import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction, type BrandConcept } from "@/lib/brand-concept";
import { mergePlatformHashtags, normalizeHashtagList, type SocialPlatform } from "@/lib/social/hashtag-policy";
import {
  PLATFORM_COPY_RULES,
  getPlatformFormatRule,
  uniquePlatforms,
  type ContentFormatKind,
} from "@/lib/social/platform-copy-rules";

export const runtime = "nodejs";
export const maxDuration = 120;

type CopyStyle = "sales" | "story" | "educational" | "punchy";

type GeneratedCopy = {
  title?: string;
  caption?: string;
  hashtags?: string[] | string;
  tags?: string[] | string;
};

const styleDescriptions: Record<CopyStyle, string> = {
  sales: "Dönüşüm / Satış & Kampanya (güçlü CTA, teklif ve müşteri faydası)",
  story: "Hikâye Anlatımı / Samimi (insan odaklı ve merak uyandıran)",
  educational: "Eğitici & Bilgilendirici (uygulanabilir ipuçları ve rehber)",
  punchy: "Kısa & Çarpıcı (hızlı tüketilen dikey video dili)",
};

function getEnabledSetHashtags(projectId: string, platform: SocialPlatform, selectedSetIds?: string[]) {
  const database = getDatabase();
  const rows = database.prepare(`SELECT id, hashtags_json FROM project_hashtag_sets WHERE project_id=? AND platform=? AND enabled=1`)
    .all(projectId, platform) as Array<{ id: string; hashtags_json: string }>;
  const selected = selectedSetIds === undefined ? null : new Set(selectedSetIds);
  return rows
    .filter((row) => !selected || selected.has(row.id))
    .flatMap((row) => JSON.parse(row.hashtags_json || "[]") as string[]);
}

