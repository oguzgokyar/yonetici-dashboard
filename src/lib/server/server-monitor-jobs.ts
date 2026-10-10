import "server-only";
import type { DatabaseSync } from "node:sqlite";
export type MonitorJob = { id: string; projectId: string; type: string; status: string; source: "production"; createdAt: string; completedAt: string | null; startedAt: null; heartbeat: string | null; stale: boolean; progressPercent: number | null };
export function readMonitorJobs(db: DatabaseSync, view: string, offset: number) {
  const states = view === "queued" ? "'queued'" : view === "history" ? "'complete','failed'" : "'dispatching','running','rendering','exporting','uploading','video_exporting'";
  const order = view === "history" ? "COALESCE(completed_at, created_at) DESC" : "created_at ASC";
  const total = Number((db.prepare(`SELECT COUNT(*) AS total FROM generation_jobs WHERE status IN (${states})`).get() as { total: number }).total);
  const rows = db.prepare(`SELECT id, project_id, type, status, progress_json, created_at, completed_at FROM generation_jobs WHERE status IN (${states}) ORDER BY ${order}, id LIMIT 25 OFFSET ?`).all(offset) as unknown as { id: string; project_id: string; type: string; status: string; progress_json: string; created_at: string; completed_at: string | null }[];
  const jobs: MonitorJob[] = rows.map(row => {
    let progress: { percent?: unknown; updatedAt?: unknown } = {};
    try { progress = JSON.parse(row.progress_json); } catch { /* Missing instrumentation is unavailable, not zero. */ }
    if (!progress || typeof progress !== "object") progress = {};
    const heartbeat = typeof progress.updatedAt === "string" && Number.isFinite(Date.parse(progress.updatedAt)) ? new Date(progress.updatedAt).toISOString() : null;
    return { id: row.id, projectId: row.project_id, type: ["canva", "image", "video", "video-layer"].includes(row.type) ? row.type : "other", status: row.status, source: "production", createdAt: row.created_at, completedAt: row.completed_at, startedAt: null, heartbeat, stale: view === "active" && (!heartbeat || Date.now() - Date.parse(heartbeat) > 60000), progressPercent: typeof progress.percent === "number" && Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : null };
  });
  return { jobs, total, hasMore: offset + jobs.length < total, offset };
}
