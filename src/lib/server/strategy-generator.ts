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

import type { StrategyOverview, StrategyIdea } from "@/lib/strategy-types";
export type { StrategyOverview, StrategyIdea } from "@/lib/strategy-types";

export type FullStrategyResult = {
  overview: StrategyOverview;
  ideas: Record<ColumnType, StrategyIdea[]>;
  engineType: string;
  runId: string;
  skillsUsed: Array<{ skill: string; role: string }>;
};

export const COLUMN_AGENCY_SPECS: Record<
  ColumnType,
  {
    agentName: string;
    agentSlug: string;
    role: string;
    guidelines: string;
  }
> = {
  vertical_video: {
    agentName: "Agency TikTok Strategist & Video Coach",
    agentSlug: "marketing-tiktok-strategist",
    role: "İlk 3 Saniye Kancası, Retention & Tartışma Kurgusu",
    guidelines: `Dikey Video (Reels/TikTok/Shorts) Kuralları (The Agency TikTok Strategist):
- Kanca (Hook): Parmak durduran ilk 3 saniye kancası olmalı. Agency Viral Hook tiplerinden birini kullan: [Uyarı / Negatif Merak: "Bunu yapmadan önce sakın..."], [Ters Köşe Hilesi: "Herkes X sanıyor ama 0 TL'ye..."], veya [Şok Sonuç: "Sonundaki tepkiye bakın..."].
- Yapı (Structure): 4-aşamalı çekim/kurgu akışı:
  1. [0-3s Kanca]: Şok edici giriş veya dikkat çekici görsel hareket.
  2. [3-12s Problem/Büyütme]: İzleyicinin yaşadığı acıyı hissettir.
  3. [12-25s Hap Çözüm]: B-roll eşliğinde tek bir net uygulanabilir değer.
  4. [Kapanış / Comment Bait]: Kitleyi ikiye bölen veya yorum yapmaya kışkırtan açık soru (Örn: 'Sence 10 üzerinden kaç puan? Sen olsan ne yapardın?').
- Açıklama: En fazla 2 kısa cümle + 1 tartışmalı soru.`,
  },
  carousel: {
    agentName: "Agency Carousel Growth Engine",
    agentSlug: "marketing-carousel-growth-engine",
    role: "6-Aşamalı Kaydırma Anatomisi & Kaydetme Mıknatısı",
    guidelines: `Çoklu Kaydırmalı Karosel (Canva Carousel) Kuralları (The Agency Carousel Engine):
- Kanca (Hook): Güçlü bir vaat ve 'Detaylar için sola kaydırın 👉' yönlendirmesi.
- Yapı (Structure) - 6-Aşamalı Kaydırma Anatomisi:
  1. [Kapak Slaytı]: Güçlü Vaat + Kaydırma Tetikleyici.
  2. [Slayt 2]: Hedef kitlenin yaptığı en büyük hata veya acı noktası.
  3. [Slayt 3]: Sorunun arkasındaki gerçek neden (Agitation).
  4. [Slayt 4]: Ezber bozan çözüm adımı ve püf nokta.
  5. [Slayt 5]: Adım adım uygulanabilir kontrol listesi veya özet tablo.
  6. [Son Slayt]: 'Daha sonra denemek için kaydet 📌 / Arkadaşına gönder 🚀' CTA'sı.`,
  },
  single_post: {
    agentName: "Agency Visual Storyteller & Content Creator",
    agentSlug: "marketing-content-creator",
    role: "Şok Edici İstatistik, İnfografik & Karşılaştırma",
    guidelines: `Tekil Görsel & İnfografik Kuralları (The Agency Content Creator):
- Kanca (Hook): Ezber bozan tek bir gerçek, çarpıcı endüstri verisi veya 'Biz vs Diğerleri' kıyaslaması.
- Yapı (Structure): 3-aşamalı kompozisyon:
  1. [Görsel Odak]: Tek bakışta anlaşılan infografik, şema veya dikkat çekici tekil metin kutusu.
  2. [Gövde Değeri]: 3 maddelik hap özet ve analitik çıkarım.
  3. [Etkileşim]: 'Senin bu konudaki görüşün ne?' veya profil bağlantısı yönlendirmesi.`,
  },
  engagement: {
    agentName: "Agency Community & Twitter Engager",
    agentSlug: "marketing-twitter-engager",
    role: "Story Anketi, İkilem Sorusu & DM Mıknatısı",
    guidelines: `Etkileşim & Topluluk Kuralları (The Agency Community Engager):
- Kanca (Hook): İki zıt görüşü karşılaştıran veya kitleyi seçim yapmaya zorlayan ikilem sorusu.
- Yapı (Structure): 3-aşamalı etkileşim kurgusu:
  1. [Anket / Soru]: 'A mı yoksa B mi? Tercihini seç.'
  2. [Hikaye Arkası]: Neden bu iki seçenek arasında kalındığına dair kısa samimi bağlam.
  3. [DM / Yorum Tetikleyici]: 'Yoruma [ANAHTAR KELİME] yaz, sana özel listeyi DM'den göndereyim' veya hikaye anket çıkartması.`,
  },
};

