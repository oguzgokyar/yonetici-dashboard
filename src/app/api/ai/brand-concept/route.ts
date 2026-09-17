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
    const { content, model } = await completeText("Sen kısa ve uygulanabilir marka görsel kimlikleri oluşturan bir kreatif direktörsün. Yalnızca geçerli JSON döndür.", `Bu marka için sosyal medya kreatiflerinde sürekli kullanılacak sade bir marka konsepti oluştur. Bilgi veya iddia uydurma.\nMarka: ${brand.brandName || "Belirtilmedi"}\nSektör: ${brand.industry || "Belirtilmedi"}\nAçıklama: ${brand.description || "Belirtilmedi"}\nHedef kitle: ${brand.audience || "Belirtilmedi"}\nTon: ${brand.tone || "Belirtilmedi"}\nMevcut renkler: ${brand.primaryColor || ""}, ${brand.secondaryColor || ""}\n\nJSON: {"summary":"tek paragraf kısa konsept","personality":"3-5 sıfat","visualStyle":"kısa tasarım dili","photographyStyle":"kısa fotoğraf yaklaşımı","primaryColor":"#RRGGBB","secondaryColor":"#RRGGBB","accentColor":"#RRGGBB"}`, { temperature: 0.35, maxTokens: 700 });
    const concept = normalizeBrandConcept({ ...parseJsonResponse<Partial<BrandConcept>>(content), updatedAt: new Date().toISOString() });
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
