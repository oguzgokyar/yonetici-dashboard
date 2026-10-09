import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";

const nativeRequire = createRequire(import.meta.url);
const directorSourceUrl = new URL("../src/lib/server/cinematic-prompt-director.ts", import.meta.url);
const workerSourceUrl = new URL("../src/lib/server/production-worker.ts", import.meta.url);

function loadModule(url, stubs = {}) {
  const source = fs.readFileSync(url, "utf8");
  const output = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  const exports = {};
  new Function("require", "exports", output)(
    (name) => (name.startsWith("node:") ? nativeRequire(name) : stubs[name] || {}),
    exports
  );
  return exports;
}

test("Cinematic visual moods catalog and director storyboard planner work as expected", async () => {
  const mockLlmJson = JSON.stringify({
    title: "Altın Çayırda Tavşan ve Aslan",
    narrativeTr: "Gün batımında tavşan ve aslanın barışçıl karşılaşması.",
    totalDurationSeconds: 30,
    visualMood: "golden_hour",
    aspectRatio: "9:16",
    scenes: [
      {
        sceneIndex: 1,
        shotType: "establishing",
        durationSeconds: 10,
        actionType: "new_scene",
        cameraSetup: "50mm prime, slow push-in",
        lightingSetup: "Warm golden hour rim light",
        summaryTr: "Çayırda ilk karşılaşma",
        promptEn: "Medium shot on 50mm lens, a swift white rabbit pauses on soft grass as a resting lion lifts its head under warm sunset rim light.",
      },
      {
        sceneIndex: 2,
        shotType: "resolution_climax",
        durationSeconds: 20,
        actionType: "extend",
        cameraSetup: "50mm prime, tracking shot",
        lightingSetup: "Golden sunset sunbeams",
        summaryTr: "Yan yana yürüyüş",
        promptEn: "Tracking shot on 50mm lens, the lion stands and walks calmly beside the hopping rabbit through amber grass.",
      },
    ],
  });

  const director = loadModule(directorSourceUrl, {
    "@/lib/server/cliproxy-text": {
      completeText: async () => ({ content: mockLlmJson }),
      parseJsonResponse: (txt) => JSON.parse(txt),
    },
  });

  assert.ok(director.CINEMATIC_VISUAL_MOODS.golden_hour);
  assert.ok(director.CINEMATIC_VISUAL_MOODS.cinematic_photoreal);

  const result = await director.planCinematicStoryboard({
    topic: "Tavşan ve aslanın dostluğu",
    visualMood: "golden_hour",
    targetDuration: "30s",
    aspectRatio: "9:16",
  });

  assert.equal(result.title, "Altın Çayırda Tavşan ve Aslan");
  assert.equal(result.totalDurationSeconds, 30);
  assert.equal(result.scenes.length, 2);
  assert.equal(result.scenes[0].actionType, "new_scene");
  assert.equal(result.scenes[1].actionType, "extend");
});

test("FIFO production worker dispatches google-vids jobs sequentially under heavy-job claim", async () => {
  delete globalThis.__fifoProductionQueue;
  const events = [];
  let jobStatus = "queued";
  const fakeJob = {
    id: "vids-job-1",
    project_id: "proj-1",
    type: "google-vids",
    provider: "google",
    model: "vids-omni-720p",
    prompt: "Tavşan ve Aslan",
    request_json: "{}",
    created_at: new Date().toISOString(),
  };

  const db = {
    prepare(sql) {
      return {
        get() {
          if (sql.includes("type = 'canva'")) return undefined;
          if (sql.includes("status = 'queued'") && jobStatus === "queued") {
            return fakeJob;
          }
          return undefined;
        },
        run() {
          return { changes: 1 };
        },
      };
    },
  };

  const worker = loadModule(workerSourceUrl, {
    "@/lib/server/database": { getDatabase: () => db },
    "@/lib/server/heavy-job-coordinator": {
      withHeavyJob: async (id, _claim, fn) => {
        events.push(`lock:${id}`);
        try {
          return await fn();
        } finally {
          events.push(`unlock:${id}`);
        }
      },
    },
    "@/lib/server/google-vids-service": {
      processGoogleVidsJob: async (job) => {
        events.push(`process:${job.id}`);
        jobStatus = "complete";
      },
    },
  });

  worker.triggerProductionWorker();
  await new Promise((r) => setTimeout(r, 40));

  assert.deepEqual(events, [
    "lock:google-vids:vids-job-1",
    "process:vids-job-1",
    "unlock:google-vids:vids-job-1",
  ]);
});
