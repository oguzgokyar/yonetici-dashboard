import "server-only";

import crypto from "node:crypto";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import {
  RSS_NARRATIVE_STYLES,
  RSS_VISUAL_MOODS,
  type RssAspectRatio,
  type RssCameraEffect,
  type RssFeedArticle,
  type RssNarrativeStyleKey,
  type RssScenePlan,
  type RssStoryboard,
  type RssTargetDuration,
  type RssTransitionType,
  type RssVisualMoodKey,
  type RssVoiceEmotion,
} from "@/features/generation/rss-video/types";

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]) : "";
}

function extractAtomLink(block: string): string {
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch?.[1]) return hrefMatch[1].trim();
  return extractXmlTag(block, "link");
}

export function scoreRssArticle(params: {
  title: string;
  summary: string;
  publishedAt: string;
}): number {
  let score = 35;

  // 1. Tazelik (max 35p)
  const pubTime = Date.parse(params.publishedAt);
  if (Number.isFinite(pubTime)) {
    const ageHours = Math.max(0, (Date.now() - pubTime) / (1000 * 3600));
    if (ageHours <= 3) score += 35;
    else if (ageHours <= 12) score += 28;
    else if (ageHours <= 24) score += 20;
    else if (ageHours <= 72) score += 12;
    else score += 5;
  } else {
    score += 15;
  }

  // 2. Başlık Kanca Gücü (max 20p)
  const titleLen = params.title.length;
  if (titleLen >= 28 && titleLen <= 95) score += 10;
  if (/\d+/.test(params.title)) score += 5;
  if (/[?!:]/.test(params.title)) score += 5;

  // 3. İçerik Zenginliği (max 10p)
  if (params.summary.length >= 120) score += 10;
  else if (params.summary.length >= 50) score += 5;

  return Math.min(100, Math.max(10, Math.round(score)));
}

