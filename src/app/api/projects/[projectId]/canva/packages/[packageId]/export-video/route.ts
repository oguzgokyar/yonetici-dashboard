import crypto from "node:crypto";
import { isCanvaStudioEnabled } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";

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
    .prepare("SELECT id, title, canva_design_id, item_count, cover_asset_id FROM media_packages WHERE id=? AND project_id=?")
    .get(packageId, projectId) as {
      id: string;
      title: string;
      canva_design_id: string;
      item_count: number;
      cover_asset_id?: string | null;
    } | undefined;

  if (!pkg) {
    return Response.json({ ok: false, message: "Paket bulunamadı." }, { status: 404 });
  }

  if (!pkg.canva_design_id) {
    return Response.json({ ok: false, message: "Bu pakete ait Canva tasarım kimliği bulunamadı." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ExportVideoBody;
  const durationPerSlide = Math.min(10, Math.max(1.5, Number(body.durationPerSlide) || 3.5));
  const useMagicAnimate = body.useMagicAnimate ?? true;

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1. Mark package as rendering immediately so UI reflects status
  database
    .prepare("UPDATE media_packages SET video_status='rendering', updated_at=? WHERE id=?")
    .run(now, packageId);

  // 2. Insert job into generation_jobs so it appears in Production Queue
  const promptLabel = `${pkg.title || "Canva Karosel"} — Videoya Dönüştürme (${pkg.item_count || 1} Slayt × ${durationPerSlide} sn)`;
  const requestState = {
    mode: "canva_video_export",
    contentType: "reels_video",
    packageId,
    designId: pkg.canva_design_id,
    slideCount: pkg.item_count || 1,
    durationPerSlide,
    useMagicAnimate: false,
    coverAssetId: pkg.cover_asset_id || null,
  };
  const progressState = {
    phase: "queued",
    percent: 15,
    detail: "Canva Cloud MP4 video render kuyruğa alındı...",
    updatedAt: now,
  };

  database
    .prepare(
      `INSERT INTO generation_jobs (
        id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
      ) VALUES (?, ?, 'canva', 'hermes-canva', 'canva-magic-video', 'queued', ?, ?, ?, ?)`
    )
    .run(
      jobId,
      projectId,
      promptLabel,
      JSON.stringify(requestState),
      JSON.stringify(progressState),
      now
    );

  // 3. Trigger background worker and return immediately
  triggerProductionWorker();

  return Response.json(
    {
      ok: true,
      queued: true,
      jobId,
      packageId,
      message: "Video dönüştürme görevi üretim listesine eklendi.",
    },
    { status: 202 }
  );
}
