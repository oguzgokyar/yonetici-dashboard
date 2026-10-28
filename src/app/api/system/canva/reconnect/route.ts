import { NextResponse } from "next/server";
import { DEFAULT_CANVA_RECONNECT_URL, getCanvaPoolSummary } from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

export async function GET() {
  const summary = getCanvaPoolSummary();
  return NextResponse.json({
    ok: true,
    reconnectUrl: summary.reconnectUrl || DEFAULT_CANVA_RECONNECT_URL,
    hasAuthOutage: summary.hasAuthOutage,
    authMessage: summary.authMessage,
  });
}

export async function POST() {
  const summary = getCanvaPoolSummary();
  return NextResponse.json({
    ok: true,
    reconnectUrl: summary.reconnectUrl || DEFAULT_CANVA_RECONNECT_URL,
    hasAuthOutage: summary.hasAuthOutage,
    authMessage: summary.authMessage,
  });
}
