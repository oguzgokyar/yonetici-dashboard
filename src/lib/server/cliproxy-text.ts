import "server-only";

import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

type ProviderRow = { base_url: string; encrypted_api_key: string; text_model: string };

export async function completeText(system: string, prompt: string, options?: { temperature?: number; maxTokens?: number }) {
  const provider = getDatabase().prepare("SELECT base_url, encrypted_api_key, text_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1").get() as ProviderRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key) throw new Error("Önce Sistem Ayarları'ndan CliProxyAPI bağlantısını kaydedin.");
  const apiKey = decryptSecret(provider.encrypted_api_key);
  const baseUrl = provider.base_url.replace(/\/+$/, "");
  let model = provider.text_model;
  if (!model) {
    const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
    const body = await response.json() as { data?: { id?: string }[] };
    const ids = body.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) || [];
    model = ids.find((id) => id === "gpt-4.1") || ids.find((id) => /gemini.*pro|claude.*sonnet|gpt-4|kimi/i.test(id)) || ids[0] || "";
  }
  if (!model) throw new Error("Kullanılabilir prompt modeli bulunamadı.");
  const response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: options?.temperature ?? 0.6, max_tokens: options?.maxTokens ?? 1400, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(60_000) });
  const body = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || "AI metin isteği tamamlanamadı.");
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI kullanılabilir bir yanıt üretmedi.");
  return { content, model };
}

export function parseJsonResponse<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const startArray = fenced.indexOf("[");
  const startObject = fenced.indexOf("{");
  const start = startArray >= 0 && (startObject < 0 || startArray < startObject) ? startArray : startObject;
  const end = start === startArray ? fenced.lastIndexOf("]") : fenced.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI geçerli JSON üretmedi.");
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}
