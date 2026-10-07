import "server-only";

import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getCanvaConfig } from "@/lib/server/canva-config";
import { dispatchHermesCanvaTask } from "@/lib/server/hermes-agent-client";

export type ColumnType = "vertical_video" | "carousel" | "single_post" | "engagement";

export type StrategyOverview = {
  brandIdentity: {
    tone: string;
    valueProposition: string;
    positioning: string;
    keyMessaging: string;
  };
  competitorAnalysis: {
    contentGaps: string[];
    viralPatternsToAdapt: string[];
    differentiationAngle: string;
  };
  audienceVoc: {
    targetPersona: string;
    painPoints: string[];
    frequentQuestions: string[];
    winningHooks: string[];
  };
  growthStrategy: {
    primaryPillars: string[];
    weeklyPostingPlan: string;
    channelPriorities: string[];
    conversionFunnel: string;
    hashtagBank?: {
      broad: string[];
      niche: string[];
      brand: string[];
    };
    dailySchedule?: Array<{
      day: string;
      format: string;
      focus: string;
    }>;
  };
};

export type StrategyIdea = {
  id?: string;
  columnType: ColumnType;
  title: string;
  hook: string;
  description: string;
  structure: string[];
  targetChannel: string;
  skillSource?: string;
  status?: "suggested" | "hidden";
  createdAt?: string;
};

export type FullStrategyResult = {
  overview: StrategyOverview;
  ideas: Record<ColumnType, StrategyIdea[]>;
  engineType: string;
  runId: string;
  skillsUsed: Array<{ skill: string; role: string }>;
};

const DEFAULT_SKILLS = [
  { skill: "competitor-social-research", role: "Rakip Açıkları & Pazar Kıyaslaması" },
  { skill: "audience-research", role: "Hedef Persona & İlgi Alanı Analizi" },
  { skill: "comment-mining", role: "Kitle VOC & Acı Noktaları (Pain Points)" },
  { skill: "outlier-post-finder", role: "Viral Kanca (Hook) & Format Çıkarma" },
  { skill: "creator-profile-teardown", role: "Marka Konumlandırma & Değer Vaadi Sentezi" },
];

