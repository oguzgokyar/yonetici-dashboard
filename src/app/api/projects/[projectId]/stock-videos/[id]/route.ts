import fs from "node:fs";
import { getDatabase } from "@/lib/server/database";
import { ensureCachedVideo } from "@/lib/server/google-drive";

export const runtime = "nodejs";

type StockVideoRow = {
  id: string;
  project_id: string;
  drive_file_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  width: number;
  height: number;
  local_path: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await context.params;
  const db = getDatabase();

  const video = db
    .prepare("SELECT * FROM stock_videos WHERE project_id = ? AND (id = ? OR drive_file_id = ?)")
    .get(projectId, id, id) as unknown as StockVideoRow | undefined;

  if (!video) {
    return new Response("Video bulunamadı", { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("info") === "true") {
    return Response.json({ ok: true, video });
  }

  try {
    const { localPath } = await ensureCachedVideo(video.drive_file_id);

    // Update local_path in db if not set
    if (!video.local_path) {
      db.prepare("UPDATE stock_videos SET local_path = ? WHERE id = ?").run(localPath, video.id);
    }

    const stat = fs.statSync(localPath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(localPath, { start, end });

      // @ts-expect-error Node stream to Web ReadableStream
      return new Response(fileStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": video.mime_type || "video/mp4",
        },
      });
    }

    const fileStream = fs.createReadStream(localPath);
    // @ts-expect-error Node stream to Web ReadableStream
    return new Response(fileStream, {
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": video.mime_type || "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${encodeURIComponent(video.name)}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Video yüklenirken hata: ${message}`, { status: 500 });
  }
}
