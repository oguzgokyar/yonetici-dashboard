import { getDatabase } from "@/lib/server/database";
import { getValidAccessToken } from "@/lib/server/google-drive";
import { createStockVideoPoster, type PosterVideo } from "@/lib/server/stock-video-poster";

export const runtime = "nodejs";
export const maxDuration = 15;

const poster = createStockVideoPoster({
  findVideo: async (projectId, id) => getDatabase()
    .prepare("SELECT id, project_id, drive_file_id, updated_at FROM stock_videos WHERE project_id = ? AND id = ?")
    .get(projectId, id) as PosterVideo | undefined,
  getAccessToken: getValidAccessToken,
});

export async function GET(request: Request, context: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await context.params;
  return poster(request, projectId, id);
}
