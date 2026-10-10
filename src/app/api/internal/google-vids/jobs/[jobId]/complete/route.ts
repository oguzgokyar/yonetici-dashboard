import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createJobCallbackToken, getCanvaConfig, verifyCallbackToken } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const authHeader = request.headers.get("authorization");
  const { callbackToken } = getCanvaConfig();
  const { jobId } = await context.params;

  if (callbackToken && !verifyCallbackToken(authHeader, createJobCallbackToken(callbackToken, jobId))) {
    return Response.json({ ok: false, message: "Yetkisiz erişim." }, { status: 401 });
  }

  const database = getDatabase();
  const job = database
    .prepare("SELECT id, project_id, status, request_json FROM generation_jobs WHERE id=? AND type='google-vids'")
    .get(jobId) as { id: string; project_id: string; status: string; request_json: string } | undefined;

  if (!job) {
    return Response.json({ ok: false, message: "İş bulunamadı." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "Multipart form-data okunamadı." }, { status: 400 });
  }

  const videoEntry = formData.get("video");
  if (!videoEntry || typeof videoEntry !== "object" || !("arrayBuffer" in videoEntry)) {
    return Response.json({ ok: false, message: "Video dosyası eksik." }, { status: 400 });
  }

  const videoBuffer = Buffer.from(await (videoEntry as Blob).arrayBuffer());
  const outputDir = path.join(process.cwd(), ".data", "video-renders");
  fs.mkdirSync(outputDir, { recursive: true });
  const finalMp4Path = path.join(outputDir, `${jobId}.mp4`);
  const thumbPath = path.join(outputDir, `${jobId}_thumb.webp`);

  fs.writeFileSync(finalMp4Path, videoBuffer);

  try {
    execSync(
      `ffmpeg -y -ss 00:00:01 -i "${finalMp4Path}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbPath}"`,
      { timeout: 10000, stdio: "ignore" }
    );
  } catch {
    // ignore thumbnail error
  }

  let req: { title?: string; durationSeconds?: number; aspectRatio?: string } = {};
  try {
    req = JSON.parse(job.request_json || "{}");
  } catch {}

  const videoUrl = `/api/videos/${jobId}`;
  const googleVidsUrl = formData.get("googleVidsUrl") as string | null;
  const responsePayload = {
    id: jobId,
    url: videoUrl,
    videoUrl: videoUrl,
    title: req.title || "Google Vids Video",
    durationSeconds: req.durationSeconds || 30,
    aspectRatio: req.aspectRatio || "9:16",
    isGoogleVids: true,
    googleVidsUrl: googleVidsUrl || undefined,
    completedAt: new Date().toISOString(),
  };

  database
    .prepare(`
      UPDATE generation_jobs
      SET status = 'complete',
          response_json = ?,
          progress_json = ?,
          completed_at = ?
      WHERE id = ?
    `)
    .run(
      JSON.stringify(responsePayload),
      JSON.stringify({ phase: "complete", percent: 100, detail: "Tamamlandı" }),
      new Date().toISOString(),
      jobId
    );

  return Response.json({ ok: true, videoUrl });
}
