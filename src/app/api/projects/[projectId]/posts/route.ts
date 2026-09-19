import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import {
  createPostizPost,
  deletePostizPost,
  uploadMediaToPostiz,
} from "@/lib/server/postiz-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const database = getDatabase();

  const rows = database
    .prepare(`
      SELECT
        id, project_id, title, content_type, media_url, local_path,
        caption, hashtags, status, schedule_type, scheduled_at,
        integration_id, post_type, postiz_post_id, postiz_media_id,
        release_url, error_message, created_at, updated_at
      FROM content_posts
      WHERE project_id = ?
      ORDER BY created_at DESC
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
    caption?: string;
    hashtags?: string;
    scheduleType?: "now" | "schedule" | "draft";
    scheduledAt?: string;
    integrationId?: string;
    postType?: "post" | "reel" | "story";
  };

  const contentType = body.contentType || (body.mediaUrl?.endsWith(".mp4") ? "video" : "image");
  const caption = body.caption?.trim() || "";
  const hashtags = body.hashtags?.trim() || "";
  const scheduleType = body.scheduleType || "now";
  const postType = body.postType || (contentType === "video" ? "reel" : "post");
  const integrationId = body.integrationId?.trim();

  if (!integrationId) {
    return Response.json({ ok: false, message: "Hedef sosyal medya hesabı seçilmedi." }, { status: 400 });
  }

  // 1. Resolve Media Buffer
  let fileBuffer: Buffer | null = null;
  let filename = `post-${Date.now()}.${contentType === "video" ? "mp4" : "png"}`;
  let mimeType = contentType === "video" ? "video/mp4" : "image/png";

  const dataDir = path.join(process.cwd(), ".data");

  // Check assetId for video
  if (body.assetId) {
    const videoPath = path.join(dataDir, "video-renders", `${body.assetId}.mp4`);
    if (fs.existsSync(videoPath)) {
      fileBuffer = fs.readFileSync(videoPath);
      filename = `motion-creative-${body.assetId}.mp4`;
      mimeType = "video/mp4";
    }
  }

  // Check mediaUrl
  if (!fileBuffer && body.mediaUrl) {
    const mediaUrl = body.mediaUrl.trim();
    if (mediaUrl.startsWith("data:")) {
      const commaIndex = mediaUrl.indexOf(",");
      if (commaIndex > -1) {
        const meta = mediaUrl.slice(0, commaIndex);
        const mimeMatch = meta.match(/data:([^;]+)/);
        if (mimeMatch) mimeType = mimeMatch[1];
        fileBuffer = Buffer.from(mediaUrl.slice(commaIndex + 1), "base64");
        filename = `creative-${Date.now()}.${mimeType.includes("jpeg") ? "jpg" : "png"}`;
      }
    } else if (mediaUrl.startsWith("/api/videos/")) {
      const vidId = mediaUrl.replace("/api/videos/", "").replace(/\.mp4$/i, "");
      const videoPath = path.join(dataDir, "video-renders", `${vidId}.mp4`);
      if (fs.existsSync(videoPath)) {
        fileBuffer = fs.readFileSync(videoPath);
        filename = `video-${vidId}.mp4`;
        mimeType = "video/mp4";
      }
    } else if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
      try {
        const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(30_000) });
        if (resp.ok) {
          fileBuffer = Buffer.from(await resp.arrayBuffer());
          const ct = resp.headers.get("content-type");
          if (ct) mimeType = ct.split(";")[0];
          filename = `download-${Date.now()}.${mimeType.includes("mp4") ? "mp4" : "jpg"}`;
        }
      } catch (err) {
        console.error("Failed to fetch mediaUrl:", err);
      }
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    return Response.json(
      { ok: false, message: "Paylaşılacak medya dosyası bulunamadı veya okunamadı." },
      { status: 400 }
    );
  }

  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  const database = getDatabase();

  // 2. Upload media to Postiz
  let postizMedia: { id: string; path: string } | null = null;
  try {
    const uploaded = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
    postizMedia = { id: uploaded.id, path: uploaded.path };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    database
      .prepare(`
        INSERT INTO content_posts (
          id, project_id, title, content_type, media_url, caption, hashtags,
          status, schedule_type, scheduled_at, integration_id, post_type,
          error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        postId,
        projectId,
        body.title || "İsimsiz Gönderi",
        contentType,
        body.mediaUrl || "",
        caption,
        hashtags,
        scheduleType,
        body.scheduledAt || null,
        integrationId,
        postType,
        `Postiz Medya Yükleme Hatası: ${errMsg}`,
        now,
        now
      );
    return Response.json({ ok: false, message: `Medyayı Postiz'e yükleme başarısız: ${errMsg}` }, { status: 500 });
  }

  // 3. Create post in Postiz
  let fullCaption = caption;
  if (hashtags) {
    const formattedTags = hashtags
      .split(/[\s,]+/)
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .join(" ");
    fullCaption = `${caption}\n\n${formattedTags}`.trim();
  }

  try {
    const postizResult = await createPostizPost({
      type: scheduleType,
      date: body.scheduledAt,
      integrationId,
      caption: fullCaption,
      media: postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : [],
      postType,
    });

    const createdPostId = postizResult[0]?.postId || "";
    const finalStatus = scheduleType === "draft" ? "draft" : scheduleType === "now" ? "published" : "scheduled";

    database
      .prepare(`
        INSERT INTO content_posts (
          id, project_id, title, content_type, media_url, caption, hashtags,
          status, schedule_type, scheduled_at, integration_id, post_type,
          postiz_post_id, postiz_media_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        postId,
        projectId,
        body.title || "İsimsiz Gönderi",
        contentType,
        postizMedia.path,
        caption,
        hashtags,
        finalStatus,
        scheduleType,
        body.scheduledAt || null,
        integrationId,
        postType,
        createdPostId,
        postizMedia.id,
        now,
        now
      );

    return Response.json({
      ok: true,
      message:
        scheduleType === "now"
          ? "Gönderi Postiz üzerinden derhal yayın kuyruğuna alındı!"
          : scheduleType === "schedule"
          ? "Gönderi başarıyla zamanlandı!"
          : "Gönderi taslak olarak Postiz'e kaydedildi.",
      post: {
        id: postId,
        postizPostId: createdPostId,
        status: finalStatus,
        mediaPath: postizMedia.path,
      },
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
        body.title || "İsimsiz Gönderi",
        contentType,
        postizMedia.path,
        caption,
        hashtags,
        scheduleType,
        body.scheduledAt || null,
        integrationId,
        postType,
        postizMedia.id,
        `Postiz Gönderi Hatası: ${errMsg}`,
        now,
        now
      );

    return Response.json({ ok: false, message: `Gönderi oluşturulamadı: ${errMsg}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const postId = url.searchParams.get("id");

  if (!postId) {
    return Response.json({ ok: false, message: "Silinecek gönderi id'si eksik." }, { status: 400 });
  }

  const database = getDatabase();
  const existing = database
    .prepare("SELECT id, postiz_post_id FROM content_posts WHERE id = ? AND project_id = ?")
    .get(postId, projectId) as { id: string; postiz_post_id?: string } | undefined;

  if (!existing) {
    return Response.json({ ok: false, message: "Gönderi bulunamadı." }, { status: 404 });
  }

  // If there's a Postiz post, attempt to delete it from Postiz as well
  if (existing.postiz_post_id) {
    await deletePostizPost(existing.postiz_post_id).catch(() => undefined);
  }

  database.prepare("DELETE FROM content_posts WHERE id = ?").run(postId);
  return Response.json({ ok: true, message: "Gönderi başarıyla silindi." });
}
