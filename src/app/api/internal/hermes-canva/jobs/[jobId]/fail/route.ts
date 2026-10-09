import { createJobCallbackToken, getCanvaConfig, verifyCallbackToken } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { finishCanvaCoordination } from "@/lib/server/production-worker";

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
    .prepare("SELECT id, status FROM generation_jobs WHERE id=? AND type='canva'")
    .get(jobId) as { id: string; status: string } | undefined;

  if (!job) {
    return Response.json({ ok: false, message: "İş bulunamadı." }, { status: 404 });
  }
  if (job.status === "complete") {
    return Response.json({ ok: true, message: "Tamamlanmış iş hata durumuna çevrilmedi." });
  }

  if (['video_exporting', 'coordination_uncertain'].includes(job.status)) {
    return Response.json({ok: false, message: 'Export may still be running; verified operator recovery required.'}, {status: 409});
  }

  const body = (await request.json().catch(() => ({}))) as {
    error?: string;
  };

  const errorMsg = body.error || "Bilinmeyen Canva üretim hatası";

  const progressJson = JSON.stringify({
    phase: "failed",
    percent: 0,
    detail: errorMsg,
    updatedAt: new Date().toISOString(),
  });

  database
    .prepare("UPDATE generation_jobs SET status='failed', error=?, progress_json=? WHERE id=?")
    .run(errorMsg, progressJson, jobId);

  await finishCanvaCoordination(jobId);

  return Response.json({ ok: true });
}
