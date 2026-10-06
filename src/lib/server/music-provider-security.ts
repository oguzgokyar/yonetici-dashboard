import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
const COOKIE = "music_settings_admin";
const TTL = 30 * 60 * 1000;
export class MusicSettingsSecurityError extends Error {
  statusCode: number;
  constructor(statusCode: number) { super(statusCode === 401 ? "Müzik ayarları için yönetici doğrulaması gerekli." : "İstek kaynağı doğrulanamadı."); this.statusCode = statusCode; }
}
const unlockAttempts = new Map<string, { count: number; resetAt: number }>();
export function checkMusicSettingsUnlockRateLimit(request: Request) {
  const now = Date.now();
  for (const [key, value] of unlockAttempts) if (value.resetAt <= now) unlockAttempts.delete(key);
  // Do not trust user-controlled forwarding headers unless a trusted reverse proxy is explicitly configured.
  const address = process.env.MUSIC_SETTINGS_TRUST_PROXY === "1" ? request.headers.get("X-Forwarded-For")?.split(",")[0].trim() || "unknown" : "direct";
  const key = createHash("sha256").update(address).digest("hex");
  const attempt = unlockAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (attempt.count >= 5 || (!unlockAttempts.has(key) && unlockAttempts.size >= 10000)) throw new MusicSettingsSecurityError(429);
  attempt.count += 1; unlockAttempts.set(key, attempt);
}
function adminToken() { return process.env.MUSIC_SETTINGS_ADMIN_TOKEN || process.env.SYSTEM_UPDATE_TOKEN || ""; }
function equal(a: string, b: string) { return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest()); }
function sign(payload: string) { return createHmac("sha256", adminToken()).update(`music-settings:${payload}`).digest("base64url"); }
export function assertMusicSettingsSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin || request.headers.get("Sec-Fetch-Site") === "cross-site") throw new MusicSettingsSecurityError(403);
  let actual: string;
  try { const parsed = new URL(origin); if (parsed.origin !== origin) throw new Error(); actual = parsed.origin; } catch { throw new MusicSettingsSecurityError(403); }
  // Never trust arbitrary X-Forwarded-Host/Proto headers. Only an explicitly configured public origin is allowed in addition to the request origin.
  const trusted = process.env.MUSIC_SETTINGS_TRUSTED_ORIGIN;
  if (actual !== new URL(request.url).origin && (!trusted || actual !== new URL(trusted).origin)) throw new MusicSettingsSecurityError(403);
}
export function createMusicSettingsAdminSession(token: string) {
  if (!adminToken() || !equal(token, adminToken())) throw new MusicSettingsSecurityError(401);
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + TTL })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; HttpOnly; SameSite=Lax; Path=/api/settings/music; Max-Age=1800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function requireMusicSettingsAdmin(request: Request) {
  if (!adminToken()) throw new MusicSettingsSecurityError(401);
  const cookie = request.headers.get("Cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  const [payload, signature, extra] = cookie.split(".");
  try {
    if (!payload || !signature || extra || !equal(signature, sign(payload))) throw new Error();
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof session.expiresAt !== "number" || session.expiresAt <= Date.now() || session.expiresAt > Date.now() + TTL) throw new Error();
  } catch { throw new MusicSettingsSecurityError(401); }
}
