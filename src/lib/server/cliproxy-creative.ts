import "server-only";
import sharp from "sharp";

export type MediaInput = { bytes: Buffer; mimeType: string };
export type CreativeQa = { passed: boolean; score: number; issues: string[]; correction: string };

type GeminiPart = { text?: string; inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } };

function endpointOrigin(baseUrl: string) { return new URL(baseUrl).origin; }

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message || `CliProxyAPI ${response.status} yanıtı verdi.`;
}

export async function loadMedia(value?: string): Promise<MediaInput | null> {
  if (!value) return null;
  const data = value.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (data) {
    const bytes = Buffer.from(data[2], "base64");
    if (/svg/i.test(data[1])) return { mimeType: "image/png", bytes: await sharp(bytes).png().toBuffer() };
    return { mimeType: data[1], bytes };
  }
  try {
    const response = await fetch(value, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer()); const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    if (/svg/i.test(mimeType)) return { mimeType: "image/png", bytes: await sharp(bytes).png().toBuffer() };
    return { bytes, mimeType };
  } catch { return null; }
}

function imageFromParts(parts: GeminiPart[] = []): MediaInput | null {
  for (const part of parts) {
    const inline = part.inlineData || (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : undefined);
    if (inline?.data) return { bytes: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType || "image/png" };
  }
  return null;
}

export async function analyzeCreative(options: { baseUrl: string; apiKey: string; model: string; image: MediaInput; prompt: string }) {
  if (/gemini/i.test(options.model)) {
    const response = await fetch(`${endpointOrigin(options.baseUrl)}/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: options.prompt }, { inlineData: { data: options.image.bytes.toString("base64"), mimeType: options.image.mimeType } }] }], generationConfig: { responseModalities: ["TEXT"], temperature: 0.1 } }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(await responseMessage(response));
    const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  }
  const response = await fetch(`${options.baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: options.model, temperature: 0.1, messages: [{ role: "user", content: [{ type: "text", text: options.prompt }, { type: "image_url", image_url: { url: `data:${options.image.mimeType};base64,${options.image.bytes.toString("base64")}` } }] }] }), signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(await responseMessage(response));
  const body = await response.json() as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content || "";
}

export async function renderCreative(options: { baseUrl: string; apiKey: string; model: string; prompt: string; ratio: string; references?: MediaInput[]; previous?: MediaInput }) {
  const { baseUrl, apiKey, model, prompt, ratio } = options;
  if (/gemini.*image/i.test(model)) {
    const parts: GeminiPart[] = [{ text: prompt }];
    for (const reference of options.references || []) parts.push({ inlineData: { data: reference.bytes.toString("base64"), mimeType: reference.mimeType } });
    if (options.previous) parts.push({ inlineData: { data: options.previous.bytes.toString("base64"), mimeType: options.previous.mimeType } });
    const response = await fetch(`${endpointOrigin(baseUrl)}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok) throw new Error(await responseMessage(response));
    const body = await response.json() as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
    const image = imageFromParts(body.candidates?.[0]?.content?.parts);
    if (!image) throw new Error("Render modeli kullanılabilir görsel döndürmedi.");
    return image;
  }

  if ((options.references?.length || options.previous) && /gpt-image/i.test(model)) {
    const form = new FormData();
    form.set("model", model); form.set("prompt", prompt); form.set("n", "1"); form.set("size", ratio === "16:9" ? "1536x1024" : ratio === "1:1" ? "1024x1024" : "1024x1536"); form.set("response_format", "b64_json");
    const images = options.previous ? [options.previous, ...(options.references || [])] : options.references || [];
    images.forEach((item, index) => form.append("image[]", new Blob([new Uint8Array(item.bytes)], { type: item.mimeType }), `reference-${index}.png`));
    const response = await fetch(`${baseUrl}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(240_000) });
    if (!response.ok) throw new Error(await responseMessage(response));
    const body = await response.json() as { data?: { b64_json?: string; url?: string }[] };
    const item = body.data?.[0];
    if (item?.b64_json) return { bytes: Buffer.from(item.b64_json, "base64"), mimeType: "image/png" };
    if (item?.url) return (await loadMedia(item.url)) || Promise.reject(new Error("Render sonucu indirilemedi."));
    throw new Error("Render modeli kullanılabilir görsel döndürmedi.");
  }

  const response = await fetch(`${baseUrl}/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, n: 1, size: ratio === "16:9" ? "1536x1024" : ratio === "1:1" ? "1024x1024" : "1024x1536", response_format: "b64_json" }), signal: AbortSignal.timeout(240_000) });
  if (!response.ok) throw new Error(await responseMessage(response));
  const body = await response.json() as { data?: { b64_json?: string; url?: string }[] };
  const item = body.data?.[0];
  if (item?.b64_json) return { bytes: Buffer.from(item.b64_json, "base64"), mimeType: "image/png" };
  if (item?.url) return (await loadMedia(item.url)) || Promise.reject(new Error("Render sonucu indirilemedi."));
  throw new Error("Render modeli kullanılabilir görsel döndürmedi.");
}

function parseQa(value: string): CreativeQa {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return { passed: false, score: 0, issues: ["Kalite kontrol yanıtı ayrıştırılamadı."], correction: "Tüm metinleri ve logoyu okunaklı, yüksek kontrastlı ve eksiksiz yeniden üret." };
  try {
    const parsed = JSON.parse(match[0]) as Partial<CreativeQa>;
    return { passed: parsed.passed === true, score: Number(parsed.score) || 0, issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 10) : [], correction: String(parsed.correction || "") };
  } catch { return { passed: false, score: 0, issues: ["Kalite kontrol JSON yanıtı geçersiz."], correction: "Tüm metinleri ve logoyu okunaklı, yüksek kontrastlı ve eksiksiz yeniden üret." }; }
}

export async function inspectCreative(options: { baseUrl: string; apiKey: string; model: string; image: MediaInput; checklist: string }) {
  const prompt = `Bu reklam kreatifini çok sıkı denetle. ${options.checklist}\nÖnce görseldeki bütün yazıları OCR yapar gibi harf harf oku. Metinlerin harf harf doğruluğunu, yalnızca Türkçe olmasını, metne eklenmiş gereksiz tırnak/renk kodu/etiket bulunmamasını, logo bütünlüğünü, ekran boyutuna göre okunaklı puntoyu ve zeminle kontrastı incele. Küçük iletişim metinleri de okunmalıdır. Yalnızca JSON döndür: {"passed":true,"score":0-100,"issues":["..."],"correction":"render modeline uygulanabilir tek düzeltme talimatı"}. Her zorunlu içerik doğru ve rahat okunur değilse passed=false; passed=true ise score en az 75 olmalıdır.`;
  if (/gemini/i.test(options.model)) {
    const response = await fetch(`${endpointOrigin(options.baseUrl)}/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { data: options.image.bytes.toString("base64"), mimeType: options.image.mimeType } }] }], generationConfig: { responseModalities: ["TEXT"], temperature: 0.1 } }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(await responseMessage(response));
    const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return parseQa(body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "");
  }
  const response = await fetch(`${options.baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: options.model, temperature: 0.1, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${options.image.mimeType};base64,${options.image.bytes.toString("base64")}` } }] }] }), signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(await responseMessage(response));
  const body = await response.json() as { choices?: { message?: { content?: string } }[] };
  return parseQa(body.choices?.[0]?.message?.content || "");
}
