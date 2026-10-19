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
      phase?: string;
      percent?: number;
      detail?: string;
      googleVidsUrl?: string;
      [key: string]: unknown;
    };

    const now = new Date().toISOString();
    const progressPayload = {
      phase: body.phase || "running",
      percent: typeof body.percent === "number" ? body.percent : 15,
      detail: body.detail || "Google Vids sahnesi işleniyor...",
      googleVidsUrl: body.googleVidsUrl || undefined,
      updatedAt: now,
    };

    database
      .prepare(`
        UPDATE generation_jobs
        SET progress_json = ?,
            status = CASE WHEN status IN ('queued', 'dispatching') THEN 'running' ELSE status END
        WHERE id = ? AND status IN ('queued', 'dispatching', 'running', 'rendering')
      `)
      .run(JSON.stringify(progressPayload), jobId);

    return Response.json({ ok: true, message: "İlerleme güncellendi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
