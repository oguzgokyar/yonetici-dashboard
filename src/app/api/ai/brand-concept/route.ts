import { BrandConcept, normalizeBrandConcept } from "@/lib/brand-concept";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
type ProjectRow = { brand_json: string; brand_concept_json: string };

function project(projectId: string) {
  return getDatabase().prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ ok: false, message: "Proje gerekli." }, { status: 400 });
  const row = project(projectId);
  if (!row) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  return Response.json({ ok: true, concept: normalizeBrandConcept(JSON.parse(row.brand_concept_json || "{}")) });
}

export async function POST(request: Request) {
  const input = await request.json() as { projectId?: string };
  if (!input.projectId) return Response.json({ ok: false, message: "Proje gerekli." }, { status: 400 });
  const row = project(input.projectId);
  if (!row) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  const brand = JSON.parse(row.brand_json) as Record<string, string>;
  try {
    const systemPrompt = `Sen Agency Agents Swarm içerisindeki kıdemli Brand Guardian (Marka Koruyucusu ve Tasarım Direktörü) uzmanısın.
Görevin: Sosyal medya ve Canva üretimlerinde tutarlı, birbirinden kopuk olmayan, markanın kimliğini yansıtan katı bir marka görsel kimlik sözleşmesi oluşturmaktır. Yalnızca geçerli JSON döndür.`;

    const userPrompt = `Bu marka için tüm sosyal medya, Canva karosel ve video üretimlerinde uygulanacak kurumsal marka stili sözleşmesini oluştur.
Marka: ${brand.brandName || "Belirtilmedi"}
Sektör: ${brand.industry || "Belirtilmedi"}
Açıklama: ${brand.description || "Belirtilmedi"}
Hedef kitle: ${brand.audience || "Belirtilmedi"}
Ton: ${brand.tone || "Belirtilmedi"}
Mevcut renkler: ${brand.primaryColor || ""} ${brand.secondaryColor || ""}

JSON Şeması:
{
  "summary": "Tek paragrafta markayı özetleyen güçlü görsel konsept ve tasarım sözleşmesi",
  "personality": "3-5 ayırt edici marka karakter sıfatı (örn: Vizyoner, Yenilikçi, Zanaatkar)",
  "visualStyle": "Net görsel tasarım dili, dokular, kompozisyon kuralları",
  "photographyStyle": "Sahne ışığı, gerçekçi atölye/çalışma anı, derinlik kuralları",
  "typographyStyle": "Başlık için kalın ve net font ailesi + gövde için temiz sans-serif font kuralı",
  "layoutGuidelines": "%60 zemin, %30 yapı, %10 marka vurgu rengi dağılım kuralı ve kenar boşlukları",
  "sampleVisualPrompt": "Bu marka stilini ve atmosferini mükemmel temsil eden, yüksek kaliteli, tek kare konsept anahtar görsel (key visual) promptu",
  "primaryColor": "#RRGGBB (Zemin veya ana kimlik rengi)",
  "secondaryColor": "#RRGGBB (Yapı ve gövde rengi)",
  "accentColor": "#RRGGBB (Dikkat çekici canlı vurgu rengi)"
}`;

    const { content, model } = await completeText(systemPrompt, userPrompt, { temperature: 0.35, maxTokens: 1200 });
    const parsed = parseJsonResponse<Partial<BrandConcept>>(content);

    let sampleVisualUrl = parsed.sampleVisualUrl || "";
    // Eğer sampleVisualPrompt varsa temsili örnek bir stil görseli render etmeyi dene
    if (parsed.sampleVisualPrompt) {
      try {
        const { getDatabase } = await import("@/lib/server/database");
        const { decryptSecret } = await import("@/lib/server/secrets");
        const { renderCreative } = await import("@/lib/server/cliproxy-creative");
        const path = await import("node:path");
        const fs = await import("node:fs");
        const crypto = await import("node:crypto");
        const sharp = (await import("sharp")).default;

        const provider = getDatabase().prepare("SELECT base_url, encrypted_api_key, image_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1").get() as any;
        if (provider?.base_url && provider?.encrypted_api_key) {
          const apiKey = decryptSecret(provider.encrypted_api_key);
          const baseUrl = provider.base_url.replace(/\/+$/, "");
          const imgModel = provider.image_model || "gemini-3.1-flash-image";

          const current = await renderCreative({
            baseUrl,
            apiKey,
            model: imgModel,
            prompt: `Brand design system and visual style guideline sheet for '${brand.brandName || "Atölye"}'. A clean graphic design poster layout showing: color swatches (${parsed.primaryColor}, ${parsed.secondaryColor}, ${parsed.accentColor}), modern bold typography hierarchy sample, UI design components, minimal icons, and visual texture inspiration. Graphic design presentation, brand identity board, clean editorial layout, crisp vector aesthetics. Not a random photo of people.`,
            ratio: "1:1",
          });

          if (current?.bytes) {
            const assetDir = path.join(process.cwd(), ".data", "assets");
            fs.mkdirSync(assetDir, { recursive: true });
            const assetId = crypto.randomUUID();
            const bytes = await sharp(current.bytes).png().toBuffer();
            fs.writeFileSync(path.join(assetDir, `${assetId}.png`), bytes);
            fs.writeFileSync(path.join(assetDir, `${assetId}.json`), JSON.stringify({ mimeType: "image/png", extension: "png" }));
            sampleVisualUrl = `/api/assets/${assetId}`;
          }
        }
      } catch (renderErr) {
        console.warn("[Brand Concept] Sample visual render skipped:", renderErr);
      }
    }

    const concept = normalizeBrandConcept({
      ...parsed,
      sampleVisualUrl: sampleVisualUrl || undefined,
      updatedAt: new Date().toISOString(),
    });

    getDatabase().prepare("UPDATE projects SET brand_concept_json = ? WHERE id = ?").run(JSON.stringify(concept), input.projectId);
    return Response.json({ ok: true, concept, model });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Marka konsepti oluşturulamadı." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const input = await request.json() as { projectId?: string; concept?: Partial<BrandConcept> };
  if (!input.projectId || !input.concept) return Response.json({ ok: false, message: "Proje ve konsept gerekli." }, { status: 400 });
  if (!project(input.projectId)) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  const concept = normalizeBrandConcept({ ...input.concept, updatedAt: new Date().toISOString() });
  getDatabase().prepare("UPDATE projects SET brand_concept_json = ? WHERE id = ?").run(JSON.stringify(concept), input.projectId);
  return Response.json({ ok: true, concept });
}
