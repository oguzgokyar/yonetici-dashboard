import { renderFramedStockVideo, type FrameStyle } from "@/lib/server/stock-video-renderer";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    stockVideoId?: string;
    frameStyle?: FrameStyle;
    headline?: string;
    subtitle?: string;
    headlineColor?: string;
    accentColor?: string;
    logoUrl?: string;
    logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
    musicTrack?: string;
    originalVolume?: number;
    musicVolume?: number;
    maxDurationSeconds?: number;
  } | null;

  if (!body?.stockVideoId) {
    return Response.json(
      { ok: false, message: "Stok video seçilmedi." },
      { status: 400 }
    );
  }

  try {
    const result = await renderFramedStockVideo({
      projectId,
      stockVideoId: body.stockVideoId,
      frameStyle: body.frameStyle || "blur_padding",
      headline: body.headline,
      subtitle: body.subtitle,
      headlineColor: body.headlineColor,
      accentColor: body.accentColor,
      logoUrl: body.logoUrl,
      logoPosition: body.logoPosition,
      musicTrack: body.musicTrack,
      originalVolume: body.originalVolume,
      musicVolume: body.musicVolume,
      maxDurationSeconds: body.maxDurationSeconds || 30,
    });

    return Response.json({ ok: true, video: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
