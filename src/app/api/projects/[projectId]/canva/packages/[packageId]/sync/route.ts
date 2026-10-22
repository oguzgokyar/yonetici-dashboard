import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import sharp from "sharp";
import { isCanvaStudioEnabled, getCanvaConfig } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { saveSinglePackageAsset } from "@/lib/server/canva-package-service";
import { exportPackageVideoHelper } from "@/lib/server/canva-video-service";

import {
  getNextAvailableCanvaAccount,
  markCanvaAccountExhausted,
  recordCanvaAccountSuccess,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

async function fetchCanvaExportUrls(
  designId: string,
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const bridgeEndpoints = [
    { host: "10.0.1.1", port: 8080 },
    { host: "10.0.7.1", port: 8080 },
    { host: "127.0.0.1", port: 8080 },
  ];

  // Try up to 3 accounts from the pool with automatic failover
  for (let attempt = 0; attempt < 3; attempt++) {
    const activeAcc = getNextAvailableCanvaAccount();
    const payload = JSON.stringify({
      design_id: designId,
      format: { type: "png" },
      account_id: activeAcc?.id,
      token_json: activeAcc?.tokenJson,
    });

    let tryNextAccount = false;

    for (const ep of bridgeEndpoints) {
      try {
        const data = await new Promise<{
          ok?: boolean;
          urls?: string[];
          is_quota_fallback?: boolean;
          fallback?: string;
          error?: string;
        } | null>((resolve) => {
          const req = http.request(
            {
              hostname: ep.host,
              port: ep.port,
              path: "/api/internal/canva/export",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                Connection: "close",
              },
              timeout: 60000,
            },
            (res) => {
              let body = "";
              res.setEncoding("utf8");
              res.on("data", (chunk) => { body += chunk; });
              res.on("end", () => {
                try { resolve(JSON.parse(body)); } catch { resolve(null); }
              });
            }
          );
          req.on("error", () => resolve(null));
          req.on("timeout", () => { req.destroy(); resolve(null); });
          req.write(payload);
          req.end();
        });

        if (data && data.ok && Array.isArray(data.urls) && data.urls.length > 0) {
          if (activeAcc) recordCanvaAccountSuccess(activeAcc.id);
          return data.urls;
        }

        if (data && ((data as { code?: string }).code === "quota_exceeded" || (data.error && data.error.includes("Too many daily export requests")))) {
          if (activeAcc) {
            markCanvaAccountExhausted(activeAcc.id, "Too many daily export requests for user");
          }
          const nextAcc = getNextAvailableCanvaAccount();
          if (nextAcc && nextAcc.id !== activeAcc?.id) {
            tryNextAccount = true;
            break;
          }
        }
      } catch {
        // Continue to next bridge or fallback
      }
    }

    if (!tryNextAccount) break;
  }

  // 2. Fallback: Dispatch to Hermes Agent via /v1/runs with export-design prompt
  const exportPrompt = `Call mcp__canva__export_design on design_id='${designId}' with format={'type':'png'}. Return the JSON object containing urls.`;
  const runResponse = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: "hermes-agent",
      input: exportPrompt,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!runResponse.ok && runResponse.status !== 202) {
    throw new Error(`Hermes ile Canva export başlatılamadı (HTTP ${runResponse.status})`);
  }

  const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
  const runId = runData.run_id || runData.id;
  if (!runId) throw new Error("Hermes run_id döndürmedi.");

  let exportJsonStr = "";
  const pollDeadline = Date.now() + 90000;
  while (Date.now() < pollDeadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(`${baseUrl}/v1/runs/${runId}`, {
      headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    }).catch(() => null);

    if (!res || !res.ok) continue;
    const statusData = (await res.json().catch(() => ({}))) as {
      status?: string;
      output?: string;
      error?: string;
    };
    if (statusData.status === "failed") throw new Error(statusData.error || "Canva export alınamadı.");
    if (statusData.status === "completed" && statusData.output) {
      exportJsonStr = statusData.output;
      break;
    }
  }

  if (!exportJsonStr) throw new Error("Canva export zaman aşımına uğradı.");

  const urlMatches = Array.from(
    exportJsonStr.matchAll(/https:\/\/export-download\.canva\.com\/[^\s"',\]}]+/g)
  ).map((m) => m[0]);

  if (urlMatches.length > 0) {
    return urlMatches;
  }

  try {
    const parsed = JSON.parse(exportJsonStr);
    const urls = parsed.urls || parsed.content?.[0]?.job?.urls || parsed.job?.urls;
    if (Array.isArray(urls) && urls.length > 0) return urls;
  } catch {
    // ignore
  }

  throw new Error("Canva export görsel bağlantıları ayrıştırılamadı.");
}

export async function POST(_request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();

  const pkg = database
    .prepare("SELECT * FROM media_packages WHERE id=? AND project_id=?")
    .get(packageId, projectId) as {
      id: string;
      project_id: string;
      generation_job_id: string;
      package_type: string;
      title: string;
      cover_asset_id: string;
      item_count: number;
      canva_design_id: string;
      video_asset_id?: string | null;
      video_duration?: number | null;
    } | undefined;

  if (!pkg) {
    return Response.json({ ok: false, message: "Paket bulunamadı." }, { status: 404 });
  }

  const designId = pkg.canva_design_id;
  if (!designId) {
    return Response.json(
      { ok: false, message: "Bu pakete ait Canva tasarım kimliği bulunamadı." },
      { status: 400 }
    );
  }

  const canvaConfig = getCanvaConfig();
  const apiKey = canvaConfig.apiKey;
  const baseUrl = canvaConfig.baseUrl.replace(/\/+$/, "");
  const assetsDir = path.join(process.cwd(), ".data", "assets");

  // IMMEDIATELY mark package as syncing / video as rendering in database before long network operations
  const now = new Date().toISOString();
  database
    .prepare("UPDATE media_packages SET video_status='rendering', updated_at=? WHERE id=?")
    .run(now, packageId);

  // Üretim Listesinde (Production Queue) canlı takip edilebilmesi için iş kaydı oluştur
  const jobId = crypto.randomUUID();
  database.prepare(`
    INSERT INTO generation_jobs (
      id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
    ) VALUES (?, ?, 'canva', 'canva-mcp', 'canva-mcp-sync', 'running', ?, ?, ?, ?)
  `).run(
    jobId,
    projectId,
    `${pkg.title || 'Canva Tasarımı'} — 🔄 Canva Eşitleme`,
    JSON.stringify({ packageId, mode: 'canva_mcp_sync' }),
    JSON.stringify({ phase: 'exporting', percent: 30, detail: 'Canva bulutundan güncel sayfalar alınıyor...' }),
    now
  );

  try {
    // 1. Fetch fresh master PNG export URLs directly from Canva Connect API
    const exportUrls = await fetchCanvaExportUrls(designId, baseUrl, apiKey);

    if (!exportUrls.length) {
      throw new Error("Canva'dan dışa aktarma bağlantıları alınamadı.");
    }

    // 2. Download and overwrite existing slide images with fresh master renders
    const existingItems = database
      .prepare("SELECT id, asset_id, position FROM media_package_items WHERE package_id=? ORDER BY position ASC")
      .all(packageId) as Array<{ id: string; asset_id: string; position: number }>;

    let newCoverAssetId = pkg.cover_asset_id;

    for (let i = 0; i < exportUrls.length; i++) {
      const slideUrl = exportUrls[i];
      const imgRes = await fetch(slideUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!imgRes.ok) {
        throw new Error(`Slayt ${i + 1} indirilemedi (HTTP ${imgRes.status})`);
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const position = i + 1;

      // If item already exists at this position, save or update
      const existing = existingItems.find((it) => it.position === position);
      if (existing) {
        // Overwrite file directly with master resolution
        const filePath = path.join(assetsDir, `${existing.asset_id}.png`);
        fs.writeFileSync(filePath, buffer);

        // Update JSON metadata file
        try {
          const meta = await sharp(buffer).metadata();
          fs.writeFileSync(
            path.join(assetsDir, `${existing.asset_id}.json`),
            JSON.stringify({ mimeType: "image/png", extension: "png", width: meta.width || 1080, height: meta.height || 1350 })
          );
        } catch {}

        // WebP önbelleklerini anında ve senkron yeniden üret
        try {
          const [previewBytes, thumbBytes] = await Promise.all([
            sharp(buffer)
              .resize(720, null, { withoutEnlargement: true })
              .webp({ quality: 85 })
              .toBuffer(),
            sharp(buffer)
              .resize(360, null, { withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer(),
          ]);
          fs.writeFileSync(path.join(assetsDir, `${existing.asset_id}_preview.webp`), previewBytes);
          fs.writeFileSync(path.join(assetsDir, `${existing.asset_id}_thumb.webp`), thumbBytes);
        } catch {
          try { fs.unlinkSync(path.join(assetsDir, `${existing.asset_id}_thumb.webp`)); } catch {}
          try { fs.unlinkSync(path.join(assetsDir, `${existing.asset_id}_preview.webp`)); } catch {}
        }
      } else {
        // Add new slide
        const saved = await saveSinglePackageAsset({ buffer, position, assetsDir });
        const itemId = crypto.randomUUID();
        database
          .prepare(
            "INSERT INTO media_package_items (id, package_id, asset_id, position, mime_type, width, height, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .run(itemId, packageId, saved.assetId, position, saved.mimeType, saved.width, saved.height, "{}", new Date().toISOString());

        if (position === 1) {
          newCoverAssetId = saved.assetId;
        }
      }

      if (position === 1 && existing) {
        newCoverAssetId = existing.asset_id;
      }
    }

    // 3. Remove orphaned slides if slide count decreased in Canva
    const newPositions = new Set(Array.from({ length: exportUrls.length }, (_, i) => i + 1));
    for (const oldItem of existingItems) {
      if (!newPositions.has(oldItem.position)) {
        // Delete all asset files for orphaned slide
        for (const ext of [".png", ".json", "_thumb.webp", "_preview.webp"]) {
          try {
            const p = path.join(assetsDir, `${oldItem.asset_id}${ext}`);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch {}
        }
        // Remove from database
        database.prepare("DELETE FROM media_package_items WHERE id=?").run(oldItem.id);
      }
    }

    // Update package count & timestamp
    database
      .prepare("UPDATE media_packages SET item_count=?, cover_asset_id=?, updated_at=? WHERE id=?")
      .run(exportUrls.length, newCoverAssetId, new Date().toISOString(), packageId);

    // 5. If package has a video or is a video package, re-export from Canva Cloud
    let videoUpdated = false;
    const oldVideoAssetId = pkg.video_asset_id;

    if (oldVideoAssetId || pkg.package_type === "video") {
      try {
        const durationPerSlide = pkg.video_duration && exportUrls.length > 0
          ? Math.min(10, Math.max(1.5, pkg.video_duration / exportUrls.length))
          : 3.5;

        const videoRes = await exportPackageVideoHelper({
          database,
          packageId,
          projectId,
          designId,
          slideCount: exportUrls.length,
          durationPerSlide,
          useMagicAnimate: false,
        });

        if (oldVideoAssetId && videoRes.videoAssetId && oldVideoAssetId !== videoRes.videoAssetId) {
          for (const ext of [".mp4", ".json", "_thumb.webp", "_preview.webp"]) {
            try {
              const oldFile = path.join(assetsDir, `${oldVideoAssetId}${ext}`);
              if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            } catch {}
          }
          try {
            const oldThumb = path.join(process.cwd(), ".data", "video-thumbs", `${oldVideoAssetId}.webp`);
            if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
          } catch {}
        }

        videoUpdated = true;
      } catch (videoErr) {
        console.error("[Sync Video Error]:", videoErr);
      }
    }

    // If not a video package, reset status to idle
    if (!pkg.video_asset_id && pkg.package_type !== "video") {
      database
        .prepare("UPDATE media_packages SET video_status='idle' WHERE id=?")
        .run(packageId);
    }

    // Üretim Listesindeki iş kaydını tamamlandıya geçir
    const syncFinishNow = new Date().toISOString();
    database
      .prepare("UPDATE generation_jobs SET status='complete', progress_json=?, completed_at=? WHERE id=?")
      .run(
        JSON.stringify({ phase: "complete", percent: 100, detail: `Canva'dan ${exportUrls.length} sayfa başarıyla eşitlendi` }),
        syncFinishNow,
        jobId
      );

    return Response.json({
      ok: true,
      message: videoUpdated
        ? "Tasarım ve video Canva'dan başarıyla güncellendi."
        : `Canva'daki son değişiklikler (${exportUrls.length} sayfa) başarıyla güncellendi.`,
      itemCount: exportUrls.length,
      videoUpdated,
    });
  } catch (err: unknown) {
    const syncErrNow = new Date().toISOString();
    database
      .prepare("UPDATE media_packages SET video_status='idle' WHERE id=?")
      .run(packageId);
    const errorMsg = err instanceof Error ? err.message : String(err);
    database
      .prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?")
      .run(errorMsg.slice(0, 500), syncErrNow, jobId);
    return Response.json({ ok: false, message: errorMsg }, { status: 500 });
  }
}
