import "server-only";

import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getCanvaConfig } from "@/lib/server/canva-config";
import { dispatchHermesCanvaTask } from "@/lib/server/hermes-agent-client";
import { getCompetitorOutlierInsights } from "@/lib/server/competitor-live-fetcher";

import {
  type ColumnType,
  type IdeaType,
  IDEA_TYPE_LABELS,
} from "@/lib/strategy-constants";
export { type ColumnType, type IdeaType, IDEA_TYPE_LABELS };

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
    liveOutlierCount?: number;
    liveOutlierSummary?: string;
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
  ideaType?: IdeaType | string;
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
  // Faz 2: Canlı kazıyıcı havuzundan (scraped_media) gerçek outlier/viral rakip verilerini topla
  const liveInsights = getCompetitorOutlierInsights(input.competitors);
  const liveOutlierSummary = liveInsights.activeOutliers.length > 0
    ? liveInsights.activeOutliers
        .map(
          (o, i) =>
            `${i + 1}. [${o.platform.toUpperCase()} @${o.username}] "${o.title}" (${Number(o.views).toLocaleString("tr-TR")} izlenme, ${Number(o.likes).toLocaleString("tr-TR")} beğeni)`
        )
        .join("\n")
    : "";

  // 1. Try dispatching via Hermes Agent with ScrapeCreators skills enabled
  const hermesPrompt = `Load skills: competitor-social-research, audience-research, comment-mining, outlier-post-finder, creator-profile-teardown, social-media-research.

Act as the Social Media Research & Brand Strategy Agent for brand '${input.brandName}'.
Brand Description & Promise: ${input.brandDescription}
Target Social Channels: ${input.socialChannels.join(", ") || "Instagram, TikTok, YouTube"}
Competitor Handles: ${input.competitors.join(", ") || "None specified (use industry best practices)"}
${liveOutlierSummary ? `\nLive Verified Competitor Outlier Posts Harvested from Pool:\n${liveOutlierSummary}\n` : ""}

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
        "targetChannel": "string",
        "ideaType": "benefit|problem_solution|brand_awareness|service_promo|campaign_discount"
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
                  overview: {
                    ...parsed.overview,
                    competitorAnalysis: {
                      ...parsed.overview.competitorAnalysis,
                      liveOutlierCount: liveInsights.activeOutliers.length,
                      liveOutlierSummary: liveInsights.summaryNote,
                    },
                  },
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
${liveOutlierSummary ? `\nKazıyıcı Havuzundan Canlı Doğrulanmış Viral / Outlier Rakip İçerikleri:\n${liveOutlierSummary}\n` : ""}

Lütfen tam JSON şemasına sadık kalarak stratejiyi ve 4 kolonluk içerik fikirlerini üret:
{
  "overview": {
    "brandIdentity": { "tone": "...", "valueProposition": "...", "positioning": "...", "keyMessaging": "..." },
    "competitorAnalysis": { "contentGaps": ["..."], "viralPatternsToAdapt": ["..."], "differentiationAngle": "..." },
    "audienceVoc": { "targetPersona": "...", "painPoints": ["..."], "frequentQuestions": ["..."], "winningHooks": ["..."] },
    "growthStrategy": { "primaryPillars": ["..."], "weeklyPostingPlan": "...", "channelPriorities": ["..."], "conversionFunnel": "..." }
  },
  "ideas": {
    "vertical_video": [{ "title": "...", "hook": "...", "description": "...", "structure": ["..."], "targetChannel": "...", "ideaType": "benefit|problem_solution|brand_awareness|service_promo|campaign_discount" }],
    "carousel": [...],
    "single_post": [...],
    "engagement": [...]
  }
}`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 4000 });
  const fallbackResult = parseJsonResponse<any>(content);
  return {
    overview: {
      ...fallbackResult.overview,
      competitorAnalysis: {
        ...fallbackResult.overview?.competitorAnalysis,
        liveOutlierCount: liveInsights.activeOutliers.length,
        liveOutlierSummary: liveInsights.summaryNote,
      },
    },
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
  ideaType?: IdeaType | string;
  strategyContext?: StrategyOverview;
}): Promise<StrategyIdea[]> {
  const columnLabels: Record<ColumnType, string> = {
    vertical_video: "9:16 Kısa Dikey Video (Reels / TikTok / Shorts)",
    carousel: "Çoklu Kaydırmalı Karosel (Canva Carousel - 5-7 slayt)",
    single_post: "Tekil Görsel & İnfografik / Sektörel Haber",
    engagement: "Etkileşim & Topluluk (Story, Anket, Soru-Cevap)",
  };

  const selectedTypeInfo = input.ideaType && (IDEA_TYPE_LABELS as any)[input.ideaType]
    ? (IDEA_TYPE_LABELS as any)[input.ideaType].label
    : input.ideaType || "";

  // 4 Kombinasyon Durum Mantığı
  let dynamicAngleInstruction = "";
  if (selectedTypeInfo && input.focusTopic) {
    // Durum 4: Hem Tip hem Konu var
    dynamicAngleInstruction = `İÇERİK FORMATI AMACI (TİP): "${selectedTypeInfo}".\nÖZEL KONU / BAĞLAM: "${input.focusTopic}".\nKural: Üreteceğin 3 fikir doğrudan "${input.focusTopic}" konusunu ele almalı ve net şekilde "${selectedTypeInfo}" amacına hizmet etmelidir.`;
  } else if (selectedTypeInfo && !input.focusTopic) {
    // Durum 2: Sadece Tip seçili
    dynamicAngleInstruction = `İÇERİK FORMATI AMACI (TİP): "${selectedTypeInfo}".\nKural: Markanın nişine, hedef kitlesine ve acı noktalarına bakarak bu amaca en uygun 3 farklı konuyu SEN belirle ve fikirleri "${selectedTypeInfo}" psikolojisinde üret.`;
  } else if (!selectedTypeInfo && input.focusTopic) {
    // Durum 3: Sadece Konu var
    dynamicAngleInstruction = `ÖZEL ODAK KONUSU: "${input.focusTopic}".\nKural: 3 fikrin tamamı "${input.focusTopic}" konusunu işlemeli, ancak her fikir FARKLI bir amaca hizmet etmelidir (örneğin 1. fikir fayda odaklı, 2. fikir problem & çözüm, 3. fikir marka bilinirliği veya hizmet tanıtımı).`;
  } else {
    // Durum 1: Ne tip ne konu var (Mevcut akış)
    dynamicAngleInstruction = `Kural: Markanın genel stratejisine, kanca laboratuvarına ve sektör açıklarına uygun 3 taze fikir üret.`;
  }

  const systemPrompt = `Sen sosyal medya içerik stratejisi uzmanısın (ScrapeCreators outlier & hook metodolojisi).
Kullanıcı senden sadece '${columnLabels[input.columnType]}' kolonu için 3 YENİ ve TAZE içerik fikri istiyor.
${dynamicAngleInstruction}

Önemli Kurallar:
- Önceden üretilmiş şu başlıklardan ve konulardan KESİNLİKLE farklı, tekrara düşmeyen yepyeni kancalar üret:
${input.existingTitles.map((t) => `- ${t}`).join("\n")}
- Yanıtını YALNIZCA geçerli bir JSON dizisi (Array) olarak ver. Ekstra markdown veya açıklama yazma.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması: ${input.brandDescription}
İçerik Türü Kolonu: ${columnLabels[input.columnType]}
${input.ideaType ? `İçerik Amacı / Tipi: ${selectedTypeInfo}` : ""}
${input.focusTopic ? `Özel Odak Konusu: ${input.focusTopic}` : ""}
Hedef Kitle & Strateji Özeti: ${input.strategyContext ? JSON.stringify(input.strategyContext.audienceVoc) : "Belirtilmedi"}

Lütfen 3 yeni fikir içeren JSON formatını üret:
[
  {
    "title": "...",
    "hook": "...",
    "description": "...",
    "structure": ["1. Adım...", "2. Adım..."],
    "targetChannel": "...",
    "ideaType": "${input.ideaType || "problem_solution"}"
  }
]`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });
  const parsed = parseJsonResponse<StrategyIdea[]>(content);
  return parsed.map((item) => ({
    ...item,
    columnType: input.columnType,
    ideaType: item.ideaType || input.ideaType || "problem_solution",
    status: "suggested",
  }));
}

