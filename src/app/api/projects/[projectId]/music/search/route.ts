import type { MusicProvider } from "@/lib/music-discovery";
import { MusicDiscoveryError, searchMusic } from "@/lib/server/music-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const result = await searchMusic({
      projectId,
      provider: (url.searchParams.get("provider") || "instagram") as MusicProvider,
      query: url.searchParams.get("query") ?? undefined,
    });
    return Response.json({ ok: result.status === "ok" || result.status === "empty", ...result }, { headers });
  } catch (error) {
    const known = error instanceof MusicDiscoveryError;
    return Response.json({ ok: false, items: [], status: "error", message: known ? error.message : "Müzik araması tamamlanamadı." }, { status: known ? error.statusCode : 500, headers });
  }
}
