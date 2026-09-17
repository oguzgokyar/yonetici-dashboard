import { getDatabase } from "@/lib/server/database";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";
type ProviderInput = { provider?: string; enabled?: boolean; baseUrl?: string; apiKey?: string; textModel?: string; imageModel?: string; priority?: number };

export async function GET() {
  const rows = getDatabase().prepare("SELECT provider, enabled, base_url, encrypted_api_key, text_model, image_model, priority FROM ai_provider_configs ORDER BY priority, provider").all() as Record<string, unknown>[];
  return Response.json(rows.map((row) => {
    let maskedKey = "";
    if (row.encrypted_api_key) try { maskedKey = maskSecret(decryptSecret(String(row.encrypted_api_key))); } catch { maskedKey = "Kayıt okunamadı"; }
    return { provider: row.provider, enabled: Boolean(row.enabled), baseUrl: row.base_url, hasApiKey: Boolean(row.encrypted_api_key), maskedKey, textModel: row.text_model, imageModel: row.image_model, priority: row.priority };
  }));
}

export async function PUT(request: Request) {
  const input = await request.json() as ProviderInput;
  if (!input.provider || !["cliproxy", "openai", "gemini"].includes(input.provider)) return Response.json({ ok: false, message: "Geçersiz sağlayıcı." }, { status: 400 });
  const database = getDatabase();
  const existing = database.prepare("SELECT encrypted_api_key FROM ai_provider_configs WHERE provider = ?").get(input.provider) as { encrypted_api_key?: string } | undefined;
  const encryptedKey = input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : existing?.encrypted_api_key || null;
  database.prepare(`INSERT INTO ai_provider_configs (provider, enabled, base_url, encrypted_api_key, text_model, image_model, priority, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET enabled=excluded.enabled, base_url=excluded.base_url, encrypted_api_key=excluded.encrypted_api_key, text_model=excluded.text_model, image_model=excluded.image_model, priority=excluded.priority, updated_at=excluded.updated_at`)
    .run(input.provider, input.enabled ? 1 : 0, input.baseUrl?.trim() || "", encryptedKey, input.textModel?.trim() || "", input.imageModel?.trim() || "", input.priority || 0, new Date().toISOString());
  return Response.json({ ok: true, hasApiKey: Boolean(encryptedKey) });
}
