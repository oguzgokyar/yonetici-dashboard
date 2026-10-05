import { getDatabase } from "@/lib/server/database";
import { fetchPostizPosts } from "@/lib/server/postiz-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const database = getDatabase();

  try {
    const postizPosts = await fetchPostizPosts();
    if (!postizPosts || postizPosts.length === 0) {
      return Response.json({
        ok: true,
        syncedCount: 0,
        message: "Postiz tarafında incelenecek gönderi bulunamadı.",
      });
    }

    const localPosts = database
      .prepare(
        "SELECT id, status, postiz_post_id, release_url, error_message FROM content_posts WHERE project_id = ? AND postiz_post_id IS NOT NULL"
      )
      .all(projectId) as Array<{
      id: string;
      status: string;
      postiz_post_id: string;
      release_url?: string;
      error_message?: string;
    }>;

    const postizMap = new Map<string, (typeof postizPosts)[0]>();
    for (const p of postizPosts) {
      postizMap.set(p.id, p);
    }

    let updatedCount = 0;
    const now = new Date().toISOString();

    const updateStmt = database.prepare(`
      UPDATE content_posts
      SET status = ?, release_url = COALESCE(?, release_url), error_message = ?, updated_at = ?
      WHERE id = ?
    `);

    for (const local of localPosts) {
      const remote = postizMap.get(local.postiz_post_id);
      if (!remote) continue;

      let newStatus = local.status;
      let newReleaseUrl = local.release_url || null;
      let newErrorMessage = local.error_message || null;

      if (remote.state === "PUBLISHED") {
        newStatus = "published";
        if (remote.releaseURL) newReleaseUrl = remote.releaseURL;
      } else if (remote.state === "ERROR") {
        newStatus = "failed";
        if (remote.error) newErrorMessage = remote.error;
      } else if (remote.state === "QUEUE") {
        newStatus = "scheduled";
      } else if (remote.state === "DRAFT") {
        newStatus = "draft";
      }

      if (
        newStatus !== local.status ||
        (newReleaseUrl && newReleaseUrl !== local.release_url)
      ) {
        updateStmt.run(newStatus, newReleaseUrl, newErrorMessage, now, local.id);
        updatedCount++;
      }
    }

    return Response.json({
      ok: true,
      syncedCount: updatedCount,
      totalPostizPosts: postizPosts.length,
      message: `${updatedCount} gönderinin durumu Postiz ile senkronize edildi.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json(
      { ok: false, message: `Postiz senkronizasyon hatası: ${msg}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: Context) {
  return POST(request, context);
}
