import "server-only";
import { getDatabase } from "@/lib/server/database";
import { renderFramedStockVideo } from "@/lib/server/stock-video-renderer";
import { getCanvaConfig, createJobCallbackToken } from "@/lib/server/canva-config";
import { buildHermesCanvaTaskPrompt } from "@/lib/server/hermes-canva-task";
import { dispatchHermesCanvaTask } from "@/lib/server/hermes-agent-client";

/**
 * Global FIFO Mutex Lock:
 * Allows ANY production endpoint (AI Image, Motion Video, Stock Video, Canva)
 * to run strictly ONE at a time in First-In, First-Out order.
 */
interface FifoQueueState {
  tail: Promise<unknown>;
  isDrainingDb: boolean;
}

const globalFifo = globalThis as unknown as {
  __fifoProductionQueue?: FifoQueueState;
};

if (!globalFifo.__fifoProductionQueue) {
  globalFifo.__fifoProductionQueue = {
    tail: Promise.resolve(),
    isDrainingDb: false,
  };
}

/**
 * Enqueues an async task into the global FIFO execution chain.
 * If another task is currently running, this waits until all earlier tasks finish,
 * then executes `fn()` and resolves with its result.
 */
export function runInFifoQueue<T>(jobId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const state = globalFifo.__fifoProductionQueue!;

  const next = state.tail.then(async () => {
    return await fn();
  });

  // Ensure errors in `next` don't break the chain for subsequent tasks
  state.tail = next.catch((err) => {
    console.error(`[FIFO Queue] Task ${jobId || "unknown"} failed:`, err);
  });

  return next;
}

/**
 * Triggers the database-backed FIFO worker for background jobs (Stock Video & Canva)
 * that are stored with status = 'queued' in `generation_jobs`.
 */
export function triggerProductionWorker(): void {
  const state = globalFifo.__fifoProductionQueue!;
  if (state.isDrainingDb) return;
  state.isDrainingDb = true;

  void runInFifoQueue("db-drain", async () => {
    try {
      const db = getDatabase();
      if (!db) return;

      while (true) {
        // Check if a Canva job is already actively running/dispatching in the background (waiting for callback)
        // Only hold if it was created within the last 10 minutes (avoid deadlocks on stale jobs)
        const activeCanva = db.prepare(`
          SELECT id FROM generation_jobs
          WHERE type = 'canva'
            AND status IN ('dispatching', 'running')
            AND datetime(created_at) > datetime('now', '-10 minutes')
          LIMIT 1
        `).get() as { id: string } | undefined;

        if (activeCanva) {
          // Wait until the active Canva job finishes (complete/fail callback will call triggerProductionWorker again)
          break;
        }

        // Fetch the oldest queued background job (Stock Video or Canva)
        const nextJob = db.prepare(`
          SELECT id, project_id, type, provider, model, prompt, request_json, created_at
          FROM generation_jobs
          WHERE status = 'queued' AND type IN ('video', 'canva')
          ORDER BY created_at ASC
          LIMIT 1
        `).get() as {
          id: string;
          project_id: string;
          type: string;
          provider: string;
          model: string;
          prompt: string;
          request_json: string;
          created_at: string;
        } | undefined;

        if (!nextJob) {
          break;
        }

        if (nextJob.type === "video") {
          await processStockVideoJob(nextJob);
        } else if (nextJob.type === "canva") {
          await processCanvaJob(nextJob);
          // After dispatching a Canva job, break and wait for its completion callback before starting the next job
          break;
        }
      }
    } finally {
      state.isDrainingDb = false;
    }
  });
}

interface StockJobRequest {
  sourceStockVideoId?: string;
  frameStyle?: "none" | "blur_padding" | "modern_card" | "split_screen" | "minimal_glow";
  headline?: string;
  subtitle?: string;
  headlineColor?: string;
  subtitleColor?: string;
  headlineFontSize?: number;
  subtitleFontSize?: number;
  headlineBgColor?: string;
  accentColor?: string;
  logoUrl?: string;
  logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
  logoSize?: number;
  showBrandName?: boolean;
  brandNameText?: string;
  brandNameLayout?: "row" | "stack";
  brandNameColor?: string;
  customOverlayId?: string;
  outroId?: string;
  musicTrack?: string;
  musicSelection?: Parameters<typeof renderFramedStockVideo>[0]["musicSelection"];
  originalVolume?: number;
  musicVolume?: number;
  maxDurationSeconds?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}

