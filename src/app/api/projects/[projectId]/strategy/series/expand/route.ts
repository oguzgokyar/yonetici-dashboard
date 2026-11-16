import { NextRequest, NextResponse } from "next/server";
import { expandSeries } from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: _ } = await params;
    const body = await request.json();
    const seriesId = String(body.seriesId || "").trim();

    if (!seriesId) {
      return NextResponse.json(
        { success: false, error: "Seri ID gereklidir." },
        { status: 400 }
      );
    }

    const series = await expandSeries(seriesId);
    return NextResponse.json({ success: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seri uzatılamadı.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
