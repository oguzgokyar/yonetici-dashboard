import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";
type ProviderRow = { base_url: string; encrypted_api_key: string; image_model: string };
type ImageItem = { b64_json?: string; url?: string; mime_type?: string };

function dimensions(ratio: string) {
  if (ratio === "9:16" || ratio === "2:3") return "1024x1536";
  if (ratio === "16:9") return "1536x1024";
  if (ratio === "4:5") return "1024x1536";
  return "1024x1024";
}

function geminiRatio(ratio: string) {
  return ["1:1", "4:5", "9:16", "2:3", "16:9"].includes(ratio) ? ratio : "1:1";
}

export async function POST(request: Request) {
  const input = await request.json() as { projectId?: string; prompt?: string; ratio?: string; count?: number; model?: string; settings?: Record<string, unknown> };
  if (!input.projectId || !input.prompt?.trim()) return Response.json({ ok: false, message: "Proje ve prompt gerekli." }, { status: 400 });
  const provider = getDatabase().prepare("SELECT base_url, encrypted_api_key, image_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1").get() as ProviderRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key) return Response.json({ ok: false, message: "CliProxyAPI ayarı kayıtlı veya etkin değil." }, { status: 409 });

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const database = getDatabase();
  database.prepare("INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, created_at) VALUES (?, ?, 'image', 'cliproxy', '', 'running', ?, ?, ?)").run(jobId, input.projectId, input.prompt.trim(), JSON.stringify(input.settings || {}), now);

  try {
    const apiKey = decryptSecret(provider.encrypted_api_key);
    const baseUrl = provider.base_url.replace(/\/+$/, "");
    let model = input.model || provider.image_model;
    if (!model) {
      const modelResponse = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
      const modelBody = await modelResponse.json() as { data?: { id?: string }[] };
      const ids = modelBody.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) || [];
      model = ids.find((id) => /gemini-3\.1-flash-image/i.test(id)) || ids.find((id) => /gpt-image|grok-imagine|image/i.test(id)) || "";
    }
    if (!model) throw new Error("Görsel üretim modeli bulunamadı.");

    database.prepare("UPDATE generation_jobs SET model = ? WHERE id = ?").run(model, jobId);
    let imageItems: ImageItem[] = [];
    if (/gemini.*image/i.test(model)) {
      const nativeBase = new URL(baseUrl).origin;
      const amount = Math.min(Math.max(input.count || 1, 1), 4);
      const responses = await Promise.all(Array.from({ length: amount }, () => fetch(`${nativeBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: input.prompt!.trim() }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: geminiRatio(input.ratio || "1:1") } } }), signal: AbortSignal.timeout(180_000) })));
      for (const response of responses) {
        const body = await response.json() as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[] } }[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message || `CliProxyAPI ${response.status} yanıtı verdi.`);
        for (const part of body.candidates?.[0]?.content?.parts || []) {
          const inline = part.inlineData || (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : undefined);
          if (inline?.data) imageItems.push({ b64_json: inline.data, mime_type: inline.mimeType || "image/png" });
        }
      }
    } else {
      const response = await fetch(`${baseUrl}/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt: input.prompt.trim(), n: Math.min(Math.max(input.count || 1, 1), 4), size: dimensions(input.ratio || "1:1"), response_format: "b64_json" }), signal: AbortSignal.timeout(180_000) });
      const body = await response.json() as { data?: ImageItem[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || `CliProxyAPI ${response.status} yanıtı verdi.`);
      imageItems = body.data || [];
    }
    if (!imageItems.length) throw new Error("Servis kullanılabilir görsel döndürmedi.");

    const assetDir = path.join(process.cwd(), ".data", "assets");
    fs.mkdirSync(assetDir, { recursive: true });
    const assets: { id: string; url: string; mimeType: string }[] = [];
    for (const item of imageItems) {
      const id = crypto.randomUUID();
      const mimeType = item.mime_type || "image/png";
      const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
      let bytes: Buffer;
      if (item.b64_json) bytes = Buffer.from(item.b64_json, "base64");
      else if (item.url) {
        const remote = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
        if (!remote.ok) throw new Error("Üretilen görsel indirilemedi.");
        bytes = Buffer.from(await remote.arrayBuffer());
      } else continue;
      fs.writeFileSync(path.join(assetDir, `${id}.${extension}`), bytes);
      fs.writeFileSync(path.join(assetDir, `${id}.json`), JSON.stringify({ mimeType, extension }));
      assets.push({ id, url: `/api/assets/${id}`, mimeType });
    }
    if (!assets.length) throw new Error("Servis kullanılabilir görsel döndürmedi.");
    database.prepare("UPDATE generation_jobs SET status='complete', response_json=?, completed_at=? WHERE id=?").run(JSON.stringify({ assets }), new Date().toISOString(), jobId);
    return Response.json({ ok: true, jobId, model, assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Görsel üretilemedi.";
    database.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(message.slice(0, 1000), new Date().toISOString(), jobId);
    return Response.json({ ok: false, message }, { status: 502 });
  }
}
