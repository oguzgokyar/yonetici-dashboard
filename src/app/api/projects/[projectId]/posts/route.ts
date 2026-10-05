import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import { resolvePackageItemsForPublishing } from "@/lib/server/canva-package-service";
import {
  createPostizPost,
  deletePostizPost,
  uploadMediaToPostiz,
  YouTubePostSettings,
  TikTokPostSettings,
} from "@/lib/server/postiz-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export type TargetSetting = {
  integrationId: string;
  title?: string;
  caption?: string;
  hashtags?: string;
  postType?: "post" | "reel" | "story";
  scheduleType?: "now" | "schedule" | "draft";
  scheduledAt?: string;
  youtubeSettings?: YouTubePostSettings;
  tiktokSettings?: TikTokPostSettings;
};

export async function GET(request: Request, context: Context) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const doSync = url.searchParams.get("sync") === "1" || url.searchParams.get("sync") === "true";
  const database = getDatabase();

  if (doSync) {
    try {
      const { fetchPostizPosts } = await import("@/lib/server/postiz-client");
      const postizPosts = await fetchPostizPosts().catch(() => []);
      if (postizPosts.length > 0) {
        const localPosts = database
          .prepare("SELECT id, status, postiz_post_id, release_url, error_message FROM content_posts WHERE project_id = ? AND postiz_post_id IS NOT NULL")
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
          }
        }
      }
    } catch (e) {
      console.warn("Inline postiz sync error:", e);
    }
  }

  const rows = database
    .prepare(`
      SELECT
        id, project_id, title, content_type, media_url, local_path,
        caption, hashtags, status, schedule_type, scheduled_at,
        integration_id, post_type, postiz_post_id, postiz_media_id,
        media_package_id, media_json,
        release_url, error_message, created_at, updated_at
      FROM content_posts
      WHERE project_id = ?
      ORDER BY
        CASE WHEN status = 'scheduled' THEN 0 ELSE 1 END,
        CASE WHEN status = 'scheduled' THEN scheduled_at END ASC,
        created_at DESC
    `)
    .all(projectId) as Record<string, unknown>[];

  return Response.json({
    ok: true,
    posts: rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      contentType: r.content_type,
      mediaUrl: r.media_url,
      caption: r.caption,
      hashtags: r.hashtags,
      status: r.status,
      scheduleType: r.schedule_type,
      scheduledAt: r.scheduled_at,
      integrationId: r.integration_id,
      postType: r.post_type,
      postizPostId: r.postiz_post_id,
      postizMediaId: r.postiz_media_id,
      mediaPackageId: r.media_package_id,
      mediaJson: r.media_json,
      releaseUrl: r.release_url,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    contentType?: "image" | "video";
    mediaUrl?: string;
    assetId?: string;
    mediaPackageId?: string;
    caption?: string;
    hashtags?: string;
    scheduleType?: "now" | "schedule" | "draft";
    scheduledAt?: string;
    integrationId?: string;
    postType?: "post" | "reel" | "story";
    targets?: TargetSetting[];
    youtubeSettings?: YouTubePostSettings;
    tiktokSettings?: TikTokPostSettings;
  };

  const defaultContentType = body.contentType || (body.mediaUrl?.endsWith(".mp4") ? "video" : "image");
  const defaultCaption = body.caption?.trim() || "";
  const defaultHashtags = body.hashtags?.trim() || "";
  const defaultScheduleType = body.scheduleType || "now";
  const defaultPostType = body.postType || (defaultContentType === "video" ? "reel" : "post");

  const targets: TargetSetting[] =
    Array.isArray(body.targets) && body.targets.length > 0
      ? body.targets
      : body.integrationId?.trim()
      ? [
          {
            integrationId: body.integrationId.trim(),
            title: body.title,
            caption: defaultCaption,
            hashtags: defaultHashtags,
            scheduleType: defaultScheduleType,
            scheduledAt: body.scheduledAt,
            postType: defaultPostType,
            youtubeSettings: body.youtubeSettings,
            tiktokSettings: body.tiktokSettings,
          },
        ]
      : [];

  if (targets.length === 0) {
    return Response.json({ ok: false, message: "Hedef sosyal medya hesabı seçilmedi." }, { status: 400 });
  }

  const database = getDatabase();
  const createdPosts: Array<Record<string, unknown>> = [];

  // --- Canva / Multi-Media Package Publishing Branch ---
  const mediaPackageId = body.mediaPackageId?.trim();
  if (mediaPackageId) {
    const dataDir = path.join(process.cwd(), ".data");
    const assetDir = path.join(dataDir, "assets");
    let packageItems;
    try {
      packageItems = resolvePackageItemsForPublishing({
        database: getDatabase(),
        packageId: mediaPackageId,
        projectId,
        assetsDir: assetDir,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Medya paketi çözümlenemedi.";
      return Response.json({ ok: false, message: msg }, { status: 400 });
    }

    // Sequentially upload each item to Postiz
    const postizMediaList: Array<{ id: string; path: string }> = [];
    try {
      for (const item of packageItems) {
        const uploaded = await uploadMediaToPostiz(item.buffer, item.filename, item.mimeType);
        postizMediaList.push({ id: uploaded.id, path: uploaded.path });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return Response.json(
        { ok: false, message: `Paket medyalarını Postiz'e yükleme başarısız: ${errMsg}` },
        { status: 500 }
      );
    }

    for (const target of targets) {
      const postId = crypto.randomUUID();
      const now = new Date().toISOString();
      const targetScheduleType = target.scheduleType || defaultScheduleType;
      const targetScheduledAt = target.scheduledAt || body.scheduledAt;
      const targetPostType = target.postType || defaultPostType;
      const targetTitle = target.title || body.title || "Canva Paketi";
      const targetCaption = target.caption !== undefined ? target.caption.trim() : defaultCaption;
      const targetHashtags = target.hashtags !== undefined ? target.hashtags.trim() : defaultHashtags;

      let fullCaption = targetCaption;
      if (targetHashtags) {
        const formattedTags = targetHashtags
          .split(/[\s,]+/)
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ");
        fullCaption = `${targetCaption}\n\n${formattedTags}`.trim();
      }

      const targetAccount = database
        .prepare("SELECT identifier FROM project_social_accounts WHERE project_id=? AND integration_id=?")
        .get(projectId, target.integrationId) as { identifier?: string } | undefined;
      const platformIdentifier = targetAccount?.identifier || "instagram";

      try {
        const postizResult = await createPostizPost({
          type: targetScheduleType,
          date: targetScheduledAt,
          integrationId: target.integrationId,
          platformIdentifier,
          caption: fullCaption,
          media: postizMediaList,
          postType: targetPostType,
          youtubeSettings: target.youtubeSettings,
          tiktokSettings: target.tiktokSettings,
        });

        const createdPostId = postizResult[0]?.postId || "";
        const finalStatus =
          targetScheduleType === "draft" ? "draft" : targetScheduleType === "now" ? "published" : "scheduled";

        database
          .prepare(`
            INSERT INTO content_posts (
              id, project_id, title, content_type, media_url, caption, hashtags,
              status, schedule_type, scheduled_at, integration_id, post_type,
              postiz_post_id, postiz_media_id, media_package_id, media_json, created_at, updated_at
            ) VALUES (?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            postId,
            projectId,
            targetTitle,
            postizMediaList[0]?.path || "",
            targetCaption,
            targetHashtags,
            finalStatus,
            targetScheduleType,
            targetScheduledAt || null,
            target.integrationId,
            targetPostType,
            createdPostId,
            postizMediaList[0]?.id || "",
            mediaPackageId,
            JSON.stringify(postizMediaList),
            now,
            now
          );

        createdPosts.push({
          id: postId,
          postizPostId: createdPostId,
          status: finalStatus,
          mediaPath: postizMediaList[0]?.path || "",
          integrationId: target.integrationId,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        database
          .prepare(`
            INSERT INTO content_posts (
              id, project_id, title, content_type, media_url, caption, hashtags,
              status, schedule_type, scheduled_at, integration_id, post_type,
              postiz_media_id, media_package_id, media_json, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, 'image', ?, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            postId,
            projectId,
            targetTitle,
            postizMediaList[0]?.path || "",
            targetCaption,
            targetHashtags,
            targetScheduleType,
            targetScheduledAt || null,
            target.integrationId,
            targetPostType,
            postizMediaList[0]?.id || null,
            mediaPackageId,
            JSON.stringify(postizMediaList),
            `Postiz Gönderi Hatası: ${errMsg}`,
            now,
            now
          );
      }
    }

    return Response.json({
      ok: true,
      message:
        createdPosts.length > 1
          ? `${createdPosts.length} kanala başarıyla dağıtıldı!`
          : defaultScheduleType === "now"
          ? "Gönderi Postiz üzerinden derhal yayın kuyruğuna alındı!"
          : defaultScheduleType === "schedule"
          ? "Gönderi başarıyla zamanlandı!"
          : "Gönderi taslak olarak kaydedildi.",
      posts: createdPosts,
      post: createdPosts[0],
    });
  }

  // --- Single Media Item Publishing Branch ---
  let fileBuffer: Buffer | null = null;
  let filename = `post-${Date.now()}.${defaultContentType === "video" ? "mp4" : "png"}`;
  let mimeType = defaultContentType === "video" ? "video/mp4" : "image/png";

  const dataDir = path.join(process.cwd(), ".data");
  const assetDir = path.join(dataDir, "assets");
  const videoDir = path.join(dataDir, "video-renders");

  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  let candidateId = body.assetId?.trim();
  if (!candidateId && body.mediaUrl) {
    const match = body.mediaUrl.match(uuidRegex);
    if (match) candidateId = match[0];
  }

  if (candidateId) {
    const metaPath = path.join(assetDir, `${candidateId}.json`);
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { mimeType?: string; extension?: string };
        const ext = meta.extension || "png";
        const imgPath = path.join(assetDir, `${candidateId}.${ext}`);
        if (fs.existsSync(imgPath)) {
          fileBuffer = fs.readFileSync(imgPath);
          filename = `creative-${candidateId}.${ext}`;
          mimeType = meta.mimeType || (ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png");
        }
      } catch (err) {
        console.error("Error loading asset from .data/assets:", err);
      }
    }

    if (!fileBuffer) {
      const vidPath = path.join(videoDir, `${candidateId}.mp4`);
      if (fs.existsSync(vidPath)) {
        fileBuffer = fs.readFileSync(vidPath);
        filename = `video-${candidateId}.mp4`;
        mimeType = "video/mp4";
      }
    }

    if (!fileBuffer) {
      const stockRow = database
        .prepare("SELECT * FROM stock_videos WHERE project_id = ? AND (id = ? OR drive_file_id = ?)")
        .get(projectId, candidateId, candidateId) as { drive_file_id: string; name: string; mime_type?: string } | undefined;
      if (stockRow) {
        try {
          const { ensureCachedVideo } = await import("@/lib/server/google-drive");
          const { localPath } = await ensureCachedVideo(stockRow.drive_file_id, projectId);
          if (fs.existsSync(localPath)) {
            fileBuffer = fs.readFileSync(localPath);
            filename = `stock-${stockRow.name}`;
            mimeType = stockRow.mime_type || "video/mp4";
          }
        } catch (e) {
          console.error("Error reading stock video:", e);
        }
      }
    }
  }

  // Fallback: fetch remote mediaUrl
  if (!fileBuffer && body.mediaUrl) {
    try {
      if (body.mediaUrl.startsWith("/")) {
        const localPath = path.join(process.cwd(), "public", body.mediaUrl.replace(/^\//, ""));
        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
        }
      } else if (body.mediaUrl.startsWith("http")) {
        const res = await fetch(body.mediaUrl);
        if (res.ok) {
          fileBuffer = Buffer.from(await res.arrayBuffer());
          const ct = res.headers.get("content-type");
          if (ct) mimeType = ct;
        }
      }
    } catch (err) {
      console.error("Error downloading mediaUrl:", err);
    }
  }

  if (!fileBuffer) {
    return Response.json(
      { ok: false, message: "Medya dosyası okunamadı veya bulunamadı. Lütfen geçerli bir görsel/video seçin." },
      { status: 400 }
    );
  }

  const resolvedContentType = mimeType.startsWith("video/") || filename.endsWith(".mp4") ? "video" : "image";

  // Upload to Postiz once
  let postizMedia: { id: string; path: string };
  try {
    postizMedia = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: `Medyayı Postiz'e yükleme başarısız: ${errMsg}` }, { status: 500 });
  }

  for (const target of targets) {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    const targetScheduleType = target.scheduleType || defaultScheduleType;
    const targetScheduledAt = target.scheduledAt || body.scheduledAt;
    const targetPostType = target.postType || defaultPostType;
    const targetTitle = target.title || body.title || "İsimsiz Gönderi";
    const targetCaption = target.caption !== undefined ? target.caption.trim() : defaultCaption;
    const targetHashtags = target.hashtags !== undefined ? target.hashtags.trim() : defaultHashtags;

    let fullCaption = targetCaption;
    if (targetHashtags) {
      const formattedTags = targetHashtags
        .split(/[\s,]+/)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      fullCaption = `${targetCaption}\n\n${formattedTags}`.trim();
    }

    const targetAccount = database
      .prepare("SELECT identifier FROM project_social_accounts WHERE project_id=? AND integration_id=?")
      .get(projectId, target.integrationId) as { identifier?: string } | undefined;
    const platformIdentifier = targetAccount?.identifier || "instagram";

    try {
      const postizResult = await createPostizPost({
        type: targetScheduleType,
        date: targetScheduledAt,
        integrationId: target.integrationId,
        platformIdentifier,
        caption: fullCaption,
        media: postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : [],
        postType: targetPostType,
        youtubeSettings: target.youtubeSettings || {
          title: targetTitle || "Video Paylaşımı",
          type: "public",
          selfDeclaredMadeForKids: "no",
        },
        tiktokSettings: target.tiktokSettings || {
          title: (targetTitle || "Video Paylaşımı").slice(0, 90),
          content_posting_method: "UPLOAD",
          privacy_level: "SELF_ONLY",
          autoAddMusic: "no",
          brand_content_toggle: false,
          brand_organic_toggle: false,
          video_made_with_ai: true,
        },
      });

      const createdPostId = postizResult[0]?.postId || "";
      const finalStatus =
        targetScheduleType === "draft" ? "draft" : targetScheduleType === "now" ? "published" : "scheduled";

      database
        .prepare(`
          INSERT INTO content_posts (
            id, project_id, title, content_type, media_url, caption, hashtags,
            status, schedule_type, scheduled_at, integration_id, post_type,
            postiz_post_id, postiz_media_id, media_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          postId,
          projectId,
          targetTitle,
          resolvedContentType,
          postizMedia.path,
          targetCaption,
          targetHashtags,
          finalStatus,
          targetScheduleType,
          targetScheduledAt || null,
          target.integrationId,
          targetPostType,
          createdPostId,
          postizMedia.id,
          JSON.stringify(postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : []),
          now,
          now
        );

      createdPosts.push({
        id: postId,
        postizPostId: createdPostId,
        status: finalStatus,
        mediaPath: postizMedia.path,
        integrationId: target.integrationId,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      database
        .prepare(`
          INSERT INTO content_posts (
            id, project_id, title, content_type, media_url, caption, hashtags,
            status, schedule_type, scheduled_at, integration_id, post_type,
            postiz_media_id, error_message, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          postId,
          projectId,
          targetTitle,
          resolvedContentType,
          postizMedia.path,
          targetCaption,
          targetHashtags,
          targetScheduleType,
          targetScheduledAt || null,
          target.integrationId,
          targetPostType,
          postizMedia.id,
          `Postiz Gönderi Hatası: ${errMsg}`,
          now,
          now
        );
    }
  }

  return Response.json({
    ok: true,
    message:
      createdPosts.length > 1
        ? `${createdPosts.length} kanala başarıyla dağıtıldı!`
        : defaultScheduleType === "now"
        ? "Gönderi Postiz üzerinden derhal yayın kuyruğuna alındı!"
        : defaultScheduleType === "schedule"
        ? "Gönderi başarıyla zamanlandı!"
        : "Gönderi taslak olarak kaydedildi.",
    posts: createdPosts,
    post: createdPosts[0],
  });
}

export async function PATCH(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    caption?: string;
    hashtags?: string;
    status?: "draft" | "scheduled" | "published" | "failed";
    scheduleType?: "now" | "schedule" | "draft";
    scheduledAt?: string;
    postType?: "post" | "reel" | "story";
  };

  if (!body.id) {
    return Response.json({ ok: false, message: "Güncellenecek gönderi id'si eksik." }, { status: 400 });
  }

  const database = getDatabase();
  const existing = database
    .prepare("SELECT * FROM content_posts WHERE id = ? AND project_id = ?")
    .get(body.id, projectId) as Record<string, unknown> | undefined;

  if (!existing) {
    return Response.json({ ok: false, message: "Gönderi bulunamadı." }, { status: 404 });
  }

  const title = body.title !== undefined ? body.title : (existing.title as string);
  const caption = body.caption !== undefined ? body.caption : (existing.caption as string);
  const hashtags = body.hashtags !== undefined ? body.hashtags : (existing.hashtags as string);
  const status = body.status !== undefined ? body.status : (existing.status as string);
  const scheduleType = body.scheduleType !== undefined ? body.scheduleType : (existing.schedule_type as string);
  const scheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : (existing.scheduled_at as string | null);
  const postType = body.postType !== undefined ? body.postType : (existing.post_type as string);
  const now = new Date().toISOString();

  database
    .prepare(`
      UPDATE content_posts
      SET title = ?, caption = ?, hashtags = ?, status = ?, schedule_type = ?, scheduled_at = ?, post_type = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `)
    .run(title, caption, hashtags, status, scheduleType, scheduledAt, postType, now, body.id, projectId);

  return Response.json({
    ok: true,
    message: "Gönderi başarıyla güncellendi.",
    post: {
      id: body.id,
      title,
      caption,
      hashtags,
      status,
      scheduleType,
      scheduledAt,
      postType,
      updatedAt: now,
    },
  });
}

export async function DELETE(request: Request, context: Context) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const postId = url.searchParams.get("id");
  const scope = url.searchParams.get("scope") || "single"; // "single" | "all"

  if (!postId) {
    return Response.json({ ok: false, message: "Silinecek gönderi id'si eksik." }, { status: 400 });
  }

  const database = getDatabase();
  const existing = database
    .prepare("SELECT id, title, scheduled_at, media_url, media_package_id, postiz_post_id FROM content_posts WHERE id = ? AND project_id = ?")
    .get(postId, projectId) as {
      id: string;
      title: string;
      scheduled_at?: string;
      media_url?: string;
      media_package_id?: string;
      postiz_post_id?: string;
    } | undefined;

  if (!existing) {
    return Response.json({ ok: false, message: "Gönderi bulunamadı." }, { status: 404 });
  }

  let postsToDelete: Array<{ id: string; postiz_post_id?: string }> = [];

  if (scope === "all") {
    if (existing.media_package_id) {
      postsToDelete = database
        .prepare("SELECT id, postiz_post_id FROM content_posts WHERE project_id = ? AND media_package_id = ?")
        .all(projectId, existing.media_package_id) as Array<{ id: string; postiz_post_id?: string }>;
    } else if (existing.title && existing.scheduled_at) {
      postsToDelete = database
        .prepare("SELECT id, postiz_post_id FROM content_posts WHERE project_id = ? AND title = ? AND scheduled_at = ?")
        .all(projectId, existing.title, existing.scheduled_at) as Array<{ id: string; postiz_post_id?: string }>;
    } else if (existing.media_url) {
      postsToDelete = database
        .prepare("SELECT id, postiz_post_id FROM content_posts WHERE project_id = ? AND media_url = ?")
        .all(projectId, existing.media_url) as Array<{ id: string; postiz_post_id?: string }>;
    }
  }

  if (postsToDelete.length === 0) {
    postsToDelete = [{ id: existing.id, postiz_post_id: existing.postiz_post_id }];
  }

  // Delete from Postiz (parallel)
  await Promise.allSettled(
    postsToDelete
      .filter((p) => Boolean(p.postiz_post_id))
      .map((p) => deletePostizPost(p.postiz_post_id!))
  );

  // Delete from SQLite
  const deleteStmt = database.prepare("DELETE FROM content_posts WHERE id = ?");
  for (const p of postsToDelete) {
    deleteStmt.run(p.id);
  }

  return Response.json({
    ok: true,
    deletedCount: postsToDelete.length,
    message:
      postsToDelete.length > 1
        ? `Gönderi ${postsToDelete.length} kanaldan başarıyla silindi.`
        : "Gönderi başarıyla silindi.",
  });
}
