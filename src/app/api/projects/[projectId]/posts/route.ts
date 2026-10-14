import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appendMusicAttribution, resolveMusicAttribution } from "@/lib/music-attribution";
import { uploadVideoViaTikTokBrowser } from "@/lib/server/tiktok-browser-service";
import {
  scheduleExactTikTokPost,
  cancelExactTikTokPost,
  getTikTokQueueDir,
  ensureTikTokSchedulersRehydrated,
} from "@/lib/server/tiktok-exact-scheduler";
import { getDatabase } from "@/lib/server/database";
import { resolvePackageItemsForPublishing } from "@/lib/server/canva-package-service";
import {
  createPostizPost,
  deletePostizPost,
  uploadMediaToPostiz,
  YouTubePostSettings,
  TikTokPostSettings,
} from "@/lib/server/postiz-client";
import { convertImagesToYouTubeVideo } from "@/lib/server/image-slideshow-service";

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
  tiktokMethod?: "postiz" | "browser";
  isAiGenerated?: boolean;
  relatedPostId?: string;
  relatedVideoUrl?: string;
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
    isAiGenerated?: boolean;
    relatedPostId?: string;
    relatedVideoUrl?: string;
  };

  const defaultContentType = body.contentType || (body.mediaUrl?.endsWith(".mp4") ? "video" : "image");
  const defaultCaption = body.caption?.trim() || "";
  const defaultHashtags = body.hashtags?.trim() || "";
  const defaultScheduleType = body.scheduleType || "now";
  const defaultPostType = body.postType || (defaultContentType === "video" ? "reel" : "post");
  const defaultIsAi = body.isAiGenerated !== undefined ? body.isAiGenerated : true;

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
            isAiGenerated: defaultIsAi,
            relatedPostId: body.relatedPostId,
            relatedVideoUrl: body.relatedVideoUrl,
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

      // YouTube için görsel paketini otomatik YouTube Shorts MP4 videosuna dönüştür
      let effectivePostizMediaList = postizMediaList;
      let effectivePostType = targetPostType;

      if (platformIdentifier.includes("youtube") && packageItems && packageItems.length > 0) {
        try {
          // Paketteki tüm görselleri topla ve yerel yollarını al
          const imgUrls = packageItems.map((item) => item.filename);
          // packageItems buffer'larını geçici MP4'e dönüştür
          const videoRes = await convertImagesToYouTubeVideo({
            imageUrls: packageItems.map((_, i) => `/api/assets/${mediaPackageId}_${i}`), // fallback id
          });

          // Eğer dönüştürme yerel dosyalarla başarılı olduysa
          if (videoRes.ok && videoRes.videoPath && fs.existsSync(videoRes.videoPath)) {
            const vBuf = fs.readFileSync(videoRes.videoPath);
            const vUploaded = await uploadMediaToPostiz(vBuf, path.basename(videoRes.videoPath), "video/mp4");
            effectivePostizMediaList = [{ id: vUploaded.id, path: vUploaded.path }];
            effectivePostType = "reel"; // YouTube Shorts
            try { fs.unlinkSync(videoRes.videoPath); } catch {}
          }
        } catch (ytConvErr) {
          console.warn("[Posts Route] YouTube Karosel-Shorts dönüşümü atlandı:", ytConvErr);
        }
      }

      try {
        const postizResult = await createPostizPost({
          type: targetScheduleType,
          date: targetScheduledAt,
          integrationId: target.integrationId,
          platformIdentifier,
          caption: fullCaption,
          media: effectivePostizMediaList,
          postType: effectivePostType,
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
  // Keep the source render reference: media_url becomes a Postiz URL after upload.
  // PATCH must re-read license evidence from the project-scoped job, never client text.
  const sourceMediaUrl = candidateId && mimeType.startsWith("video/")
    ? `/api/videos/${candidateId}` : body.mediaUrl || "";
  const musicAttribution = resolveMusicAttribution(database, projectId, {
    assetId: candidateId, mediaUrl: body.mediaUrl,
  });

  // Check if only TikTok (browser mode) is targeted -> bypass Postiz upload completely
  const isOnlyTikTokBrowser = targets.every((t) => {
    const acc = database
      .prepare("SELECT identifier, tiktok_method FROM project_social_accounts WHERE project_id=? AND integration_id=?")
      .get(projectId, t.integrationId) as { identifier?: string; tiktok_method?: string } | undefined;
    const pId = acc?.identifier || "";
    const m = t.tiktokMethod || acc?.tiktok_method || "browser";
    return pId.includes("tiktok") && m === "browser" && (mimeType.startsWith("video/") || filename.endsWith(".mp4"));
  });

  // Upload to Postiz only when other platforms or Postiz mode is requested
  let postizMedia: { id: string; path: string } | null = null;
  if (!isOnlyTikTokBrowser) {
    try {
      let uploadBuffer = fileBuffer;
      let uploadFilename = filename;
      let uploadMimeType = mimeType;

      // Eğer hedef kanallar arasında YouTube varsa ve medya görsel ise:
      // YouTube API statik görsel kabul etmediği için otomatik olarak 10-15s YouTube Shorts MP4 videosuna dönüştür
      const hasYouTubeTarget = targets.some((t) => {
        const acc = database
          .prepare("SELECT identifier FROM project_social_accounts WHERE project_id=? AND integration_id=?")
          .get(projectId, t.integrationId) as { identifier?: string } | undefined;
        return Boolean(acc?.identifier?.includes("youtube"));
      });

      if (hasYouTubeTarget && (resolvedContentType === "image" || !mimeType.startsWith("video/"))) {
        try {
          const videoRes = await convertImagesToYouTubeVideo({
            imageUrls: [body.mediaUrl || `/api/assets/${candidateId}`],
            durationPerSlide: 8, // Tek görsel için 8 saniyelik statik video
          });
          if (videoRes.ok && videoRes.videoPath && fs.existsSync(videoRes.videoPath)) {
            uploadBuffer = fs.readFileSync(videoRes.videoPath);
            uploadFilename = path.basename(videoRes.videoPath);
            uploadMimeType = "video/mp4";
            try { fs.unlinkSync(videoRes.videoPath); } catch {}
          }
        } catch (ytSingleErr) {
          console.warn("[Posts Route] YouTube tekil görsel video dönüşümü atlandı:", ytSingleErr);
        }
      }

      postizMedia = await uploadMediaToPostiz(uploadBuffer, uploadFilename, uploadMimeType);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, message: `Medyayı Postiz'e yükleme başarısız: ${errMsg}` }, { status: 500 });
    }
  }

  for (const target of targets) {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    const targetScheduleType = target.scheduleType || defaultScheduleType;
    const targetScheduledAt = target.scheduledAt || body.scheduledAt;
    const targetPostType = target.postType || defaultPostType;
    const targetTitle = target.title || body.title || "İsimsiz Gönderi";

    // 24 Saatlik Mükerrer Kontrolü (Deduplication Guard)
    const existingRecent = database.prepare(`
      SELECT id, status, created_at FROM content_posts
      WHERE project_id = ? AND integration_id = ? AND (title = ? OR media_url = ?)
        AND created_at >= datetime('now', '-24 hours')
        AND status IN ('published', 'scheduled')
      LIMIT 1
    `).get(projectId, target.integrationId, targetTitle, body.mediaUrl || "") as { id: string; status: string } | undefined;

    if (existingRecent) {
      console.warn(`[Posts Deduplication] Aynı içerik son 24 saat içinde zaten paylaşıldı/zamanlandı: ${targetTitle}`);
      createdPosts.push({
        id: existingRecent.id,
        status: existingRecent.status,
        integrationId: target.integrationId,
      });
      continue;
    }

    if (!isOnlyTikTokBrowser && !postizMedia) {
      postizMedia = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
    }

    const targetCaption = appendMusicAttribution(
      target.caption !== undefined ? target.caption.trim() : defaultCaption, musicAttribution,
    );
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
      .prepare("SELECT identifier, tiktok_method FROM project_social_accounts WHERE project_id=? AND integration_id=?")
      .get(projectId, target.integrationId) as { identifier?: string; tiktok_method?: string } | undefined;
    const platformIdentifier = targetAccount?.identifier || "instagram";
    const effectiveTiktokMethod = target.tiktokMethod || targetAccount?.tiktok_method || "browser";
    const isAi = target.isAiGenerated !== undefined ? (target.isAiGenerated ? 1 : 0) : defaultIsAi ? 1 : 0;
    const relPostId = target.relatedPostId || body.relatedPostId || null;
    const relVideoUrl = target.relatedVideoUrl || body.relatedVideoUrl || null;

    // TikTok Tarayıcı Yükleme Modu Kontrolü
    if (platformIdentifier.includes("tiktok") && effectiveTiktokMethod === "browser" && resolvedContentType === "video") {
      // 1. İLERİ TARİHLİ ZAMANLAMA (Kullanıcı Talebi: TikTok arayüzü yerine kuyrukta beklet, saati gelince 'Şimdi Paylaş' ile yükle)
      if (targetScheduleType === "schedule" && targetScheduledAt) {
        try {
          const queueDir = getTikTokQueueDir();
          const queueFilePath = path.join(queueDir, `${postId}.mp4`);
          fs.writeFileSync(queueFilePath, fileBuffer);

          database
            .prepare(`
              INSERT INTO content_posts (
                id, project_id, title, content_type, media_url,
                caption, hashtags, status, schedule_type, scheduled_at,
                integration_id, post_type, postiz_post_id, postiz_media_id,
                local_path, is_ai_generated, related_post_id, related_video_url,
                error_message, created_at, updated_at
              ) VALUES (?, ?, ?, 'video', ?, ?, ?, 'scheduled', 'schedule', ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?)
            `)
            .run(
              postId,
              projectId,
              targetTitle,
              body.mediaUrl || "",
              targetCaption,
              targetHashtags,
              targetScheduledAt,
              target.integrationId,
              targetPostType,
              queueFilePath,
              isAi,
              relPostId,
              relVideoUrl,
              now,
              now
            );

          // Saati geldiğinde otomatik uyanacak tam-zamanlı alarmı kur
          scheduleExactTikTokPost(postId, targetScheduledAt);

          createdPosts.push({
            id: postId,
            status: "scheduled",
            scheduledAt: targetScheduledAt,
            integrationId: target.integrationId,
          });
          continue;
        } catch (qErr) {
          const errMsg = qErr instanceof Error ? qErr.message : "TikTok zamanlama kuyruğuna eklenemedi";
          return Response.json({ ok: false, message: errMsg }, { status: 500 });
        }
      }

      // 2. HEMEN PAYLAŞ ("now") VEYA TASLAK ("draft")
      const tmpVideoPath = path.join("/tmp", `tiktok_single_${postId}.mp4`);
      try {
        fs.writeFileSync(tmpVideoPath, fileBuffer);
        const browserRes = await uploadVideoViaTikTokBrowser({
          videoPath: tmpVideoPath,
          caption: fullCaption,
          visibility: targetScheduleType === "draft" ? "SELF_ONLY" : "PUBLIC",
          isAiGenerated: isAi === 1,
        });
        try { fs.unlinkSync(tmpVideoPath); } catch {}

        if (!browserRes.ok) {
          throw new Error(browserRes.error || "TikTok tarayıcı yüklemesi başarısız oldu.");
        }

        const finalStatus = targetScheduleType === "draft" ? "draft" : "published";
        const finalSchedType = targetScheduleType === "draft" ? "draft" : "now";

        database
          .prepare(`
            INSERT INTO content_posts (
              id, project_id, title, content_type, media_url,
              caption, hashtags, status, schedule_type, scheduled_at,
              integration_id, post_type, postiz_post_id, postiz_media_id,
              is_ai_generated, related_post_id, related_video_url,
              error_message, created_at, updated_at
            ) VALUES (?, ?, ?, 'video', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
          `)
          .run(
            postId,
            projectId,
            targetTitle,
            postizMedia?.path || body.mediaUrl || "",
            targetCaption,
            targetHashtags,
            finalStatus,
            finalSchedType,
            null,
            target.integrationId,
            targetPostType,
            `tiktok_browser_${postId.slice(0, 8)}`,
            postizMedia?.id || "",
            isAi,
            relPostId,
            relVideoUrl,
            now,
            now
          );

        createdPosts.push({
          id: postId,
          postizPostId: `tiktok_browser_${postId.slice(0, 8)}`,
          status: finalStatus,
          mediaPath: postizMedia?.path || body.mediaUrl || "",
          integrationId: target.integrationId,
        });
        continue;
      } catch (bErr) {
        try { if (fs.existsSync(tmpVideoPath)) fs.unlinkSync(tmpVideoPath); } catch {}
        console.error("TikTok browser upload error:", bErr);
        return Response.json({
          ok: false,
          message: `TikTok tarayıcı yükleme hatası: ${bErr instanceof Error ? bErr.message : String(bErr)}`
        }, { status: 500 });
      }
    }

    try {
      if (!postizMedia) {
        postizMedia = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
      }
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
          content_posting_method: "DIRECT_POST",
          privacy_level: "SELF_ONLY",
          autoAddMusic: "no",
          brand_content_toggle: false,
          brand_organic_toggle: false,
          video_made_with_ai: isAi === 1,
        },
        isAiGenerated: isAi === 1,
        relatedVideoUrl: relVideoUrl || undefined,
      });

      const createdPostId = postizResult[0]?.postId || "";
      const finalStatus =
        targetScheduleType === "draft" ? "draft" : targetScheduleType === "now" ? "published" : "scheduled";

      database
        .prepare(`
          INSERT INTO content_posts (
            id, project_id, title, content_type, media_url, caption, hashtags,
            status, schedule_type, scheduled_at, integration_id, post_type,
            postiz_post_id, postiz_media_id, media_json, local_path,
            is_ai_generated, related_post_id, related_video_url,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          postId,
          projectId,
          targetTitle,
          resolvedContentType,
          postizMedia ? postizMedia.path : body.mediaUrl || "",
          targetCaption,
          targetHashtags,
          finalStatus,
          targetScheduleType,
          targetScheduledAt || null,
          target.integrationId,
          targetPostType,
          createdPostId,
          postizMedia ? postizMedia.id : null,
          JSON.stringify(postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : []),
          sourceMediaUrl,
          isAi,
          relPostId,
          relVideoUrl,
          now,
          now
        );

      createdPosts.push({
        id: postId,
        postizPostId: createdPostId,
        status: finalStatus,
        mediaPath: postizMedia ? postizMedia.path : body.mediaUrl || "",
        integrationId: target.integrationId,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      database
        .prepare(`
          INSERT INTO content_posts (
            id, project_id, title, content_type, media_url, caption, hashtags,
            status, schedule_type, scheduled_at, integration_id, post_type,
            postiz_media_id, local_path, error_message, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          postId,
          projectId,
          targetTitle,
          resolvedContentType,
          postizMedia ? postizMedia.path : body.mediaUrl || "",
          targetCaption,
          targetHashtags,
          targetScheduleType,
          targetScheduledAt || null,
          target.integrationId,
          targetPostType,
          postizMedia ? postizMedia.id : null,
          sourceMediaUrl,
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
  const musicAttribution = resolveMusicAttribution(database, projectId, {
    mediaUrl: (existing.local_path as string) || (existing.media_url as string),
  });
  const caption = appendMusicAttribution(
    body.caption !== undefined ? body.caption : (existing.caption as string) || "", musicAttribution,
  );
  const hashtags = body.hashtags !== undefined ? body.hashtags : (existing.hashtags as string);
  const status = body.status !== undefined ? body.status : (existing.status as string);
  const scheduleType = body.scheduleType !== undefined ? body.scheduleType : (existing.schedule_type as string);
  const scheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : (existing.scheduled_at as string | null);
  const postType = body.postType !== undefined ? body.postType : (existing.post_type as string);

  let postizPostId = (existing.postiz_post_id as string) || null;
  let finalStatus = status;
  let errorMessage = (existing.error_message as string) || null;

  // If transitioning to scheduled but missing Postiz postId (e.g. failed/draft recovery), create in Postiz now
  if (
    status === "scheduled" &&
    !postizPostId &&
    existing.integration_id &&
    (existing.media_url || existing.postiz_media_id)
  ) {
    try {
      const targetAccount = database
        .prepare("SELECT identifier FROM project_social_accounts WHERE project_id=? AND integration_id=?")
        .get(projectId, existing.integration_id as string) as { identifier?: string } | undefined;
      const platformIdentifier = targetAccount?.identifier || "instagram";

      let fullCaption = caption;
      if (hashtags) {
        const formattedTags = hashtags
          .split(/[\s,]+/)
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ");
        fullCaption = `${caption}\n\n${formattedTags}`.trim();
      }

      const isYt = Boolean(platformIdentifier.includes("youtube"));
      const isTt = Boolean(platformIdentifier.includes("tiktok"));

      const ytTags = hashtags
        ? hashtags.split(/\s+/).map((t) => t.trim().replace(/^#+/, "").trim()).filter(Boolean)
        : [];

      const postizMedia = existing.postiz_media_id
        ? [{ id: existing.postiz_media_id as string, path: (existing.media_url as string) || "" }]
        : [];

      const postizResult = await createPostizPost({
        type: scheduleType === "now" || scheduleType === "draft" ? scheduleType : "schedule",
        date: scheduledAt || (existing.scheduled_at as string | undefined),
        integrationId: existing.integration_id as string,
        platformIdentifier,
        caption: fullCaption,
        media: postizMedia,
        postType: (postType || "post") as "post" | "reel" | "story",
        youtubeSettings: isYt
          ? {
              title: title.slice(0, 100),
              type: "public",
              selfDeclaredMadeForKids: "no",
              tags: ytTags,
            }
          : undefined,
        tiktokSettings: isTt
          ? {
              title: title.slice(0, 90),
              content_posting_method: "DIRECT_POST",
              privacy_level: "SELF_ONLY",
              video_made_with_ai: true,
            }
          : undefined,
      });

      if (postizResult[0]?.postId) {
        postizPostId = postizResult[0].postId;
        errorMessage = null;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      finalStatus = "failed";
      errorMessage = `Postiz Gönderi Hatası: ${errMsg}`;
      const now = new Date().toISOString();
      database
        .prepare(`
          UPDATE content_posts
          SET status = 'failed', caption = ?, error_message = ?, updated_at = ?
          WHERE id = ? AND project_id = ?
        `)
        .run(caption, errorMessage, now, body.id, projectId);

      return Response.json(
        { ok: false, message: `Postiz'de zamanlanamadı: ${errMsg}` },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString();

  database
    .prepare(`
      UPDATE content_posts
      SET title = ?, caption = ?, hashtags = ?, status = ?, schedule_type = ?, scheduled_at = ?, post_type = ?, postiz_post_id = ?, error_message = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `)
    .run(
      title,
      caption,
      hashtags,
      finalStatus,
      scheduleType,
      scheduledAt || null,
      postType,
      postizPostId || null,
      errorMessage || null,
      now,
      body.id,
      projectId
    );

  // TikTok için exact-time alarmını senkronize et
  if (finalStatus === "scheduled" && scheduledAt) {
    scheduleExactTikTokPost(body.id, scheduledAt);
  } else {
    cancelExactTikTokPost(body.id);
  }

  return Response.json({
    ok: true,
    message: "Gönderi başarıyla güncellendi.",
    post: {
      id: body.id,
      title,
      caption,
      hashtags,
      status: finalStatus,
      scheduleType,
      scheduledAt,
      postType,
      postizPostId,
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

  // Delete from SQLite and cancel any active exact timers
  const deleteStmt = database.prepare("DELETE FROM content_posts WHERE id = ?");
  for (const p of postsToDelete) {
    cancelExactTikTokPost(p.id);
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
