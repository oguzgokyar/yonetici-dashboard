import net from "node:net";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

type ProviderRow = { base_url: string; encrypted_api_key: string; text_model: string };
type BrandResult = { brandName?: string; phone?: string; email?: string; address?: string; industry?: string; description?: string; audience?: string; tone?: string; primaryColor?: string; secondaryColor?: string; defaultCta?: string; logo?: string };

function safeWebsite(value: string) {
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(normalized);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Geçersiz protokol");
  const host = url.hostname.toLowerCase();
  const ipType = net.isIP(host);
  if (host === "localhost" || host.endsWith(".local") || (ipType && (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)))) throw new Error("Yerel adreslere erişilemez");
  return url;
}

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim().slice(0, 24000);
}

function metadata(html: string, base: URL) {
  const pick = (pattern: RegExp) => html.match(pattern)?.[1]?.trim() || "";
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i) || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const logoCandidate = pick(/<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i) || pick(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo[^"']*["']/i);
  let logo = "";
  try { if (logoCandidate) logo = new URL(logoCandidate, base).toString(); } catch { /* ignore invalid candidate */ }
  return { title, description, logo };
}

function parseJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const object = fenced.match(/\{[\s\S]*\}/)?.[0];
  if (!object) throw new Error("AI JSON yanıtı üretmedi");
  return JSON.parse(object) as BrandResult;
}

export async function POST(request: Request) {
  const input = await request.json() as { website?: string };
  if (!input.website?.trim()) return Response.json({ ok: false, message: "Önce web sitesi adresini girin." }, { status: 400 });

  let website: URL;
  try { website = safeWebsite(input.website.trim()); } catch { return Response.json({ ok: false, message: "Geçerli ve herkese açık bir web sitesi adresi girin." }, { status: 400 }); }

  const provider = getDatabase().prepare("SELECT base_url, encrypted_api_key, text_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1").get() as ProviderRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key) return Response.json({ ok: false, message: "Önce Sistem Ayarları'ndan CliProxyAPI bağlantısını kaydedin." }, { status: 409 });

  try {
    const siteResponse = await fetch(website, { headers: { "User-Agent": "YoneticiBrandImporter/1.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!siteResponse.ok) return Response.json({ ok: false, message: `Web sitesi ${siteResponse.status} yanıtı verdi.` }, { status: 502 });
    const html = (await siteResponse.text()).slice(0, 750_000);
    const meta = metadata(html, website);
    const content = cleanHtml(html);
    if (!content) return Response.json({ ok: false, message: "Web sitesinden okunabilir içerik alınamadı." }, { status: 422 });

    const apiKey = decryptSecret(provider.encrypted_api_key);
    const baseUrl = provider.base_url.replace(/\/+$/, "");
    let model = provider.text_model;
    if (!model) {
      const modelsResponse = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
      const modelsBody = await modelsResponse.json() as { data?: { id?: string }[] };
      const ids = modelsBody.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) || [];
      model = ids.find((id) => id === "gpt-4.1") || ids.find((id) => /gemini.*pro|claude.*sonnet|gpt-4/i.test(id)) || ids[0] || "";
    }
    if (!model) return Response.json({ ok: false, message: "Analiz için kullanılabilecek metin modeli bulunamadı." }, { status: 422 });

    const prompt = `Aşağıdaki web sitesi içeriğini incele ve marka bilgilerini çıkar. Yalnızca içerikte açıkça bulunan veya güçlü biçimde çıkarılabilen bilgileri kullan; bilgi uydurma. Türkçe, kısa ve pazarlama çalışmalarına uygun yaz. Sadece geçerli JSON döndür. Alanlar: brandName, phone, email, address, industry, description, audience, tone, primaryColor, secondaryColor, defaultCta. Bulamadığın alanı boş string yap.\n\nSayfa başlığı: ${meta.title}\nMeta açıklaması: ${meta.description}\nURL: ${website.toString()}\n\nİçerik:\n${content}`;
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 900, messages: [{ role: "system", content: "Sen bir marka araştırma uzmanısın. Yanıtın yalnızca JSON olmalı." }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(45_000) });
    const aiBody = await aiResponse.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!aiResponse.ok) return Response.json({ ok: false, message: "AI analizi tamamlanamadı." }, { status: 502 });
    const result = parseJson(aiBody.choices?.[0]?.message?.content || "");
    if (meta.logo) result.logo = meta.logo;
    return Response.json({ ok: true, brand: result, model, source: website.toString() });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json({ ok: false, message: timedOut ? "Web sitesi veya AI servisi zaman aşımına uğradı." : "Marka bilgileri alınırken bir hata oluştu." }, { status: 502 });
  }
}
