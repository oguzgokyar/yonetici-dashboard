import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export interface ProductionQueueItem {
  id: string;
  projectId: string;
  type: "canva" | "image" | "video" | "video-layer" | "other";
  typeLabel: string;
  status: "queued" | "dispatching" | "running" | "rendering" | "exporting" | "uploading" | "complete" | "failed";
  prompt: string;
  model: string;
  progressPercent: number;
  progressDetail: string;
  phase: string;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  previewUrl?: string | null;
  canvaEditUrl?: string | null;
  itemCount?: number;
}

type RequestData = { contentType?: string; prompt?: string };
type ResponseData = { assets?: Array<{ url?: string }>; videoUrl?: string };
type PackageData = {
  id?: string;
  generation_job_id?: string;
  title?: string;
  cover_asset_id?: string;
  item_count?: number;
  canva_edit_url?: string;
  video_url?: string;
};

type DbJobRow = {
  id: string;
  project_id: string;
  type: "canva" | "image" | "video" | "video-layer" | "other";
  provider: string;
  model: string;
  status: "queued" | "dispatching" | "running" | "rendering" | "exporting" | "uploading" | "complete" | "failed";
  prompt: string;
  request_json: string;
  response_json: string;
  progress_json: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

function resolveTypeLabel(type: string, requestData: RequestData): string {
  if (type === "canva") {
    const cType = requestData?.contentType || "";
    if (cType.includes("carousel")) return "Canva Karosel";
    if (cType.includes("story")) return "Canva Story";
    if (cType.includes("video") || cType.includes("reels")) return "Canva Video";
    return "Canva Tasarım";
  }
  if (type === "image") return "AI Görsel";
  if (type === "video") return "Motion Video";
  if (type === "video-layer") return "Video Katmanı";
  return "İçerik Üretimi";
}

function extractPreviewUrl(type: string, responseData: ResponseData, packageRow?: PackageData): string | null {
  if (type === "canva" && packageRow) {
    if (packageRow.cover_asset_id) return `/api/assets/${packageRow.cover_asset_id}`;
    if (packageRow.video_url) return packageRow.video_url;
  }
  if (type === "image" && Array.isArray(responseData?.assets) && responseData.assets.length > 0) {
    return responseData.assets[0]?.url || null;
  }
  if (type === "video" && responseData?.videoUrl) {
    return responseData.videoUrl;
  }
  return null;
}

// GET: Fetch in-flight (running/queued) and last 10 completed production items
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase()!;

  // 1. Fetch in-flight (active/queued) jobs
  const inFlightRows = db.prepare(`
    SELECT id, project_id, type, provider, model, status, prompt, request_json, response_json, progress_json, error, created_at, completed_at
    FROM generation_jobs
    WHERE project_id = ? AND status IN ('queued', 'dispatching', 'running', 'rendering', 'exporting', 'uploading')
    ORDER BY created_at ASC
  `).all(projectId) as unknown as DbJobRow[];

  // 2. Fetch completed/failed jobs (Limit 10)
  const completedRows = db.prepare(`
    SELECT id, project_id, type, provider, model, status, prompt, request_json, response_json, progress_json, error, created_at, completed_at
    FROM generation_jobs
    WHERE project_id = ? AND status IN ('complete', 'failed')
    ORDER BY COALESCE(completed_at, created_at) DESC
    LIMIT 10
  `).all(projectId) as unknown as DbJobRow[];

  // Helper map for media_packages if canva jobs exist
  const canvaJobIds = [...inFlightRows, ...completedRows]
    .filter((r) => r.type === "canva")
    .map((r) => r.id);

  const packageMap = new Map<string, PackageData>();
  if (canvaJobIds.length > 0) {
    const placeholders = canvaJobIds.map(() => "?").join(",");
    const pkgs = db.prepare(`
      SELECT id, generation_job_id, title, cover_asset_id, item_count, canva_edit_url, video_url
      FROM media_packages
      WHERE generation_job_id IN (${placeholders})
    `).all(...canvaJobIds) as unknown as PackageData[];
    for (const p of pkgs) {
      if (p.generation_job_id) packageMap.set(p.generation_job_id, p);
    }
  }

  function mapRow(row: DbJobRow): ProductionQueueItem {
    let req: RequestData = {};
    let res: ResponseData = {};
    let prog: { percent?: number; detail?: string; phase?: string } = {};
    try { req = JSON.parse(row.request_json || "{}"); } catch {}
    try { res = JSON.parse(row.response_json || "{}"); } catch {}
    try { prog = JSON.parse(row.progress_json || "{}"); } catch {}

    const pkg = packageMap.get(row.id);
    const progressPercent = typeof prog.percent === "number"
      ? prog.percent
      : (row.status === "complete" ? 100 : (row.status === "queued" ? 5 : 45));

    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      typeLabel: resolveTypeLabel(row.type, req),
      status: row.status,
      prompt: row.prompt || req.prompt || "İçerik üretimi",
      model: row.model || "Hermes Agent",
      progressPercent,
      progressDetail: prog.detail || (row.status === "queued" ? "Sırada bekliyor..." : (row.status === "complete" ? "Tamamlandı" : "Üretiliyor...")),
      phase: prog.phase || row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      error: row.error,
      previewUrl: extractPreviewUrl(row.type, res, pkg),
      canvaEditUrl: pkg?.canva_edit_url || null,
      itemCount: pkg?.item_count || (res.assets?.length ?? 1),
    };
  }

  const queue = inFlightRows.map(mapRow);
  const completed = completedRows.map(mapRow);

  return NextResponse.json({
    ok: true,
    activeCount: queue.length,
    queue,
    completed,
  });
}

// DELETE: Cancel / dismiss a production job
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ ok: false, message: "jobId gereklidir." }, { status: 400 });
  }

  const db = getDatabase()!;
  const row = db.prepare("SELECT id, status FROM generation_jobs WHERE id = ? AND project_id = ?").get(jobId, projectId) as { id: string; status: string } | undefined;
  if (!row) {
    return NextResponse.json({ ok: false, message: "Görev bulunamadı." }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (["queued", "dispatching", "running", "rendering"].includes(row.status)) {
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed', error = 'Kullanıcı tarafından iptal edildi.', completed_at = ?
      WHERE id = ? AND project_id = ?
    `).run(now, jobId, projectId);
  } else {
    // Delete record if already completed/failed
    db.prepare("DELETE FROM generation_jobs WHERE id = ? AND project_id = ?").run(jobId, projectId);
  }

  return NextResponse.json({ ok: true, message: "Üretim kaydı güncellendi / iptal edildi." });
}
