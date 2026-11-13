import "server-only";

import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

type ProviderRow = { base_url: string; encrypted_api_key: string; text_model: string };

export async function completeText(
  system: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; model?: string; timeoutMs?: number }
) {
  const provider = getDatabase()
    .prepare("SELECT base_url, encrypted_api_key, text_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1")
    .get() as ProviderRow | undefined;
  if (!provider?.base_url || !provider.encrypted_api_key) throw new Error("Önce Sistem Ayarları'ndan CliProxyAPI bağlantısını kaydedin.");
  const apiKey = decryptSecret(provider.encrypted_api_key);
  const baseUrl = provider.base_url.replace(/\/+$/, "");
  let model = options?.model || provider.text_model || "gemini-3-flash";

  const timeoutMs = options?.timeoutMs ?? 180_000;

  // Primary model, with fast fallback if deep reasoning model times out
  const modelsToTry = [model];
  if (!modelsToTry.includes("gemini-3-flash")) {
    modelsToTry.push("gemini-3-flash");
  }

  let lastError: unknown;
  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const perModelTimeout = modelsToTry.length > 1 && i === 0 && currentModel.includes("-high")
        ? 65_000
        : timeoutMs;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentModel,
          temperature: options?.temperature ?? 0.6,
          max_tokens: options?.maxTokens ?? 2200,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(perModelTimeout),
      });

      const body = (await response.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };

      if (!response.ok) throw new Error(body.error?.message || `AI isteği tamamlanamadı (${response.status})`);
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("AI kullanılabilir bir yanıt üretmedi.");
      return { content, model: body.model || currentModel };
    } catch (err) {
      lastError = err;
      console.warn(`[CliProxyText] Model ${currentModel} başarısız veya zaman aşımı, yedek modele geçiliyor:`, err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
