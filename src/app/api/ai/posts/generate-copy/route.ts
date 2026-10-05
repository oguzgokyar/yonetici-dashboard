import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction, type BrandConcept } from "@/lib/brand-concept";
import { mergePlatformHashtags, normalizeHashtagList, type SocialPlatform } from "@/lib/social/hashtag-policy";
import { PLATFORM_COPY_RULES, uniquePlatforms } from "@/lib/social/platform-copy-rules";

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

async function generatePlatformCopy(input: {
  platform: SocialPlatform;
  brand: Record<string, string>;
  brandConcept: Partial<BrandConcept>;
  style: CopyStyle;
  topicContext: string;
}) {
  const prompt = `MARKA BİLGİLERİ:
Marka Adı: ${input.brand.brandName || "Belirtilmedi"}
Sektör: ${input.brand.industry || "Belirtilmedi"}
Hedef Kitle: ${input.brand.audience || "Genel kitle"}
İletişim Tonu: ${input.brand.tone || "Profesyonel ve samimi"}
Varsayılan CTA: ${input.brand.defaultCta || "Detaylı bilgi için profil bağlantısını inceleyin"}
${brandConceptInstruction(input.brandConcept)}

PLATFORM: ${input.platform}
PLATFORM KURALI: ${PLATFORM_COPY_RULES[input.platform]}
İÇERİK STİLİ: ${styleDescriptions[input.style]}
${input.topicContext}

GÖREV:
Bu platform için özgün Türkçe paylaşım metni üret. Başka platform adlarını veya alakasız etiketleri ekleme. Görsel üretim promptu, kamera açısı ya da sahne talimatı yazma.
Yalnızca geçerli JSON döndür:
{
  "title": "platforma uygun başlık",
  "caption": "tam paylaşım metni",
  "hashtags": ["#Etiket1", "#Etiket2"],
  "tags": ["YouTube için backend arama etiketi; diğer platformlarda boş dizi"]
}`;

  const { content } = await completeText(
    "Sen kıdemli bir platform-özel sosyal medya stratejisti ve Türkçe kreatif metin yazarısın. Yalnızca geçerli JSON üret.",
    prompt,
    { temperature: 0.72, maxTokens: 1600 },
  );
  return parseJsonResponse<GeneratedCopy>(content);
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({})) as {
      projectId?: string;
      platforms?: string[];
      platform?: string;
      postType?: "post" | "reel" | "story";
      style?: CopyStyle;
      idea?: { title?: string; concept?: string };
      sourceTopic?: string;
      stockVideoMeta?: { rawTitle?: string; rawDescription?: string; keywords?: string[] };
      includeHashtagSets?: boolean;
      selectedHashtagSetIds?: Record<string, string[]>;
    };
    if (!input.projectId) return Response.json({ ok: false, message: "Proje kimliği zorunludur." }, { status: 400 });

    const requestedPlatforms = uniquePlatforms(input.platforms?.length ? input.platforms : [input.platform || "instagram"]);
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

    const settled = await Promise.allSettled(requestedPlatforms.map(async (platform) => {
      const generated = await generatePlatformCopy({ platform, brand, brandConcept, style: input.style || "sales", topicContext });
      const aiHashtags = normalizeHashtagList(generated.hashtags || []);
      const setHashtags = input.includeHashtagSets
        ? getEnabledSetHashtags(input.projectId!, platform, input.selectedHashtagSetIds?.[platform])
        : [];
      const merged = mergePlatformHashtags({ platform, aiHashtags, setHashtags, includeSets: Boolean(input.includeHashtagSets) });
      const aiTags = normalizeHashtagList(generated.tags || []).map((tag) => tag.replace(/^#/, ""));
      const tags = platform === "youtube" ? [...new Set([...merged.tags, ...aiTags])].slice(0, 15) : [];
      return {
        platform,
        copy: {
          title: generated.title || input.idea?.title || input.sourceTopic || "Sosyal Medya Gönderisi",
          caption: generated.caption || "",
          hashtags: merged.visible.join(" "),
          tags,
          hashtagMeta: {
            ai: merged.aiAdded, savedSet: merged.setAdded,
            removedDuplicates: merged.removedDuplicates, removedInvalid: merged.removedInvalid,
          },
        },
      };
    }));

    const copies: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    settled.forEach((result, index) => {
      const platform = requestedPlatforms[index];
      if (result.status === "fulfilled") copies[platform] = result.value.copy;
      else errors[platform] = result.reason instanceof Error ? result.reason.message : "Metin üretilemedi.";
    });
    return Response.json({ ok: Object.keys(copies).length > 0, copies, errors });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Metin üretilemedi." }, { status: 500 });
  }
}
