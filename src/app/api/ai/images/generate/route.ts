import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { brandConceptInstruction } from "@/lib/brand-concept";
import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { inspectCreative, loadMedia, MediaInput, renderCreative } from "@/lib/server/cliproxy-creative";

export const runtime = "nodejs";
type ProviderRow = { base_url: string; encrypted_api_key: string; text_model: string; image_model: string; vision_model: string; edit_model: string };
type ProjectRow = { brand_json: string; brand_concept_json: string };
type CreativePlan = { conceptName: string; headline: string; supportingText: string; cta: string; artDirection: string; rationale: string };
type Attempt = { number: number; model: string; qaModel: string; qa: { passed: boolean; score: number; issues: string[]; correction: string } | null };

const labels: Record<string, string> = { brandName: "Marka adı", phone: "Telefon", email: "E-posta", website: "Web sitesi", address: "Adres" };
const ratios = new Set(["1:1", "4:5", "9:16", "2:3", "16:9"]);
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function normalizePlans(value: unknown, amount: number) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { conceptName: clean(item.conceptName, 80), headline: clean(item.headline, 70), supportingText: clean(item.supportingText, 180), cta: clean(item.cta, 40), artDirection: clean(item.artDirection, 3000), rationale: clean(item.rationale, 500) };
  }).filter((item) => item.conceptName && item.headline && item.supportingText && item.cta && item.artDirection).slice(0, amount);
}
async function availableModels(baseUrl: string, apiKey: string) {
  const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return [];
  const body = await response.json() as { data?: { id?: string }[] };
  return body.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) || [];
}
function requiredBrandLines(brand: Record<string, string>, selected: string[]) {
  return selected.filter((key) => key !== "logo" && brand[key]).map((key) => `${labels[key] || key}: “${brand[key]}”`);
}
function updateProgress(jobId: string, phase: string, completed: number, total: number, detail: string) {
  getDatabase().prepare("UPDATE generation_jobs SET progress_json=? WHERE id=?").run(JSON.stringify({ phase, completed, total, detail, updatedAt: new Date().toISOString() }), jobId);
}
function renderPrompt(plan: CreativePlan, brief: string, brand: Record<string, string>, concept: Record<string, string>, selected: string[], correction = "") {
  const brandLines = requiredBrandLines(brand, selected);
  return `Bitmiş, profesyonel bir sosyal medya reklam kreatifi render et. Tasarımı sen kur; hazır şablon, sabit alt bant, standart iletişim kartı veya tekrarlanan yerleşim kullanma. Fotoğraf, tipografi, logo ve marka bilgilerini tek bir özgün kompozisyonda bütünleştir.\n\nKREATİF BRİEFİ:\n${brief}\n\nSANAT YÖNETİMİ:\n${plan.artDirection}\n${brandConceptInstruction(concept)}\n\nGÖRSELDE HARF HARF AYNEN YER ALACAK TÜRKÇE METİNLER:\nBaşlık: “${plan.headline}”\nDestek metni: “${plan.supportingText}”\nCTA: “${plan.cta}”${brandLines.length ? `\n${brandLines.join("\n")}` : ""}\n\nKESİN ÜRETİM KURALLARI:\n- Yukarıda tırnak içinde verilen metinlerin yazımını değiştirme, çevirme, kısaltma veya yeni metin ekleme. Tırnak işaretleri yalnızca sınırı gösterir; onları görsele basma.\n- Görünen bütün yazılar yalnızca Türkçe olsun; renk kodu, tasarım notu, lorem ipsum, sahte iletişim bilgisi, filigran ve anlamsız karakter üretme.\n- Puntoyu çıktı ölçüsüne göre seç; başlık ilk bakışta, destek ve iletişim metinleri telefonda yakınlaştırmadan okunabilsin.\n- Her metin ve logo bulunduğu zemine karşı güçlü kontrast taşısın. Gerekirse tasarıma uygun aydınlık/koyu güvenli alan, lokal gradient, ince kontur veya doğal gölge kullan.\n${selected.includes("logo") ? "- Logo referans olarak eklenmiştir. Logoyu yeniden yazma veya bozma; oranını koru ve tasarımla doğal biçimde bütünleştir.\n" : ""}- Marka konseptini kesin uygula fakat tasarımı bir şablona sıkıştırma.\n- Çıktı yalnızca bitmiş reklam görseli olsun.${correction ? `\n\nÖNCEKİ RENDER KALİTE KONTROLÜNDEN GEÇMEDİ. Kompozisyonu iyileştirerek şu sorunları kesin düzelt:\n${correction}` : ""}`;
}

