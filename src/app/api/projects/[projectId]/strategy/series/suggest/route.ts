import { NextRequest, NextResponse } from "next/server";
import { suggestStrategicSeries } from "@/lib/server/series-researcher";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const suggestions = await suggestStrategicSeries(projectId);
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stratejik seri önerileri alınamadı.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
