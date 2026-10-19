import { createJobCallbackToken, getCanvaConfig, verifyCallbackToken } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const authHeader = request.headers.get("authorization");
  const { callbackToken } = getCanvaConfig();
  const { jobId } = await context.params;

  if (callbackToken && !verifyCallbackToken(authHeader, createJobCallbackToken(callbackToken, jobId))) {
    return Response.json({ ok: false, message: "Yetkisiz erişim." }, { status: 401 });
  }

  const database = getDatabase();
  try {
    const body = (await request.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    const errorMessage = body.error || body.message || "Google Vids üretimi başarısız oldu.";
    const now = new Date().toISOString();

    database
      .prepare(`
        UPDATE generation_jobs
        SET status = 'failed',
            error = ?,
            completed_at = ?,
            progress_json = json_set(COALESCE(progress_json, '{}'), '$.phase', 'failed', '$.percent', 100, '$.detail', ?)
        WHERE id = ? AND status IN ('queued', 'dispatching', 'running', 'rendering')
      `)
      .run(errorMessage, now, errorMessage, jobId);

    return Response.json({ ok: true, message: "İş başarısız olarak işaretlendi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
