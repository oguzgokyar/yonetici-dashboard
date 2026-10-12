import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";

const nativeRequire = createRequire(import.meta.url);
const schedulerUrl = new URL("../src/lib/server/tiktok-exact-scheduler.ts", import.meta.url);

function loadModule(url, stubs = {}) {
  const source = fs.readFileSync(url, "utf8");
  const output = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  });
  const exports = {};
  new Function("require", "exports", output)(
    (name) => (name === "fs" || name === "node:fs" ? nativeRequire("node:fs") : name === "path" || name === "node:path" ? nativeRequire("node:path") : name.startsWith("node:") ? nativeRequire(name) : stubs[name] || {}),
    exports
  );
  return exports;
}

test("TikTok Exact-Time Scheduler sets and cancels exact timers and fires direct upload at deadline", async () => {
  let uploadedArgs = null;
  let updatedStatus = null;

  const mockDb = {
    prepare: (sql) => ({
      get: (id) => {
        if (sql.includes("FROM content_posts")) {
          return {
            id,
            project_id: "proj_1",
            title: "Planlı Robotik Video",
            caption: "Açıklama metni",
            hashtags: "#robot #kodlama",
            status: "scheduled",
            local_path: "/opt/data/Karanliga_Isik_Veren_Eller_Cyberpunk_20s.mp4",
            media_url: "",
          };
        }
        return undefined;
      },
      run: (...args) => {
        if (sql.includes("status = 'published'")) {
          updatedStatus = "published";
        }
        return { changes: 1 };
      },
      all: () => [],
    }),
  };

  const mod = loadModule(schedulerUrl, {
    "server-only": {},
    "@/lib/server/database": {
      getDatabase: () => mockDb,
    },
    "@/lib/server/tiktok-browser-service": {
      uploadVideoViaTikTokBrowser: async (opts) => {
        uploadedArgs = opts;
        return { ok: true, status: "published" };
      },
    },
  });

  // 1. Schedule a post 1500ms in the future
  const futureIso = new Date(Date.now() + 1500).toISOString();
  mod.scheduleExactTikTokPost("post_test_1", futureIso);

  // Immediately after scheduling, it must NOT have uploaded yet!
  assert.equal(uploadedArgs, null, "Must not upload immediately when scheduled in future");

  // 2. Wait 2000ms for the exact timer to fire
  await new Promise((r) => setTimeout(r, 2000));

  // Verify it fired and uploaded in direct mode (no scheduleTime!)
  assert.ok(uploadedArgs, "Exact timer must have triggered the upload at deadline");
  assert.equal(uploadedArgs.visibility, "PUBLIC");
  assert.equal(uploadedArgs.scheduleTime, undefined, "Must NOT pass scheduleTime to TikTok browser");
  assert.match(uploadedArgs.caption, /#robot #kodlama/, "Hashtags must be formatted into caption");
  assert.equal(updatedStatus, "published", "Database status must be updated to published");

  // 3. Test cancellation before deadline
  uploadedArgs = null;
  const futureIso2 = new Date(Date.now() + 1500).toISOString();
  mod.scheduleExactTikTokPost("post_test_2", futureIso2);
  mod.cancelExactTikTokPost("post_test_2");
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal(uploadedArgs, null, "Cancelled timer must never fire");
});
