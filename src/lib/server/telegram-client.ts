import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  threadId?: string;
  enabled: boolean;
}

/**
 * Telegram yapılandırmasını çözer:
 * 1. integration_configs tablosundaki 'telegram' servisi (varsa)
 * 2. process.env içindeki TELEGRAM_BOT_TOKEN ve TELEGRAM_HOME_CHANNEL
 */
export function getTelegramConfig(): TelegramConfig | null {
  try {
    const db = getDatabase();
    if (db) {
      const row = db
        .prepare("SELECT enabled, encrypted_api_key, settings_json FROM integration_configs WHERE service = 'telegram'")
        .get() as { enabled: number; encrypted_api_key?: string; settings_json?: string } | undefined;

      if (row && row.enabled) {
        let botToken = "";
        if (row.encrypted_api_key) {
          try {
            botToken = decryptSecret(row.encrypted_api_key);
          } catch {
            botToken = "";
          }
        }
        let settings: { chatId?: string; threadId?: string } = {};
        if (row.settings_json) {
          try {
            settings = JSON.parse(row.settings_json);
          } catch {
            settings = {};
          }
        }
        if (botToken && settings.chatId) {
          return {
            botToken,
            chatId: settings.chatId,
            threadId: settings.threadId || undefined,
            enabled: true,
          };
        }
      }
    }
  } catch {
    // Database erişimi yoksa fallback ortam değişkenleri kullanılır
  }

  // Fallback: Environment variables
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_HOME_CHANNEL || process.env.TELEGRAM_CHAT_ID;
  const envThreadId = process.env.TELEGRAM_HOME_CHANNEL_THREAD_ID;

  if (envToken && envChatId) {
    return {
      botToken: envToken,
      chatId: envChatId,
      threadId: envThreadId || undefined,
      enabled: true,
    };
  }

  return null;
}

/**
 * Yerel dosya yolunu resolve eder:
 * /api/assets/[id] -> .data/assets/[id].[ext]
 * /api/videos/[id] -> .data/video-renders/[id].mp4
 * .data/ -> disk yolu
 */
export function resolveLocalMediaPath(mediaUrl: string): { filePath: string; mimeType: string; filename: string } | null {
  const cleanUrl = mediaUrl.split("?")[0];
  const cwd = process.cwd();

  // 1. /api/assets/[id]
  const assetMatch = cleanUrl.match(/\/api\/assets\/([a-f0-9-]+)/i);
  if (assetMatch) {
    const assetId = assetMatch[1];
    const assetDir = path.join(cwd, ".data", "assets");
    const metaPath = path.join(assetDir, `${assetId}.json`);
    let ext = "png";
    let mimeType = "image/png";
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        if (meta.extension) ext = meta.extension;
        if (meta.mimeType) mimeType = meta.mimeType;
      } catch {}
    }
    const filePath = path.join(assetDir, `${assetId}.${ext}`);
    if (fs.existsSync(filePath)) {
      return { filePath, mimeType, filename: `kreatif-${assetId.slice(0, 8)}.${ext}` };
    }
  }

  // 2. /api/videos/[id]
  const videoMatch = cleanUrl.match(/\/api\/videos\/([a-z0-9_-]+)/i);
  if (videoMatch) {
    const videoId = videoMatch[1];
    const videoPath = path.join(cwd, ".data", "video-renders", `${videoId}.mp4`);
    if (fs.existsSync(videoPath)) {
      return { filePath: videoPath, mimeType: "video/mp4", filename: `video-${videoId.slice(0, 8)}.mp4` };
    }
  }

  // 3. Doğrudan dosya yolu veya /uploads/
  if (cleanUrl.startsWith("/") && fs.existsSync(cleanUrl)) {
    const ext = path.extname(cleanUrl).toLowerCase().replace(".", "");
    const isVideo = ["mp4", "mov", "webm"].includes(ext);
    return {
      filePath: cleanUrl,
      mimeType: isVideo ? `video/${ext}` : `image/${ext || "png"}`,
      filename: path.basename(cleanUrl),
    };
  }

  return null;
}

/**
 * Medyayı Telegram Bot API üzerinden hedefe gönderir.
 */
export async function sendMediaToTelegram(options: {
  mediaUrl: string;
  mediaType?: "image" | "video" | "auto";
  caption?: string;
  config?: TelegramConfig;
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const config = options.config || getTelegramConfig();
  if (!config || !config.botToken || !config.chatId) {
    return {
      ok: false,
      error: "Telegram botu yapılandırılmamış. Lütfen Ayarlar > API Yönetimi altından Bot Token ve Hedef Chat ID ekleyin veya ortam değişkenlerini kontrol edin.",
    };
  }

  const { botToken, chatId, threadId } = config;
  const resolved = resolveLocalMediaPath(options.mediaUrl);
  const caption = options.caption ? options.caption.slice(0, 1024) : undefined;

  let inferredType = options.mediaType || "auto";
  if (inferredType === "auto") {
    if (resolved?.mimeType.startsWith("video/") || options.mediaUrl.endsWith(".mp4") || options.mediaUrl.includes("/videos/")) {
      inferredType = "video";
    } else {
      inferredType = "image";
    }
  }

  try {
    if (resolved) {
      // Yerel dosya: multipart/form-data ile gönderim (En hızlı ve güvenilir)
      const fileBytes = fs.readFileSync(resolved.filePath);
      const blob = new Blob([fileBytes], { type: resolved.mimeType });
      const formData = new FormData();
      formData.append("chat_id", chatId);
      if (threadId) formData.append("message_thread_id", threadId);
      if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "HTML");
      }

      const method = inferredType === "video" ? "sendVideo" : "sendPhoto";
      formData.append(inferredType === "video" ? "video" : "photo", blob, resolved.filename);

      const resp = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (!data.ok) {
        return { ok: false, error: data.description || "Telegram API hatası" };
      }
      return { ok: true, messageId: data.result?.message_id };
    } else {
      // Uzak URL: JSON veya direct form-data ile iletim
      const method = inferredType === "video" ? "sendVideo" : "sendPhoto";
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        [inferredType === "video" ? "video" : "photo"]: options.mediaUrl,
      };
      if (threadId) payload.message_thread_id = threadId;
      if (caption) {
        payload.caption = caption;
        payload.parse_mode = "HTML";
      }

      const resp = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.ok) {
        return { ok: false, error: data.description || "Telegram API hatası" };
      }
      return { ok: true, messageId: data.result?.message_id };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}
