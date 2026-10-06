import { requireMusicSettingsAdmin, assertMusicSettingsSameOrigin, createMusicSettingsAdminSession, checkMusicSettingsUnlockRateLimit, MusicSettingsSecurityError } from "@/lib/server/music-provider-security";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  try {
    assertMusicSettingsSameOrigin(request);
    return Response.json({ authorized: false }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `music_settings_admin=; HttpOnly; SameSite=Lax; Path=/api/settings/music; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}` } });
  } catch { return Response.json({ error: "İstek kaynağı doğrulanamadı." }, { status: 403, headers: { "Cache-Control": "no-store" } }); }
}
export async function GET(request: Request) {
  try { requireMusicSettingsAdmin(request); return Response.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ authorized: false }, { headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(request: Request) {
  try {
    assertMusicSettingsSameOrigin(request); checkMusicSettingsUnlockRateLimit(request);
    const raw = await request.text(); if (raw.length > 8192) throw new Error();
    const body = JSON.parse(raw); if (typeof body.token !== "string") throw new Error();
    const cookie = createMusicSettingsAdminSession(body.token);
    return Response.json({ authorized: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } });
  } catch (error) {
    return Response.json({ authorized: false, error: "Yönetici doğrulaması başarısız." }, { status: error instanceof MusicSettingsSecurityError ? error.statusCode : 400, headers: { "Cache-Control": "no-store" } });
  }
}
