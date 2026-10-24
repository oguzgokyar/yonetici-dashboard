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
        voiceoverTr: "Güneşin altın ışıkları çayırı sararken, sevimli tavşan Pamuk ilk kez dev aslanla karşılaştı.",
        promptEn: "Stylized 3D animated scene. Rabbit Pamuk (stylized 3D white rabbit, oversized expressive eyes, blue vest) hops across soft meadow...",
      },
      {
        sceneIndex: 2,
        shotType: "action_development",
        durationSeconds: 10,
        actionType: "new_scene",
        cameraSetup: "50mm prime, tracking shot",
        lightingSetup: "Golden sunset sunbeams",
        summaryTr: "Yan yana yürüyüş",
        voiceoverTr: "Korkunun yerini merak aldı ve iki dost neşeyle birlikte adım atmaya başladı.",
        promptEn: "Stylized 3D animated scene. Rabbit Pamuk walks calmly beside the friendly lion in the meadow...",
      },
      {
        sceneIndex: 3,
        shotType: "resolution_climax",
        durationSeconds: 10,
        actionType: "new_scene",
        cameraSetup: "50mm prime, wide tilt",
        lightingSetup: "Golden sunset warm glow",
        summaryTr: "Dostluğun zaferi",
        voiceoverTr: "Gerçek dostluk farklılıklara bakmazdı; onlar artık ayrılmaz bir ikiliydi.",
        promptEn: "Stylized 3D animated scene. Rabbit Pamuk and the lion watch the sunset side by side...",
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
  assert.equal(result.scenes.length, 3);
  assert.equal(result.scenes[0].actionType, "new_scene");
  assert.equal(result.scenes[1].actionType, "new_scene");
  assert.equal(result.scenes[2].actionType, "new_scene");
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
  const deckSource = fs.existsSync(new URL("../src/features/generation/google-vids/components/vids-storyboard-deck.tsx", import.meta.url))
    ? fs.readFileSync(new URL("../src/features/generation/google-vids/components/vids-storyboard-deck.tsx", import.meta.url), "utf8")
    : "";
  const gallerySource = fs.existsSync(new URL("../src/features/generation/google-vids/components/vids-video-gallery.tsx", import.meta.url))
    ? fs.readFileSync(new URL("../src/features/generation/google-vids/components/vids-video-gallery.tsx", import.meta.url), "utf8")
    : "";
  const combinedUiSource = uiSource + "\n" + deckSource + "\n" + gallerySource;
  const charRouteSource = fs.readFileSync(new URL("../src/app/api/projects/[projectId]/google-vids/character-anchor/route.ts", import.meta.url), "utf8");
  const videosRouteSource = fs.readFileSync(new URL("../src/app/api/videos/route.ts", import.meta.url), "utf8");
  const googleVidsRouteSource = fs.readFileSync(new URL("../src/app/api/projects/[projectId]/google-vids/route.ts", import.meta.url), "utf8");

  // 1. Karakter DNA'sı görsel tarz uyumu
  assert.ok(charRouteSource.includes("visualMood?: CinematicVisualMood"), "character-anchor route must accept visualMood");
  assert.ok(charRouteSource.includes("CINEMATIC_VISUAL_MOODS"), "character-anchor route must import CINEMATIC_VISUAL_MOODS");
  assert.ok(charRouteSource.includes("stylized_3d"), "character-anchor route must handle stylized_3d specifically");
  assert.ok(uiSource.includes("visualMood: targetMoodKey"), "google-vids-studio must pass visualMood when generating character anchor");

  // 2. Sekmeli sahne gezintisi ve kutu sınırlamalarının olmaması
  assert.ok(combinedUiSource.includes("activeSceneTabIdx"), "google-vids-studio must have activeSceneTabIdx state");
  assert.ok(combinedUiSource.includes("setActiveSceneTabIdx(idx)"), "google-vids-studio must switch tabs on scene click");
  assert.ok(combinedUiSource.includes("minHeight: \"150px\""), "promptEn textarea must have generous minHeight without clamp");
  assert.ok(combinedUiSource.includes("← Önceki Sahne"), "must provide previous scene navigation button");
  assert.ok(combinedUiSource.includes("Sonraki Sahne →"), "must provide next scene navigation button");

  // 3. 3 Boyutlu Referans Görseller (Kişi, Mekan, Maket/Obje) paneli
  assert.ok(combinedUiSource.includes("Referans Görseller"), "must render 3-way visual anchors panel");
  assert.ok(combinedUiSource.includes("onGenerateVisualAnchor") || combinedUiSource.includes("onGenerateAllVisualAnchors"), "must provide visual anchor generation triggers");

  // 4. Üretilen videolara Düzenle butonu eklenmesi ve senaryonun geri çağrılması
  assert.ok(combinedUiSource.includes("handleEditVideo"), "must have handleEditVideo for restoring storyboard");
  assert.ok(combinedUiSource.includes("Düzenle"), "must have Düzenle button on video cards");
  assert.ok(videosRouteSource.includes("storyboard = {"), "api/videos must include storyboard in response for google-vids");
  assert.ok(googleVidsRouteSource.includes("characterAnchor: storyboard.characterAnchor"), "google-vids route must store characterAnchor in request_json");

  // 5. Senaryo içerik kutularında hızlı kopyala ve Omni prompt düzenleme
  assert.ok(combinedUiSource.includes("handleCopy"), "must have handleCopy function");
  assert.ok(combinedUiSource.includes("scene-${currentIdx}-prompt"), "must have copy button on omni prompt");

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

test("Desktop DIY & Cardboard craft has dedicated multi-shot (3 angles) and multi-event (2 actions) directing rules while other styles remain unaffected", async () => {
  let capturedSystemPromptDiy = "";
  let capturedSystemPromptOther = "";
  let capturedRerollPromptDiy = "";
  let capturedRerollPromptOther = "";

  const director = loadModule(directorSourceUrl, {
    "@/lib/server/cliproxy-text": {
      completeText: async (sys, usr) => {
        if (usr.includes("Masaüstü DIY & Karton Zanaat") || usr.includes("diy_craft_macro")) {
          capturedSystemPromptDiy = sys;
        } else {
          capturedSystemPromptOther = sys;
        }
        return { content: "" }; // triggers fallback
      },
      parseJsonResponse: () => null,
    },
  });

  // 1. diy_craft_macro planCinematicStoryboard
  const diyResult = await director.planCinematicStoryboard({
    topic: "Pet Şişeden Dikey Rüzgar Türbini ile LED Yakma",
    visualMood: "diy_craft_macro",
    targetDuration: "15s",
  });

  assert.ok(capturedSystemPromptDiy.includes("SPECIAL MULTI-SHOT & MULTI-ACTION DIRECTIVE ACTIVE FOR THIS STORYBOARD"));
  assert.ok(capturedSystemPromptDiy.includes("TWO distinct micro-events"));
  assert.ok(capturedSystemPromptDiy.includes("THREE different dynamic camera angles"));
  assert.ok(capturedSystemPromptDiy.includes("Three-shot dynamic sequence with rapid jump cuts"));

  // Check fallback scene generation has the 3-shot / 2-action structure
  assert.equal(diyResult.scenes.length, 4); // [3, 4, 4, 4] for 15s
  assert.ok(diyResult.scenes[0].cameraSetup.includes("3-shot dynamic jump cuts"));
  assert.ok(diyResult.scenes[0].promptEn.includes("Three-shot dynamic sequence with rapid jump cuts"));
  assert.ok(diyResult.scenes[0].summaryTr.includes("2 olaylı çok açılı montaj"));

  // 2. other visual moods (e.g. cinematic_photoreal or stylized_3d) MUST NOT have the multi-shot cuts
  const otherResult = await director.planCinematicStoryboard({
    topic: "Doğa Belgeseli",
    visualMood: "documentary_nature",
    targetDuration: "15s",
  });

  assert.ok(capturedSystemPromptOther.includes("INACTIVE FOR CURRENT STYLE"));
  assert.ok(capturedSystemPromptOther.includes("Strictly DO NOT use multi-cut jump-cuts or 3-shot sequences"));
  assert.ok(!otherResult.scenes[0].cameraSetup.includes("3-shot dynamic jump cuts"));
  assert.ok(!otherResult.scenes[0].promptEn.includes("Three-shot dynamic sequence"));

  // 3. rerollSingleScene under diy_craft_macro vs other
  const rerollDirector = loadModule(directorSourceUrl, {
    "@/lib/server/cliproxy-text": {
      completeText: async (sys, usr) => {
        if (sys.includes("ACTIVE FOR diy_craft_macro")) {
          capturedRerollPromptDiy = sys;
        } else {
          capturedRerollPromptOther = sys;
        }
        return {
          content: JSON.stringify({
            sceneIndex: 1,
            shotType: "action_development",
            durationSeconds: 4,
            actionType: "new_scene",
            cameraSetup: "3-shot dynamic jump cuts",
            lightingSetup: "Task lamp",
            summaryTr: "Yenilenen sahne",
            voiceoverTr: "",
            dialogueTr: "",
            promptEn: "Three-shot dynamic sequence",
          }),
        };
      },
      parseJsonResponse: (t) => JSON.parse(t),
    },
  });

  await rerollDirector.rerollSingleScene({
    topic: "Pet Şişeden Dikey Rüzgar Türbini ile LED Yakma",
    sceneIndex: 1,
    currentStoryboard: diyResult,
    visualMood: "diy_craft_macro",
  });
  assert.ok(capturedRerollPromptDiy.includes("SPECIAL MULTI-SHOT & MULTI-ACTION DIRECTIVE (ACTIVE FOR diy_craft_macro)"));

  await rerollDirector.rerollSingleScene({
    topic: "Doğa Belgeseli",
    sceneIndex: 1,
    currentStoryboard: otherResult,
    visualMood: "documentary_nature",
  });
  assert.ok(capturedRerollPromptOther.includes("SINGLE TAKE CONTINUITY"));
  assert.ok(capturedRerollPromptOther.includes("DO NOT use multi-cut jump-cuts"));
});
