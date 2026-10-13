import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/server/secrets";
import { getTelegramConfig } from "@/lib/server/telegram-client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = getTelegramConfig();
    const db = getDatabase();
    let isDbConfigured = false;
    let dbChatId = "";
    let dbThreadId = "";
    let maskedToken = "";

    if (db) {
      const row = db
        .prepare("SELECT enabled, encrypted_api_key, settings_json FROM integration_configs WHERE service = 'telegram'")
        .get() as { enabled: number; encrypted_api_key?: string; settings_json?: string } | undefined;

      if (row) {
        isDbConfigured = Boolean(row.enabled);
        if (row.encrypted_api_key) {
          try {
            const rawToken = decryptSecret(row.encrypted_api_key);
            maskedToken = maskSecret(rawToken);
          } catch {}
        }
        if (row.settings_json) {
          try {
            const s = JSON.parse(row.settings_json);
            dbChatId = s.chatId || "";
            dbThreadId = s.threadId || "";
          } catch {}
        }
      }
    }

    const isAvailable = Boolean(config?.botToken && config?.chatId);

    return NextResponse.json({
      configured: isAvailable,
      source: isDbConfigured ? "database" : (config ? "environment" : "none"),
      chatId: dbChatId || config?.chatId || "",
      threadId: dbThreadId || config?.threadId || "",
      hasApiKey: Boolean(config?.botToken),
      maskedToken: maskedToken || (config?.botToken ? maskSecret(config.botToken) : ""),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, botToken, chatId, threadId, enabled } = body;

    const db = getDatabase();
    if (!db) {
      return NextResponse.json({ error: "Veritabanı bağlantısı kurulamadı." }, { status: 500 });
    }

    if (action === "test") {
      const targetToken = botToken || getTelegramConfig()?.botToken;
      const targetChat = chatId || getTelegramConfig()?.chatId;
      const targetThread = threadId || getTelegramConfig()?.threadId;

      if (!targetToken || !targetChat) {
        return NextResponse.json({ ok: false, error: "Test için geçerli bir bot token ve chat ID gereklidir." }, { status: 400 });
      }

      const payload: Record<string, unknown> = {
        chat_id: targetChat,
        text: "⚡ <b>Yönetici Dashboard</b> Telegram bağlantı testi başarılı!",
        parse_mode: "HTML",
      };
      if (targetThread) payload.message_thread_id = targetThread;

      const resp = await fetch(`https://api.telegram.org/bot${targetToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.ok) {
        return NextResponse.json({ ok: false, error: data.description || "Telegram API hatası" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "Test mesajı başarıyla gönderildi!" });
    }

    // Kaydetme işlemi
    const existing = db
      .prepare("SELECT encrypted_api_key FROM integration_configs WHERE service = 'telegram'")
      .get() as { encrypted_api_key?: string } | undefined;

    let finalEncryptedKey = existing?.encrypted_api_key || null;
    if (botToken && botToken.trim()) {
      finalEncryptedKey = encryptSecret(botToken.trim());
    }

    const settingsJson = JSON.stringify({
      chatId: chatId?.trim() || "",
      threadId: threadId?.trim() || "",
    });

    const isEnabled = enabled !== undefined ? (enabled ? 1 : 0) : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO integration_configs (service, enabled, base_url, encrypted_api_key, settings_json, updated_at)
      VALUES ('telegram', ?, 'https://api.telegram.org', ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        enabled = excluded.enabled,
        encrypted_api_key = COALESCE(excluded.encrypted_api_key, integration_configs.encrypted_api_key),
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
    `).run(isEnabled, finalEncryptedKey, settingsJson, now);

    return NextResponse.json({ ok: true, message: "Telegram yapılandırması kaydedildi." });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kaydedilemedi." }, { status: 500 });
  }
}
