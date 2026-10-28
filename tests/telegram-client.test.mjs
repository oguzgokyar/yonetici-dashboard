import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";

const nativeRequire = createRequire(import.meta.url);
const sourceUrl = new URL("../src/lib/server/telegram-client.ts", import.meta.url);

async function loadTelegramClient(stubs = {}) {
  const source = fs.readFileSync(sourceUrl, "utf8");
  const output = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const exports = {};
  new Function("require", "exports", output)(
    (name) => {
      if (name.startsWith("node:") || name === "fs" || name === "path") {
        const mod = nativeRequire(name);
        return { ...mod, default: mod };
      }
      return stubs[name] || {};
    },
    exports
  );
  return exports;
}

test("Telegram Client - config resolution from env fallback", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:FAKE_TOKEN";
  process.env.TELEGRAM_HOME_CHANNEL = "99887766";
  process.env.TELEGRAM_HOME_CHANNEL_THREAD_ID = "42";

  const client = await loadTelegramClient({
    "@/lib/server/database": { getDatabase: () => null },
    "@/lib/server/secrets": { decryptSecret: (v) => v },
  });

  const config = client.getTelegramConfig();
  assert.ok(config !== null);
  assert.strictEqual(config.botToken, "123456:FAKE_TOKEN");
  assert.strictEqual(config.chatId, "99887766");
  assert.strictEqual(config.threadId, "42");
  assert.strictEqual(config.enabled, true);
});

test("Telegram Client - config resolution from database", async () => {
  const mockDb = {
    prepare: () => ({
      get: () => ({
        enabled: 1,
        encrypted_api_key: "ENC_TOKEN",
        settings_json: JSON.stringify({ chatId: "112233", threadId: "5" }),
      }),
    }),
  };

  const client = await loadTelegramClient({
    "@/lib/server/database": { getDatabase: () => mockDb },
    "@/lib/server/secrets": { decryptSecret: () => "DECRYPTED_TOKEN" },
  });

  const config = client.getTelegramConfig();
  assert.ok(config !== null);
  assert.strictEqual(config.botToken, "DECRYPTED_TOKEN");
  assert.strictEqual(config.chatId, "112233");
  assert.strictEqual(config.threadId, "5");
});

test("Telegram Client - resolveLocalMediaPath", async () => {
  const client = await loadTelegramClient({
    "@/lib/server/database": { getDatabase: () => null },
    "@/lib/server/secrets": { decryptSecret: (v) => v },
  });

  // Non-existent ID returns null
  assert.strictEqual(client.resolveLocalMediaPath("/api/assets/00000000-0000-0000-0000-000000000000"), null);
  assert.strictEqual(client.resolveLocalMediaPath("https://external.com/photo.jpg"), null);
});

test("Telegram Client - sendMediaToTelegram with mediaUrls sends sendMediaGroup", async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = null;
  let interceptedBody = null;

  globalThis.fetch = async (url, options) => {
    interceptedUrl = String(url);
    interceptedBody = options.body;
    return {
      json: async () => ({
        ok: true,
        result: [{ message_id: 101 }, { message_id: 102 }, { message_id: 103 }],
      }),
    };
  };

  try {
    const client = await loadTelegramClient({
      "@/lib/server/database": { getDatabase: () => null },
      "@/lib/server/secrets": { decryptSecret: (v) => v },
    });

    const config = {
      botToken: "123:TOKEN",
      chatId: "99999",
      enabled: true,
    };

    const res = await client.sendMediaToTelegram({
      mediaUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
      caption: "Test Karosel",
      config,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.messageId, 101);
    assert.deepStrictEqual(res.messageIds, [101, 102, 103]);
    assert.ok(interceptedUrl.includes("/sendMediaGroup"), "URL should be sendMediaGroup endpoint");
    assert.ok(interceptedBody instanceof FormData, "Body should be FormData");

    const mediaJson = interceptedBody.get("media");
    assert.ok(mediaJson, "media form entry should exist");
    const parsedMedia = JSON.parse(mediaJson);
    assert.strictEqual(parsedMedia.length, 3);
    assert.strictEqual(parsedMedia[0].media, "https://example.com/1.jpg");
    assert.strictEqual(parsedMedia[0].caption, "Test Karosel");
    assert.strictEqual(parsedMedia[1].media, "https://example.com/2.jpg");
    assert.strictEqual(parsedMedia[1].caption, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