const DEFAULT_SKILLS = [
  { skill: "specialized/business-strategist", role: "Değer Vaadi Kanvası & Pazar Konumlandırması" },
  { skill: "design-brand-guardian", role: "Marka Arketipi & Görsel Dil Direktifleri" },
  { skill: "sales-offer-lead-gen-strategist", role: "Grand Slam Lead Magnet & Dönüşüm Teklifi" },
  { skill: "marketing-growth-hacker", role: "30-Günlük ToFu/MoFu/BoFu Dağıtım Matrisi" },
  { skill: "marketing-aeo-foundations", role: "AI Motorlarında (ChatGPT/Perplexity) Alıntılanma Stratejisi" },
  { skill: "marketing-tiktok-strategist", role: "Dikey Video & 3-Saniye Kanca Motoru" },
  { skill: "marketing-carousel-growth-engine", role: "6-Aşamalı Carousel Rehber Mimarisi" },
  { skill: "marketing-content-creator", role: "Tekil Gönderi & İnfografik Kurgusu" },
  { skill: "marketing-twitter-engager", role: "Topluluk & Etkileşim/DM Mıknatısı" },
  { skill: "outlier-post-finder", role: "Viral Kanca (Hook) & Pazar Kıyaslaması" },
];

function formatFullStrategyContext(ctx?: StrategyOverview): string {
  if (!ctx) return "Belirtilmedi";
  const lines: string[] = [];
  if (ctx.brandIdentity) {
    lines.push(`• Marka Vaadi & Konumlandırma: ${ctx.brandIdentity.valueProposition || ""} (${ctx.brandIdentity.positioning || ""})`);
    if (ctx.brandIdentity.brandArchetype) {
      lines.push(`• Marka Arketipi: ${ctx.brandIdentity.brandArchetype}`);
    }
  }
  if (ctx.competitorAnalysis) {
    if (ctx.competitorAnalysis.differentiationAngle) {
      lines.push(`• Rakiplerden Farklılaşma Açısı: ${ctx.competitorAnalysis.differentiationAngle}`);
    }
    if (ctx.competitorAnalysis.contentGaps?.length) {
      lines.push(`• Sektör Açıkları: ${ctx.competitorAnalysis.contentGaps.slice(0, 3).join(", ")}`);
    }
  }
  if (ctx.audienceVoc) {
    if (ctx.audienceVoc.targetPersona) {
      lines.push(`• Hedef Persona: ${ctx.audienceVoc.targetPersona}`);
    }
    if (ctx.audienceVoc.painPoints?.length) {
      lines.push(`• En Büyük Acı Noktaları: ${ctx.audienceVoc.painPoints.slice(0, 4).join(", ")}`);
    }
  }
  if (ctx.growthStrategy?.leadMagnetOffer?.hook) {
    lines.push(`• Dönüşüm Teklifi (Lead Magnet): ${ctx.growthStrategy.leadMagnetOffer.hook} (${ctx.growthStrategy.leadMagnetOffer.ctaTrigger})`);
  }
  return lines.join("\n") || "Belirtilmedi";
}

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
  const agencyRulesBlock = (Object.keys(COLUMN_AGENCY_SPECS) as ColumnType[])
    .map((col) => `=== [${col.toUpperCase()}] (${COLUMN_AGENCY_SPECS[col].agentName}) ===\n${COLUMN_AGENCY_SPECS[col].guidelines}`)
    .join("\n\n");

  const systemPrompt = `Sen üst düzey bir Sosyal Medya Büyüme & İçerik Stratejisi Ajanısın (The Agency & ScrapeCreators metodolojisi uzmanı).
Görevin: Kullanıcının verdiği marka bilgisi, sosyal medya kanalları ve rakipleri analiz ederek;
1. Stratejik Konumlandırma & Kitle Analizi (VOC - Voice of Customer, acı noktaları, kancalar, rakip açıkları, büyüme taktiği)
2. 4 ana içerik türü kolonuna dağıtılmış (vertical_video, carousel, single_post, engagement), her kolonun kendi Agency Uzmanı kurallarına %100 uyan içerik fikirleri üretmek.

FORMAT BAZLI AGENCY UZMANI KURALLARI:
${agencyRulesBlock}

Her kolonda EN AZ 3'er adet son derece yaratıcı, jenerik olmayan, doğrudan markanın nişine özel içerik fikri üret.
Yanıtını YALNIZCA geçerli ve hatasız bir JSON nesnesi olarak ver. Markdown bloğu veya ekstra metin ekleme.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması & Değer Vaadi: ${input.brandDescription}
Kullanılan Sosyal Medya Kanalları: ${input.socialChannels.join(", ") || "Instagram, TikTok, YouTube"}
Takip Edilen Rakipler / Örnek Hesaplar: ${input.competitors.join(", ") || "Belirtilmedi (Sektör liderleri baz alınsın)"}
${liveOutlierSummary ? `\nKazıyıcı Havuzundan Canlı Doğrulanmış Viral / Outlier Rakip İçerikleri:\n${liveOutlierSummary}\n` : ""}

The Agency uzmanlık standartlarında (Business Strategist, Brand Guardian, Sales Offer Architect, Growth Hacker, AEO Foundations) aşağıdaki zengin JSON şemasını üret:
{
  "overview": {
    "brandIdentity": {
      "tone": "...",
      "valueProposition": "...",
      "positioning": "...",
      "keyMessaging": "...",
      "brandArchetype": "Örn: Bilge Rehber (Sage) / Yenilikçi Kaşif (Explorer) vb.",
      "visualDirectives": {
        "primaryAesthetic": "Temiz, yüksek kontrastlı kurumsal estetik...",
        "forbiddenCliches": ["Stok el sıkışma görselleri", "Aşırı süslü yazı tipleri"],
        "photoStyle": "Doğal stüdyo ışığı, 50mm derinlik hissi"
      }
    },
    "competitorAnalysis": {
      "contentGaps": ["..."],
      "viralPatternsToAdapt": ["..."],
      "differentiationAngle": "...",
      "competitorWeaknesses": ["Rakiplerin en çok eleştirilen 2 eksikliği"]
    },
    "audienceVoc": {
      "targetPersona": "...",
      "painPoints": ["..."],
      "frequentQuestions": ["..."],
      "winningHooks": ["..."],
      "unspokenDesires": ["Statü, hız veya güvenle ilgili içsel beklenti"]
    },
    "growthStrategy": {
      "primaryPillars": ["..."],
      "weeklyPostingPlan": "...",
      "channelPriorities": ["..."],
      "conversionFunnel": "...",
      "leadMagnetOffer": {
        "hook": "Yoruma X yazanlara verilecek ücretsiz teklif kancası",
        "deliverable": "Ücretsiz rehber/araç/şablon",
        "ctaTrigger": "Yoruma 'REHBER' yaz, DM'den gelsin"
      },
      "contentDistributionRatio": {
        "tofuAwareness": "%60 (Viral & Keşfet)",
        "mofuTrust": "%30 (Eğitici & Rehber)",
        "bofuConversion": "%10 (Teklif & Satış)"
      },
      "aiSearchAeoDirective": "ChatGPT ve Perplexity'de markanın niş lideri olarak alıntılanma kuralı"
    }
  },
  "ideas": {
    "vertical_video": [{ "title": "...", "hook": "...", "description": "...", "structure": ["..."], "targetChannel": "...", "ideaType": "benefit|problem_solution|brand_awareness|service_promo|campaign_discount" }],
    "carousel": [...],
    "single_post": [...],
    "engagement": [...]
  }
}`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 4200 });
  const fallbackResult = parseJsonResponse<any>(content);
  const ideasWithSkills: Record<ColumnType, StrategyIdea[]> = {
    vertical_video: [],
    carousel: [],
    single_post: [],
    engagement: [],
  };
  for (const col of ["vertical_video", "carousel", "single_post", "engagement"] as ColumnType[]) {
    const rawList = fallbackResult.ideas?.[col] || [];
    ideasWithSkills[col] = rawList.map((item: any) => ({
      ...item,
      columnType: col,
      skillSource: COLUMN_AGENCY_SPECS[col].agentSlug,
    }));
  }

  return {
    overview: {
      ...fallbackResult.overview,
      competitorAnalysis: {
        ...fallbackResult.overview?.competitorAnalysis,
        liveOutlierCount: liveInsights.activeOutliers.length,
        liveOutlierSummary: liveInsights.summaryNote,
      },
    },
    ideas: ideasWithSkills,
    engineType: "The Agency Swarm (CliProxyAPI)",
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

  const agencySpec = COLUMN_AGENCY_SPECS[input.columnType];

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

  const systemPrompt = `Sen The Agency uzmanlarından '${agencySpec.agentName}' (${agencySpec.role}) rolündesin.
Kullanıcı senden sadece '${columnLabels[input.columnType]}' kolonu için 3 YENİ ve TAZE içerik fikri istiyor.
${dynamicAngleInstruction}

BU FORMAT İÇİN ZORUNLU AGENCY PROTOKOLÜ:
${agencySpec.guidelines}

Önemli Kurallar:
- Önceden üretilmiş şu başlıklardan ve konulardan KESİNLİKLE farklı, tekrara düşmeyen yepyeni kancalar üret:
${input.existingTitles.map((t) => `- ${t}`).join("\n")}
- Yanıtını YALNIZCA geçerli bir JSON dizisi (Array) olarak ver. Ekstra markdown veya açıklama yazma.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması: ${input.brandDescription}
İçerik Türü Kolonu: ${columnLabels[input.columnType]}
Atanan Agency Uzmanı: ${agencySpec.agentName} (${agencySpec.agentSlug})
${input.ideaType ? `İçerik Amacı / Tipi: ${selectedTypeInfo}` : ""}
${input.focusTopic ? `Özel Odak Konusu: ${input.focusTopic}` : ""}
Hedef Kitle & Tam Strateji Özeti:
${formatFullStrategyContext(input.strategyContext)}

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

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2200 });
  const parsed = parseJsonResponse<StrategyIdea[]>(content);
  return parsed.map((item) => ({
    ...item,
    columnType: input.columnType,
    ideaType: item.ideaType || input.ideaType || "problem_solution",
    skillSource: agencySpec.agentSlug,
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

  const agencyRulesBlock = (Object.keys(COLUMN_AGENCY_SPECS) as ColumnType[])
    .map((col) => `=== [${col}] (${COLUMN_AGENCY_SPECS[col].agentName}) ===\n${COLUMN_AGENCY_SPECS[col].guidelines}`)
    .join("\n\n");

  let forbiddenTitlesInstruction = "";
  if (input.existingTitlesByColumn) {
    const list: string[] = [];
    for (const [col, titles] of Object.entries(input.existingTitlesByColumn)) {
      if (titles && titles.length > 0) {
        list.push(`- [${col.toUpperCase()}]: ${titles.slice(0, 10).map((t) => `"${t}"`).join(" | ")}`);
      }
    }
    if (list.length > 0) {
      forbiddenTitlesInstruction = `\nÖNEMLİ (SIFIR-TEKRAR KURALI): Daha önce üretilmiş aşağıdaki başlıklardan KESİNLİKLE farklı, yepyeni açılar ve kancalar üret:\n${list.join("\n")}\n`;
    }
  }

  const systemPrompt = `Sen kıdemli bir Sosyal Medya Büyüme & Fikir Makinesi Motorusun (The Agency Multi-Specialist Swarm).
Kullanıcı senden 4 format kolonunun ("vertical_video", "carousel", "single_post", "engagement") HER BİRİ İÇİN 2'şer adet çok güçlü ve uygulanabilir içerik fikri üretmeni istiyor.
${dynamicAngleInstruction}
${forbiddenTitlesInstruction}

FORMAT BAZLI ZORUNLU AGENCY PROTOKOLÜ:
${agencyRulesBlock}

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
Hedef Kitle & Tam Strateji Özeti:
${formatFullStrategyContext(input.strategyContext)}

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
      skillSource: COLUMN_AGENCY_SPECS[col].agentSlug,
      status: "suggested",
    }));
  }

  return result;
}
