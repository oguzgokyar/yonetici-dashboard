import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/server/secrets";
import {
  acquireAvailableVidsAccount,
  recordVidsAccountRenderSuccess,
  markVidsAccountQuotaExhausted,
} from "@/lib/server/google-vids-account-pool";

export type FlowVideoModel = "veo-3.1-fast" | "veo-3.1-quality" | "veo-3.1-lite" | "omni-flash";
export type FlowAspectRatio = "9:16" | "16:9" | "1:1";
export type FlowDurationSeconds = 4 | 5 | 6 | 8;

export interface FlowStoredConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  maskedKey: string;
  defaultModel: FlowVideoModel;
}

export interface FlowVideoJob {
  id: string;
  projectId: string;
  status: "queued" | "running" | "complete" | "failed";
  prompt: string;
  model: string;
  aspectRatio: string;
  durationSeconds: number;
  sourceAssetId?: string;
  accountEmail?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string | null;
  progressPercent?: number;
  progressDetail?: string;
  createdAt: string;
  completedAt?: string | null;
}

const DEFAULT_FLOW_BASE_URL = "https://api.useapi.net/v1/google-flow";
const DEFAULT_FLOW_MODEL: FlowVideoModel = "veo-3.1-fast";

export function getFlowConfig(): FlowStoredConfig {
  const database = getDatabase();
  // 1. Try integration_configs first
  const row = database
    .prepare("SELECT enabled, base_url, encrypted_api_key, settings_json FROM integration_configs WHERE service = 'flow'")
    .get() as { enabled?: number; base_url?: string; encrypted_api_key?: string; settings_json?: string } | undefined;

  let apiKey = process.env.FLOW_API_KEY || "";
  let baseUrl = row?.base_url?.trim() || process.env.FLOW_BASE_URL || DEFAULT_FLOW_BASE_URL;
  let defaultModel = DEFAULT_FLOW_MODEL;
  let enabled = row ? Boolean(row.enabled) : Boolean(apiKey);

  if (row?.settings_json) {
    try {
      const parsed = JSON.parse(row.settings_json);
      if (parsed.defaultModel) defaultModel = parsed.defaultModel;
    } catch {}
  }

  if (row?.encrypted_api_key) {
    try {
      apiKey = decryptSecret(row.encrypted_api_key);
    } catch {
      apiKey = "";
    }
  }

  // 2. Fallback to ai_provider_configs if not found in integration_configs
  if (!apiKey) {
    const aiRow = database
      .prepare("SELECT enabled, base_url, encrypted_api_key, edit_model FROM ai_provider_configs WHERE provider = 'flow'")
      .get() as { enabled?: number; base_url?: string; encrypted_api_key?: string; edit_model?: string } | undefined;

    if (aiRow) {
      if (aiRow.base_url?.trim()) baseUrl = aiRow.base_url.trim();
      if (aiRow.edit_model?.trim()) defaultModel = aiRow.edit_model.trim() as FlowVideoModel;
      if (aiRow.enabled !== undefined) enabled = Boolean(aiRow.enabled);
      if (aiRow.encrypted_api_key) {
        try {
          apiKey = decryptSecret(aiRow.encrypted_api_key);
        } catch {}
      }
    }
  }

  const isLocal =
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("flow-agent") ||
    baseUrl.includes(":8001") ||
    baseUrl.includes("10.0.1.1") ||
    baseUrl.includes("10.0.7.1");

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    hasApiKey: Boolean(apiKey) || isLocal,
    maskedKey: apiKey ? maskSecret(apiKey) : isLocal ? "Yerel Motor (API anahtarsız)" : "",
    defaultModel,
  };
}

