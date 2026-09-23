import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

const OUTRO_DIR = path.join(process.cwd(), ".data", "outros");
const execFileAsync = promisify(execFile);
const MAX_OUTRO_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();

  const rows = db
    .prepare("SELECT * FROM project_outro_videos WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as unknown as Array<{
      id: string;
      project_id: string;
      title: string;
      video_url: string;
      duration_seconds: number;
      created_at: string;
    }>;

  return Response.json({
    ok: true,
    outros: rows.map((r) => ({
      id: r.id,
      title: r.title,
      videoUrl: r.video_url,
      durationSeconds: r.duration_seconds,
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
  fs.mkdirSync(OUTRO_DIR, { recursive: true });

  const contentType = request.headers.get("content-type") || "";

  // 1. File upload via FormData
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string | null)?.trim() || file?.name || "Bitiş (Outro) Videosu";

      if (!file) {
        return Response.json({ ok: false, message: "Video dosyası yüklenmedi." }, { status: 400 });
      }
      if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
        return Response.json({ ok: false, message: "Yalnızca MP4, WebM veya MOV outro yüklenebilir." }, { status: 400 });
      }
      if (file.size > MAX_OUTRO_BYTES) {
        return Response.json({ ok: false, message: "Outro dosyası en fazla 100 MB olabilir." }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const localPath = path.join(OUTRO_DIR, `${id}.mp4`);
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(localPath, bytes);
      let durationSeconds = 0;
      try {
        const { stdout } = await execFileAsync("/usr/bin/ffprobe", [
          "-v", "quiet", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", localPath,
        ], { timeout: 20_000 });
        durationSeconds = Number.parseFloat(stdout.trim()) || 0;
      } catch {
        // Duration metadata is optional; playback still works without it.
      }

      const videoUrl = `/api/projects/${projectId}/stock-videos/outros/${id}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO project_outro_videos (id, project_id, title, video_url, local_path, duration_seconds, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, title, videoUrl, localPath, durationSeconds, now);

      return Response.json({
        ok: true,
        outro: {
          id,
          title,
          videoUrl,
          durationSeconds,
          createdAt: now,
        },
      });
    } catch (err) {
      return Response.json(
        { ok: false, message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // 2. Link from URL / existing path via JSON
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    videoUrl?: string;
  };

  if (!body.videoUrl?.trim()) {
    return Response.json({ ok: false, message: "Video URL gerekli." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const title = body.title?.trim() || "Bitiş (Outro) Videosu";
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO project_outro_videos (id, project_id, title, video_url, local_path, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, '', 0, ?)
  `).run(id, projectId, title, body.videoUrl.trim(), now);

  return Response.json({
    ok: true,
    outro: {
      id,
      title,
      videoUrl: body.videoUrl.trim(),
      durationSeconds: 0,
      createdAt: now,
    },
  });
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
    return Response.json({ ok: false, message: "Outro ID gerekli." }, { status: 400 });
  }

  const row = db
    .prepare("SELECT * FROM project_outro_videos WHERE id = ? AND project_id = ?")
    .get(id, projectId) as { local_path?: string } | undefined;

  if (row?.local_path && fs.existsSync(row.local_path)) {
    try {
      fs.rmSync(row.local_path, { force: true });
    } catch {
      // ignore
    }
  }

  db.prepare("DELETE FROM project_outro_videos WHERE id = ? AND project_id = ?").run(id, projectId);

  return Response.json({ ok: true, message: "Outro videosu kaldırıldı." });
}