export function parseRssFeedXml(xmlText: string, sourceName: string, maxItems = 15): RssFeedArticle[] {
  const articles: RssFeedArticle[] = [];
  const itemBlocks =
    xmlText.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ||
    xmlText.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ||
    [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractXmlTag(block, "title");
    const url = extractAtomLink(block) || extractXmlTag(block, "guid");
    const rawSummary =
      extractXmlTag(block, "description") ||
      extractXmlTag(block, "summary") ||
      extractXmlTag(block, "content:encoded") ||
      extractXmlTag(block, "content");
    const pubRaw =
      extractXmlTag(block, "pubDate") ||
      extractXmlTag(block, "published") ||
      extractXmlTag(block, "updated") ||
      extractXmlTag(block, "dc:date");

    if (!title || !url || !/^https?:\/\//i.test(url)) continue;

    let publishedAt = new Date().toISOString();
    if (pubRaw) {
      const parsed = Date.parse(pubRaw);
      if (Number.isFinite(parsed)) {
        publishedAt = new Date(parsed).toISOString();
      }
    }

    const summary = rawSummary.slice(0, 400);
    const id = "rss_" + crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
    const score = scoreRssArticle({ title, summary, publishedAt });

    articles.push({
      id,
      title,
      url,
      summary,
      sourceName,
      publishedAt,
      score,
    });
  }

  return articles.sort((a, b) => b.score - a.score);
}

export async function scrapeArticleFromUrl(url: string): Promise<{
  title: string;
  text: string;
  url: string;
}> {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Yalnızca HTTP/HTTPS makale bağlantıları desteklenir.");
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Makale sayfası indirilemedi (HTTP ${response.status}).`);
  }

  const html = await response.text();

  // Strip scripts, styles, nav, footer
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ");

  const ogTitle =
    cleanHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    cleanHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
    "";
  const h1Title = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  const docTitle = cleanHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const title = decodeHtmlEntities(ogTitle || h1Title || docTitle || "Haber İçeriği");

  const ogDesc =
    cleanHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    cleanHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    "";

  const paragraphs: string[] = [];
  if (ogDesc) {
    paragraphs.push(decodeHtmlEntities(ogDesc));
  }

  const pMatches = cleanHtml.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi) || [];
  for (const pBlock of pMatches) {
    const text = decodeHtmlEntities(pBlock);
    if (text.length >= 40 && !/çerez|cookie|all rights reserved|tüm hakları/i.test(text)) {
      paragraphs.push(text);
    }
  }

  const fullText = paragraphs.join("\n\n").slice(0, 5000).trim();
  if (!fullText && !title) {
    throw new Error("Belirtilen bağlantıda okunabilir makale metni bulunamadı.");
  }

  return {
    title,
    text: fullText || title,
    url: parsedUrl.toString(),
  };
}

export async function researchAndPlanRssStoryboard(options: {
  sourceMode: "rss" | "url" | "prompt";
  topicOrText: string;
  sourceUrl?: string;
  narrativeStyle: RssNarrativeStyleKey;
  visualMood: RssVisualMoodKey;
  targetDuration: RssTargetDuration;
  aspectRatio: RssAspectRatio;
  brandName?: string;
  brandPrimaryColor?: string;
  revisionFeedback?: string;
  currentStoryboard?: RssStoryboard | null;
}): Promise<RssStoryboard> {
  const styleMeta =
    RSS_NARRATIVE_STYLES.find((s) => s.key === options.narrativeStyle) || RSS_NARRATIVE_STYLES[0];
  const moodMeta =
    RSS_VISUAL_MOODS.find((m) => m.key === options.visualMood) || RSS_VISUAL_MOODS[0];

  const durationNum = parseInt(options.targetDuration.replace(/\D/g, ""), 10) || 30;
  const targetSceneCount =
    durationNum <= 15 ? 3 : durationNum <= 30 ? 5 : durationNum <= 45 ? 7 : 9;

  const systemPrompt = `Sen "visual-skills-video" (Dramaturgy, Animatic Keyframes & Montage Patterns), "Short-Video Editing Coach" ve "Humanizer" disiplinleriyle çalışan kıdemli bir AI Video Yönetmeni ve Senaryo Yazarısın.

GÖREVİN:
Verilen kaynak içeriği (RSS haberi, makale metni veya konu başlığı) derinlemesine analiz edip, seçilen ANLATIM STİLİNE (${styleMeta.label}) göre ${targetSceneCount} sahnelik (${durationNum} saniye toplam süreli) profesyonel bir Türkçe video senaryosu ve hareketsiz görsellerden sinematik hareket üreten (Animatic Keyframe) İngilizce görsel prompt planı hazırlamaktır.

SEÇİLEN ANLATIM VE KURGU STİLİ: "${styleMeta.label}"
- Kurgu Yasası: ${styleMeta.dramaturgyDirective}
- Ritim Kuralı: ${styleMeta.pacingRule}
- Varsayılan Geçiş: ${styleMeta.defaultTransition}
- Varsayılan Ses Duygusu: ${styleMeta.defaultVoiceEmotion}

ZORUNLU PROFESYONEL KURALLAR:
1. DOĞAL TÜRKÇE DIŞ SES (HUMANIZER KURALI):
   - "Günümüzde...", "Peki siz ne düşünüyorsunuz?", "İşte karşınızda..." gibi yapay zekâ klişelerini ASLA kullanma.
   - Her sahnenin "voiceoverTr" metni, sahne süresine (durationSeconds) tam uymalıdır: Türkçe doğal konuşma hızı saniyede ~2.2 kelimedir (Örn: 5 saniyelik sahne = 9-12 kelime; 6 saniyelik sahne = 11-14 kelime).
   - Cümleler seslendirildiğinde nefes payı bırakacak kadar vurucu, akıcı ve net olmalıdır.
2. HAREKETSİZ GÖRSELDEN SİNEMA HİSSİ (ANIMATIC KEYFRAMES & 3-DETAIL LAW):
   - "promptEn" alanı CLIProxyAPI görüntü üretim modeline gönderilecektir.
   - "cinematic, masterpiece, stunning, high quality" gibi boş sıfatlar YASAKTIR.
   - Her sahnenin "promptEn" metni mutlaka şu 3 somut katmanı içermelidir:
     a) Ön Plan (Foreground - FG), Orta Plan (Midground - MG - ana özne) ve Arka Plan (Background - BG) derinlik ayrımı (böylece FFmpeg zoompan/pan uygulandığında sahne 3 boyutlu görünür).
     b) Fiziksel mikro-eylem veya "donmuş hareket izi" (motion-as-still: örn. havada asılı kıvılcım, rüzgârda savrulan kumaş, ışık kırılması, mercek yansıması).
     c) Konuda geçen özel isim, teknoloji, mekân veya objenin somut fiziksel tasviri.
   - Görselin içinde ASLA yazı, harf, tabela metni, logo veya filigran olmamalıdır ("strictly no text, no letters, no watermark in frame").
   - Görsel Atmosfer Eki: ${moodMeta.promptSuffixEn}
