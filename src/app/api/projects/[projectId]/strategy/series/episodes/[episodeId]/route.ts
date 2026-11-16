import { NextRequest, NextResponse } from "next/server";
import { updateEpisode, getProjectSeries } from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; episodeId: string }> }
) {
  try {
    const { projectId, episodeId } = await params;
    const body = await request.json();

    await updateEpisode(episodeId, {
      status: body.status,
      title: body.title,
      core_message: body.core_message,
      user_notes: body.user_notes,
    });

    const series = await getProjectSeries(projectId);
    return NextResponse.json({ success: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bölüm güncellenemedi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
