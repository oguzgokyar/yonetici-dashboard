import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";
import type { StoryboardResponse } from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const database = getDatabase();
    
    // En son veya aktif olan google-vids işlerini getir
    const rows = database
      .prepare(`
        SELECT id, status, prompt, request_json, response_json, progress_json, error, created_at, completed_at
        FROM generation_jobs
        WHERE project_id = ? AND type = 'google-vids'
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .all(projectId) as Array<{
        id: string;
        status: string;
        prompt: string;
        request_json: string;
        response_json: string;
        progress_json: string;
        error: string | null;
        created_at: string;
        completed_at: string | null;
      }>;

    const jobs = rows.map((r) => {
      let requestPayload: Record<string, unknown> = {};
      let responsePayload: Record<string, unknown> = {};
      let progressPayload: Record<string, unknown> = {};
      try { requestPayload = JSON.parse(r.request_json || "{}"); } catch {}
      try { responsePayload = JSON.parse(r.response_json || "{}"); } catch {}
      try { progressPayload = JSON.parse(r.progress_json || "{}"); } catch {}

      return {
        id: r.id,
        status: r.status,
        prompt: r.prompt,
        error: r.error,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        request: requestPayload,
        response: responsePayload,
        progress: progressPayload,
        googleVidsUrl: responsePayload.googleVidsUrl || progressPayload.googleVidsUrl || undefined,
      };
    });

    const activeJob = jobs.find((j) =>
      ["queued", "dispatching", "running", "rendering", "exporting", "uploading"].includes(j.status)
    );

    return Response.json({
      ok: true,
      activeJob: activeJob || null,
      jobs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Google Vids durumları okunamadı.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      storyboard?: StoryboardResponse;
      topic?: string;
      captionStyle?: string;
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
      narrativeMode: storyboard.narrativeMode || "hybrid",
      musicSpec: storyboard.musicSpec,
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
