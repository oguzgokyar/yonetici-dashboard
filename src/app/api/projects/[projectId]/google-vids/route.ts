import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";
import { listGoogleVidsAccounts } from "@/lib/server/google-vids-account-pool";
import type { StoryboardResponse } from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const url = new URL(request.url);
    const requestedOrigin = url.searchParams.get("origin") || "marka_motoru";
    const includeAll = url.searchParams.get("all") === "true";
    const database = getDatabase();
    
    // En son veya aktif olan google-vids işlerini getir (hafıza optimizasyonu: en fazla 15 kayıt)
    const rows = database
      .prepare(`
        SELECT id, status, prompt, request_json, response_json, progress_json, error, created_at, completed_at
        FROM generation_jobs
        WHERE project_id = ? AND type = 'google-vids'
        ORDER BY created_at DESC
        LIMIT 15
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

    const filteredRows = rows.filter((r) => {
      if (includeAll) return true;
      let req: Record<string, unknown> = {};
      try { req = JSON.parse(r.request_json || "{}"); } catch {}
      const isSinematik =
        req.origin === "sinematik_studio" ||
        req.source === "sinematik_studio" ||
        req.isSceneClip === true ||
        req.scope === "scene_clip" ||
        req.isEpisodeMaster === true ||
        r.prompt.startsWith("[Klip:") ||
        r.prompt.startsWith("[Master]") ||
        r.prompt.includes("(Tam Bölüm)") ||
        r.prompt.includes("Karamurat");

      if (requestedOrigin === "marka_motoru") {
        return !isSinematik;
      }
      return isSinematik;
    });

    const jobs = filteredRows.map((r) => {
      let requestPayload: Record<string, unknown> = {};
      let responsePayload: Record<string, unknown> = {};
      let progressPayload: Record<string, unknown> = {};
      try { requestPayload = JSON.parse(r.request_json || "{}"); } catch {}
      try { responsePayload = JSON.parse(r.response_json || "{}"); } catch {}
      try { progressPayload = JSON.parse(r.progress_json || "{}"); } catch {}

      const isJobActive = ["queued", "dispatching", "running", "rendering", "exporting", "uploading"].includes(r.status);

      // Payload Trimming: 190 KB'lık devasa ağ yükünü 3-5 KB'a indir.
      // Yalnızca aktif olan iş için sahne ve karakter detaylarını sakla; geçmiş işlerde sadece özet dön.
      const trimmedRequest = isJobActive
        ? {
            title: requestPayload.title,
            topic: requestPayload.topic,
            durationSeconds: requestPayload.durationSeconds,
            visualMood: requestPayload.visualMood,
            aspectRatio: requestPayload.aspectRatio,
            narrativeTr: requestPayload.narrativeTr,
            characterAnchor: requestPayload.characterAnchor,
            visualAnchors: requestPayload.visualAnchors,
            scenes: requestPayload.scenes,
            origin: requestPayload.origin || "marka_motoru",
          }
        : {
            title: requestPayload.title || r.prompt,
            durationSeconds: requestPayload.durationSeconds,
            origin: requestPayload.origin || "marka_motoru",
          };

      return {
        id: r.id,
        status: r.status,
        prompt: r.prompt,
        error: r.error,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        request: trimmedRequest,
        response: {
          url: responsePayload.url,
          videoUrl: responsePayload.videoUrl,
        },
        progress: progressPayload,
        googleVidsUrl: responsePayload.googleVidsUrl || progressPayload.googleVidsUrl || undefined,
      };
    });

    const activeJob = jobs.find((j) =>
      ["queued", "dispatching", "running", "rendering", "exporting", "uploading"].includes(j.status)
    );

    let accounts: unknown[] = [];
    try {
      accounts = listGoogleVidsAccounts();
    } catch {}

    return Response.json({
      ok: true,
      activeJob: activeJob || null,
      accounts,
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
      storyboard?: StoryboardResponse & { isSceneClip?: boolean };
      topic?: string;
      captionStyle?: string;
      preferredAuthuser?: number;
      preferredAccountId?: string;
      isSceneClip?: boolean;
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

    const isFromSinematik = Boolean(
      (body as Record<string, unknown>).origin === "sinematik_studio" ||
      (body as Record<string, unknown>).source === "sinematik_studio" ||
      body.isSceneClip ||
      storyboard.isSceneClip ||
      (storyboard.title && (storyboard.title.includes("Klip:") || storyboard.title.includes("Bölüm") || storyboard.title.includes("Dizi") || storyboard.title.includes("Karamurat")))
    );

    const origin = isFromSinematik ? "sinematik_studio" : ((body as Record<string, unknown>).origin as string || "marka_motoru");

    const requestPayload = {
      origin,
      source: origin,
      title: storyboard.title || body.topic || "Google Vids Video",
      topic: body.topic || storyboard.title,
      aspectRatio: storyboard.aspectRatio || "9:16",
      durationSeconds: storyboard.totalDurationSeconds || 30,
      visualMood: storyboard.visualMood || "cinematic_photoreal",
      narrativeTr: storyboard.narrativeTr,
      narrativeMode: storyboard.narrativeMode || "hybrid",
      characterAnchor: storyboard.characterAnchor,
      visualAnchors: storyboard.visualAnchors,
      musicSpec: storyboard.musicSpec,
      isSceneClip: Boolean(body.isSceneClip || storyboard.isSceneClip),
      scope: (body.isSceneClip || storyboard.isSceneClip) ? "scene_clip" : undefined,
      preferredAuthuser: typeof body.preferredAuthuser === "number" ? body.preferredAuthuser : undefined,
      preferredAccountId: body.preferredAccountId || undefined,
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
