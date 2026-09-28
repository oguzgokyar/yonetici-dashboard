import { createJobCallbackToken, getCanvaConfig, verifyCallbackToken } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const authHeader = request.headers.get("authorization");
  const { callbackToken } = getCanvaConfig();

  const { jobId } = await context.params;
  if (!verifyCallbackToken(authHeader, createJobCallbackToken(callbackToken, jobId))) {
    return Response.json({ ok: false, message: "Yetkisiz erişim." }, { status: 401 });
  }
  const database = getDatabase();

  const job = database
    .prepare("SELECT id, status FROM generation_jobs WHERE id=?")
    .get(jobId) as { id: string; status: string } | undefined;

  if (!job) {
    return Response.json({ ok: false, message: "İş bulunamadı." }, { status: 404 });
  }

  if (job.status === "complete") {
    return Response.json({ ok: true, message: "İş zaten tamamlandı." });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phase?: string;
    percent?: number;
    completed?: number;
    total?: number;
    detail?: string;
  };

  const phase = body.phase || "running";
  let targetStatus = "running";
  if (phase === "exporting") targetStatus = "exporting";
  else if (phase === "uploading") targetStatus = "uploading";

  const progressJson = JSON.stringify({
    phase,
    percent: typeof body.percent === "number" ? body.percent : 50,
    completed: body.completed ?? 0,
    total: body.total ?? 0,
    detail: body.detail || "İşlem devam ediyor",
    updatedAt: new Date().toISOString(),
  });

  database
    .prepare("UPDATE generation_jobs SET status=?, progress_json=? WHERE id=?")
    .run(targetStatus, progressJson, jobId);

  return Response.json({ ok: true });
}
