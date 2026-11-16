import { NextRequest, NextResponse } from "next/server";
import {
  updateEpisode,
  deleteEpisode,
  getProjectSeriesById,
} from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; episodeId: string }> }
) {
  try {
    const { projectId: _, episodeId } = await params;
    const body = await request.json();

    await updateEpisode(episodeId, {
      status: body.status,
      title: body.title,
      description: body.description,
      user_notes: body.user_notes,
    });

    const seriesId = String(body.seriesId || "");
    const series = seriesId ? await getProjectSeriesById(seriesId) : null;
    return NextResponse.json({ success: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bölüm güncellenemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; episodeId: string }> }
) {
  try {
    const { episodeId } = await params;
    const seriesId = await deleteEpisode(episodeId);
    const series = await getProjectSeriesById(seriesId);
    return NextResponse.json({ success: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bölüm silinemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
