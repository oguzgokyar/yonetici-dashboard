import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";
type TestPayload = { provider?: string; baseUrl?: string; apiKey?: string };

export async function POST(request: Request) {
  let payload: TestPayload;
  try { payload = await request.json(); } catch { return Response.json({ ok: false, message: "Geçersiz istek." }, { status: 400 }); }
  const stored = payload.provider ? getDatabase().prepare("SELECT base_url, encrypted_api_key FROM ai_provider_configs WHERE provider = ?").get(payload.provider) as { base_url?: string; encrypted_api_key?: string } | undefined : undefined;
  const baseUrl = payload.baseUrl || stored?.base_url || "";
  let apiKey = payload.apiKey || "";
  if (!apiKey && stored?.encrypted_api_key) try { apiKey = decryptSecret(stored.encrypted_api_key); } catch { return Response.json({ ok: false, message: "Kayıtlı API anahtarı çözülemedi." }, { status: 500 }); }
  if (!baseUrl || !apiKey) return Response.json({ ok: false, message: "Base URL ve API anahtarı gerekli." }, { status: 400 });

  let target: URL;
  try {
    target = new URL(`${baseUrl.replace(/\/+$/, "")}/models`);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("unsupported protocol");
  } catch { return Response.json({ ok: false, message: "Geçerli bir HTTP veya HTTPS Base URL girin." }, { status: 400 }); }

  try {
    const response = await fetch(target, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => null) as { data?: { id?: string }[] } | null;
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "API anahtarı kabul edilmedi." : `CLIProxyAPI ${response.status} yanıtı verdi.`;
      return Response.json({ ok: false, status: response.status, message }, { status: 502 });
    }
    const models = Array.isArray(body?.data) ? body.data.map((item) => item.id).filter((id): id is string => Boolean(id)) : [];
    return Response.json({ ok: true, status: response.status, modelCount: models.length, models: models.slice(0, 50), message: `${models.length} model erişilebilir.` });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json({ ok: false, message: timedOut ? "Bağlantı 12 saniye içinde yanıt vermedi." : "CLIProxyAPI sunucusuna ulaşılamadı." }, { status: 502 });
  }
}
