import { authorizeServerMonitorUnlock, createServerMonitorSession } from "@/lib/server/server-monitor-security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { authorizeServerMonitorUnlock(request); } catch (error) { return Response.json({ ok: false, message: "İstek kaynağı veya deneme sınırı doğrulanamadı." }, { status: (error as { statusCode?: number }).statusCode || 403, headers: { "Cache-Control": "no-store" } }); }
  try {
    const body = await request.json();
    if (typeof body?.token !== "string" || body.token.length > 4096) throw new Error();
    const cookie = createServerMonitorSession(body.token);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, message: "Yönetici anahtarı doğrulanamadı." }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
}