export function saveFlowConfig(input: {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: FlowVideoModel;
}): FlowStoredConfig {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT encrypted_api_key, settings_json FROM integration_configs WHERE service = 'flow'")
    .get() as { encrypted_api_key?: string; settings_json?: string } | undefined;

  const encryptedKey = input.apiKey?.trim()
    ? encryptSecret(input.apiKey.trim())
    : existing?.encrypted_api_key || null;

  const baseUrl = (input.baseUrl?.trim() || DEFAULT_FLOW_BASE_URL).replace(/\/+$/, "");
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1;

  let settings: Record<string, unknown> = {};
  if (existing?.settings_json) {
    try {
      settings = JSON.parse(existing.settings_json);
    } catch {}
  }
  if (input.defaultModel) settings.defaultModel = input.defaultModel;

  database
    .prepare(`
      INSERT INTO integration_configs (service, enabled, base_url, encrypted_api_key, settings_json, updated_at)
      VALUES ('flow', ?, ?, ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        enabled = excluded.enabled,
        base_url = excluded.base_url,
        encrypted_api_key = excluded.encrypted_api_key,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
    `)
    .run(enabled, baseUrl, encryptedKey, JSON.stringify(settings), new Date().toISOString());

  return getFlowConfig();
}

/**
 * Image asset resolver for First Frame / Image-to-Video
 */
function resolveAssetData(assetId: string): { base64Data: string; mimeType: string } | null {
  try {
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    const metaPath = path.join(assetsDir, `${assetId}.json`);
    let mimeType = "image/png";
    let ext = "png";

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        if (meta.mimeType) mimeType = meta.mimeType;
        if (meta.extension) ext = meta.extension;
      } catch {}
    }

    const filePath = path.join(assetsDir, `${assetId}.${ext}`);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return {
        base64Data: `data:${mimeType};base64,${buffer.toString("base64")}`,
        mimeType,
      };
    }
  } catch {}
  return null;
}

/**
 * Initiates a Flow video generation job via REST API.
 */
