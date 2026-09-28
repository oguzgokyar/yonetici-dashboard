import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
export type CanvaContentType =
  | "instagram_post"
  | "instagram_carousel"
  | "instagram_story"
  | "square_post"
  | "pinterest_pin";

export interface CanvaManifestExport {
  position: number;
  name?: string;
  path?: string;
}

export interface CanvaManifest {
  designId: string;
  editUrl: string;
  contentType: CanvaContentType;
  width: number;
  height: number;
  pageCount: number;
  exports: CanvaManifestExport[];
}

export function validateCompletionManifest(rawInput: unknown): CanvaManifest {
  if (!rawInput) {
    throw new Error("Geçersiz manifest: veri boş.");
  }

  let data = rawInput;
  if (typeof rawInput === "string") {
    try {
      data = JSON.parse(rawInput);
    } catch {
      throw new Error("Geçersiz manifest: JSON ayrıştırılamadı.");
    }
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("Geçersiz manifest: obje bekleniyor.");
  }

  const m = data as Partial<CanvaManifest>;

  const designId = (m.designId || "").trim();
  if (!designId) {
    throw new Error("Eksik veya geçersiz designId.");
  }

  const editUrl = (m.editUrl || "").trim();
  if (!editUrl || (!editUrl.startsWith("http://") && !editUrl.startsWith("https://"))) {
    throw new Error("Eksik veya geçersiz editUrl.");
  }

  const pageCount = Number(m.pageCount);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("Eksik veya geçersiz pageCount.");
  }

  const width = Number(m.width) || 1080;
  const height = Number(m.height) || 1350;
  const contentType = (m.contentType || "instagram_post") as CanvaContentType;

  if (!Array.isArray(m.exports)) {
    throw new Error("Manifest içinde exports listesi eksik.");
  }

  if (m.exports.length !== pageCount) {
    throw new Error(
      `Sayfa sayısı ile export sayısı uyuşmuyor: sayfa=${pageCount}, exports=${m.exports.length}`
    );
  }

  const exports: CanvaManifestExport[] = m.exports.map((item) => {
    const position = Number(item.position);
    if (!Number.isInteger(position) || position < 1) {
      throw new Error("Manifest export pozisyonları pozitif tamsayı olmalıdır.");
    }
    return {
      position,
      name: item.name || `slide-${String(position).padStart(2, "0")}`,
      path: item.path,
    };
  });
  const positions = exports.map((item) => item.position);
  if (new Set(positions).size !== positions.length) {
    throw new Error("Manifest export pozisyonları benzersiz olmalıdır.");
  }
  const sortedPositions = [...positions].sort((a, b) => a - b);
  if (sortedPositions.some((position, index) => position !== index + 1)) {
    throw new Error("Manifest export pozisyonları 1'den başlayarak kesintisiz olmalıdır.");
  }

  return {
    designId,
    editUrl,
    contentType,
    width,
    height,
    pageCount,
    exports,
  };
}

export interface SavedPackageAsset {
  assetId: string;
  position: number;
  mimeType: string;
  width: number;
  height: number;
  extension: string;
}

