import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";

const nativeRequire = createRequire(import.meta.url);
const sourceUrl = new URL("../src/app/api/integrations/telegram/send/route.ts", import.meta.url);

async function loadSendRoute(stubs = {}) {
  const source = fs.readFileSync(sourceUrl, "utf8");
  const output = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  });
  const exports = {};
  new Function("require", "exports", output)(
    (name) => (name.startsWith("node:") ? nativeRequire(name) : (stubs[name] || {})),
    exports
  );
  return exports;
}

test("Telegram Send Route - rejects empty mediaUrl", async () => {
  const route = await loadSendRoute({
    "@/lib/server/telegram-client": { sendMediaToTelegram: async () => ({ ok: true }) },
    "next/server": {
      NextResponse: {
        json: (data, init) => ({ body: data, status: init?.status || 200 }),
      },
    },
  });

  const req = {
    json: async () => ({ mediaUrl: "" }),
  };

  const res = await route.POST(req);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.ok, false);
});

test("Telegram Send Route - delegates valid request to sendMediaToTelegram", async () => {
  let calledOptions = null;
  const route = await loadSendRoute({
    "@/lib/server/telegram-client": {
      sendMediaToTelegram: async (opts) => {
        calledOptions = opts;
        return { ok: true, messageId: 999 };
      },
    },
    "next/server": {
      NextResponse: {
        json: (data, init) => ({ body: data, status: init?.status || 200 }),
      },
    },
  });

  const req = {
    json: async () => ({
      mediaUrl: "/api/assets/sample-123",
      mediaType: "image",
      caption: "Test görseli",
    }),
  };

  const res = await route.POST(req);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.messageId, 999);
  assert.deepStrictEqual(calledOptions, {
    mediaUrl: "/api/assets/sample-123",
    mediaType: "image",
    caption: "Test görseli",
  });
});

test("Telegram Send Route - delegates mediaUrls array to sendMediaToTelegram", async () => {
  let calledOptions = null;
  const route = await loadSendRoute({
    "@/lib/server/telegram-client": {
      sendMediaToTelegram: async (opts) => {
        calledOptions = opts;
        return { ok: true, messageId: 100, messageIds: [100, 101] };
      },
    },
    "next/server": {
      NextResponse: {
        json: (data, init) => ({ body: data, status: init?.status || 200 }),
      },
    },
  });

  const req = {
    json: async () => ({
      mediaUrls: ["/api/assets/slide-1", "/api/assets/slide-2"],
      mediaType: "image",
      caption: "Karosel albümü",
    }),
  };

  const res = await route.POST(req);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.messageId, 100);
  assert.deepStrictEqual(res.body.messageIds, [100, 101]);
  assert.deepStrictEqual(calledOptions, {
    mediaUrls: ["/api/assets/slide-1", "/api/assets/slide-2"],
    mediaType: "image",
    caption: "Karosel albümü",
  });
});
