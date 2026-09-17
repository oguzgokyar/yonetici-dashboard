import { completeText } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
type ProjectRow = { brand_json: string };

const labels: Record<string, string> = { logo: "Logo", brandName: "Marka adı", phone: "Telefon", email: "E-posta", address: "Adres", website: "Web sitesi" };

export async function POST(request: Request) {
  const input = await request.json() as { projectId?: string; prompt?: string; selectedFields?: string[]; idea?: { title?: string; concept?: string; visualDirection?: string } };
  if (!input.projectId || !input.prompt?.trim()) return Response.json({ ok: false, message: "Prompt gerekli." }, { status: 400 });
  const project = getDatabase().prepare("SELECT brand_json FROM projects WHERE id = ?").get(input.projectId) as ProjectRow | undefined;
  if (!project) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  const brand = JSON.parse(project.brand_json) as Record<string, string>;
  const selected = (input.selectedFields || []).filter((key) => brand[key]).map((key) => `${labels[key] || key}: ${brand[key]}`).join("; ");
  const idea = input.idea?.title ? `\nSeçilen içerik fikri: ${input.idea.title}\nFikir özeti: ${input.idea.concept || ""}\nGörsel yön: ${input.idea.visualDirection || ""}` : "";
  try {
    const { content, model } = await completeText("Sen sosyal medya reklam görselleri için uzman prompt yazarı ve art direktörsün. Sadece geliştirilmiş promptu döndür; açıklama, başlık veya tırnak kullanma.", `Temel prompt: ${input.prompt.trim()}${idea}\nMarka: ${brand.brandName || ""}\nSektör: ${brand.industry || ""}\nHedef kitle: ${brand.audience || ""}\nTon: ${brand.tone || ""}\nGörselde kesin olarak yer alacak seçili marka kaynakları: ${selected || "Yok"}\n\nPromptu sahne, kompozisyon, ışık, kamera, materyal, duygu ve reklam odağı bakımından geliştir. Seçili marka kaynaklarının üretim sonrasında ayrı ve hatasız bir marka katmanı olarak ekleneceğini açıkça belirt; bu bilgiler için okunaklı negatif alan ayırmasını iste. Seçilmemiş iletişim bilgilerini ekleme.`, { temperature: 0.45, maxTokens: 900 });
    return Response.json({ ok: true, prompt: content, model });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Prompt geliştirilemedi." }, { status: 502 });
  }
}
