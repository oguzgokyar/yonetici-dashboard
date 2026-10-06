import { getMusicProviderPublicConfig, saveMusicProviderStoredConfig, removeMusicProvider } from "@/lib/server/music-provider-config";
import { requireMusicSettingsAdmin, assertMusicSettingsSameOrigin, MusicSettingsSecurityError } from "@/lib/server/music-provider-security";
import type { MusicProvider } from "@/lib/music-discovery";
import type { MusicProviderConfigInput } from "@/lib/music-provider-settings";
export const runtime = "nodejs";
type Context = { params: Promise<{ provider: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function provider(context: Context): Promise<MusicProvider> {
  const { provider } = await context.params;
  if (provider !== "youtube" && provider !== "instagram") throw new Error("validation");
  return provider;
}
function failure(error: unknown) { return error instanceof MusicSettingsSecurityError ? reply({ error: error.message }, error.statusCode) : reply({ error: "Müzik ayarı işlenemedi. Alanları kontrol edin." }, 400); }
function validate(body: unknown): MusicProviderConfigInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("validation");
  const value = body as Record<string, unknown>;
  const strings = ["apiKey", "accessToken", "refreshToken", "clientSecret", "clientId", "userId", "regionCode", "accountName", "expiresAt"];
  for (const [key, v] of Object.entries(value)) {
    if (strings.includes(key)) { if (typeof v !== "string" || v.length > 16000) throw new Error("validation"); }
    else if (key === "enabled") { if (typeof v !== "boolean") throw new Error("validation"); }
    else if (key === "clearFields") { if (!Array.isArray(v) || !v.every(k => ["apiKey", "accessToken", "refreshToken", "clientSecret"].includes(k))) throw new Error("validation"); }
    else throw new Error("validation"); // Verified account choices/permissions may only be written by server-side OAuth.
  }
  if (value.regionCode !== undefined && !/^[A-Z]{2}$/.test(value.regionCode as string)) throw new Error("validation");
  if (value.userId && !/^\d{1,50}$/.test(value.userId as string)) throw new Error("validation");
  if (value.expiresAt && !Number.isFinite(Date.parse(value.expiresAt as string))) throw new Error("validation");
  return value as MusicProviderConfigInput;
}
export async function GET(request: Request, context: Context) {
  try { requireMusicSettingsAdmin(request); const p = await provider(context); return reply({ ...getMusicProviderPublicConfig(p), redirectUri: new URL(`/api/settings/music/${p}/oauth/callback`, process.env.MUSIC_SETTINGS_TRUSTED_ORIGIN || request.url).toString() }); } catch (error) { return failure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    requireMusicSettingsAdmin(request); assertMusicSettingsSameOrigin(request);
    const p = await provider(context); const raw = await request.text(); if (raw.length > 70000) throw new Error("validation");
    saveMusicProviderStoredConfig(p, validate(JSON.parse(raw)));
    return reply({ ok: true, ...getMusicProviderPublicConfig(p) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    requireMusicSettingsAdmin(request); assertMusicSettingsSameOrigin(request);
    const p = await provider(context); const body = await request.json();
    if (body.action === "disconnect") {
      const { disconnectMusicProvider } = await import("@/lib/server/music-provider-oauth");
      const outcome = await disconnectMusicProvider(p);
      return reply({ ok: true, ...getMusicProviderPublicConfig(p), ...outcome, message: outcome.revoked ? "Bağlantı ve sağlayıcı izni kaldırıldı." : "Yerel bağlantı kaldırıldı; sağlayıcı tarafındaki izinler iptal edilemedi." });
    }
    else if (body.action === "remove") removeMusicProvider(p);
    else throw new Error("validation");
    return reply({ ok: true, ...getMusicProviderPublicConfig(p), message: "Yerel bağlantı kaldırıldı; sağlayıcı tarafındaki izinler iptal edilmedi." });
  } catch (error) { return failure(error); }
}