async function processStockVideoJob(job: {
  id: string;
  project_id: string;
  request_json: string;
}) {
  const db = getDatabase()!;
  let req: StockJobRequest = {};
  try {
    req = JSON.parse(job.request_json || "{}") as StockJobRequest;
  } catch {
    req = {};
  }

  db.prepare(`
    UPDATE generation_jobs
    SET status = 'rendering',
        progress_json = ?
    WHERE id = ?
  `).run(
    JSON.stringify({
      phase: "rendering",
      percent: 25,
      detail: "FFmpeg ile video çerçevesi ve efektler işleniyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  try {
    await renderFramedStockVideo({
      jobId: job.id,
      projectId: job.project_id,
      stockVideoId: req.sourceStockVideoId || "",
      frameStyle: req.frameStyle || "blur_padding",
      headline: req.headline,
      subtitle: req.subtitle,
      headlineColor: req.headlineColor,
      subtitleColor: req.subtitleColor,
      headlineFontSize: req.headlineFontSize,
      subtitleFontSize: req.subtitleFontSize,
      headlineBgColor: req.headlineBgColor,
      accentColor: req.accentColor,
      logoUrl: req.logoUrl,
      logoPosition: req.logoPosition,
      logoSize: req.logoSize,
      showBrandName: req.showBrandName,
      brandNameText: req.brandNameText,
      brandNameLayout: req.brandNameLayout,
      brandNameColor: req.brandNameColor,
      customOverlayId: req.customOverlayId,
      outroId: req.outroId,
      musicTrack: req.musicTrack,
      musicSelection: req.musicSelection,
      originalVolume: req.originalVolume,
      musicVolume: req.musicVolume,
      maxDurationSeconds: req.maxDurationSeconds,
      trimStartSeconds: req.trimStartSeconds,
      trimEndSeconds: req.trimEndSeconds,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed', error = ?, completed_at = ?
      WHERE id = ?
    `).run(errorMsg.slice(0, 1000), new Date().toISOString(), job.id);
  }
}

interface CanvaJobRequest {
  prompt?: string;
  contentType: Parameters<typeof buildHermesCanvaTaskPrompt>[0]["contentType"];
  slideCount: number;
  style: Parameters<typeof buildHermesCanvaTaskPrompt>[0]["style"];
  brandSnapshot: Parameters<typeof buildHermesCanvaTaskPrompt>[0]["brandSnapshot"];
}

async function processCanvaJob(job: {
  id: string;
  project_id: string;
  prompt: string;
  request_json: string;
}) {
  const db = getDatabase()!;
  let req: Partial<CanvaJobRequest> = {};
  try {
    req = JSON.parse(job.request_json || "{}") as Partial<CanvaJobRequest>;
  } catch {
    req = {};
  }

  const canvaConfig = getCanvaConfig();
  const callbackBaseUrl = (process.env.CANVA_CALLBACK_BASE_URL || "").trim().replace(/\/+$/, "");

  if (!callbackBaseUrl) {
    db.prepare("UPDATE generation_jobs SET status='failed', error=? WHERE id=?").run(
      "CANVA_CALLBACK_BASE_URL yapılandırılmamış.",
      job.id
    );
    return;
  }

  const taskPrompt = buildHermesCanvaTaskPrompt({
    jobId: job.id,
    projectId: job.project_id,
    prompt: req.prompt || job.prompt,
    contentType: req.contentType || "instagram_carousel",
    slideCount: req.slideCount || 6,
    style: req.style || "clean_minimal",
    brandSnapshot: req.brandSnapshot || { name: "" },
    callbackBaseUrl,
    callbackToken: createJobCallbackToken(canvaConfig.callbackToken, job.id),
  });

  db.prepare("UPDATE generation_jobs SET status='dispatching', progress_json=? WHERE id=?").run(
    JSON.stringify({
      phase: "dispatching",
      percent: 10,
      detail: "Hermes Agent'a görev gönderiliyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  try {
    const dispatchResult = await dispatchHermesCanvaTask({
      baseUrl: canvaConfig.baseUrl,
      apiKey: canvaConfig.apiKey,
      taskPrompt,
      timeoutMs: 15000,
    });

    if (dispatchResult.dispatched) {
      db.prepare("UPDATE generation_jobs SET status='running', progress_json=? WHERE id=?").run(
        JSON.stringify({
          phase: "running",
          percent: 20,
          detail: "Hermes üretimi başlattı",
          runId: dispatchResult.runId || null,
          updatedAt: new Date().toISOString(),
        }),
        job.id
      );
    } else {
      db.prepare("UPDATE generation_jobs SET status='failed', error=? WHERE id=?").run(
        dispatchResult.error || "Hermes görev kabul etmedi",
        job.id
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE generation_jobs SET status='failed', error=? WHERE id=?").run(
      errMsg.slice(0, 1000),
      job.id
    );
  }
}
