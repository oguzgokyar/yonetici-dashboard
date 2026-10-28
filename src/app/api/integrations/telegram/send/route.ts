import { NextRequest, NextResponse } from "next/server";
import { sendMediaToTelegram } from "@/lib/server/telegram-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaUrl, mediaUrls, mediaType, caption } = body;

    const hasMultiple = Array.isArray(mediaUrls) && mediaUrls.length > 0;
    const urls: string[] = hasMultiple
      ? mediaUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
      : (mediaUrl && typeof mediaUrl === "string" && mediaUrl.trim().length > 0 ? [mediaUrl.trim()] : []);

    if (urls.length === 0) {
      return NextResponse.json({ ok: false, error: "Geçerli bir mediaUrl veya mediaUrls gereklidir." }, { status: 400 });
    }

    const result = await sendMediaToTelegram({
      ...(hasMultiple ? { mediaUrls: urls } : { mediaUrl: urls[0] }),
      mediaType: mediaType || "auto",
      caption: caption || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, messageId: result.messageId, messageIds: result.messageIds });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Bilinmeyen sunucu hatası";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