async function generateMultiPlatformCopy(input: {
  platforms: SocialPlatform[];
  format: ContentFormatKind;
  itemCount?: number;
  brand: Record<string, string>;
  brandConcept: Partial<BrandConcept>;
  style: CopyStyle;
  topicContext: string;
}): Promise<Record<string, GeneratedCopy>> {
  const platformSpecs = input.platforms
    .map((p) => {
      const rule = getPlatformFormatRule(p, input.format, input.itemCount);
      return `--- [${p.toUpperCase()}] ---\n${rule}\nKURAL: ${PLATFORM_COPY_RULES[p]}`;
    })
    .join("\n\n");

  const expectedKeys = input.platforms
    .map(
      (p) =>
        `  "${p}": {\n    "title": "başlık",\n    "caption": "açıklama metni",\n    "hashtags": ["#Etiket1", "#Etiket2"],\n    "tags": ${p === "youtube" ? '["etiket1", "etiket2"]' : "[]"}\n  }`
    )
    .join(",\n");

  const prompt = `MARKA BİLGİLERİ:
Marka Adı: ${input.brand.brandName || "Belirtilmedi"}
Sektör: ${input.brand.industry || "Belirtilmedi"}
Hedef Kitle: ${input.brand.audience || "Genel kitle"}
İletişim Tonu: ${input.brand.tone || "Profesyonel ve samimi"}
Varsayılan CTA: ${input.brand.defaultCta || "Detaylı bilgi için profil bağlantısını inceleyin"}
${brandConceptInstruction(input.brandConcept)}

İÇERİK STİLİ: ${styleDescriptions[input.style] || styleDescriptions.sales}
${input.topicContext}

HEDEF PLATFORMLAR VE ÖZEL KURALLAR:
${platformSpecs}

GÖREV:
Yukarıdaki her bir platform için ayrı ayrı optimize edilmiş, viral olmaya müsait, özgün Türkçe paylaşım metinlerini TEK BİR JSON nesnesi içinde üret.
Yalnızca geçerli JSON döndür:
{
${expectedKeys}
}`;

  const { content } = await completeText(
    "Sen viral sosyal medya kurguları ve platform algoritmaları konusunda uzman kıdemli bir sosyal medya direktörü ve Türkçe kreatif metin yazarısın. Yalnızca geçerli JSON üret.",
    prompt,
    { temperature: 0.7, maxTokens: 2200 }
  );
  return parseJsonResponse<Record<string, GeneratedCopy>>(content);
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({})) as {
      projectId?: string;
      platforms?: string[];
      platform?: string;
      postType?: "post" | "reel" | "story";
      format?: ContentFormatKind;
      itemCount?: number;
      style?: CopyStyle;
      idea?: { title?: string; concept?: string };
      sourceTopic?: string;
      stockVideoMeta?: { rawTitle?: string; rawDescription?: string; keywords?: string[] };
      includeHashtagSets?: boolean;
      selectedHashtagSetIds?: Record<string, string[]>;
    };
    if (!input.projectId) return Response.json({ ok: false, message: "Proje kimliği zorunludur." }, { status: 400 });

    const rawPlatforms = Array.isArray(input.platforms) && input.platforms.length
      ? input.platforms
      : [typeof input.platform === "string" && input.platform ? input.platform : "instagram"];
    const requestedPlatforms = uniquePlatforms(rawPlatforms);
    if (!requestedPlatforms.length) return Response.json({ ok: false, message: "En az bir desteklenen platform seçilmelidir." }, { status: 400 });

    const database = getDatabase();
    const project = database.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = ?")
      .get(input.projectId) as { brand_json: string; brand_concept_json: string } | undefined;
    if (!project) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });

    const brand = JSON.parse(project.brand_json || "{}") as Record<string, string>;
    const brandConcept = JSON.parse(project.brand_concept_json || "{}") as Partial<BrandConcept>;
    let topicContext = input.idea?.title
      ? `Seçilen Fikir: "${input.idea.title}"\nKonsept: "${input.idea.concept || ""}"`
      : `Ana Konu: "${input.sourceTopic || "Marka ve ürün tanıtımı"}"`;
    if (input.stockVideoMeta) {
      topicContext += `\nHam Başlık: "${input.stockVideoMeta.rawTitle || ""}"\nHam Açıklama: "${input.stockVideoMeta.rawDescription || ""}"\nKaynak Kelimeler: ${(input.stockVideoMeta.keywords || []).join(", ")}`;
    }

    const resolvedFormat: ContentFormatKind =
      input.format ||
      (input.postType === "reel" ? "reel" : input.postType === "story" ? "story" : "post");

    // Tek birleşik LLM çağrısıyla tüm platformların metnini tek seferde üret
    let rawMultiCopies: Record<string, GeneratedCopy> = {};
    try {
      rawMultiCopies = await generateMultiPlatformCopy({
        platforms: requestedPlatforms,
        format: resolvedFormat,
        itemCount: input.itemCount,
        brand,
        brandConcept,
        style: input.style || "sales",
        topicContext,
      });
    } catch (e) {
      console.error("[generateMultiPlatformCopy Error]", e);
    }

    const copies: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const platform of requestedPlatforms) {
      const generated = rawMultiCopies[platform] || rawMultiCopies[platform.toLowerCase()] || {};
      if (!generated.caption && !generated.title) {
        errors[platform] = "Platform için metin üretilemedi.";
        continue;
      }

      const aiHashtags = normalizeHashtagList(generated.hashtags || []);
      const setHashtags = input.includeHashtagSets
        ? getEnabledSetHashtags(input.projectId!, platform, input.selectedHashtagSetIds?.[platform])
        : [];
      const merged = mergePlatformHashtags({ platform, aiHashtags, setHashtags, includeSets: Boolean(input.includeHashtagSets) });
      const aiTags = normalizeHashtagList(generated.tags || []).map((tag) => tag.replace(/^#/, ""));
      const tags = platform === "youtube" ? [...new Set([...merged.tags, ...aiTags])].slice(0, 15) : [];

      copies[platform] = {
        title: generated.title || input.idea?.title || input.sourceTopic || "Sosyal Medya Gönderisi",
        caption: generated.caption || "",
        hashtags: merged.visible.join(" "),
        tags,
        hashtagMeta: {
          ai: merged.aiAdded, savedSet: merged.setAdded,
          removedDuplicates: merged.removedDuplicates, removedInvalid: merged.removedInvalid,
        },
      };
    }

    const firstCopy = copies[requestedPlatforms[0]];
    return Response.json({ ok: Object.keys(copies).length > 0, copy: firstCopy, copies, errors });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Metin üretilemedi." }, { status: 500 });
  }
}
