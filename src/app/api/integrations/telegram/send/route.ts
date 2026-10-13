import { NextRequest, NextResponse } from "next/server";
import { sendMediaToTelegram } from "@/lib/server/telegram-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaUrl, mediaType, caption } = body;

    if (!mediaUrl || typeof mediaUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Geçerli bir mediaUrl gereklidir." }, { status: 400 });
    }

    const result = await sendMediaToTelegram({
      mediaUrl,
      mediaType: mediaType || "auto",
      caption: caption || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Bilinmeyen sunucu hatası";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
