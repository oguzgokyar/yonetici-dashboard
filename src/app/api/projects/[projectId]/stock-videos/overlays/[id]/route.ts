import fs from "node:fs";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  const { projectId, id } = await context.params;
  const db = getDatabase();

  const row = db
    .prepare("SELECT * FROM project_frame_overlays WHERE project_id = ? AND id = ?")
    .get(projectId, id) as { local_path?: string } | undefined;

  if (!row || !row.local_path || !fs.existsSync(row.local_path)) {
    return new Response("Çerçeve görseli bulunamadı", { status: 404 });
  }

  const stat = fs.statSync(row.local_path);
  const fileBytes = fs.readFileSync(row.local_path);
  const isWebp = row.local_path.endsWith(".webp");

  return new Response(fileBytes, {
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": isWebp ? "image/webp" : "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
