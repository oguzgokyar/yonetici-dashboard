import { NextRequest, NextResponse } from "next/server";
import {
  getProjectSeries,
  getProjectSeriesById,
  getProjectSeriesList,
  researchAndCreateSeries,
} from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get("seriesId");

    const allSeries = await getProjectSeriesList(projectId);
    const series = seriesId
      ? await getProjectSeriesById(seriesId)
      : await getProjectSeries(projectId);

    return NextResponse.json({ success: true, series, allSeries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seri verisi alınamadı.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const mainTopic = String(body.mainTopic || "").trim();

    if (!mainTopic) {
      return NextResponse.json(
        { success: false, error: "Ana konu başlığı gereklidir." },
        { status: 400 }
      );
    }

    const series = await researchAndCreateSeries(projectId, mainTopic);
    const allSeries = await getProjectSeriesList(projectId);
    return NextResponse.json({ success: true, series, allSeries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seri araştırma işlemi başarısız oldu.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
