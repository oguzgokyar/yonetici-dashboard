import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

const OVERLAYS_DIR = path.join(process.cwd(), ".data", "overlays");
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB max
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/webp"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();

  const rows = db
    .prepare("SELECT * FROM project_frame_overlays WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as unknown as Array<{
      id: string;
      project_id: string;
      title: string;
      image_url: string;
      created_at: string;
    }>;

  return Response.json({
    ok: true,
    overlays: rows.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.image_url,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string | null)?.trim() || file?.name || "Özel Çerçeve";

      if (!file) {
        return Response.json({ ok: false, message: "Çerçeve görseli yüklenmedi." }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return Response.json({ ok: false, message: "Yalnızca şeffaf PNG veya WebP görseli yüklenebilir." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return Response.json({ ok: false, message: "Çerçeve dosyası en fazla 20 MB olabilir." }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const ext = file.type === "image/webp" ? ".webp" : ".png";
      const localPath = path.join(OVERLAYS_DIR, `${id}${ext}`);
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(localPath, bytes);

      const imageUrl = `/api/projects/${projectId}/stock-videos/overlays/${id}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO project_frame_overlays (id, project_id, title, image_url, local_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, projectId, title, imageUrl, localPath, now);

      return Response.json({
        ok: true,
        overlay: {
          id,
          title,
          imageUrl,
          createdAt: now,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, message: `Çerçeve yüklenemedi: ${message}` }, { status: 500 });
    }
  }

  return Response.json({ ok: false, message: "Geçersiz içerik türü." }, { status: 400 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ ok: false, message: "ID parametresi gerekli." }, { status: 400 });
  }

  const row = db
    .prepare("SELECT local_path FROM project_frame_overlays WHERE id = ? AND project_id = ?")
    .get(id, projectId) as { local_path?: string } | undefined;

  if (!row) {
    return Response.json({ ok: false, message: "Çerçeve bulunamadı." }, { status: 404 });
  }

  if (row.local_path && fs.existsSync(row.local_path)) {
    try {
      fs.unlinkSync(row.local_path);
    } catch {
      // ignore unlink error
    }
  }

  db.prepare("DELETE FROM project_frame_overlays WHERE id = ? AND project_id = ?").run(id, projectId);

  return Response.json({ ok: true, message: "Özel çerçeve silindi." });
}