export async function saveSinglePackageAsset(params: {
  buffer: Buffer;
  assetId?: string;
  position?: number;
  assetsDir: string;
}): Promise<SavedPackageAsset> {
  const assetId = params.assetId || crypto.randomUUID();
  const position = params.position ?? 1;

  if (!params.buffer || params.buffer.length === 0) {
    throw new Error(`Asset için boş veri sağlandı (assetId: ${assetId})`);
  }

  fs.mkdirSync(params.assetsDir, { recursive: true });

  // Decode & validate through sharp
  const image = sharp(params.buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Görsel verisi çözümlenemedi veya bozuk (assetId: ${assetId})`);
  }

  const extension = "png";
  const mimeType = "image/png";
  const pngBuffer = await image.png().toBuffer();

  const tempFilePath = path.join(
    params.assetsDir,
    `.tmp-${assetId}-${Date.now()}.${extension}`
  );
  const finalFilePath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${assetId}.${extension}`);
  const metaFilePath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${assetId}.json`);

  // Write atomically
  fs.writeFileSync(tempFilePath, pngBuffer);
  fs.renameSync(tempFilePath, finalFilePath);

  fs.writeFileSync(
    metaFilePath,
    JSON.stringify({
      mimeType,
      extension,
      width: metadata.width,
      height: metadata.height,
    })
  );

  return {
    assetId,
    position,
    mimeType,
    width: metadata.width,
    height: metadata.height,
    extension,
  };
}

export function recordPackageCompletionTransaction(params: {
  database: DatabaseSync;
  jobId: string;
  projectId: string;
  manifest: CanvaManifest;
  assets: SavedPackageAsset[];
}): { packageId: string; alreadyCompleted?: boolean } {
  const db = params.database;

  // Idempotency check: if job is already complete, find packageId
  const existingJob = db
    .prepare("SELECT status, response_json FROM generation_jobs WHERE id=?")
    .get(params.jobId) as { status: string; response_json?: string } | undefined;

  if (existingJob?.status === "complete" && existingJob.response_json) {
    try {
      const parsed = JSON.parse(existingJob.response_json);
      if (parsed.packageId) {
        return { packageId: parsed.packageId, alreadyCompleted: true };
      }
    } catch {
      // ignore
    }
  }

  const now = new Date().toISOString();
  const packageId = crypto.randomUUID();
  const sortedAssets = [...params.assets].sort((a, b) => a.position - b.position);
  const coverAssetId = sortedAssets[0]?.assetId || "";
  const packageType = sortedAssets.length > 1 ? "carousel" : "single";

  const insertPackage = db.prepare(`
    INSERT INTO media_packages (
      id, project_id, generation_job_id, source, package_type, title,
      cover_asset_id, item_count, canva_design_id, canva_edit_url,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'canva', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO media_package_items (
      id, package_id, asset_id, position, mime_type, width, height, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateJob = db.prepare(`
    UPDATE generation_jobs
    SET status='complete', response_json=?, progress_json=?, completed_at=?
    WHERE id=?
  `);

  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const lockedJob = db
      .prepare("SELECT status, response_json FROM generation_jobs WHERE id=?")
      .get(params.jobId) as { status: string; response_json?: string } | undefined;
    if (lockedJob?.status === "complete") {
      const parsed = JSON.parse(lockedJob.response_json || "{}") as { packageId?: string };
      db.exec("ROLLBACK");
      transactionStarted = false;
      if (parsed.packageId) return { packageId: parsed.packageId, alreadyCompleted: true };
      throw new Error("Tamamlanmış iş için paket kimliği bulunamadı.");
    }
    insertPackage.run(
      packageId,
      params.projectId,
      params.jobId,
      packageType,
      `${packageType === "carousel" ? "Carousel" : "Görsel"} (${params.manifest.pageCount} sayfa)`,
      coverAssetId,
      sortedAssets.length,
      params.manifest.designId,
      params.manifest.editUrl,
      JSON.stringify(params.manifest),
      now,
      now
    );

    for (const asset of sortedAssets) {
      const itemId = crypto.randomUUID();
      insertItem.run(
        itemId,
        packageId,
        asset.assetId,
        asset.position,
        asset.mimeType,
        asset.width,
        asset.height,
        JSON.stringify({ extension: asset.extension }),
        now
      );
    }

    const responseJson = JSON.stringify({
      packageId,
      designId: params.manifest.designId,
      editUrl: params.manifest.editUrl,
      assets: sortedAssets.map((a) => ({
        id: a.assetId,
        url: `/api/assets/${a.assetId}`,
        mimeType: a.mimeType,
        position: a.position,
      })),
    });

    const progressJson = JSON.stringify({
      phase: "complete",
      percent: 100,
      completed: sortedAssets.length,
      total: sortedAssets.length,
      detail: "Paket hazır ve arşive kaydedildi",
      updatedAt: now,
    });

    updateJob.run(responseJson, progressJson, now, params.jobId);
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (err) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw err;
  }

  return { packageId };
}

export function deletePackageWithAssets(params: {
  database: DatabaseSync;
  packageId: string;
  projectId: string;
  assetsDir: string;
}): boolean {
  const db = params.database;

  const pkg = db
    .prepare("SELECT id FROM media_packages WHERE id=? AND project_id=?")
    .get(params.packageId, params.projectId) as { id: string } | undefined;

  if (!pkg) return false;

  const items = db
    .prepare("SELECT asset_id FROM media_package_items WHERE package_id=?")
    .all(params.packageId) as unknown as Array<{ asset_id: string }>;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM media_package_items WHERE package_id=?").run(params.packageId);
    db.prepare("DELETE FROM media_packages WHERE id=?").run(params.packageId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Delete local asset files safely
  for (const item of items) {
    if (!item.asset_id) continue;
    try {
      const metaPath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${item.asset_id}.json`);
      let ext = "png";
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { extension?: string };
          if (meta.extension) ext = meta.extension;
        } catch {
          // ignore
        }
        fs.unlinkSync(metaPath);
      }

      const imgPath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${item.asset_id}.${ext}`);
      if (fs.existsSync(/*turbopackIgnore: true*/ imgPath)) fs.unlinkSync(imgPath);

      const thumbPath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${item.asset_id}_thumb.webp`);
      if (fs.existsSync(/*turbopackIgnore: true*/ thumbPath)) fs.unlinkSync(thumbPath);
    } catch {
      // Non-blocking disk cleanup
    }
  }

  return true;
}

export interface PublishingMediaItem {
  assetId: string;
  position: number;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export function resolvePackageItemsForPublishing(params: {
  database: DatabaseSync;
  packageId: string;
  projectId: string;
  assetsDir: string;
}): PublishingMediaItem[] {
  const db = params.database;

  const pkg = db
    .prepare("SELECT id, package_type FROM media_packages WHERE id=? AND project_id=?")
    .get(params.packageId, params.projectId) as { id: string; package_type: string } | undefined;

  if (!pkg) {
    throw new Error(`Medya paketi bulunamadı (ID: ${params.packageId})`);
  }

  const items = db
    .prepare(
      "SELECT asset_id, position, mime_type FROM media_package_items WHERE package_id=? ORDER BY position ASC"
    )
    .all(params.packageId) as unknown as Array<{
    asset_id: string;
    position: number;
    mime_type?: string;
  }>;

  if (items.length === 0) {
    throw new Error(`Medya paketinde görsel bulunamadı (ID: ${params.packageId})`);
  }

  const results: PublishingMediaItem[] = [];

  for (const item of items) {
    const metaPath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${item.asset_id}.json`);
    let ext = "png";
    let mime = item.mime_type || "image/png";

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
          extension?: string;
          mimeType?: string;
        };
        if (meta.extension) ext = meta.extension;
        if (meta.mimeType) mime = meta.mimeType;
      } catch {
        // ignore
      }
    }

    const filePath = path.join(/*turbopackIgnore: true*/ params.assetsDir, `${item.asset_id}.${ext}`);
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      throw new Error(
        `Paket görsel dosyası diskte bulunamadı: ${item.asset_id}.${ext}`
      );
    }

    const buffer = fs.readFileSync(/*turbopackIgnore: true*/ filePath);
    results.push({
      assetId: item.asset_id,
      position: item.position,
      buffer,
      filename: `slide-${String(item.position).padStart(2, "0")}.${ext}`,
      mimeType: mime,
    });
  }

  return results;
}
