import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import { getCanvaConfig } from "@/lib/server/canva-config";
import { acquireHeavyJob, releaseHeavyJob } from "@/lib/server/heavy-job-coordinator";

const execFileAsync = promisify(execFile);

export interface ExportPackageVideoParams {
  database: DatabaseSync;
  packageId: string;
  projectId: string;
  designId?: string;
  slideCount?: number;
  durationPerSlide?: number;
  useMagicAnimate?: boolean;
  coordinationJobId?: string;
}

export interface ExportPackageVideoResult {
  ok: boolean;
  packageId: string;
  videoAssetId?: string;
  videoUrl?: string;
  duration?: number;
  message?: string;
}

export async function exportPackageVideoHelper(
  params: ExportPackageVideoParams
): Promise<ExportPackageVideoResult> {
  const jobId = params.coordinationJobId || `canva-video:${params.packageId}`;
  const claimId = `dashboard-export:${crypto.randomUUID()}`;
  await acquireHeavyJob(jobId, claimId);
  const phase = { remoteMayBeRunning: false };
  try {
    return await exportPackageVideoUnderClaim({...params, coordinationJobId: jobId}, phase);
  } finally {
    // Release local failures, but never guess that a dispatched run has stopped.
    if (!phase.remoteMayBeRunning) await releaseHeavyJob(jobId, claimId);
  }
}

async function fetchCanvaVideoExportUrl(
  designId: string,
  baseUrl: string,
  apiKey: string
): Promise<string> {
  // 1. Try host bridge first for ultra-fast (3-5s) direct Canva Cloud MP4 export
  const bridgeUrls = [
    "http://10.0.1.1:8080/api/internal/canva/export-video",
    "http://127.0.0.1:8080/api/internal/canva/export-video",
    "http://10.0.1.8:8080/api/internal/canva/export-video",
  ];

  for (const bUrl of bridgeUrls) {
    try {
      const res = await fetch(bUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_id: designId, quality: "horizontal_1080p" }),
        signal: AbortSignal.timeout(90000),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          download_url?: string;
        };
        if (data.ok && data.download_url) {
          return data.download_url;
        }
      }
    } catch {
      // Continue to next bridge or fallback
    }
  }

  // 2. Fallback: Dispatch directly to Hermes Agent via /v1/runs with mcp__canva__export_design MP4
  const prompt = `Call mcp__canva__export_design on design_id='${designId}' with format={'type':'mp4', 'quality':'horizontal_1080p'}.\nReturn the exact download URL of the exported MP4 file.`;
  const runUrl = `${baseUrl}/v1/runs`;
  const runResponse = await fetch(runUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: "hermes-agent", input: prompt }),
    signal: AbortSignal.timeout(15000),
  });

  if (!runResponse.ok && runResponse.status !== 202) {
    throw new Error(`Hermes video export başlatılamadı (HTTP ${runResponse.status})`);
  }

  const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
  const runId = runData.run_id || runData.id;
  if (!runId) throw new Error("Hermes görev kimliği (run_id) döndürmedi.");

  const pollDeadline = Date.now() + 120000;
  while (Date.now() < pollDeadline) {
    await new Promise((r) => setTimeout(r, 3000));
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

    if (["failed", "cancelled", "canceled"].includes(runStatus.status || "")) {
      throw new Error(runStatus.error || "Canva video export başarısız oldu.");
    }

    if (runStatus.status === "completed") {
      if (runStatus.output) {
        const urlMatch = runStatus.output.match(/https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
        if (urlMatch) return urlMatch[0];
      }
      const rawErr = (runStatus.output || runStatus.error || "").trim();
      throw new Error(rawErr || "Canva video çıktısı üretilemedi.");
    }
  }

  throw new Error("Canva MP4 render zaman aşımına uğradı veya indirme bağlantısı alınamadı.");
}

