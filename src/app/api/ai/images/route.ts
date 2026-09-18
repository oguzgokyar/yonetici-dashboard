import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
type Asset = { id: string; url: string; mimeType: string; qaScore?: number };
type JobRow = { id: string; model: string; prompt: string; status: string; response_json: string; progress_json: string; created_at: string; completed_at: string | null };

function assetsFrom(value: string) {
  try { const parsed = JSON.parse(value) as { assets?: Asset[] }; return Array.isArray(parsed.assets) ? parsed.assets : []; }
  catch { return []; }
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) return Response.json({ ok: false, message: "Proje gerekli." }, { status: 400 });
  const rows = getDatabase().prepare("SELECT id, model, prompt, status, response_json, progress_json, created_at, completed_at FROM generation_jobs WHERE project_id=? AND type='image' AND status IN ('running','complete') ORDER BY created_at DESC LIMIT 100").all(projectId) as unknown as JobRow[];
  const assets = rows.filter((row) => row.status === "complete").flatMap((row) => assetsFrom(row.response_json).map((asset) => ({ ...asset, jobId: row.id, model: row.model, prompt: row.prompt, createdAt: row.completed_at || row.created_at })));
  const runningJobs = rows.filter((row) => row.status === "running").map((row) => { let progress = {}; try { progress = JSON.parse(row.progress_json || "{}"); } catch { /* use empty progress */ } return { id: row.id, model: row.model, prompt: row.prompt, createdAt: row.created_at, progress }; });
  return Response.json({ ok: true, assets, runningJobs });
}

export async function DELETE(request: Request) {
  const input = await request.json().catch(() => null) as { projectId?: string; assetId?: string } | null;
  if (!input?.projectId || !input.assetId || !/^[a-f0-9-]{36}$/i.test(input.assetId)) return Response.json({ ok: false, message: "Geçersiz görsel." }, { status: 400 });
  const database = getDatabase();
  const rows = database.prepare("SELECT id, response_json FROM generation_jobs WHERE project_id=? AND type='image' AND status='complete'").all(input.projectId) as unknown as { id: string; response_json: string }[];
  const row = rows.find((candidate) => assetsFrom(candidate.response_json).some((asset) => asset.id === input.assetId));
  if (!row) return Response.json({ ok: false, message: "Görsel bulunamadı." }, { status: 404 });
  const parsed = JSON.parse(row.response_json) as { assets?: Asset[]; attempts?: unknown };
  parsed.assets = (parsed.assets || []).filter((asset) => asset.id !== input.assetId);
  if (parsed.assets.length) database.prepare("UPDATE generation_jobs SET response_json=? WHERE id=?").run(JSON.stringify(parsed), row.id);
  else database.prepare("DELETE FROM generation_jobs WHERE id=?").run(row.id);
  const assetDir = path.join(process.cwd(), ".data", "assets");
  try {
    const metadataPath = path.join(assetDir, `${input.assetId}.json`);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as { extension?: string };
    const imagePath = path.join(assetDir, `${input.assetId}.${metadata.extension || "png"}`);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
  } catch { /* Database deletion remains authoritative. */ }
  return Response.json({ ok: true });
}
