import crypto from "node:crypto";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { brandConceptInstruction } from "@/lib/brand-concept";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IdeaDraft = { title?: string; concept?: string; visualDirection?: string; suggestedPrompt?: string };
type ProjectRow = { brand_json: string; brand_concept_json: string };
type IdeaRow = { id: string; source_prompt: string; title: string; concept: string; visual_direction: string; suggested_prompt: string; status: string; created_at: string; used_at: string | null };

function mapIdea(row: IdeaRow) {
  return { id: row.id, sourcePrompt: row.source_prompt, title: row.title, concept: row.concept, visualDirection: row.visual_direction, suggestedPrompt: row.suggested_prompt, status: row.status, createdAt: row.created_at, usedAt: row.used_at };
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ ok: false, message: "Proje gerekli." }, { status: 400 });
  const rows = getDatabase().prepare("SELECT * FROM content_ideas WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as unknown as IdeaRow[];
  return Response.json({ ok: true, ideas: rows.map(mapIdea) });
}

export async function POST(request: Request) {
  const input = await request.json() as { projectId?: string; prompt?: string; contentType?: string };
  if (!input.projectId || !input.prompt?.trim()) return Response.json({ ok: false, message: "Ürün veya içerik bilgisini prompt alanına yazın." }, { status: 400 });
  const projectId = input.projectId;
  const sourcePrompt = input.prompt.trim();
  const database = getDatabase();
  const project = database.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
  if (!project) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  const brand = JSON.parse(project.brand_json) as Record<string, string>;
  const brandConcept = JSON.parse(project.brand_concept_json || "{}");
  const previous = database.prepare("SELECT title, concept, status FROM content_ideas WHERE project_id = ? ORDER BY created_at DESC LIMIT 60").all(projectId) as unknown as { title: string; concept: string; status: string }[];
  const excluded = previous.map((item) => `- ${item.title}: ${item.concept} (${item.status === "used" ? "kullanıldı" : "önerildi"})`).join("\n") || "Henüz yok";
  try {
    const instruction = `Ürün/içerik bilgisi: ${sourcePrompt}\nİçerik tipi: ${input.contentType || "Otomatik"}\nMarka: ${brand.brandName || "Belirtilmedi"}\nSektör: ${brand.industry || "Belirtilmedi"}\nHedef kitle: ${brand.audience || "Belirtilmedi"}\nMarka tonu: ${brand.tone || "Belirtilmedi"}\n${brandConceptInstruction(brandConcept)}\n\nDaha önce önerilen veya kullanılan fikirler (bunları ve yakın varyasyonlarını tekrar etme):\n${excluded}\n\nBirbirinden belirgin biçimde farklı 7 reklam görseli fikri üret. Her fikir seçilen içerik tipine ve marka konseptine uymalı; arka planın yanında başlık, destek metni, CTA ve marka bilgilerinin tasarımdaki kullanımını da tarif etmelidir. Bilgi veya iddia uydurma. Türkçe yaz. Yalnızca JSON dizi döndür. Her nesne: {"title":"kısa fikir adı","concept":"2 cümlelik pazarlama fikri","visualDirection":"kompozisyon, sahne, metin yapısı, ışık ve marka kullanımı","suggestedPrompt":"doğrudan görsel üretiminde kullanılabilecek ayrıntılı prompt"}.`;
    const { content, model } = await completeText("Sen tekrara düşmeyen, dönüşüm odaklı sosyal medya reklam konseptleri üreten kıdemli bir kreatif direktörsün. Yanıtın yalnızca geçerli JSON olmalı.", instruction, { temperature: 0.85, maxTokens: 2400 });
    const drafts = parseJsonResponse<IdeaDraft[]>(content);
    const seen = new Set(previous.map((item) => item.title.trim().toLocaleLowerCase("tr-TR")));
    const valid = drafts.filter((item) => item.title?.trim() && item.concept?.trim() && item.visualDirection?.trim() && item.suggestedPrompt?.trim()).filter((item) => { const key = item.title!.trim().toLocaleLowerCase("tr-TR"); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 7);
    if (valid.length < 5) throw new Error("AI yeterli sayıda benzersiz fikir üretemedi. Tekrar deneyin.");
    const insert = database.prepare("INSERT INTO content_ideas (id, project_id, source_prompt, title, concept, visual_direction, suggested_prompt, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'suggested', ?)");
    const now = new Date().toISOString();
    const created = valid.map((item) => { const id = crypto.randomUUID(); insert.run(id, projectId, sourcePrompt, item.title!.trim(), item.concept!.trim(), item.visualDirection!.trim(), item.suggestedPrompt!.trim(), now); return { id, sourcePrompt, title: item.title!.trim(), concept: item.concept!.trim(), visualDirection: item.visualDirection!.trim(), suggestedPrompt: item.suggestedPrompt!.trim(), status: "suggested" as const, createdAt: now, usedAt: null }; });
    return Response.json({ ok: true, ideas: created, model });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "İçerik fikirleri üretilemedi." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json() as { projectId?: string; ideaId?: string };
  if (!input.projectId || !input.ideaId) return Response.json({ ok: false, message: "Proje ve fikir gerekli." }, { status: 400 });
  const usedAt = new Date().toISOString();
  const result = getDatabase().prepare("UPDATE content_ideas SET status = 'used', used_at = ? WHERE id = ? AND project_id = ?").run(usedAt, input.ideaId, input.projectId);
  if (!result.changes) return Response.json({ ok: false, message: "Fikir bulunamadı." }, { status: 404 });
  return Response.json({ ok: true, usedAt });
}
