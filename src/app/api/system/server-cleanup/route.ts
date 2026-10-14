import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const bridgeUrls = [
      "http://10.0.1.1:8080/api/internal/system/cleanup",
      "http://127.0.0.1:8080/api/internal/system/cleanup",
      "http://10.0.1.8:8080/api/internal/system/cleanup",
    ];

    let lastError: Error | null = null;
    for (const bUrl of bridgeUrls) {
      try {
        const res = await fetch(bUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: `Host köprüsüne bağlanılamadı: ${lastError?.message || "Bilinmeyen hata"}`,
      },
      { status: 502 }
    );
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
