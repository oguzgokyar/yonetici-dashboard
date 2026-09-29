import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isCanvaStudioEnabled, getCanvaConfig } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

interface ExportVideoBody {
  durationPerSlide?: number; // e.g. 2, 3.5, 5
  animationType?: "canva" | "crossfade";
  useMagicAnimate?: boolean;
}

export async function POST(request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();

  const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const pkg = database
    .prepare("SELECT * FROM media_packages WHERE id=? AND project_id=?")
    .get(packageId, projectId) as {
      id: string;
      canva_design_id: string;
      item_count: number;
      title: string;
      video_asset_id?: string | null;
      video_url?: string | null;
    } | undefined;

  if (!pkg) {
    return Response.json({ ok: false, message: "Paket bulunamadı." }, { status: 404 });
  }

  if (!pkg.canva_design_id) {
    return Response.json({ ok: false, message: "Bu pakete ait Canva tasarım kimliği bulunamadı." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ExportVideoBody;
  const slideCount = Math.max(1, pkg.item_count || 1);
  const durationPerSlide = Math.min(10, Math.max(1.5, Number(body.durationPerSlide) || 3.5));
  const targetTotalDuration = slideCount * durationPerSlide;

  const canvaConfig = getCanvaConfig();
  const apiKey = canvaConfig.apiKey;
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");

  // 0. Optional: Apply Magic Animate via CDP if requested
  if (body.useMagicAnimate) {
    try {
      await execFileAsync("python3", [
        "/opt/data/scripts/canva_magic_animate_cdp.py",
        pkg.canva_design_id,
      ], { timeout: 35000 });
    } catch {
      // Non-fatal: if CDP automation fails or browser is closed, continue with standard export
    }
  }

  const prompt = `Call mcp__canva__export_design directly on design_id='${pkg.canva_design_id}' with format={'type':'mp4', 'quality':'horizontal_1080p'}.
Wait for export completion using mcp__canva__get_export_job or check returned download URLs.
Return the exact download URL of the exported MP4 file.`;

  try {
    // 1. Dispatch export to Hermes Agent
    const runResponse = await fetch(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "hermes-agent",
        input: prompt,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!runResponse.ok && runResponse.status !== 202) {
      throw new Error(`Hermes video export başlatılamadı (HTTP ${runResponse.status})`);
    }

    const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
    const runId = runData.run_id || runData.id;
    if (!runId) {
      throw new Error("Hermes görev kimliği (run_id) döndürmedi.");
    }

    // 2. Poll Hermes run for completed MP4 URL (up to 120s)
    let downloadUrl = "";
    const pollDeadline = Date.now() + 120000;
    while (Date.now() < pollDeadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const statusRes = await fetch(`${baseUrl}/v1/runs/${runId}`, {
        headers: {
          Accept: "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (!statusRes || !statusRes.ok) continue;

      const runStatus = (await statusRes.json().catch(() => ({}))) as {
        status?: string;
        output?: string;
        error?: string;
      };

      if (runStatus.status === "failed") {
        throw new Error(runStatus.error || "Canva video export başarısız oldu.");
      }

      if (runStatus.status === "completed" && runStatus.output) {
        const urlMatch = runStatus.output.match(/https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
        if (urlMatch) {
          downloadUrl = urlMatch[0];
          break;
        }
      }
    }

    if (!downloadUrl) {
      throw new Error("Canva MP4 render zaman aşımına uğradı veya indirme bağlantısı alınamadı.");
    }

    // 3. Download MP4 into assets
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    const rawVideoId = crypto.randomUUID();
    const rawVideoPath = path.join(assetsDir, `raw_${rawVideoId}.mp4`);
    const finalVideoId = crypto.randomUUID();
    const finalVideoPath = path.join(assetsDir, `${finalVideoId}.mp4`);
    const metaPath = path.join(assetsDir, `${finalVideoId}.json`);

    const videoResp = await fetch(downloadUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(60000),
    });

    if (!videoResp.ok) {
      throw new Error("Canva MP4 dosyası indirilemedi.");
    }

    const fileBuffer = Buffer.from(await videoResp.arrayBuffer());
    fs.writeFileSync(rawVideoPath, fileBuffer);

    // 4. Calibrate duration using FFmpeg PTS retiming (smooth & fast)
    let actualDuration = Math.round(targetTotalDuration);
    let videoWidth = 1080;
    let videoHeight = 1350;

    try {
      // Probe raw video duration & dimensions
      const { stdout: probeOut } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "stream=width,height,duration",
        "-of", "json",
        rawVideoPath,
      ]);
      const probeData = JSON.parse(probeOut || "{}") as {
        streams?: Array<{ width?: number; height?: number; duration?: string }>;
      };
      const stream = probeData.streams?.[0];
      const rawDur = parseFloat(stream?.duration || "0") || 30.0;
      videoWidth = stream?.width || 1080;
      videoHeight = stream?.height || 1350;

      // PTS scaling factor = targetTotalDuration / rawDur
      const speedFactor = targetTotalDuration / rawDur;

      // Apply PTS filter to retune playback speed cleanly without quality loss
      await execFileAsync("ffmpeg", [
        "-y",
        "-i", rawVideoPath,
        "-filter:v", `setpts=${speedFactor.toFixed(4)}*PTS`,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-an",
        finalVideoPath,
      ]);

      actualDuration = Math.round(targetTotalDuration);
    } catch {
      // Fallback: move raw video directly
      fs.copyFileSync(rawVideoPath, finalVideoPath);
    } finally {
      try { fs.unlinkSync(rawVideoPath); } catch {}
    }

    // 5. Write metadata JSON
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        mimeType: "video/mp4",
        extension: "mp4",
        width: videoWidth,
        height: videoHeight,
        duration: actualDuration,
        source: "canva_video_export",
        createdAt: new Date().toISOString(),
      })
    );

    const videoUrl = `/api/assets/${finalVideoId}`;

    // 6. Update database
    database
      .prepare(
        "UPDATE media_packages SET video_asset_id=?, video_url=?, video_duration=?, updated_at=? WHERE id=?"
      )
      .run(finalVideoId, videoUrl, actualDuration, new Date().toISOString(), packageId);

    return Response.json({
      ok: true,
      packageId,
      videoAssetId: finalVideoId,
      videoUrl,
      duration: actualDuration,
      message: "Canva videosu başarıyla oluşturuldu.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: errorMsg }, { status: 500 });
  }
}