export async function createFlowVideoJob(params: {
  projectId: string;
  prompt: string;
  model?: FlowVideoModel;
  aspectRatio?: FlowAspectRatio;
  durationSeconds?: FlowDurationSeconds;
  sourceAssetId?: string;
  preferredAccountId?: string;
}): Promise<FlowVideoJob> {
  const config = getFlowConfig();
  const isLocal =
    config.baseUrl.includes("127.0.0.1") ||
    config.baseUrl.includes("localhost") ||
    config.baseUrl.includes("flow-agent") ||
    config.baseUrl.includes(":8001") ||
    config.baseUrl.includes("10.0.1.1") ||
    config.baseUrl.includes("10.0.7.1");

  if (!config.apiKey && !isLocal && !process.env.FLOW_MOCK) {
    throw new Error(
      "Flow Video REST API yapılandırılmamış. Lütfen Sistem Ayarları bölümünden Flow API anahtarınızı (token) tanımlayın."
    );
  }

  const cleanPrompt = params.prompt?.trim();
  if (!cleanPrompt) {
    throw new Error("Video üretimi için prompt (açıklama) gereklidir.");
  }

  // Acquire Google account from the shared pool
  let accountInfo: { id: string; authuser: number; profileDirectory: string; email: string; isFallback: boolean } | null = null;
  try {
    accountInfo = acquireAvailableVidsAccount(params.preferredAccountId);
  } catch {}

  const model = params.model || config.defaultModel || DEFAULT_FLOW_MODEL;
  const aspectRatio = params.aspectRatio || "9:16";
  const durationSeconds = params.durationSeconds || 5;
  const jobId = crypto.randomUUID();
  const database = getDatabase();

  // Handle first frame image reference if specified
  let sourceImageData: string | undefined;
  if (params.sourceAssetId) {
    const asset = resolveAssetData(params.sourceAssetId);
    if (asset?.base64Data) {
      sourceImageData = asset.base64Data;
    }
  }

  // Map aspect ratio for API compatibility
  const apiRatio = aspectRatio === "9:16" ? "portrait" : aspectRatio === "16:9" ? "landscape" : "square";

  let remoteJobId: string = jobId;
  let initialPhase = "queued";

  // Dispatch REST request to Flow endpoint if not in mock test mode
  if (!process.env.FLOW_MOCK && (config.apiKey || isLocal)) {
    const isLocalFlowAgent =
      isLocal ||
      config.baseUrl.includes(":8001") ||
      config.baseUrl.includes("/api/v1") ||
      config.baseUrl.includes("flow-agent");
    const videoEndpoint = isLocalFlowAgent
      ? `${config.baseUrl.replace(/\/+$/, "")}/api/v1/video`
      : `${config.baseUrl.replace(/\/+$/, "")}/videos`;

    const requestPayload: Record<string, unknown> = {
      prompt: cleanPrompt,
      model,
      aspectRatio: apiRatio,
      aspect: aspectRatio,
      duration: `${durationSeconds}s`,
      quality: "720p",
    };

    if (accountInfo) {
      requestPayload.email = accountInfo.email;
      requestPayload.authuser = accountInfo.authuser;
      requestPayload.profileDirectory = accountInfo.profileDirectory;
    }

    if (sourceImageData) {
      requestPayload.imageUrl = sourceImageData;
      requestPayload.referenceImage = sourceImageData;
      requestPayload.start_image = sourceImageData;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

      const response = await fetch(videoEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(240_000),
      });

      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg =
          responseBody?.detail ||
          responseBody?.error?.message ||
          responseBody?.error ||
          responseBody?.message ||
          `Flow API ${response.status} hatası döndürdü.`;
        throw new Error(errorMsg);
      }

      // If local flow-agent returned completed files directly
      const directFiles = responseBody?.files || [];
      if (Array.isArray(directFiles) && directFiles.length > 0 && directFiles[0].path) {
        const sourcePath = directFiles[0].path;
        const videoRendersDir = path.join(process.cwd(), ".data", "video-renders");
        fs.mkdirSync(videoRendersDir, { recursive: true });
        const destPath = path.join(videoRendersDir, `${jobId}.mp4`);
        const thumbPath = path.join(videoRendersDir, `${jobId}_thumb.webp`);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
        }

        try {
          execSync(
            `ffmpeg -y -ss 00:00:00.5 -i "${destPath}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbPath}"`,
            { timeout: 8000, stdio: "ignore" }
          );
        } catch {}

        const now = new Date().toISOString();
        const responseData = {
          videoUrl: `/api/videos/${jobId}`,
          thumbnailUrl: `/api/videos/${jobId}?thumb=1`,
          model,
          aspectRatio,
          durationSeconds,
        };

        const progressData = {
          phase: "complete",
          percent: 100,
          detail: "Video üretimi başarıyla tamamlandı",
          updatedAt: now,
        };

        database
          .prepare(`
            INSERT INTO generation_jobs (
              id, project_id, type, provider, model, status, prompt, request_json, response_json, progress_json, created_at, completed_at
            ) VALUES (?, ?, 'flow-video', 'flow-rest', ?, 'complete', ?, ?, ?, ?, ?, ?)
          `)
          .run(
            jobId,
            params.projectId,
            model,
            cleanPrompt,
            JSON.stringify({ prompt: cleanPrompt, model, aspectRatio, durationSeconds, sourceAssetId: params.sourceAssetId, remoteJobId: jobId }),
            JSON.stringify(responseData),
            JSON.stringify(progressData),
            now,
            now
          );

        return {
          id: jobId,
          projectId: params.projectId,
          status: "complete",
          prompt: cleanPrompt,
          model,
          aspectRatio,
          durationSeconds,
          sourceAssetId: params.sourceAssetId,
          videoUrl: `/api/videos/${jobId}`,
          thumbnailUrl: `/api/videos/${jobId}?thumb=1`,
          progressPercent: 100,
          progressDetail: "Tamamlandı",
          createdAt: now,
          completedAt: now,
        };
      }

      remoteJobId =
        responseBody?.id ||
        responseBody?.jobId ||
        responseBody?.job_id ||
        responseBody?.taskId ||
        responseBody?.task_id ||
        jobId;

      initialPhase = responseBody?.status || "queued";
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : String(err);
      throw new Error(`Flow REST API isteği başarısız: ${errText}`);
    }
  }

  const now = new Date().toISOString();
  const requestState = {
    prompt: cleanPrompt,
    model,
    aspectRatio,
    durationSeconds,
    sourceAssetId: params.sourceAssetId,
    account: accountInfo ? {
      id: accountInfo.id,
      email: accountInfo.email,
      authuser: accountInfo.authuser,
      profileDirectory: accountInfo.profileDirectory,
    } : undefined,
    remoteJobId,
  };

  const progressState = {
    phase: initialPhase,
    percent: 15,
    detail: accountInfo
      ? `Flow REST API kuyruğuna iletildi (${accountInfo.email})`
      : "Flow REST API kuyruğuna iletildi",
    updatedAt: now,
  };

  database
    .prepare(`
      INSERT INTO generation_jobs (
        id, project_id, type, provider, model, status, prompt, request_json, response_json, progress_json, created_at
      ) VALUES (?, ?, 'flow-video', 'flow-rest', ?, 'running', ?, ?, '{}', ?, ?)
    `)
    .run(
      jobId,
      params.projectId,
      model,
      cleanPrompt,
      JSON.stringify(requestState),
      JSON.stringify(progressState),
      now
    );

  return {
    id: jobId,
    projectId: params.projectId,
    status: "running",
    prompt: cleanPrompt,
    model,
    aspectRatio,
    durationSeconds,
    sourceAssetId: params.sourceAssetId,
    accountEmail: accountInfo?.email,
    progressPercent: 15,
    progressDetail: progressState.detail,
    createdAt: now,
  };
}