export async function POST(request: Request) {
  const input = await request.json() as { projectId?: string; prompt?: string; ratio?: string; count?: number; model?: string; settings?: Record<string, unknown> };
  if (!input.projectId || !input.prompt?.trim()) return Response.json({ ok: false, message: "Proje ve prompt gerekli." }, { status: 400 });
  const database = getDatabase();
  const provider = database.prepare("SELECT base_url, encrypted_api_key, text_model, image_model, vision_model, edit_model FROM ai_provider_configs WHERE provider='cliproxy' AND enabled=1").get() as ProviderRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key) return Response.json({ ok: false, message: "CliProxyAPI ayarı kayıtlı veya etkin değil." }, { status: 409 });
  const project = database.prepare("SELECT brand_json, brand_concept_json FROM projects WHERE id=?").get(input.projectId) as ProjectRow | undefined;
  if (!project) return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });

  const brand = JSON.parse(project.brand_json) as Record<string, string>;
  const concept = JSON.parse(project.brand_concept_json || "{}") as Record<string, string>;
  const selected = Array.isArray(input.settings?.selectedFields) ? input.settings.selectedFields.filter((item): item is string => typeof item === "string" && ["logo", "brandName", "phone", "email", "website", "address"].includes(item) && Boolean(brand[item])) : [];
  const amount = Math.min(Math.max(input.count || 1, 1), 4);
  const ratio = ratios.has(input.ratio || "") ? input.ratio! : "1:1";
  const apiKey = decryptSecret(provider.encrypted_api_key); const baseUrl = provider.base_url.replace(/\/+$/, "");
  const models = await availableModels(baseUrl, apiKey);
  const renderModel = input.model || provider.image_model || models.find((id) => /gemini-3\.1-flash-image|gemini-3-pro-image|gemini-2\.5-flash-image/i.test(id)) || models.find((id) => /gpt-image|image/i.test(id)) || "";
  const visionModel = provider.vision_model || provider.text_model || models.find((id) => /gemini.*(?:pro|flash)(?!.*image)|gpt-4\.1|gpt-5/i.test(id)) || renderModel;
  const editModel = provider.edit_model || renderModel;
  if (!renderModel) return Response.json({ ok: false, message: "Render modeli bulunamadı. Sistem Ayarları > API Yönetimi bölümünden görsel modelini seçin." }, { status: 409 });
  const logo = selected.includes("logo") ? await loadMedia(brand.logo) : null;
  if (selected.includes("logo") && !logo) return Response.json({ ok: false, message: "Seçilen marka logosu render modeline hazırlanamadı. Proje Ayarları'ndan logoyu yenileyin." }, { status: 422 });

  const jobId = crypto.randomUUID(); const now = new Date().toISOString();
  database.prepare("INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at) VALUES (?, ?, 'image', 'cliproxy', ?, 'running', ?, ?, ?, ?)").run(jobId, input.projectId, renderModel, input.prompt.trim(), JSON.stringify({ ...(input.settings || {}), ratio, selectedFields: selected }), JSON.stringify({ phase: "planning", completed: 0, total: amount, detail: "Kreatif fikir ve sanat yönetimi hazırlanıyor", updatedAt: now }), now);

  const plannerPrompt = `Aynı brief için ${amount} farklı reklam kreatifi planla. Yerleşim koordinatı veya şablon tarif etme; render modeline özgür ama uygulanabilir sanat yönetimi ver. Her varyasyon farklı görsel fikir ve kompozisyon kullansın. Görünen metin yalnızca doğal Türkçe olsun. Başlık en fazla 55, destek metni 120, CTA 28 karakter olsun. Uydurma iddia, sayı veya iletişim bilgisi yazma.\n\nBrief: ${input.prompt.trim()}\nMarka: ${brand.brandName || ""}\nSektör: ${brand.industry || ""}\nHedef kitle: ${brand.audience || ""}\nTon: ${brand.tone || ""}\nVarsayılan CTA: ${brand.defaultCta || "Detaylı bilgi alın"}\n${brandConceptInstruction(concept)}\n\nYalnızca JSON dizi döndür: [{"conceptName":"...","headline":"...","supportingText":"...","cta":"...","artDirection":"özgün sahne, kompozisyon, tipografi yaklaşımı, görsel hiyerarşi, marka entegrasyonu, ışık ve kontrast tarifi","rationale":"..."}]`;
  let plans: CreativePlan[] = [];
  try {
    const { content } = await completeText("Sen Türkçe reklam kreatifleri yöneten kıdemli bir kreatif direktörsün. Hazır şablon seçmez, render modeline sanat yönetimi ve kesin metin sözleşmesi verirsin. Yalnızca geçerli JSON döndür.", plannerPrompt, { temperature: 0.8, maxTokens: 4200 });
    plans = normalizePlans(parseJsonResponse<unknown>(content), amount);
  } catch { /* handled below */ }
  if (plans.length !== amount) {
    database.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run("Kreatif direktör modeli geçerli üretim planı oluşturamadı.", new Date().toISOString(), jobId);
    return Response.json({ ok: false, message: "Kreatif direktör modeli geçerli üretim planı oluşturamadı." }, { status: 502 });
  }

  const requestState = { ...(input.settings || {}), ratio, selectedFields: selected, plans, pipeline: { directorModel: provider.text_model, renderModel, visionModel, editModel, maxAttempts: 2 } };
  database.prepare("UPDATE generation_jobs SET request_json=? WHERE id=?").run(JSON.stringify(requestState), jobId);

  try {
    const assetDir = path.join(process.cwd(), ".data", "assets"); fs.mkdirSync(assetDir, { recursive: true });
    const assets: { id: string; url: string; mimeType: string; qaScore: number }[] = []; const allAttempts: Attempt[][] = [];
    for (const [planIndex, plan] of plans.entries()) {
      const attempts: Attempt[] = []; let current: MediaInput | null = null; let correction = ""; let finalScore = 0;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const model = attempt === 1 ? renderModel : editModel;
        updateProgress(jobId, attempt === 1 ? "rendering" : "correcting", planIndex, amount, attempt === 1 ? `${planIndex + 1}. kreatif render ediliyor` : `${planIndex + 1}. kreatif kalite kontrolüne göre düzeltiliyor`);
        current = await renderCreative({ baseUrl, apiKey, model, prompt: renderPrompt(plan, input.prompt.trim(), brand, concept, selected, correction), ratio, references: logo ? [logo] : [], previous: attempt > 1 ? current || undefined : undefined });
        updateProgress(jobId, "checking", planIndex, amount, `${planIndex + 1}. kreatif okunabilirlik ve marka uyumu için kontrol ediliyor`);
        const checklist = `Zorunlu başlık: “${plan.headline}”. Zorunlu destek metni: “${plan.supportingText}”. Zorunlu CTA: “${plan.cta}”. ${requiredBrandLines(brand, selected).join(". ")}. ${selected.includes("logo") ? "Verilen marka logosu doğru ve okunur görünmeli." : "Logo zorunlu değil."}`;
        let qa;
        try { qa = await inspectCreative({ baseUrl, apiKey, model: visionModel, image: current, checklist }); }
        catch (error) { qa = { passed: false, score: 0, issues: [error instanceof Error ? `Görsel kontrolü çalışmadı: ${error.message}` : "Görsel kontrolü çalışmadı."], correction: "Tüm zorunlu Türkçe metinleri ve logoyu yüksek kontrastla, büyük ve eksiksiz biçimde yeniden render et." }; }
        attempts.push({ number: attempt, model, qaModel: visionModel, qa }); finalScore = qa.score;
        if (qa.passed && qa.score >= 75) break;
        correction = `${qa.issues.join("; ")}\n${qa.correction}`;
      }
      if (!current) throw new Error("Render modeli görsel oluşturamadı.");
      const id = crypto.randomUUID(); const bytes = await sharp(current.bytes).png().toBuffer();
      fs.writeFileSync(path.join(assetDir, `${id}.png`), bytes); fs.writeFileSync(path.join(assetDir, `${id}.json`), JSON.stringify({ mimeType: "image/png", extension: "png" }));
      assets.push({ id, url: `/api/assets/${id}`, mimeType: "image/png", qaScore: finalScore }); allAttempts.push(attempts);
      updateProgress(jobId, "rendering", planIndex + 1, amount, `${planIndex + 1}/${amount} kreatif tamamlandı`);
    }
    database.prepare("UPDATE generation_jobs SET status='complete', response_json=?, progress_json=?, completed_at=? WHERE id=?").run(JSON.stringify({ assets, attempts: allAttempts }), JSON.stringify({ phase: "complete", completed: amount, total: amount, detail: "Kreatifler hazır", updatedAt: new Date().toISOString() }), new Date().toISOString(), jobId);
    return Response.json({ ok: true, jobId, model: renderModel, assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Görsel üretilemedi.";
    database.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(message.slice(0, 1000), new Date().toISOString(), jobId);
    return Response.json({ ok: false, message }, { status: 502 });
  }
}
