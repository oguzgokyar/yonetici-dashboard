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
    visualMood: "stylized_3d",
    aspectRatio: "9:16",
    musicSpec: {
      moodTr: "Neşeli animasyon orkestrası",
      instrumentationTr: "Marimba, pizzicato yaylılar ve flüt",
      musicPromptEn: "Whimsical upbeat 3D animation soundtrack with marimba, light woodwinds and playful pizzicato strings, no vocals",
    },
    characterAnchor: {
      name: "Tavşan Pamuk",
      archetypeTr: "Meraklı sevimli kahraman",
      masterVisualPromptEn: "Stylized 3D animated character design model sheet of Rabbit Pamuk, Disney Pixar style, soft white fur, oversized expressive brown eyes, blue vest, vibrant volumetric lighting, clean 3D render",
      fixedTraitsEn: "Stylized 3D white rabbit, oversized expressive eyes, small blue wool vest with brass button",
    },
    scenes: [
      {
        sceneIndex: 1,
        shotType: "establishing",
        durationSeconds: 10,
        actionType: "new_scene",
        cameraSetup: "50mm prime, slow push-in",
        lightingSetup: "Warm golden hour rim light",
        summaryTr: "Çayırda ilk karşılaşma",
        promptEn: "Stylized 3D animated scene. Rabbit Pamuk (stylized 3D white rabbit, oversized expressive eyes, blue vest) hops across soft meadow...",
      },
      {
        sceneIndex: 2,
        shotType: "resolution_climax",
        durationSeconds: 20,
        actionType: "extend",
        cameraSetup: "50mm prime, tracking shot",
        lightingSetup: "Golden sunset sunbeams",
        summaryTr: "Yan yana yürüyüş",
        promptEn: "Stylized 3D animated scene. Rabbit Pamuk continues walking calmly beside the friendly lion...",
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
  assert.ok(director.CINEMATIC_VISUAL_MOODS.stylized_3d);

  const result = await director.planCinematicStoryboard({
    topic: "Tavşan ve aslanın dostluğu",
    visualMood: "stylized_3d",
    targetDuration: "30s",
    aspectRatio: "9:16",
    includeMusic: true,
  });

  assert.equal(result.title, "Altın Çayırda Tavşan ve Aslan");
  assert.equal(result.totalDurationSeconds, 30);
  assert.equal(result.scenes.length, 2);
  assert.equal(result.scenes[0].actionType, "new_scene");
  assert.equal(result.scenes[1].actionType, "extend");
  assert.ok(result.musicSpec);
  assert.equal(result.musicSpec.moodTr, "Neşeli animasyon orkestrası");
  assert.ok(result.musicSpec.musicPromptEn.includes("3D animation"));
  assert.ok(result.characterAnchor);
  assert.equal(result.characterAnchor.name, "Tavşan Pamuk");
  assert.ok(result.characterAnchor.masterVisualPromptEn.includes("3D"));
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

test("Google Vids UI, character anchor visual harmony, tabbed scene navigation and edit button invariants", () => {
  const uiSource = fs.readFileSync(new URL("../src/features/generation/google-vids-studio.tsx", import.meta.url), "utf8");
  const charRouteSource = fs.readFileSync(new URL("../src/app/api/projects/[projectId]/google-vids/character-anchor/route.ts", import.meta.url), "utf8");
  const videosRouteSource = fs.readFileSync(new URL("../src/app/api/videos/route.ts", import.meta.url), "utf8");
  const googleVidsRouteSource = fs.readFileSync(new URL("../src/app/api/projects/[projectId]/google-vids/route.ts", import.meta.url), "utf8");

  // 1. Karakter DNA'sı görsel tarz uyumu
  assert.ok(charRouteSource.includes("visualMood?: CinematicVisualMood"), "character-anchor route must accept visualMood");
  assert.ok(charRouteSource.includes("CINEMATIC_VISUAL_MOODS"), "character-anchor route must import CINEMATIC_VISUAL_MOODS");
  assert.ok(charRouteSource.includes("stylized_3d"), "character-anchor route must handle stylized_3d specifically");
  assert.ok(uiSource.includes("visualMood: targetMoodKey"), "google-vids-studio must pass visualMood when generating character anchor");

  // 2. Sekmeli sahne gezintisi ve kutu sınırlamalarının olmaması
  assert.ok(uiSource.includes("activeSceneTabIdx"), "google-vids-studio must have activeSceneTabIdx state");
  assert.ok(uiSource.includes("setActiveSceneTabIdx(idx)"), "google-vids-studio must switch tabs on scene click");
  assert.ok(uiSource.includes("minHeight: \"150px\""), "promptEn textarea must have generous minHeight without clamp");
  assert.ok(uiSource.includes("← Önceki Sahne"), "must provide previous scene navigation button");
  assert.ok(uiSource.includes("Sonraki Sahne →"), "must provide next scene navigation button");

  // 3. Müzik aktif edildiğinde müzik üretim promptunun görünür olması
  assert.ok(uiSource.includes("Müzik Üretim Promptu (Google Vids Audio - İngilizce)"), "must label visible music generation prompt");
  assert.ok(uiSource.includes("updateMusicPrompt"), "must provide function to update music prompt");

  // 4. Üretilen videolara Düzenle butonu eklenmesi ve senaryonun geri çağrılması
  assert.ok(uiSource.includes("handleEditVideo(video)"), "must have handleEditVideo for restoring storyboard");
  assert.ok(uiSource.includes("Düzenle"), "must have Düzenle button on video cards");
  assert.ok(videosRouteSource.includes("storyboard = {"), "api/videos must include storyboard in response for google-vids");
  assert.ok(googleVidsRouteSource.includes("characterAnchor: storyboard.characterAnchor"), "google-vids route must store characterAnchor in request_json");

  // 5. Senaryo içerik kutularında hızlı kopyala simgesi
  assert.ok(uiSource.includes("handleCopy"), "must have handleCopy function");
  assert.ok(uiSource.includes("char-dna"), "must have copy button on character DNA");
  assert.ok(uiSource.includes("music-prompt"), "must have copy button on music prompt");
  assert.ok(uiSource.includes("scene-${currentIdx}-prompt"), "must have copy button on omni prompt");

  // 6. Hızlı İçerik Önerileri (QuickIdeasDrawer) yan panel entegrasyonu
  const quickDrawerSource = fs.readFileSync(new URL("../src/components/layout/quick-ideas-drawer.tsx", import.meta.url), "utf8");
  const shellSource = fs.readFileSync(new URL("../src/components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.ok(quickDrawerSource.includes("Hızlı İçerik Önerileri"), "QuickIdeasDrawer must render title");
  assert.ok(quickDrawerSource.includes("vertical_video"), "QuickIdeasDrawer must have vertical_video icon tab");
  assert.ok(quickDrawerSource.includes("carousel"), "QuickIdeasDrawer must have carousel icon tab");
  assert.ok(quickDrawerSource.includes("single_post"), "QuickIdeasDrawer must have single_post icon tab");
  assert.ok(quickDrawerSource.includes("engagement"), "QuickIdeasDrawer must have engagement icon tab");
  assert.ok(quickDrawerSource.includes("kanban-card"), "QuickIdeasDrawer must render strategy idea cards");
  assert.ok(shellSource.includes("QuickIdeasDrawer"), "DashboardShell must integrate QuickIdeasDrawer");
});
