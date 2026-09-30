import path from "node:path";
import fs from "node:fs";
import { isCanvaStudioEnabled, getCanvaConfig } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { saveSinglePackageAsset } from "@/lib/server/canva-package-service";
import { exportPackageVideoHelper } from "@/lib/server/canva-video-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

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

  try {
    // 1. Fetch updated pages & thumbnails from Canva via Hermes
    const pagesPrompt = `Call mcp__canva__get_design_pages directly on design_id='${designId}'. Return the raw JSON result.`;
    const runResponse = await fetch(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "hermes-agent",
        input: pagesPrompt,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!runResponse.ok && runResponse.status !== 202) {
      throw new Error(`Hermes ile Canva sayfaları sorgulanamadı (HTTP ${runResponse.status})`);
    }

    const runData = (await runResponse.json().catch(() => ({}))) as { run_id?: string; id?: string };
    const runId = runData.run_id || runData.id;
    if (!runId) throw new Error("Hermes run_id döndürmedi.");

    let pagesJsonStr = "";
    const pollDeadline = Date.now() + 60000;
    while (Date.now() < pollDeadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const res = await fetch(`${baseUrl}/v1/runs/${runId}`, {
        headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      }).catch(() => null);

      if (!res || !res.ok) continue;
      const statusData = (await res.json().catch(() => ({}))) as { status?: string; output?: string; error?: string };
      if (statusData.status === "failed") throw new Error(statusData.error || "Canva sayfaları alınamadı.");
      if (statusData.status === "completed" && statusData.output) {
        pagesJsonStr = statusData.output;
        break;
      }
    }

    if (!pagesJsonStr) throw new Error("Canva sayfaları zaman aşımına uğradı.");

    // Parse items array
    let itemsList: Array<{ index?: number; thumbnail?: { url?: string }; dimensions?: { width?: number; height?: number } }> = [];
    try {
      const match = pagesJsonStr.match(/\{[\s\S]*"items"[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        itemsList = parsed.items || [];
      }
    } catch {
      // fallback
    }

    if (!itemsList.length) {
      throw new Error("Canva tasarım sayfaları ayrıştırılamadı.");
    }

    // 2. Download and overwrite existing slide images
    const existingItems = database
      .prepare("SELECT id, asset_id, position FROM media_package_items WHERE package_id=? ORDER BY position ASC")
      .all(packageId) as Array<{ id: string; asset_id: string; position: number }>;

    let newCoverAssetId = pkg.cover_asset_id;

    for (let i = 0; i < itemsList.length; i++) {
      const page = itemsList[i];
      const thumbUrl = page.thumbnail?.url;
      if (!thumbUrl) continue;

      const imgRes = await fetch(thumbUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!imgRes.ok) continue;

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const position = i + 1;

      // If item already exists at this position, save or update
      const existing = existingItems.find((it) => it.position === position);
      if (existing) {
        // Overwrite file directly
        const filePath = path.join(assetsDir, `${existing.asset_id}.png`);
        fs.writeFileSync(filePath, buffer);
        // Clear webp caches
        try { fs.unlinkSync(path.join(assetsDir, `${existing.asset_id}_thumb.webp`)); } catch {}
        try { fs.unlinkSync(path.join(assetsDir, `${existing.asset_id}_preview.webp`)); } catch {}
      } else {
        // Add new slide
        const saved = await saveSinglePackageAsset({ buffer, position, assetsDir });
        const itemId = crypto.randomUUID();
        database
          .prepare(
            "INSERT INTO media_package_items (id, package_id, asset_id, position, mime_type, width, height, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .run(itemId, packageId, saved.assetId, position, saved.mimeType, saved.width, saved.height, "{}", new Date().toISOString());
      }

      if (position === 1 && existing) {
        newCoverAssetId = existing.asset_id;
      }
    }

    // Update package count & timestamp
    database
      .prepare("UPDATE media_packages SET item_count=?, cover_asset_id=?, updated_at=? WHERE id=?")
      .run(itemsList.length, newCoverAssetId, new Date().toISOString(), packageId);

    // 3. If package has a video or is a video package, re-export the video with Magic Animate
    let videoUpdated = false;
    if (pkg.video_asset_id || pkg.package_type === "video") {
      try {
        await exportPackageVideoHelper({
          database,
          packageId,
          projectId,
          designId,
          slideCount: itemsList.length,
          durationPerSlide: 3.5,
          useMagicAnimate: true,
        });
        videoUpdated = true;
      } catch (videoErr) {
        console.error("[Sync Video Error]:", videoErr);
      }
    }

    return Response.json({
      ok: true,
      message: videoUpdated
        ? "Tasarım ve video Canva'dan başarıyla güncellendi."
        : "Tasarım slaytları Canva'dan başarıyla güncellendi.",
      itemCount: itemsList.length,
      videoUpdated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: errorMsg }, { status: 500 });
  }
}