3. EKRAN KANCA METNİ ("onScreenTextTr"):
   - Her sahne için en fazla 3-5 kelimelik kısa bir sahne başlığı/vurgu özeti yaz.
4. KAMERA VE GEÇİŞ EFEKTLERİ:
   - "cameraEffect" yalnızca şunlardan biri olabilir: "ken_burns_zoom_in", "ken_burns_zoom_out", "cinematic_push", "zoom_in_fast", "pan_right", "pan_left", "drift_left_right", "tilt_pan", "pulse".
   - "transition" yalnızca şunlardan biri olabilir: "dissolve", "fadeblack", "smoothleft", "wipeleft", "circleopen", "slideleft".
   - "voiceEmotion" yalnızca şunlardan biri olabilir: "urgent", "serious", "calm", "warm_storyteller", "dramatic", "mysterious", "excited".

YALNIZCA geçerli bir JSON nesnesi döndür:
{
  "title": "Çarpıcı Video Başlığı (Türkçe)",
  "summaryTr": "Videonun 1-2 cümlelik kurgu ve araştırma özeti",
  "scenes": [
    {
      "sceneIndex": 1,
      "role": "hook",
      "durationSeconds": 5,
      "summaryTr": "Sahnenin Türkçe kurgu özeti",
      "onScreenTextTr": "Kısa Vurgu Başlığı",
      "voiceoverTr": "Gemini 2.0 TTS tarafından seslendirilecek doğal Türkçe dış ses metni.",
      "promptEn": "Detailed English visual prompt with Foreground, Midground subject, Background depth, concrete physical details, lighting, lens, strictly no text in frame",
      "cameraEffect": "zoom_in_fast",
      "transition": "${styleMeta.defaultTransition}",
      "voiceEmotion": "${styleMeta.defaultVoiceEmotion}"
    }
  ]
}`;

  const revisionBlock =
    options.revisionFeedback && options.currentStoryboard
      ? `\n\nMEVCUT SENARYO JSON:\n${JSON.stringify(options.currentStoryboard, null, 2)}\n\nKULLANICI REVİZYON TALEBİ:\n"${options.revisionFeedback}"\nLütfen mevcut senaryoyu bu revizyon talebine göre güncelleyerek aynı JSON şemasında döndür.`
      : "";

  const userPrompt = `KAYNAK TÜRÜ: ${options.sourceMode.toUpperCase()}
${options.sourceUrl ? `KAYNAK URL: ${options.sourceUrl}\n` : ""}MARKA BAĞLAMI: ${options.brandName || "Genel"}
HEDEF SÜRE: ${durationNum} saniye (${targetSceneCount} sahne)
EN-BOY ORANI: ${options.aspectRatio}
ANLATIM STİLİ: ${styleMeta.label} (${options.narrativeStyle})
GÖRSEL TARZ: ${moodMeta.label} (${options.visualMood})

