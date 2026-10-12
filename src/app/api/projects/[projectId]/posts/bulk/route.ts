import { getDatabase } from "@/lib/server/database";
import { resolvePackageItemsForPublishing } from "@/lib/server/canva-package-service";
import {
  createPostizPost,
  uploadMediaToPostiz,
  YouTubePostSettings,
  TikTokPostSettings,
} from "@/lib/server/postiz-client";
import { appendMusicAttribution, resolveMusicAttribution } from "@/lib/music-attribution";
import { uploadVideoViaTikTokBrowser } from "@/lib/server/tiktok-browser-service";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ projectId: string }> };

type TargetSetting = {
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
};

type BulkItemPayload = {
  title?: string;
  contentType?: "image" | "video";
  mediaUrl?: string;
  assetId?: string;
  mediaPackageId?: string;
  caption?: string;
  hashtags?: string;
  scheduleType?: "now" | "schedule" | "draft";
  scheduledAt?: string;
  targets: TargetSetting[];
};

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    items?: BulkItemPayload[];
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ ok: false, message: "En az bir içerik öğesi seçilmelidir." }, { status: 400 });
  }

  const database = getDatabase();
  const dataDir = path.join(process.cwd(), ".data");
  const assetDir = path.join(dataDir, "assets");
  const videoDir = path.join(dataDir, "videos");
  const videoRendersDir = path.join(dataDir, "video-renders");

  const results: Array<{
    success: boolean;
    title: string;
    postId?: string;
    error?: string;
  }> = [];

  for (const item of items) {
    const itemTitle = item.title?.trim() || "Toplu Gönderi";
    try {
      if (!Array.isArray(item.targets) || item.targets.length === 0) {
        results.push({ success: false, title: itemTitle, error: "Hedef sosyal medya hesabı seçilmedi." });
        continue;
      }

      // 1. Canva Package Branch
      if (item.mediaPackageId?.trim()) {
        const mediaPackageId = item.mediaPackageId.trim();
        let packageItems;
        try {
          packageItems = resolvePackageItemsForPublishing({
            database,
            packageId: mediaPackageId,
            projectId,
            assetsDir: assetDir,
          });
        } catch (err) {
          results.push({
            success: false,
            title: itemTitle,
            error: err instanceof Error ? err.message : "Medya paketi çözümlenemedi.",
          });
          continue;
        }

        const postizMediaList: Array<{ id: string; path: string }> = [];
        for (const pItem of packageItems) {
          const uploaded = await uploadMediaToPostiz(pItem.buffer, pItem.filename, pItem.mimeType);
          postizMediaList.push({ id: uploaded.id, path: uploaded.path });
        }

        for (const target of item.targets) {
          const postId = crypto.randomUUID();
          const now = new Date().toISOString();
          const targetScheduleType = target.scheduleType || item.scheduleType || "now";
          const targetScheduledAt = target.scheduledAt || item.scheduledAt;
          const targetPostType = target.postType || "post";
          const targetCaption = target.caption !== undefined ? target.caption.trim() : item.caption || "";
          const targetHashtags = target.hashtags !== undefined ? target.hashtags.trim() : item.hashtags || "";

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
              targetScheduleType === "draft"
                ? "draft"
                : targetScheduleType === "now"
                ? "published"
                : "scheduled";

            database
              .prepare(`
                INSERT INTO content_posts (
                  id, project_id, title, content_type, media_url,
                  caption, hashtags, status, schedule_type, scheduled_at,
                  integration_id, post_type, postiz_post_id, media_package_id,
                  media_json, error_message, created_at, updated_at
                ) VALUES (?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
              `)
              .run(
                postId,
                projectId,
                target.title || itemTitle,
                postizMediaList[0]?.path || "",
                targetCaption,
                targetHashtags,
                finalStatus,
                targetScheduleType,
                targetScheduledAt || null,
                target.integrationId,
                targetPostType,
                createdPostId,
                mediaPackageId,
                JSON.stringify(postizMediaList.map((m) => ({ url: m.path }))),
                now,
                now
              );

            results.push({ success: true, title: itemTitle, postId });
          } catch (tErr) {
            results.push({
              success: false,
              title: itemTitle,
              error: tErr instanceof Error ? tErr.message : "Postiz paylaşım hatası",
            });
          }
        }
        continue;
      }

      // 2. Single Media (Image / Video / Stock) Branch
      let fileBuffer: Buffer | null = null;
      let filename = `asset-${Date.now()}`;
      let mimeType = item.contentType === "video" ? "video/mp4" : "image/png";
      const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
      let candidateId = item.assetId?.trim() || "";
      if (!candidateId && item.mediaUrl) {
        const match = item.mediaUrl.match(uuidRegex);
        if (match) candidateId = match[0];
      }

      if (candidateId) {
        // Try local asset first from .data/assets
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
          } catch {}
        }

        if (!fileBuffer) {
          const directImg = path.join(assetDir, `${candidateId}.png`);
          if (fs.existsSync(directImg)) {
            fileBuffer = fs.readFileSync(directImg);
            filename = `creative-${candidateId}.png`;
            mimeType = "image/png";
          }
        }

        if (!fileBuffer) {
          const candExt = candidateId.endsWith(".mp4") ? candidateId : `${candidateId}.mp4`;
          for (const vPath of [
            path.join(videoRendersDir, candExt),
            path.join(videoDir, candExt),
            path.join(dataDir, candExt),
          ]) {
            if (fs.existsSync(vPath)) {
              fileBuffer = fs.readFileSync(vPath);
              filename = `video-${candidateId}.mp4`;
              mimeType = "video/mp4";
              break;
            }
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
            } catch {
              // ignore
            }
          }
        }
      }

      // Fallback: download remote mediaUrl
      if (!fileBuffer && item.mediaUrl) {
        if (item.mediaUrl.startsWith("/")) {
          const directPublic = path.join(process.cwd(), "public", item.mediaUrl.replace(/^\//, ""));
          const dataDirPublic = path.join(dataDir, item.mediaUrl.replace(/^\//, ""));
          if (fs.existsSync(directPublic)) {
            fileBuffer = fs.readFileSync(directPublic);
          } else if (fs.existsSync(dataDirPublic)) {
            fileBuffer = fs.readFileSync(dataDirPublic);
          }
        } else if (item.mediaUrl.startsWith("http")) {
          const res = await fetch(item.mediaUrl);
          if (res.ok) {
            fileBuffer = Buffer.from(await res.arrayBuffer());
            const ct = res.headers.get("content-type");
            if (ct) mimeType = ct;
          }
        }
      }

      if (!fileBuffer) {
        results.push({ success: false, title: itemTitle, error: "Medya dosyası okunamadı veya bulunamadı." });
        continue;
      }

      const postizMedia = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
      const isVideo = mimeType.startsWith("video/") || filename.endsWith(".mp4");
      const musicAttribution = resolveMusicAttribution(database, projectId, {
        assetId: candidateId, mediaUrl: item.mediaUrl,
      });

      for (const target of item.targets) {
        const postId = crypto.randomUUID();
        const now = new Date().toISOString();
        const targetScheduleType = target.scheduleType || item.scheduleType || "now";
        const targetScheduledAt = target.scheduledAt || item.scheduledAt;
        const targetPostType = target.postType || (isVideo ? "reel" : "post");
        const targetCaption = appendMusicAttribution(
          target.caption !== undefined ? target.caption.trim() : item.caption || "",
          musicAttribution
        );
        const targetHashtags = target.hashtags !== undefined ? target.hashtags.trim() : item.hashtags || "";

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

        // TikTok Tarayıcı Yükleme Modu Kontrolü
        if (platformIdentifier.includes("tiktok") && effectiveTiktokMethod === "browser" && isVideo) {
          const tmpVideoPath = path.join("/tmp", `tiktok_upload_${postId}.mp4`);
          try {
            fs.writeFileSync(tmpVideoPath, fileBuffer);
            const browserRes = await uploadVideoViaTikTokBrowser({
              videoPath: tmpVideoPath,
              caption: fullCaption,
              visibility: "PUBLIC",
            });
            try { fs.unlinkSync(tmpVideoPath); } catch {}

            if (!browserRes.ok) {
              if (browserRes.need_login) {
                throw new Error("TikTok tarayıcı oturumu kapalı! Lütfen Hesaplar sayfasından TikTok girişini tamamlayın.");
              }
              throw new Error(browserRes.error || "TikTok tarayıcı yüklemesi başarısız oldu.");
            }

            database
              .prepare(`
                INSERT INTO content_posts (
                  id, project_id, title, content_type, media_url,
                  caption, hashtags, status, schedule_type, scheduled_at,
                  integration_id, post_type, postiz_post_id, postiz_media_id,
                  error_message, created_at, updated_at
                ) VALUES (?, ?, ?, 'video', ?, ?, ?, 'published', 'now', NULL, ?, ?, ?, ?, NULL, ?, ?)
              `)
              .run(
                postId,
                projectId,
                target.title || itemTitle,
                postizMedia.path,
                targetCaption,
                targetHashtags,
                target.integrationId,
                targetPostType,
                `tiktok_browser_${postId.slice(0, 8)}`,
                postizMedia.id,
                now,
                now
              );

            results.push({ success: true, title: itemTitle, postId });
            continue;
          } catch (bErr) {
            try { if (fs.existsSync(tmpVideoPath)) fs.unlinkSync(tmpVideoPath); } catch {}
            results.push({
              success: false,
              title: itemTitle,
              error: bErr instanceof Error ? bErr.message : "TikTok tarayıcı hatası",
            });
            continue;
          }
        }

        try {
          const postizResult = await createPostizPost({
            type: targetScheduleType,
            date: targetScheduledAt,
            integrationId: target.integrationId,
            platformIdentifier,
            caption: fullCaption,
            media: postizMedia ? [{ id: postizMedia.id, path: postizMedia.path }] : [],
            postType: targetPostType,
            youtubeSettings: target.youtubeSettings,
            tiktokSettings: target.tiktokSettings,
          });

          const createdPostId = postizResult[0]?.postId || "";
          const finalStatus =
            targetScheduleType === "draft"
              ? "draft"
              : targetScheduleType === "now"
              ? "published"
              : "scheduled";

          database
            .prepare(`
              INSERT INTO content_posts (
                id, project_id, title, content_type, media_url,
                caption, hashtags, status, schedule_type, scheduled_at,
                integration_id, post_type, postiz_post_id, postiz_media_id,
                error_message, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            `)
            .run(
              postId,
              projectId,
              target.title || itemTitle,
              isVideo ? "video" : "image",
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
              now,
              now
            );

          results.push({ success: true, title: itemTitle, postId });
        } catch (tErr) {
          results.push({
            success: false,
            title: itemTitle,
            error: tErr instanceof Error ? tErr.message : "Postiz paylaşım hatası",
          });
        }
      }
    } catch (itemErr) {
      results.push({
        success: false,
        title: itemTitle,
        error: itemErr instanceof Error ? itemErr.message : "İçerik işlenemedi",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return Response.json({
    ok: successCount > 0,
    successCount,
    failCount,
    total: results.length,
    results,
    message: `${successCount} içerik başarıyla yayınlandı/planlandı${failCount > 0 ? `, ${failCount} içerik başarısız oldu.` : "."}`,
  });
}