async function exportPackageVideoUnderClaim(
  params: ExportPackageVideoParams,
  phase: { remoteMayBeRunning: boolean },
): Promise<ExportPackageVideoResult> {
  const { database, packageId, projectId } = params;

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
    throw new Error("Paket bulunamadı.");
  }

  const designId = params.designId || pkg.canva_design_id;
  if (!designId) {
    throw new Error("Bu pakete ait Canva tasarım kimliği bulunamadı.");
  }

  const slideCount = Math.max(1, params.slideCount || pkg.item_count || 1);
  const durationPerSlide = Math.min(10, Math.max(1.5, Number(params.durationPerSlide) || 3.5));
  const targetTotalDuration = slideCount * durationPerSlide;

  // Set video_status = 'rendering' at start
  database
    .prepare("UPDATE media_packages SET video_status='rendering', updated_at=? WHERE id=?")
    .run(new Date().toISOString(), packageId);

  const canvaConfig = getCanvaConfig();
  const apiKey = canvaConfig.apiKey;
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");

  try {
    // 1. Fetch direct MP4 download URL from Canva Cloud via host bridge or Canva MCP
    phase.remoteMayBeRunning = true;
    const downloadUrl = await fetchCanvaVideoExportUrl(designId, baseUrl, apiKey);
    phase.remoteMayBeRunning = false;

    // 2. Download MP4 into assets
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    const rawVideoId = crypto.randomUUID();
    const rawVideoPath = path.join(assetsDir, `raw_${rawVideoId}.mp4`);
    const finalVideoId = crypto.randomUUID();
    const finalVideoPath = path.join(assetsDir, `${finalVideoId}.mp4`);
    const metaPath = path.join(assetsDir, `${finalVideoId}.json`);

    const dlRes = await fetch(downloadUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(60000),
    });

    if (!dlRes.ok) {
      throw new Error(`Canva MP4 dosyası indirilemedi (HTTP ${dlRes.status})`);
    }

    const videoBuffer = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(rawVideoPath, videoBuffer);

    // 3. Retime video PTS via FFmpeg to match requested durationPerSlide * slideCount
    let actualDuration = targetTotalDuration;
    try {
      const ffprobeOut = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        rawVideoPath,
      ]);
      const rawDur = parseFloat(ffprobeOut.stdout.trim());
      if (rawDur > 0 && Math.abs(rawDur - targetTotalDuration) > 0.5) {
        const speedFactor = targetTotalDuration / rawDur;
        await execFileAsync("ffmpeg", [
          "-y",
          "-i",
          rawVideoPath,
          "-filter:v",
          `setpts=${speedFactor.toFixed(4)}*PTS`,
          "-an",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          finalVideoPath,
        ]);
        try {
          fs.unlinkSync(rawVideoPath);
        } catch {}
      } else {
        fs.renameSync(rawVideoPath, finalVideoPath);
        actualDuration = rawDur > 0 ? Math.round(rawDur) : targetTotalDuration;
      }
    } catch {
      if (fs.existsSync(rawVideoPath) && !fs.existsSync(finalVideoPath)) {
        fs.renameSync(rawVideoPath, finalVideoPath);
      }
    }

    const { width: videoWidth, height: videoHeight } = await getMediaDimensions(finalVideoPath);

    // 4. Write metadata JSON
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

    // 5. Physically delete old video files from disk (zero-waste)
    const oldVideoId = pkg.video_asset_id;
    if (oldVideoId && oldVideoId !== finalVideoId) {
      for (const ext of [".mp4", ".json", "_thumb.webp", "_preview.webp"]) {
        try {
          const oldFile = path.join(assetsDir, `${oldVideoId}${ext}`);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        } catch {}
      }
      try {
        const oldThumb = path.join(process.cwd(), ".data", "video-thumbs", `${oldVideoId}.webp`);
        if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
      } catch {}
    }

    const videoUrl = `/api/assets/${finalVideoId}`;

    // 6. Update database
    const nowIso = new Date().toISOString();
    database
      .prepare(
        "UPDATE media_packages SET video_asset_id=?, video_url=?, video_duration=?, video_status='ready', updated_at=? WHERE id=?"
      )
      .run(finalVideoId, videoUrl, actualDuration, nowIso, packageId);

    // If an active generation job exists for this export, mark it complete
    try {
      database
        .prepare(
          "UPDATE generation_jobs SET status='complete', completed_at=?, progress_json=? WHERE (id=? OR prompt LIKE ?) AND status NOT IN ('complete', 'failed')"
        )
        .run(
          nowIso,
          JSON.stringify({
            phase: "complete",
            percent: 100,
            detail: "Canva videosu hazır ve arşive eklendi",
            updatedAt: nowIso,
          }),
          params.coordinationJobId || "",
          `%${packageId}%`
        );
    } catch {}

    return {
      ok: true,
      packageId,
      videoAssetId: finalVideoId,
      videoUrl,
      duration: actualDuration,
      message: "Canva videosu başarıyla oluşturuldu.",
    };
  } catch (err) {
    try {
      database
        .prepare("UPDATE media_packages SET video_status='failed', updated_at=? WHERE id=?")
        .run(new Date().toISOString(), packageId);
    } catch {}
    throw err;
  }
}

async function getMediaDimensions(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const ffprobeOut = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      filePath,
    ]);
    const [w, h] = ffprobeOut.stdout.trim().split("x").map(Number);
    if (w && h) return { width: w, height: h };
  } catch {}
  return { width: 1080, height: 1920 };
}