export async function generateFullStrategyAndIdeas(input: {
  brandName: string;
  brandDescription: string;
  socialChannels: string[];
  competitors: string[];
}): Promise<FullStrategyResult> {
  // 1. Try dispatching via Hermes Agent with ScrapeCreators skills enabled
  const hermesPrompt = `Load skills: competitor-social-research, audience-research, comment-mining, outlier-post-finder, creator-profile-teardown, social-media-research.

Act as the Social Media Research & Brand Strategy Agent for brand '${input.brandName}'.
Brand Description & Promise: ${input.brandDescription}
Target Social Channels: ${input.socialChannels.join(", ") || "Instagram, TikTok, YouTube"}
Competitor Handles: ${input.competitors.join(", ") || "None specified (use industry best practices)"}

Using ScrapeCreators research frameworks (outlier post analysis, comment mining VOC, competitor gap analysis):
Synthesize a comprehensive brand strategy and generate at least 3 distinct, high-performing ideas for each of the 4 content columns:
- vertical_video (9:16 Reels/TikTok/Shorts with viral hook and script breakdown)
- carousel (5-7 slide educational or case study Canva carousel)
- single_post (infographic, punchy industry statistic, or high-value quote)
- engagement (Story poll, dilemma, question-and-answer, DM incentive)

Output MUST be strictly valid JSON matching this schema (no markdown formatting, no conversational text):
{
  "overview": {
    "brandIdentity": {
      "tone": "string",
      "valueProposition": "string",
      "positioning": "string",
      "keyMessaging": "string"
    },
    "competitorAnalysis": {
      "contentGaps": ["string", "string"],
      "viralPatternsToAdapt": ["string", "string"],
      "differentiationAngle": "string"
    },
    "audienceVoc": {
      "targetPersona": "string",
      "painPoints": ["string", "string"],
      "frequentQuestions": ["string", "string"],
      "winningHooks": ["string", "string"]
    },
    "growthStrategy": {
      "primaryPillars": ["string", "string"],
      "weeklyPostingPlan": "string",
      "channelPriorities": ["string", "string"],
      "conversionFunnel": "string"
    }
  },
  "ideas": {
    "vertical_video": [
      {
        "title": "string",
        "hook": "string",
        "description": "string",
        "structure": ["string", "string"],
        "targetChannel": "string"
      }
    ],
    "carousel": [...],
    "single_post": [...],
    "engagement": [...]
  }
}`;

  try {
    const config = getCanvaConfig();
    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    const apiKey = config.apiKey;

    const dispatchRes = await dispatchHermesCanvaTask({
      taskPrompt: hermesPrompt,
      baseUrl,
      apiKey,
      timeoutMs: 15000,
    });

    if (dispatchRes.dispatched && dispatchRes.runId) {
      console.log(`[Hermes Strategy] Task dispatched to Hermes Agent (runId: ${dispatchRes.runId})`);
      // Poll Hermes for completion up to 120s
      const pollDeadline = Date.now() + 120000;
      while (Date.now() < pollDeadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const statusRes = await fetch(`${baseUrl}/v1/runs/${dispatchRes.runId}`, {
          headers: {
            Accept: "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);

        if (!statusRes || !statusRes.ok) continue;
        const runData = (await statusRes.json().catch(() => ({}))) as {
          status?: string;
          output?: string;
          result?: string;
        };

        if (runData.status === "completed") {
          const rawText = runData.output || runData.result || "";
          if (rawText) {
            try {
              const parsed = parseJsonResponse<any>(rawText);
              if (parsed?.overview && parsed?.ideas) {
                console.log("[Hermes Strategy] Successfully synthesized strategy via Hermes Agent & ScrapeCreators skills!");
                return {
                  overview: parsed.overview,
                  ideas: parsed.ideas,
                  engineType: "Hermes Agent (v1/runs)",
                  runId: dispatchRes.runId,
                  skillsUsed: DEFAULT_SKILLS,
                };
              }
            } catch (err) {
              console.warn("[Hermes Strategy] Output parsing failed, falling back to direct synthesis:", err);
              break;
            }
          }
        } else if (runData.status === "failed") {
          console.warn("[Hermes Strategy] Hermes run marked failed, falling back to direct synthesis.");
          break;
        }
      }
    }
  } catch (hermesErr) {
    console.warn("[Hermes Strategy] Hermes dispatch bypassed or timed out, executing direct fast synthesis:", hermesErr);
  }

  // Direct high-speed synthesis fallback (keeps dashboard resilient)
  const systemPrompt = `Sen üst düzey bir Sosyal Medya Büyüme & İçerik Stratejisi Ajanısın (ScrapeCreators metodolojisi uzmanı).
Görevin: Kullanıcının verdiği marka bilgisi, sosyal medya kanalları ve rakipleri ScrapeCreators kurallarıyla (outlier detection, comment mining, competitor teardown) analiz ederek;
1. Stratejik Konumlandırma & Kitle Analizi (VOC - Voice of Customer, acı noktaları, kancalar, rakip açıkları, büyüme taktiği)
2. 4 ana içerik türü kolonuna dağıtılmış (vertical_video, carousel, single_post, engagement), hemen üretilebilecek kanıtlanmış kancalara (hook) sahip içerik fikirleri üretmek.

Her kolonda EN AZ 3'er adet son derece yaratıcı, jenerik olmayan, doğrudan markanın nişine özel içerik fikri üret.
Yanıtını YALNIZCA geçerli ve hatasız bir JSON nesnesi olarak ver. Markdown bloğu veya ekstra metin ekleme.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması & Değer Vaadi: ${input.brandDescription}
Kullanılan Sosyal Medya Kanalları: ${input.socialChannels.join(", ") || "Instagram, TikTok, YouTube"}
Takip Edilen Rakipler / Örnek Hesaplar: ${input.competitors.join(", ") || "Belirtilmedi (Sektör liderleri baz alınsın)"}

Lütfen tam JSON şemasına sadık kalarak stratejiyi ve 4 kolonluk içerik fikirlerini üret:
{
  "overview": {
    "brandIdentity": { "tone": "...", "valueProposition": "...", "positioning": "...", "keyMessaging": "..." },
    "competitorAnalysis": { "contentGaps": ["..."], "viralPatternsToAdapt": ["..."], "differentiationAngle": "..." },
    "audienceVoc": { "targetPersona": "...", "painPoints": ["..."], "frequentQuestions": ["..."], "winningHooks": ["..."] },
    "growthStrategy": { "primaryPillars": ["..."], "weeklyPostingPlan": "...", "channelPriorities": ["..."], "conversionFunnel": "..." }
  },
  "ideas": {
    "vertical_video": [{ "title": "...", "hook": "...", "description": "...", "structure": ["..."], "targetChannel": "..." }],
    "carousel": [...],
    "single_post": [...],
    "engagement": [...]
  }
}`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 4000 });
  const fallbackResult = parseJsonResponse<any>(content);
  return {
    overview: fallbackResult.overview,
    ideas: fallbackResult.ideas,
    engineType: "CliProxyAPI (gemini-3.8-flash-high)",
    runId: `local_${Date.now()}`,
    skillsUsed: DEFAULT_SKILLS,
  };
}

export async function generateNewIdeasForColumn(input: {
  brandName: string;
  brandDescription: string;
  columnType: ColumnType;
  existingTitles: string[];
  focusTopic?: string;
  strategyContext?: StrategyOverview;
}): Promise<StrategyIdea[]> {
  const columnLabels: Record<ColumnType, string> = {
    vertical_video: "9:16 Kısa Dikey Video (Reels / TikTok / Shorts)",
    carousel: "Çoklu Kaydırmalı Karosel (Canva Carousel - 5-7 slayt)",
    single_post: "Tekil Görsel & İnfografik / Sektörel Haber",
    engagement: "Etkileşim & Topluluk (Story, Anket, Soru-Cevap)",
  };

  const topicInstruction = input.focusTopic
    ? `ÖZEL ODAK / AÇI: Üreteceğin fikirler doğrudan şu rakip açığına veya müşteri acı noktasına çözüm getirmeli: "${input.focusTopic}".`
    : "";

  const systemPrompt = `Sen sosyal medya içerik stratejisi uzmanısın (ScrapeCreators outlier & hook metodolojisi).
Kullanıcı senden sadece '${columnLabels[input.columnType]}' kolonu için 3 YENİ ve TAZE içerik fikri istiyor.
${topicInstruction}
Önemli Kurallar:
- Önceden üretilmiş şu başlıklardan ve konulardan KESİNLİKLE farklı, tekrara düşmeyen yepyeni kancalar üret:
${input.existingTitles.map((t) => `- ${t}`).join("\n")}
- Yanıtını YALNIZCA geçerli bir JSON dizisi (Array) olarak ver. Ekstra markdown veya açıklama yazma.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması: ${input.brandDescription}
İçerik Türü Kolonu: ${columnLabels[input.columnType]}
${input.focusTopic ? `Özel Odak Konusu: ${input.focusTopic}` : ""}
Hedef Kitle & Strateji Özeti: ${input.strategyContext ? JSON.stringify(input.strategyContext.audienceVoc) : "Belirtilmedi"}

Lütfen 3 yeni fikir içeren JSON formatını üret:
[
  {
    "title": "...",
    "hook": "...",
    "description": "...",
    "structure": ["1. Adım...", "2. Adım..."],
    "targetChannel": "..."
  }
]`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });
  const parsed = parseJsonResponse<StrategyIdea[]>(content);
  return parsed.map((item) => ({ ...item, columnType: input.columnType, status: "suggested" }));
}
