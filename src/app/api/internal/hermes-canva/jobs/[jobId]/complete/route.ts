import fs from "node:fs";
import path from "node:path";
import { createJobCallbackToken, getCanvaConfig, verifyCallbackToken } from "@/lib/server/canva-config";
import {
  recordPackageCompletionTransaction,
  saveSinglePackageAsset,
  validateCompletionManifest,
} from "@/lib/server/canva-package-service";
import { getDatabase } from "@/lib/server/database";
import { validateManifestAgainstJob } from "@/lib/server/hermes-canva-task";

export const runtime = "nodejs";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const authHeader = request.headers.get("authorization");
  const { callbackToken } = getCanvaConfig();

  const { jobId } = await context.params;
  if (!verifyCallbackToken(authHeader, createJobCallbackToken(callbackToken, jobId))) {
    return Response.json({ ok: false, message: "Yetkisiz erişim." }, { status: 401 });
  }
  const database = getDatabase();

  const job = database
    .prepare("SELECT id, project_id, status, request_json FROM generation_jobs WHERE id=? AND type='canva'")
    .get(jobId) as { id: string; project_id: string; status: string; request_json: string } | undefined;

  if (!job) {
    return Response.json({ ok: false, message: "İş bulunamadı." }, { status: 404 });
  }

  if (job.status === "complete") {
    return Response.json({ ok: true, alreadyCompleted: true });
  }

  // Guard against oversize payloads before reading formData
  const contentLength = Number(request.headers.get("content-length") || 0);
  const MAX_BYTES = 60 * 1024 * 1024; // 60 MB upper bound for 10 full-size PNG slides
  if (contentLength > MAX_BYTES) {
    return Response.json({ ok: false, message: "Payload çok büyük." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "Multipart/form-data ayrıştırılamadı." }, { status: 400 });
  }

  const manifestRaw = formData.get("manifest");
  if (!manifestRaw || typeof manifestRaw !== "string") {
    return Response.json({ ok: false, message: "Manifest JSON alanı zorunludur." }, { status: 400 });
  }

  let manifest;
  try {
    manifest = validateCompletionManifest(manifestRaw);
    const jobRequest = JSON.parse(job.request_json || "{}") as {
      contentType?: "instagram_post" | "instagram_carousel" | "instagram_story" | "square_post" | "pinterest_pin";
      slideCount?: number;
      width?: number;
      height?: number;
    };
    if (!jobRequest.contentType || !jobRequest.slideCount || !jobRequest.width || !jobRequest.height) {
      throw new Error("Üretim işi beklenen manifest bilgilerini içermiyor.");
    }
    validateManifestAgainstJob(manifest, {
      contentType: jobRequest.contentType,
      slideCount: jobRequest.slideCount,
      width: jobRequest.width,
      height: jobRequest.height,
    });
  } catch (manifestErr) {
    const msg = manifestErr instanceof Error ? manifestErr.message : "Geçersiz manifest.";
    return Response.json({ ok: false, message: msg }, { status: 400 });
  }

  const assetsDir = path.join(process.cwd(), ".data", "assets");
  const savedAssets = [];

  try {
    for (const exp of manifest.exports) {
      const candidates = [
        exp.name || "",
        `slide-${String(exp.position).padStart(2, "0")}`,
        `slide-${exp.position}`,
        String(exp.position),
        `slide_${exp.position}`,
      ].filter(Boolean);

      let foundEntry: FormDataEntryValue | null = null;
      for (const key of candidates) {
        const val = formData.get(key);
        if (val && typeof val === "object" && "arrayBuffer" in val) {
          foundEntry = val;
          break;
        }
      }

      if (!foundEntry || typeof foundEntry !== "object" || !("arrayBuffer" in foundEntry)) {
        throw new Error(`Eksik export dosyası: ${exp.name || `slide-${exp.position}`}`);
      }

      const fileBuffer = Buffer.from(await (foundEntry as Blob).arrayBuffer());
      const saved = await saveSinglePackageAsset({
        buffer: fileBuffer,
        position: exp.position,
        assetsDir,
      });
      if (saved.width !== manifest.width || saved.height !== manifest.height) {
        throw new Error(
          `Export boyutu beklenen ${manifest.width}x${manifest.height} yerine ${saved.width}x${saved.height}.`,
        );
      }
      savedAssets.push(saved);
    }

    const { packageId } = recordPackageCompletionTransaction({
      database,
      jobId,
      projectId: job.project_id,
      manifest,
      assets: savedAssets,
    });

    return Response.json({ ok: true, packageId });
  } catch (err) {
    for (const asset of savedAssets) {
      for (const suffix of [`.${asset.extension}`, ".json", "_thumb.webp"]) {
        try {
          const filePath = path.join(assetsDir, `${asset.assetId}${suffix}`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {
          // Best-effort rollback of files written before transaction failure.
        }
      }
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    database
      .prepare("UPDATE generation_jobs SET status='failed', error=? WHERE id=?")
      .run(`Paket kaydetme hatası: ${errMsg}`, jobId);

    return Response.json({ ok: false, message: errMsg }, { status: 500 });
  }
}
