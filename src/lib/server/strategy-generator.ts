import "server-only";

import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";

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
  };
};

export type StrategyIdea = {
  id?: string;
  columnType: ColumnType;
  title: string;
  hook: string;
  description: string;
  structure: string[]; // e.g. ["1. Hook", "2. Problem", "3. Solution", "4. CTA"]
  targetChannel: string; // "Instagram Reels", "TikTok", "YouTube Shorts", "Instagram Carousel", "Story"
  status?: "suggested" | "hidden";
};

export type FullStrategyResult = {
  overview: StrategyOverview;
  ideas: Record<ColumnType, StrategyIdea[]>;
};

export async function generateFullStrategyAndIdeas(input: {
  brandName: string;
  brandDescription: string;
  socialChannels: string[];
  competitors: string[];
}): Promise<FullStrategyResult> {
  const systemPrompt = `Sen üst düzey bir Sosyal Medya Büyüme & İçerik Stratejisi Ajanısın (ScrapeCreators metodolojisi uzmanı).
Görevin: Kullanıcının verdiği marka bilgisi, sosyal medya kanalları ve rakipleri derinlemesine analiz ederek;
1. Stratejik Konumlandırma & Kitle Analizi (VOC - Voice of Customer, acı noktaları, kancalar, rakip açıkları, büyüme taktiği)
2. 4 ana içerik türü kolonuna dağıtılmış, hemen üretilebilecek somut, kanıtlanmış kancalara (hook) sahip içerik fikirleri üretmek.

İçerik Türü Kolonları:
- vertical_video: 9:16 Dikey Video (Instagram Reels, TikTok, YouTube Shorts için viral kancalar ve senaryo adımları)
- carousel: Çoklu Kaydırmalı Karosel (Instagram/LinkedIn Carousel, 5-7 slaytlık eğitici veya vaka akışı)
- single_post: Tekil Görsel & İnfografik (Sektör haberi, çarpıcı veri, alıntı veya hap bilgi)
- engagement: Etkileşim & Topluluk (Story, anket, ikilem, soru-cevap, DM teşvik kurguları)

Her kolonda EN AZ 3'er adet son derece yaratıcı, jenerik olmayan, doğrudan markanın nişine özel içerik fikri üret.
Yanıtını YALNIZCA geçerli ve hatasız bir JSON nesnesi olarak ver. Markdown bloğu veya ekstra metin ekleme.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması & Değer Vaadi: ${input.brandDescription}
Kullanılan Sosyal Medya Kanalları: ${input.socialChannels.join(", ") || "Instagram, TikTok, YouTube"}
Takip Edilen Rakipler / Örnek Hesaplar: ${input.competitors.join(", ") || "Belirtilmedi (Sektör liderleri baz alınsın)"}

Lütfen aşağıdaki JSON şemasına birebir sadık kalarak stratejiyi ve 4 kolonluk içerik fikirlerini üret:
{
  "overview": {
    "brandIdentity": {
      "tone": "...",
      "valueProposition": "...",
      "positioning": "...",
      "keyMessaging": "..."
    },
    "competitorAnalysis": {
      "contentGaps": ["...", "..."],
      "viralPatternsToAdapt": ["...", "..."],
      "differentiationAngle": "..."
    },
    "audienceVoc": {
      "targetPersona": "...",
      "painPoints": ["...", "..."],
      "frequentQuestions": ["...", "..."],
      "winningHooks": ["...", "..."]
    },
    "growthStrategy": {
      "primaryPillars": ["...", "..."],
      "weeklyPostingPlan": "...",
      "channelPriorities": ["...", "..."],
      "conversionFunnel": "..."
    }
  },
  "ideas": {
    "vertical_video": [
      {
        "title": "...",
        "hook": "...",
        "description": "...",
        "structure": ["1. Saniye 0-3: Kanca", "2. Saniye 4-15: Problem", "3. Saniye 16-35: Çözüm", "4. CTA"],
        "targetChannel": "Instagram Reels / TikTok"
      }
    ],
    "carousel": [
      {
        "title": "...",
        "hook": "...",
        "description": "...",
        "structure": ["Slayt 1: Kapak & Kanca", "Slayt 2: Yaygın Hata", "Slayt 3-4: 3 Adımlı Çözüm", "Slayt 5: Kaydet & Paylaş"],
        "targetChannel": "Instagram Carousel"
      }
    ],
    "single_post": [
      {
        "title": "...",
        "hook": "...",
        "description": "...",
        "structure": ["Görsel: Vurucu İstatistik", "Açıklama: Sektörel Yorum & Soru"],
        "targetChannel": "Instagram / LinkedIn"
      }
    ],
    "engagement": [
      {
        "title": "...",
        "hook": "...",
        "description": "...",
        "structure": ["Story 1: Anket / İkilem", "Story 2: Doğru Cevap & Püf Noktası", "Story 3: DM Teşviki"],
        "targetChannel": "Instagram Story"
      }
    ]
  }
}`;

  const { content } = await completeText(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 4000 });
  const parsed = parseJsonResponse<FullStrategyResult>(content);
  return parsed;
}

export async function generateNewIdeasForColumn(input: {
  brandName: string;
  brandDescription: string;
  columnType: ColumnType;
  existingTitles: string[];
  strategyContext?: StrategyOverview;
}): Promise<StrategyIdea[]> {
  const columnLabels: Record<ColumnType, string> = {
    vertical_video: "9:16 Kısa Dikey Video (Reels / TikTok / Shorts)",
    carousel: "Çoklu Kaydırmalı Karosel (Canva Carousel - 5-7 slayt)",
    single_post: "Tekil Görsel & İnfografik / Sektörel Haber",
    engagement: "Etkileşim & Topluluk (Story, Anket, Soru-Cevap)",
  };

  const systemPrompt = `Sen sosyal medya içerik stratejisi uzmanısın.
Kullanıcı senden sadece '${columnLabels[input.columnType]}' kolonu için 3 YENİ ve TAZE içerik fikri istiyor.
Önemli Kurallar:
- Önceden üretilmiş şu başlıklardan ve konulardan KESİNLİKLE farklı, tekrara düşmeyen yepyeni kancalar üret:
${input.existingTitles.map((t) => `- ${t}`).join("\n")}
- Yanıtını YALNIZCA geçerli bir JSON dizisi (Array) olarak ver. Ekstra markdown veya açıklama yazma.`;

  const userPrompt = `Marka Adı: ${input.brandName}
Marka Açıklaması: ${input.brandDescription}
İçerik Türü Kolonu: ${columnLabels[input.columnType]}
Hedef Kitle & Strateji Özeti: ${input.strategyContext ? JSON.stringify(input.strategyContext.audienceVoc) : "Belirtilmedi"}

Lütfen 3 yeni fikir içeren şu JSON formatını üret:
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
