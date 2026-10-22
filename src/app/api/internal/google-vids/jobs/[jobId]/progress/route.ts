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

    const existingRow = database
      .prepare("SELECT progress_json, response_json FROM generation_jobs WHERE id = ?")
      .get(jobId) as { progress_json?: string; response_json?: string } | undefined;
    let existingProgress: Record<string, unknown> = {};
    if (existingRow?.progress_json) {
      try {
        existingProgress = JSON.parse(existingRow.progress_json);
      } catch {}
    }

    const resolvedGvUrl = body.googleVidsUrl || (existingProgress.googleVidsUrl as string | undefined);
    const now = new Date().toISOString();
    const progressPayload = {
      ...existingProgress,
      phase: body.phase || existingProgress.phase || "running",
      percent: typeof body.percent === "number" ? body.percent : (existingProgress.percent ?? 15),
      detail: body.detail || existingProgress.detail || "Google Vids sahnesi işleniyor...",
      googleVidsUrl: resolvedGvUrl || undefined,
      updatedAt: now,
    };

    database
      .prepare(`
        UPDATE generation_jobs
        SET progress_json = ?,
            response_json = CASE
              WHEN ? IS NOT NULL THEN json_set(COALESCE(response_json, '{}'), '$.googleVidsUrl', ?)
              ELSE response_json
            END,
            status = CASE WHEN status IN ('queued', 'dispatching') THEN 'running' ELSE status END
        WHERE id = ? AND status IN ('queued', 'dispatching', 'running', 'rendering')
      `)
      .run(JSON.stringify(progressPayload), resolvedGvUrl || null, resolvedGvUrl || null, jobId);

    return Response.json({ ok: true, message: "İlerleme güncellendi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
