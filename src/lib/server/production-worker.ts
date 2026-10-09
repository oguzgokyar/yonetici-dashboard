import "server-only";
import { randomUUID } from "node:crypto";
import { withHeavyJob, acquireHeavyJob, releaseHeavyJob } from "@/lib/server/heavy-job-coordinator";
import { getDatabase } from "@/lib/server/database";
import { renderFramedStockVideo } from "@/lib/server/stock-video-renderer";
import { getCanvaConfig, createJobCallbackToken } from "@/lib/server/canva-config";
import { buildHermesCanvaTaskPrompt } from "@/lib/server/hermes-canva-task";
import { dispatchHermesCanvaTask } from "@/lib/server/hermes-agent-client";
import { processGoogleVidsJob } from "@/lib/server/google-vids-service";

/**
 * Process-local FIFO plus mandatory shared host coordinator admission.
 * This in-memory chain alone is NOT a cross-process/global lock.
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
function enqueueLocal<T>(fn: () => Promise<T>): Promise<T> {
  const state = globalFifo.__fifoProductionQueue!;
  const next = state.tail.then(fn);
  state.tail = next.catch(err => { console.error('[FIFO Queue] Task failed:', err); });
  return next;
}

export function runInFifoQueue<T>(jobId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const id = jobId || randomUUID();
  return enqueueLocal(() => withHeavyJob(`production:${id}`, `dashboard:${randomUUID()}`, fn));
}

async function waitForCanvaCompletion(jobId: string): Promise<void> {
  while (true) {
    const job = getDatabase().prepare('SELECT status FROM generation_jobs WHERE id=?').get(jobId) as {status: string} | undefined;
    if (job && ['complete', 'failed'].includes(job.status)) return;
    // No age bypass: missing callback/restart requires verified operator recovery.
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function runCanvaLifetime(job: Parameters<typeof processCanvaJob>[0], resume = false): Promise<void> {
  const jobId = `canva:${job.id}`;
  const claim = `dashboard:${job.id}`;
  await acquireHeavyJob(jobId, claim);
  try {
    if (!resume) await processCanvaJob(job);
    await waitForCanvaCompletion(job.id);
  } finally {
    const status = getDatabase().prepare('SELECT status FROM generation_jobs WHERE id=?').get(job.id) as {status: string} | undefined;
    if (status && ['complete', 'failed'].includes(status.status)) await releaseHeavyJob(jobId, claim);
  }
}

/** Callback routes release this persistent claim only AFTER all work incl video export stops. */
export async function finishCanvaCoordination(jobId: string): Promise<void> {
  await releaseHeavyJob(`canva:${jobId}`, `dashboard:${jobId}`);
  triggerProductionWorker();
}

/**
 * Triggers the database-backed FIFO worker for background jobs (Stock Video & Canva)
 * that are stored with status = 'queued' in `generation_jobs`.
 */
export function triggerProductionWorker(): void {
  const state = globalFifo.__fifoProductionQueue!;
  if (state.isDrainingDb) return;
  state.isDrainingDb = true;

  void enqueueLocal(async () => {
    try {
      const db = getDatabase();
      if (!db) return;

      while (true) {
        // Resume waiting after process restart; active async work has no arbitrary age expiry.
        const activeCanva = db.prepare(`
          SELECT id, project_id, prompt, request_json FROM generation_jobs
          WHERE type = 'canva'
            AND status IN ('dispatching', 'running', 'exporting', 'uploading', 'video_exporting', 'coordination_uncertain')
          ORDER BY created_at ASC LIMIT 1
        `).get() as Parameters<typeof processCanvaJob>[0] | undefined;

        if (activeCanva) {
          await runCanvaLifetime(activeCanva, true);
          continue;
        }

        // Fetch the oldest queued background job (Stock Video, Canva, or Google Vids)
        const nextJob = db.prepare(`
          SELECT id, project_id, type, provider, model, prompt, request_json, created_at
          FROM generation_jobs
          WHERE status = 'queued' AND type IN ('video', 'canva', 'google-vids')
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
          await withHeavyJob(`production:${nextJob.id}`, `dashboard:${randomUUID()}`, () => processStockVideoJob(nextJob));
        } else if (nextJob.type === "google-vids") {
          await withHeavyJob(`google-vids:${nextJob.id}`, `dashboard:${randomUUID()}`, () => processGoogleVidsJob(nextJob));
        } else if (nextJob.type === "canva") {
          await runCanvaLifetime(nextJob);
          // Continue only after completion/failure, never after mere dispatch.
        }
      }
    } finally {
      state.isDrainingDb = false;
    }
  }).catch(err => { console.error('[Production Worker] Coordination unavailable; jobs remain queued:', err); });
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

  const claimed = db.prepare(`
    UPDATE generation_jobs
    SET status = 'rendering',
        progress_json = ?
    WHERE id = ? AND status = 'queued'
  `).run(
    JSON.stringify({
      phase: "rendering",
      percent: 25,
      detail: "FFmpeg ile video çerçevesi ve efektler işleniyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  if (!claimed.changes) return;

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

  const claimed = db.prepare("UPDATE generation_jobs SET status='dispatching', progress_json=? WHERE id=? AND status='queued'").run(
    JSON.stringify({
      phase: "dispatching",
      percent: 10,
      detail: "Hermes Agent'a görev gönderiliyor...",
      updatedAt: new Date().toISOString(),
    }),
    job.id
  );

  if (!claimed.changes) return;

  try {
    const dispatchResult = await dispatchHermesCanvaTask({
      baseUrl: canvaConfig.baseUrl,
      apiKey: canvaConfig.apiKey,
      taskPrompt,
      timeoutMs: 15000,
    });

    if (dispatchResult.dispatched) {
      db.prepare("UPDATE generation_jobs SET status='running', progress_json=? WHERE id=? AND status='dispatching'").run(
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
      // No HTTP rejection means transport failure may hide an accepted asynchronous run.
      const uncertain = !dispatchResult.status;
      db.prepare(`UPDATE generation_jobs SET status='${uncertain ? 'coordination_uncertain' : 'failed'}', error=? WHERE id=?`).run(
        dispatchResult.error || "Hermes görev kabul etmedi",
        job.id
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE generation_jobs SET status='coordination_uncertain', error=? WHERE id=?").run(
      errMsg.slice(0, 1000),
      job.id
    );
  }
}
