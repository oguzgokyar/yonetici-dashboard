import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";

const nativeRequire = createRequire(import.meta.url);
const strategyGenUrl = new URL("../src/lib/server/strategy-generator.ts", import.meta.url);

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

test("The Agency Strategy Engine: Column specs, Agent assignments and schemas", () => {
  const mod = loadModule(strategyGenUrl, {
    "server-only": {},
    "@/lib/server/cliproxy-text": {
      completeText: async () => ({ content: "{}" }),
      parseJsonResponse: () => ({}),
    },
    "@/lib/server/canva-config": {
      getCanvaConfig: () => ({ baseUrl: "http://localhost", apiKey: "" }),
    },
    "@/lib/server/hermes-agent-client": {
      dispatchHermesCanvaTask: async () => ({ dispatched: false }),
    },
    "@/lib/server/competitor-live-fetcher": {
      getCompetitorOutlierInsights: () => ({ activeOutliers: [], summaryNote: "" }),
    },
    "@/lib/strategy-constants": {
      IDEA_TYPE_LABELS: {
        problem_solution: { label: "Problem & Çözüm", bg: "#f0fdf4", color: "#166534" },
      },
    },
  });

  // 1. Column Agency Specs
  assert.ok(mod.COLUMN_AGENCY_SPECS, "COLUMN_AGENCY_SPECS must be exported");
  const cols = ["vertical_video", "carousel", "single_post", "engagement"];
  for (const c of cols) {
    const spec = mod.COLUMN_AGENCY_SPECS[c];
    assert.ok(spec, `Spec for column ${c} must exist`);
    assert.ok(spec.agentName, `Agent name must exist for ${c}`);
    assert.ok(spec.agentSlug, `Agent slug must exist for ${c}`);
    assert.ok(spec.guidelines, `Guidelines must exist for ${c}`);
  }

  assert.equal(mod.COLUMN_AGENCY_SPECS.vertical_video.agentSlug, "marketing-tiktok-strategist");
  assert.equal(mod.COLUMN_AGENCY_SPECS.carousel.agentSlug, "marketing-carousel-growth-engine");
  assert.equal(mod.COLUMN_AGENCY_SPECS.single_post.agentSlug, "marketing-content-creator");
  assert.equal(mod.COLUMN_AGENCY_SPECS.engagement.agentSlug, "marketing-twitter-engager");
});

test("The Agency Zero-Duplicate and Full Context Serialization", async () => {
  let capturedUserPrompt = "";
  let capturedSystemPrompt = "";

  const mod = loadModule(strategyGenUrl, {
    "server-only": {},
    "@/lib/server/cliproxy-text": {
      completeText: async (sys, usr) => {
        capturedSystemPrompt = sys;
        capturedUserPrompt = usr;
        return {
          content: JSON.stringify({
            vertical_video: [{ title: "Yeni Reels", hook: "Kanca", description: "Desc", structure: ["1"], targetChannel: "Reels" }],
            carousel: [],
            single_post: [],
            engagement: [],
          }),
        };
      },
      parseJsonResponse: (text) => JSON.parse(text),
    },
    "@/lib/server/canva-config": {
      getCanvaConfig: () => ({ baseUrl: "http://localhost", apiKey: "" }),
    },
    "@/lib/server/hermes-agent-client": {
      dispatchHermesCanvaTask: async () => ({ dispatched: false }),
    },
    "@/lib/server/competitor-live-fetcher": {
      getCompetitorOutlierInsights: () => ({ activeOutliers: [], summaryNote: "" }),
    },
    "@/lib/strategy-constants": {
      IDEA_TYPE_LABELS: {},
    },
  });

  // Call generateIdeasAcrossAllColumns with existing titles and full strategy context
  const mockStrategy = {
    brandIdentity: {
      tone: "Samimi",
      valueProposition: "Çocuklar için üretken STEM",
      positioning: "Ekran bağımlılığına alternatif",
      keyMessaging: "Kendi oyununu kendin yap",
      brandArchetype: "Bilge Rehber (Sage)",
    },
    competitorAnalysis: {
      contentGaps: ["STEM ve ahşap eksikliği"],
      viralPatternsToAdapt: ["Ters köşe kanca"],
      differentiationAngle: "Gerçek marangozluk aletleri",
    },
    audienceVoc: {
      targetPersona: "Endişeli ebeveynler",
      painPoints: ["Çocukların tablete gömülmesi"],
      frequentQuestions: ["Güvenli mi?"],
      winningHooks: ["Çocuğunuza tablet yerine bunu verin"],
    },
    growthStrategy: {
      primaryPillars: ["Eğitim", "Güvenlik"],
      weeklyPostingPlan: "Haftada 5 video",
      channelPriorities: ["Instagram", "TikTok"],
      conversionFunnel: "Reels -> Profil Linki -> Atölye Kaydı",
      leadMagnetOffer: {
        hook: "Ücretsiz Evde STEM Başlangıç Rehberi",
        deliverable: "15 sayfalık PDF",
        ctaTrigger: "Yoruma 'REHBER' yaz",
      },
      contentDistributionRatio: {
        tofuAwareness: "%60",
        mofuTrust: "%30",
        bofuConversion: "%10",
      },
    },
  };

  const existingTitles = {
    vertical_video: ["Mevcut Video 1", "Mevcut Video 2"],
    carousel: ["Mevcut Carousel 1"],
    single_post: [],
    engagement: [],
  };

  const result = await mod.generateIdeasAcrossAllColumns({
    brandName: "Atölye Hanem",
    brandDescription: "STEM atölyesi",
    strategyContext: mockStrategy,
    existingTitlesByColumn: existingTitles,
  });

  // Assertions
  assert.ok(result.vertical_video.length > 0, "Vertical video ideas generated");
  assert.equal(result.vertical_video[0].skillSource, "marketing-tiktok-strategist");

  // Verify Zero-Duplicate instruction is present in system prompt
  assert.match(capturedSystemPrompt, /SIFIR-TEKRAR KURALI/, "Zero-duplicate rule must be in system prompt");
  assert.match(capturedSystemPrompt, /Mevcut Video 1/, "Existing titles must be listed to prevent duplication");

  // Verify Full Strategy Context is present in user prompt
  assert.match(capturedUserPrompt, /Çocuklar için üretken STEM/, "Value proposition must be serialized");
  assert.match(capturedUserPrompt, /Bilge Rehber/, "Brand archetype must be serialized");
  assert.match(capturedUserPrompt, /Gerçek marangozluk aletleri/, "Differentiation angle must be serialized");
  assert.match(capturedUserPrompt, /Ücretsiz Evde STEM Başlangıç Rehberi/, "Lead magnet offer must be serialized");
});
