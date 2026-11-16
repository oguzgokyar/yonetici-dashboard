import { NextRequest, NextResponse } from "next/server";
import {
  getProjectSeries,
  getProjectSeriesById,
  getProjectSeriesList,
  researchAndCreateSeries,
  updateSeriesTitle,
  deleteSeries,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const seriesId = String(body.seriesId || "").trim();
    const mainTopic = String(body.mainTopic || "").trim();

    if (!seriesId || !mainTopic) {
      return NextResponse.json(
        { success: false, error: "Seri ID ve yeni başlık gereklidir." },
        { status: 400 }
      );
    }

    await updateSeriesTitle(seriesId, mainTopic);
    const series = await getProjectSeriesById(seriesId);
    const allSeries = await getProjectSeriesList(projectId);
    return NextResponse.json({ success: true, series, allSeries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Başlık güncellenemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get("seriesId");

    if (!seriesId) {
      return NextResponse.json(
        { success: false, error: "Silinecek seri ID belirtilmedi." },
        { status: 400 }
      );
    }

    await deleteSeries(seriesId);
    const allSeries = await getProjectSeriesList(projectId);
    const series = await getProjectSeries(projectId);
    return NextResponse.json({ success: true, series, allSeries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seri silinemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
