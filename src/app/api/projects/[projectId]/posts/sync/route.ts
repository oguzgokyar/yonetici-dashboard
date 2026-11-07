import { getDatabase } from "@/lib/server/database";
import { fetchPostizPosts } from "@/lib/server/postiz-client";
import { fetchOpenPostPublicationStatus, getOpenPostStoredConfig } from "@/lib/server/openpost-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const database = getDatabase();

  try {
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

    if (localPosts.length === 0) {
      return Response.json({
        ok: true,
        syncedCount: 0,
        message: "Senkronize edilecek gönderi bulunamadı.",
      });
    }

    let updatedCount = 0;
    const now = new Date().toISOString();

    const updateStmt = database.prepare(`
      UPDATE content_posts
      SET status = ?, release_url = COALESCE(?, release_url), error_message = ?, updated_at = ?
      WHERE id = ?
    `);

    // 1. Check OpenPost posts (standard UUID format with dashes, e.g. 66b93038-20ed-49b3-9526-ed483c80d8b6)
    const openPostConfig = getOpenPostStoredConfig();
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const openPostItems = localPosts.filter((p) => isUuid(p.postiz_post_id));
    const postizItems = localPosts.filter((p) => !isUuid(p.postiz_post_id));

    if (openPostConfig.hasApiKey && openPostItems.length > 0) {
      for (const item of openPostItems) {
        try {
          const statusResult = await fetchOpenPostPublicationStatus(item.postiz_post_id);
          let newStatus = item.status;
          if (statusResult.status === "published") newStatus = "published";
          else if (statusResult.status === "failed") newStatus = "failed";
          else if (statusResult.status === "scheduled") newStatus = "scheduled";

          const newReleaseUrl = statusResult.releaseUrl || item.release_url || null;
          const newErrorMessage = statusResult.errorMessage || item.error_message || null;

          if (
            newStatus !== item.status ||
            (newReleaseUrl && newReleaseUrl !== item.release_url)
          ) {
            updateStmt.run(newStatus, newReleaseUrl, newErrorMessage, now, item.id);
            updatedCount++;
          }
        } catch {
          // ignore individual sync errors
        }
      }
    }

    // 2. Check Postiz posts (cuid format, e.g. cmu8w6apc0001pj7g42wyi0z1)
    if (postizItems.length > 0) {
      const postizPosts = await fetchPostizPosts().catch(() => []);
      if (postizPosts && postizPosts.length > 0) {
        const postizMap = new Map<string, (typeof postizPosts)[0]>();
        for (const p of postizPosts) {
          postizMap.set(p.id, p);
        }

        for (const local of postizItems) {
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
      }
    }

    return Response.json({
      ok: true,
      syncedCount: updatedCount,
      message: `${updatedCount} gönderinin durumu senkronize edildi.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json(
      { ok: false, message: `Sosyal medya senkronizasyon hatası: ${msg}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: Context) {
  return POST(request, context);
}