İÇERİK / KONU / MAKALE METNİ:
${options.topicOrText.slice(0, 4500)}${revisionBlock}`;

  const completion = await completeText(systemPrompt, userPrompt, {
    temperature: 0.65,
    maxTokens: 3200,
  });

  const parsed = parseJsonResponse<{
    title?: string;
    summaryTr?: string;
    scenes?: Array<Partial<RssScenePlan>>;
  }>(completion.content);

  const rawScenes = Array.isArray(parsed.scenes) && parsed.scenes.length > 0 ? parsed.scenes : [];
  if (!rawScenes.length) {
    throw new Error("AI senaryo motoru geçerli sahne listesi üretemedi.");
  }

  const validEffects = new Set<RssCameraEffect>([
    "ken_burns_zoom_in",
    "ken_burns_zoom_out",
    "cinematic_push",
    "zoom_in_fast",
    "pan_right",
    "pan_left",
    "drift_left_right",
    "tilt_pan",
    "pulse",
  ]);
  const validTransitions = new Set<RssTransitionType>([
    "dissolve",
    "fadeblack",
    "smoothleft",
    "wipeleft",
    "circleopen",
    "slideleft",
  ]);
  const validEmotions = new Set<RssVoiceEmotion>([
    "urgent",
    "serious",
    "calm",
    "warm_storyteller",
    "dramatic",
    "mysterious",
    "excited",
  ]);

  const normalizedScenes: RssScenePlan[] = rawScenes.map((sc, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === rawScenes.length - 1;
    const role: RssScenePlan["role"] = isFirst
      ? "hook"
      : isLast
      ? "outro"
      : idx === rawScenes.length - 2
      ? "climax"
      : "body";

    const fallbackEffect =
      styleMeta.defaultCameraSequence[idx % styleMeta.defaultCameraSequence.length] ||
      "ken_burns_zoom_in";
    const cameraEffect = validEffects.has(sc.cameraEffect as RssCameraEffect)
      ? (sc.cameraEffect as RssCameraEffect)
      : fallbackEffect;
    const transition = validTransitions.has(sc.transition as RssTransitionType)
      ? (sc.transition as RssTransitionType)
      : styleMeta.defaultTransition;
    const voiceEmotion = validEmotions.has(sc.voiceEmotion as RssVoiceEmotion)
      ? (sc.voiceEmotion as RssVoiceEmotion)
      : styleMeta.defaultVoiceEmotion;

    const dur = Math.max(3, Math.min(12, Math.round(Number(sc.durationSeconds) || durationNum / rawScenes.length)));
    const basePromptEn = (sc.promptEn || sc.summaryTr || parsed.title || "Cinematic still frame").trim();
    const fullPromptEn = basePromptEn.toLowerCase().includes("strictly zero text")
      ? basePromptEn
      : `${basePromptEn}. ${moodMeta.promptSuffixEn}`;

    return {
      sceneIndex: idx + 1,
      role,
      durationSeconds: dur,
      summaryTr: (sc.summaryTr || `Sahne ${idx + 1}`).trim(),
      onScreenTextTr: (sc.onScreenTextTr || "").trim(),
      voiceoverTr: (sc.voiceoverTr || sc.summaryTr || "").trim(),
      promptEn: fullPromptEn,
      cameraEffect,
      transition,
      voiceEmotion,
      previewImageUrl: sc.previewImageUrl,
    };
  });

  const totalDurationSeconds = normalizedScenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  return {
    title: (parsed.title || options.topicOrText.split("\n")[0] || "RSS Video Senaryosu").slice(0, 140).trim(),
    summaryTr: (parsed.summaryTr || `${styleMeta.label} formatında ${normalizedScenes.length} sahnelik video kurgusu.`).trim(),
    sourceMode: options.sourceMode,
    sourceUrl: options.sourceUrl,
    narrativeStyle: options.narrativeStyle,
    visualMood: options.visualMood,
    aspectRatio: options.aspectRatio,
    totalDurationSeconds,
    scenes: normalizedScenes,
  };
}
