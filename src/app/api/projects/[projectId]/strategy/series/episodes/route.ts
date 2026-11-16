import { NextRequest, NextResponse } from "next/server";
import { createEpisode, getProjectSeriesById } from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: _ } = await params;
    const body = await request.json();
    const seriesId = String(body.seriesId || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();

    if (!seriesId) {
      return NextResponse.json(
        { success: false, error: "Seri ID gereklidir." },
        { status: 400 }
      );
    }

    await createEpisode(seriesId, title, description);
    const series = await getProjectSeriesById(seriesId);
    return NextResponse.json({ success: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alt konu eklenemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
