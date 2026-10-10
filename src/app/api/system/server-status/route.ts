import { getDatabase } from "@/lib/server/database";
import { collectLocalMetrics, collectHostMetrics } from "@/lib/server/server-monitor";
import { readMonitorJobs } from "@/lib/server/server-monitor-jobs";
import { requireServerMonitorAdmin } from "@/lib/server/server-monitor-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try { requireServerMonitorAdmin(request); } catch { return Response.json({ ok: false, message: "Sunucu izleme için yönetici doğrulaması gerekli." }, { status: 401, headers }); }
  const params = new URL(request.url).searchParams;
  const view = params.get("view") || "active";
  const offset = Number(params.get("offset") || 0);
  if (!["active", "queued", "history"].includes(view) || !Number.isInteger(offset) || offset < 0 || offset > 100000) return Response.json({ ok: false, message: "Geçersiz liste isteği." }, { status: 400, headers });
  const [local, host] = await Promise.all([collectLocalMetrics().catch(() => null), collectHostMetrics()]);
  let jobs = null;
  try { const db = getDatabase(); if (db) jobs = readMonitorJobs(db, view, offset); } catch { /* Do not expose SQL paths/errors. */ }
  return Response.json({ ok: true, local, host, production: jobs }, { headers });
}