// Fikir Makinesi: 4 Kolonun Tamamına Birden Fikir Üretme
export async function generateIdeasAcrossAllColumns(input: {
  brandName: string;
  brandDescription: string;
  focusTopic?: string;
  ideaType?: IdeaType | string;
  strategyContext?: StrategyOverview;
  existingTitlesByColumn?: Record<ColumnType, string[]>;
}): Promise<Record<ColumnType, StrategyIdea[]>> {
  const selectedTypeInfo = input.ideaType && (IDEA_TYPE_LABELS as any)[input.ideaType]
    ? (IDEA_TYPE_LABELS as any)[input.ideaType].label
    : input.ideaType || "";

  let dynamicAngleInstruction = "";
  if (selectedTypeInfo && input.focusTopic) {
    dynamicAngleInstruction = `İÇERİK AMACI (TİP): "${selectedTypeInfo}".\nÖZEL KONU: "${input.focusTopic}".\nKural: 4 kolonun tamamındaki tüm içerikler doğrudan "${input.focusTopic}" konusunu "${selectedTypeInfo}" çerçevesinde işlemelidir.`;
  } else if (selectedTypeInfo && !input.focusTopic) {
    dynamicAngleInstruction = `İÇERİK AMACI (TİP): "${selectedTypeInfo}".\nKural: Markanın hedef kitlesine göre en uygun konuları belirle ve 4 kolondaki tüm içerikleri "${selectedTypeInfo}" psikolojisine odakla.`;
  } else if (!selectedTypeInfo && input.focusTopic) {
    dynamicAngleInstruction = `ÖZEL ODAK KONUSU: "${input.focusTopic}".\nKural: Tüm içerikler "${input.focusTopic}" konusunu işlemeli, ancak formatlara göre farklı açılar (fayda, problem-çözüm, bilinirlik, hizmet tanıtımı) dağıtılmalıdır.`;
  } else {
    dynamicAngleInstruction = `Kural: Markanın genel büyüme ve kitle hedeflerine uygun taze ve etkileyici içerikler üret.`;
  }

  const systemPrompt = `Sen kıdemli bir Sosyal Medya Büyüme & Fikir Makinesi Motorusun (ScrapeCreators metodolojisi).
Kullanıcı senden 4 format kolonunun ("vertical_video", "carousel", "single_post", "engagement") HER BİRİ İÇİN 2'şer adet çok güçlü ve uygulanabilir içerik fikri üretmeni istiyor.
${dynamicAngleInstruction}

JSON formatında çıktıyı strict bir nesne olarak ver:
{
  "vertical_video": [{ "title": "...", "hook": "...", "description": "...", "structure": ["..."], "targetChannel": "...", "ideaType": "..." }],
  "carousel": [...],
  "single_post": [...],
  "engagement": [...]
}`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması: ${input.brandDescription}
${input.ideaType ? `İçerik Amacı / Tipi: ${selectedTypeInfo}` : ""}
${input.focusTopic ? `Özel Odak Konusu: ${input.focusTopic}` : ""}
Hedef Kitle & Strateji: ${input.strategyContext ? JSON.stringify(input.strategyContext.audienceVoc) : "Belirtilmedi"}

Lütfen 4 kolon için 2'şer fikir içeren JSON nesnesini üret.`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 3500 });
  const parsed = parseJsonResponse<Record<ColumnType, StrategyIdea[]>>(content);

  const result: Record<ColumnType, StrategyIdea[]> = {
    vertical_video: [],
    carousel: [],
    single_post: [],
    engagement: [],
  };

  for (const col of ["vertical_video", "carousel", "single_post", "engagement"] as ColumnType[]) {
    const list = parsed[col] || [];
    result[col] = list.map((item) => ({
      ...item,
      columnType: col,
      ideaType: item.ideaType || input.ideaType || "problem_solution",
      status: "suggested",
    }));
  }

  return result;
}
