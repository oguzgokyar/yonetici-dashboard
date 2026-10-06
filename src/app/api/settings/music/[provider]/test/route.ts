import { testMusicProviderConnection } from "@/lib/server/music-discovery";
import { requireMusicSettingsAdmin, assertMusicSettingsSameOrigin, MusicSettingsSecurityError } from "@/lib/server/music-provider-security";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  try {
    requireMusicSettingsAdmin(request); assertMusicSettingsSameOrigin(request);
    const { provider } = await context.params;
    if (provider !== "youtube" && provider !== "instagram") return Response.json({ error: "Geçersiz sağlayıcı." }, { status: 400, headers });
    return Response.json(await testMusicProviderConnection(provider), { headers });
  } catch (error) {
    return Response.json({ ok: false, code: "unavailable", message: error instanceof MusicSettingsSecurityError ? error.message : "Bağlantı doğrulanamadı." }, { status: error instanceof MusicSettingsSecurityError ? error.statusCode : 502, headers });
  }
}
