import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";
import {
  researchAndPlanRssStoryboard,
  scrapeArticleFromUrl,
} from "@/lib/server/rss-feed-research";
import type {
  RssAspectRatio,
  RssAudioSettings,
  RssNarrativeStyleKey,
  RssStoryboard,
  RssTargetDuration,
  RssVisualMoodKey,
} from "@/features/generation/rss-video/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const db = getDatabase();

    const rows = db
      .prepare(
        `SELECT id, status, prompt, request_json, response_json, progress_json, error, created_at, completed_at
         FROM generation_jobs
         WHERE project_id = ? AND type = 'video' AND model = 'rss-video-composer'
         ORDER BY created_at DESC
         LIMIT 15`
      )
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
      let req: Record<string, unknown> = {};
      let res: Record<string, unknown> = {};
      let prog: Record<string, unknown> = {};
      try {
        req = JSON.parse(r.request_json || "{}");
      } catch {}
      try {
        res = JSON.parse(r.response_json || "{}");
      } catch {}
      try {
        prog = JSON.parse(r.progress_json || "{}");
      } catch {}

      const isActive = ["queued", "dispatching", "running", "rendering"].includes(r.status);

      return {
        id: r.id,
        status: r.status,
        prompt: r.prompt,
        error: r.error,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        progress: prog,
        request: isActive
          ? {
              title: req.title,
              topic: req.topic,
              narrativeStyle: req.narrativeStyle,
              visualMood: req.visualMood,
              aspectRatio: req.aspectRatio,
              durationSeconds: req.durationSeconds,
              storyboard: req.storyboard,
            }
          : {
              title: req.title || r.prompt,
              durationSeconds: req.durationSeconds,
              narrativeStyle: req.narrativeStyle,
            },
        response: {
          url: res.url,
          durationSeconds: res.durationSeconds,
        },
      };
    });

    const activeJob =
      jobs.find((j) => ["queued", "dispatching", "running", "rendering"].includes(j.status)) ||
      null;

    return Response.json({
      ok: true,
      activeJob,
      jobs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "RSS Video iş durumları okunamadı.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      oneClick?: boolean;
      sourceMode?: "rss" | "url" | "prompt";
      topicOrText?: string;
      sourceUrl?: string;
      narrativeStyle?: RssNarrativeStyleKey;
      visualMood?: RssVisualMoodKey;
      targetDuration?: RssTargetDuration;
      aspectRatio?: RssAspectRatio;
      storyboard?: RssStoryboard | null;
      audioSettings?: RssAudioSettings;
    };

    const db = getDatabase();
    const project = db
      .prepare("SELECT id, name, brand_json FROM projects WHERE id = ?")
      .get(projectId) as { id: string; name?: string; brand_json?: string } | undefined;

    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    let storyboard = body.storyboard || null;

    // Tek Tıkla Üretim: Eğer storyboard henüz oluşturulmadıysa önce senaryoyu otomatik kurgula
    if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      const sourceMode = body.sourceMode || "prompt";
      let topicOrText = (body.topicOrText || "").trim();
      const sourceUrl =
        sourceMode === "prompt" ? undefined : (body.sourceUrl || "").trim() || undefined;

      if ((sourceMode === "url" || sourceMode === "rss") && sourceUrl && !topicOrText) {
        try {
          const scraped = await scrapeArticleFromUrl(sourceUrl);
          topicOrText = `${scraped.title}\n\n${scraped.text}`;
        } catch (err) {
          if (!topicOrText) throw err;
        }
      }

      if (!topicOrText) {
        return Response.json(
          {
            ok: false,
            message: "Tek tıkla üretim için önce bir konu, RSS haberi veya makale URL'si girin.",
          },
          { status: 400 }
        );
      }

      let brandName = project.name || "";
      try {
        const brand = JSON.parse(project.brand_json || "{}") as { brandName?: string };
        if (brand.brandName) brandName = brand.brandName;
      } catch {}

      storyboard = await researchAndPlanRssStoryboard({
        sourceMode,
        topicOrText,
        sourceUrl,
        narrativeStyle: body.narrativeStyle || "news_bulletin",
        visualMood: body.visualMood || "cinematic_photoreal",
        targetDuration: body.targetDuration || "30s",
        aspectRatio: body.aspectRatio || "9:16",
        brandName,
      });
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = storyboard.title || "RSS Video";

    const audioSettings: RssAudioSettings = body.audioSettings || {
      voiceActor: "Kore",
      voiceSpeed: 1.0,
      voiceEmotion: "auto",
      captionStyle: "tiktok_pop",
      captionColor: "yellow",
      includeMusic: true,
      musicMood: "dynamic_news",
      musicDucking: "-18dB",
    };

    const requestPayload = {
      isRssVideo: true,
      origin: "marka_motoru",
      renderer: "rss-video-composer",
      title,
      topic: body.topicOrText || title,
      sourceMode: storyboard.sourceMode,
      sourceUrl: storyboard.sourceUrl,
      narrativeStyle: storyboard.narrativeStyle,
      visualMood: storyboard.visualMood,
      aspectRatio: storyboard.aspectRatio,
      durationSeconds: storyboard.totalDurationSeconds,
      storyboard,
      audioSettings,
    };

    db.prepare(
      `INSERT INTO generation_jobs (
        id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
      ) VALUES (?, ?, 'video', 'cliproxy', 'rss-video-composer', 'queued', ?, ?, ?, ?)`
    ).run(
      jobId,
      projectId,
      title,
      JSON.stringify(requestPayload),
      JSON.stringify({
        phase: "queued",
        percent: 5,
        detail: "Üretim sırasına alındı (#1 FIFO)...",
        updatedAt: now,
      }),
      now
    );

    triggerProductionWorker();

    return Response.json({
      ok: true,
      jobId,
      storyboard,
      message: "RSS Video üretimi merkezi FIFO kuyruğuna eklendi.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Üretim sıraya eklenemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
