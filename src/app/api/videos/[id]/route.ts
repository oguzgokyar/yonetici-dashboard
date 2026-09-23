import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const exists = getDatabase().prepare("SELECT 1 FROM generation_jobs WHERE id=? AND type='video' AND status='complete'").get(id);
  if (!exists) return new Response("Not found", { status: 404 });
  try {
    const bytes = fs.readFileSync(path.join(process.cwd(), ".data", "video-renders", `${id}.mp4`));
    return new Response(bytes, { headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=31536000, immutable", "Content-Disposition": `inline; filename="motion-creative-${id}.mp4"` } });
  } catch { return new Response("Not found", { status: 404 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ ok: false, message: "Geçersiz video ID." }, { status: 400 });

  const db = getDatabase();
  const exists = db.prepare("SELECT id FROM generation_jobs WHERE id=? AND type='video'").get(id);
  if (!exists) return Response.json({ ok: false, message: "Video bulunamadı." }, { status: 404 });

  const filePath = path.join(process.cwd(), ".data", "video-renders", `${id}.mp4`);
  if (fs.existsSync(filePath)) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // ignore
    }
  }

  db.prepare("DELETE FROM generation_jobs WHERE id=? AND type='video'").run(id);
  return Response.json({ ok: true, message: "Video başarıyla silindi." });
}
