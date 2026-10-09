import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";
import type { StoryboardResponse } from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      storyboard?: StoryboardResponse;
      topic?: string;
    };

    const storyboard = body.storyboard;
    if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      return Response.json(
        { ok: false, message: "Geçerli bir senaryo ve sahne planı bulunamadı." },
        { status: 400 }
      );
    }

    const database = getDatabase();
    const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const requestPayload = {
      title: storyboard.title || body.topic || "Google Vids Video",
      topic: body.topic || storyboard.title,
      aspectRatio: storyboard.aspectRatio || "9:16",
      durationSeconds: storyboard.totalDurationSeconds || 30,
      visualMood: storyboard.visualMood || "cinematic_photoreal",
      narrativeTr: storyboard.narrativeTr,
      scenes: storyboard.scenes,
    };

    const initialProgress = {
      phase: "queued",
      percent: 5,
      detail: "FIFO kuyruğunda sıraya alındı, önceki render bekleniyor...",
      updatedAt: now,
    };

    database
      .prepare(`
        INSERT INTO generation_jobs (
          id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
        ) VALUES (?, ?, 'google-vids', 'google', 'vids-omni-720p', 'queued', ?, ?, ?, ?)
      `)
      .run(
        jobId,
        projectId,
        requestPayload.title,
        JSON.stringify(requestPayload),
        JSON.stringify(initialProgress),
        now
      );

    // Trigger FIFO worker in background
    triggerProductionWorker();

    return Response.json({
      ok: true,
      jobId,
      message: "Video başarıyla üretim kuyruğuna eklendi.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kuyruğa eklenirken hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
