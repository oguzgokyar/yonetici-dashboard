import fs from "node:fs";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await context.params;
  const db = getDatabase();

  const row = db
    .prepare("SELECT * FROM project_outro_videos WHERE project_id = ? AND id = ?")
    .get(projectId, id) as { local_path?: string; video_url?: string } | undefined;

  if (!row || !row.local_path || !fs.existsSync(row.local_path)) {
    return new Response("Outro video bulunamadı", { status: 404 });
  }

  const stat = fs.statSync(row.local_path);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(row.local_path, { start, end });

    // @ts-expect-error Node stream to Web ReadableStream
    return new Response(fileStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const fileStream = fs.createReadStream(row.local_path);
  // @ts-expect-error Node stream to Web ReadableStream
  return new Response(fileStream, {
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
}
