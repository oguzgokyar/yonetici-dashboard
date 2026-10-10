import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assertMusicSettingsSameOrigin, checkMusicSettingsUnlockRateLimit } from "@/lib/server/music-provider-security";
const COOKIE = "server_monitor_admin";
const TTL = 1800;
function token() { return process.env.SERVER_MONITOR_ADMIN_TOKEN || process.env.SYSTEM_UPDATE_TOKEN || ""; }
function equal(a: string, b: string) { return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest()); }
function sign(payload: string) { return createHmac("sha256", token()).update(`server-monitor:${payload}`).digest("base64url"); }
export function createServerMonitorSession(input: string) {
  if (!token() || !equal(input, token())) throw new Error("Unauthorized");
  const payload = String(Date.now() + TTL * 1000);
  return `${COOKIE}=${payload}.${sign(payload)}; HttpOnly; SameSite=Strict; Path=/api/system/server-status; Max-Age=${TTL}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function requireServerMonitorAdmin(request: Request) {
  const cookie = request.headers.get("Cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  const [payload, signature, extra] = cookie.split(".");
  const expires = Number(payload);
  if (!token() || !signature || extra || !equal(signature, sign(payload)) || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + TTL * 1000) throw new Error("Unauthorized");
}
export function authorizeServerMonitorUnlock(request: Request) {
  assertMusicSettingsSameOrigin(request);
  checkMusicSettingsUnlockRateLimit(request);
}