/**
 * Polls remote Flow REST API status and completes the job if finished.
 */
export async function syncFlowJobStatus(jobId: string): Promise<FlowVideoJob | null> {
  const database = getDatabase();
  const row = database
    .prepare(`
      SELECT id, project_id, status, prompt, model, request_json, response_json, progress_json, error, created_at, completed_at
      FROM generation_jobs
      WHERE id = ? AND type = 'flow-video'
    `)
    .get(jobId) as {
      id: string;
      project_id: string;
      status: string;
      prompt: string;
      model: string;
      request_json: string;
      response_json: string;
      progress_json: string;
      error: string | null;
      created_at: string;
      completed_at: string | null;
    } | undefined;

  if (!row) return null;

  let req: Record<string, unknown> = {};
  let res: Record<string, unknown> = {};
  let prog: Record<string, unknown> = {};

  try { req = JSON.parse(row.request_json || "{}"); } catch {}
  try { res = JSON.parse(row.response_json || "{}"); } catch {}
  try { prog = JSON.parse(row.progress_json || "{}"); } catch {}

  const currentJob: FlowVideoJob = {
    id: row.id,
    projectId: row.project_id,
    status: row.status as FlowVideoJob["status"],
    prompt: row.prompt,
    model: row.model,
    aspectRatio: (req.aspectRatio as string) || "9:16",
    durationSeconds: Number(req.durationSeconds || 5),
    sourceAssetId: req.sourceAssetId as string | undefined,
    accountEmail: (req.account as { email?: string })?.email,
    videoUrl: (res.videoUrl as string) || (row.status === "complete" ? `/api/videos/${row.id}` : undefined),
    thumbnailUrl: row.status === "complete" ? `/api/videos/${row.id}?thumb=1` : undefined,
    error: row.error,
    progressPercent: Number(prog.percent || (row.status === "complete" ? 100 : 20)),
    progressDetail: (prog.detail as string) || (row.status === "complete" ? "Tamamlandı" : "İşleniyor"),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };

  // If already complete or failed, no further remote polling needed
  if (row.status === "complete" || row.status === "failed") {
    return currentJob;
  }

  const config = getFlowConfig();
  const isLocal =
    config.baseUrl.includes("127.0.0.1") ||
    config.baseUrl.includes("localhost") ||
    config.baseUrl.includes("flow-agent") ||
    config.baseUrl.includes(":8001") ||
    config.baseUrl.includes("10.0.1.1") ||
    config.baseUrl.includes("10.0.7.1");
  const remoteJobId = (req.remoteJobId as string) || row.id;

  if (!config.apiKey && !isLocal && !process.env.FLOW_MOCK) {
    return currentJob;
  }

  // Remote Poll
  try {
    const isStandardEndpoint =
      isLocal ||
      config.baseUrl.includes(":8001") ||
      config.baseUrl.includes("/api/v1") ||
      config.baseUrl.includes("flow-agent");
    const checkEndpoint = isStandardEndpoint
      ? `${config.baseUrl.replace(/\/+$/, "")}/api/v1/video/${encodeURIComponent(remoteJobId)}`
      : `${config.baseUrl.replace(/\/+$/, "")}/videos/${encodeURIComponent(remoteJobId)}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const response = await fetch(checkEndpoint, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return currentJob;
    }

    const data = await response.json().catch(() => null);
    if (!data) return currentJob;

    const remoteStatus = String(data.status || "").toLowerCase();
    const downloadUrl =
      data.url ||
      data.videoUrl ||
      data.video_url ||
      data.downloadUrl ||
      data.download_url ||
      data.result?.url ||
      data.result?.videoUrl;

    // Check if completed
    const isCompleted =
      remoteStatus === "completed" ||
      remoteStatus === "complete" ||
      remoteStatus === "ready" ||
      remoteStatus === "success" ||
      Boolean(downloadUrl);

    if (isCompleted && downloadUrl) {
      // 1. Download video to local .data/video-renders/
      const videoRendersDir = path.join(process.cwd(), ".data", "video-renders");
      fs.mkdirSync(videoRendersDir, { recursive: true });

      const videoFilePath = path.join(videoRendersDir, `${row.id}.mp4`);
      const thumbFilePath = path.join(videoRendersDir, `${row.id}_thumb.webp`);

      const resolvedUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `${config.baseUrl.replace(/\/+$/, "")}/${downloadUrl.replace(/^\/+/, "")}`;
      const videoRes = await fetch(resolvedUrl, { signal: AbortSignal.timeout(60_000) });
      if (videoRes.ok) {
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
        fs.writeFileSync(videoFilePath, videoBuffer);

        // 2. Generate webp thumbnail via ffmpeg
        try {
          execSync(
            `ffmpeg -y -ss 00:00:00.5 -i "${videoFilePath}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbFilePath}"`,
            { timeout: 8000, stdio: "ignore" }
          );
        } catch {
          // Non-fatal if ffmpeg is busy
        }

        const now = new Date().toISOString();
        const responseData = {
          videoUrl: `/api/videos/${row.id}`,
          thumbnailUrl: `/api/videos/${row.id}?thumb=1`,
          remoteDownloadUrl: downloadUrl,
          fileSize: videoBuffer.length,
          model: row.model,
          aspectRatio: req.aspectRatio,
          durationSeconds: req.durationSeconds,
        };

        const progressData = {
          phase: "complete",
          percent: 100,
          detail: "Video üretimi başarıyla tamamlandı",
          updatedAt: now,
        };

        database
          .prepare(`
            UPDATE generation_jobs
            SET status = 'complete', response_json = ?, progress_json = ?, completed_at = ?
            WHERE id = ?
          `)
          .run(JSON.stringify(responseData), JSON.stringify(progressData), now, row.id);

        return {
          ...currentJob,
          status: "complete",
          videoUrl: `/api/videos/${row.id}`,
          thumbnailUrl: `/api/videos/${row.id}?thumb=1`,
          progressPercent: 100,
          progressDetail: "Tamamlandı",
          completedAt: now,
        };
      }
    } else if (remoteStatus === "failed" || remoteStatus === "error") {
      const errorMsg = data.error || data.message || "Flow video üretimi başarısız oldu.";
      const now = new Date().toISOString();

      database
        .prepare(`
          UPDATE generation_jobs
          SET status = 'failed', error = ?, completed_at = ?
          WHERE id = ?
        `)
        .run(errorMsg, now, row.id);

      return {
        ...currentJob,
        status: "failed",
        error: errorMsg,
        completedAt: now,
      };
    } else {
      // Still in progress - update percent if provided
      const percent = data.progress || data.percent || (remoteStatus === "running" ? 60 : 30);
      const detail = data.detail || (remoteStatus === "running" ? "Flow video işleniyor..." : "Sırada bekliyor...");
      const progressData = {
        phase: remoteStatus || "running",
        percent,
        detail,
        updatedAt: new Date().toISOString(),
      };

      database
        .prepare("UPDATE generation_jobs SET progress_json = ? WHERE id = ?")
        .run(JSON.stringify(progressData), row.id);

      return {
        ...currentJob,
        progressPercent: percent,
        progressDetail: detail,
      };
    }
  } catch {
    // If polling blips temporarily, return current state without crashing
    return currentJob;
  }

  return currentJob;
}

/**
 * Lists all Flow videos for a project and triggers background sync for active jobs.
 */
export async function listFlowVideos(projectId: string): Promise<FlowVideoJob[]> {
  const database = getDatabase();
  const rows = database
    .prepare(`
      SELECT id, project_id, status, prompt, model, request_json, response_json, progress_json, error, created_at, completed_at
      FROM generation_jobs
      WHERE project_id = ? AND type = 'flow-video'
      ORDER BY created_at DESC
      LIMIT 40
    `)
    .all(projectId) as Array<{
      id: string;
      project_id: string;
      status: string;
      prompt: string;
      model: string;
      request_json: string;
      response_json: string;
      progress_json: string;
      error: string | null;
      created_at: string;
      completed_at: string | null;
    }>;

  const results: FlowVideoJob[] = [];

  for (const row of rows) {
    let req: Record<string, unknown> = {};
    let res: Record<string, unknown> = {};
    let prog: Record<string, unknown> = {};
    try { req = JSON.parse(row.request_json || "{}"); } catch {}
    try { res = JSON.parse(row.response_json || "{}"); } catch {}
    try { prog = JSON.parse(row.progress_json || "{}"); } catch {}

    const job: FlowVideoJob = {
      id: row.id,
      projectId: row.project_id,
      status: row.status as FlowVideoJob["status"],
      prompt: row.prompt,
      model: row.model,
      aspectRatio: (req.aspectRatio as string) || "9:16",
      durationSeconds: Number(req.durationSeconds || 5),
      sourceAssetId: req.sourceAssetId as string | undefined,
      accountEmail: (req.account as { email?: string })?.email,
      videoUrl: (res.videoUrl as string) || (row.status === "complete" ? `/api/videos/${row.id}` : undefined),
      thumbnailUrl: row.status === "complete" ? `/api/videos/${row.id}?thumb=1` : undefined,
      error: row.error,
      progressPercent: Number(prog.percent || (row.status === "complete" ? 100 : 20)),
      progressDetail: (prog.detail as string) || (row.status === "complete" ? "Tamamlandı" : "İşleniyor"),
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };

    // If job is currently running, sync it live
    if (row.status === "running") {
      try {
        const synced = await syncFlowJobStatus(row.id);
        results.push(synced || job);
      } catch {
        results.push(job);
      }
    } else {
      results.push(job);
    }
  }

  return results;
}

/**
 * Deletes a Flow video and its local rendered files.
 */
export function deleteFlowVideo(jobId: string, projectId: string): boolean {
  const database = getDatabase();
  const deleted = database
    .prepare("DELETE FROM generation_jobs WHERE id = ? AND project_id = ? AND type = 'flow-video'")
    .run(jobId, projectId);

  if (deleted.changes > 0) {
    const videoRendersDir = path.join(process.cwd(), ".data", "video-renders");
    try { fs.unlinkSync(path.join(videoRendersDir, `${jobId}.mp4`)); } catch {}
    try { fs.unlinkSync(path.join(videoRendersDir, `${jobId}_thumb.webp`)); } catch {}
    return true;
  }
  return false;
}
