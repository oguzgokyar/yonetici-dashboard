import "server-only";
import { getDatabase } from "@/lib/server/database";
import { encryptSecret, decryptSecret } from "@/lib/server/secrets";
import type { MusicProvider } from "@/lib/music-discovery";
import type { MusicProviderConfigInput, MusicProviderPublicConfig } from "@/lib/music-provider-settings";

const secretFields = ["apiKey", "accessToken", "refreshToken", "clientSecret"] as const;
const metadataFields = ["clientId", "userId", "regionCode", "accountName", "expiresAt"] as const;
export type MusicProviderStoredConfig = Required<Omit<MusicProviderConfigInput, "clearFields">> & { source: MusicProviderPublicConfig["source"] };
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
function requireProvider(provider: MusicProvider) {
  if (provider !== "instagram" && provider !== "youtube") throw new Error("Geçersiz müzik sağlayıcısı.");
}
export function getMusicProviderStoredConfig(provider: MusicProvider): MusicProviderStoredConfig {
  requireProvider(provider);
  const row = getDatabase().prepare("SELECT enabled, encrypted_api_key, settings_json FROM integration_configs WHERE service = ?").get(`music-${provider}`) as { enabled: number; encrypted_api_key: string | null; settings_json: string } | undefined;
  let secrets: Record<string, unknown> = {};
  let metadata: Record<string, unknown> = {};
  if (row) {
    try { metadata = JSON.parse(row.settings_json); } catch { /* fail closed */ }
    try { secrets = row.encrypted_api_key ? JSON.parse(decryptSecret(row.encrypted_api_key)) : {}; } catch { /* never fallback to env on corruption */ }
  } else if (provider === "youtube") secrets.apiKey = process.env.YOUTUBE_MUSIC_API_KEY;
  else { secrets.accessToken = process.env.INSTAGRAM_MUSIC_ACCESS_TOKEN; metadata.userId = process.env.INSTAGRAM_MUSIC_USER_ID; }
  const configured = Boolean(provider === "youtube" ? clean(secrets.apiKey) : clean(secrets.accessToken) && clean(metadata.userId));
  return {
    enabled: row ? Boolean(row.enabled) : configured, source: row ? "database" : configured ? "environment" : "none",
    apiKey: clean(secrets.apiKey), accessToken: clean(secrets.accessToken), refreshToken: clean(secrets.refreshToken), clientSecret: clean(secrets.clientSecret),
    clientId: clean(metadata.clientId), userId: clean(metadata.userId), regionCode: clean(metadata.regionCode) || "TR", accountName: clean(metadata.accountName), expiresAt: clean(metadata.expiresAt),
    accountChoices: Array.isArray(metadata.accountChoices) ? metadata.accountChoices : [], permissions: Array.isArray(metadata.permissions) ? metadata.permissions.filter((p): p is string => typeof p === "string") : [],
  };
}
export function getMusicProviderPublicConfig(provider: MusicProvider): MusicProviderPublicConfig {
  const c = getMusicProviderStoredConfig(provider);
  const configured = provider === "youtube" ? Boolean(c.apiKey || c.accessToken) : Boolean(c.accessToken && c.userId);
  return {
    provider, enabled: c.enabled, source: c.source,
    status: !c.enabled && c.source !== "none" ? "disabled" : c.expiresAt && Date.parse(c.expiresAt) <= Date.now() && !c.apiKey ? "expired" : configured ? "configured" : "not-configured",
    hasApiKey: Boolean(c.apiKey), maskedKey: c.apiKey ? "••••••••" : "", hasAccessToken: Boolean(c.accessToken), maskedAccessToken: c.accessToken ? "••••••••" : "", hasRefreshToken: Boolean(c.refreshToken), hasClientSecret: Boolean(c.clientSecret),
    clientId: c.clientId, userId: c.userId, regionCode: c.regionCode, accountName: c.accountName, expiresAt: c.expiresAt, accountChoices: c.accountChoices, permissions: c.permissions,
  };
}
export function disconnectMusicProvider(provider: MusicProvider) {
  return saveMusicProviderStoredConfig(provider, { clearFields: ["accessToken", "refreshToken"], userId: "", accountName: "", expiresAt: "", accountChoices: [], permissions: [] });
}
export function removeMusicProvider(provider: MusicProvider) {
  return saveMusicProviderStoredConfig(provider, { enabled: false, clearFields: [...secretFields], clientId: "", userId: "", accountName: "", expiresAt: "", regionCode: "TR", accountChoices: [], permissions: [] });
}
export function saveMusicProviderStoredConfig(provider: MusicProvider, input: MusicProviderConfigInput) {
  const existing = getMusicProviderStoredConfig(provider);
  const secrets: Record<string, string> = {};
  for (const key of secretFields) secrets[key] = input.clearFields?.includes(key) ? "" : clean(input[key]) || existing[key];
  const metadata: Record<string, unknown> = {};
  for (const key of metadataFields) metadata[key] = input[key] !== undefined ? clean(input[key]) : existing[key];
  metadata.accountChoices = input.accountChoices ?? existing.accountChoices;
  metadata.permissions = input.permissions ?? existing.permissions;
  getDatabase().prepare(`INSERT INTO integration_configs(service, enabled, base_url, encrypted_api_key, settings_json, updated_at) VALUES(?, ?, '', ?, ?, ?) ON CONFLICT(service) DO UPDATE SET enabled=excluded.enabled, encrypted_api_key=excluded.encrypted_api_key, settings_json=excluded.settings_json, updated_at=excluded.updated_at`).run(`music-${provider}`, (input.enabled ?? (existing.source === "none" ? true : existing.enabled)) ? 1 : 0, encryptSecret(JSON.stringify(secrets)), JSON.stringify(metadata), new Date().toISOString());
  return getMusicProviderStoredConfig(provider);
}
