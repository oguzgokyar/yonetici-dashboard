import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_URLS = [
  "http://10.0.1.1:8080/api/internal/novnc",
  "http://127.0.0.1:8080/api/internal/novnc",
  "http://10.0.1.8:8080/api/internal/novnc",
];

async function callBridge(action?: string, targetUrl?: string) {
  let lastError: Error | null = null;
  for (const baseUrl of BRIDGE_URLS) {
    try {
      const url = action ? `${baseUrl}?action=${encodeURIComponent(action)}` : baseUrl;
      const res = await fetch(url, {
        method: action ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: action ? JSON.stringify({ action, target_url: targetUrl }) : undefined,
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(`Host köprüsüne erişilemedi: ${lastError?.message || "Bilinmeyen hata"}`);
}

export async function GET() {
  try {
    const data = await callBridge();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, status: "unknown", message: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    let action = "status";
    let targetUrl: string | undefined;
    try {
      const body = await request.json();
      action = body.action || "status";
      targetUrl = body.target_url || body.targetUrl;
    } catch {
      // ignore
    }

    const data = await callBridge(action, targetUrl);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, status: "error", message: msg }, { status: 502 });
  }
}
