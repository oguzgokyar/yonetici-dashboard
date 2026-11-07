import "server-only";

import { getDatabase } from "@/lib/server/database";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/server/secrets";

export type OpenPostConfig = {
  enabled: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  maskedKey: string;
  defaultWorkspaceId?: string;
};

export type OpenPostAccount = {
  id: string;
  slug?: string;
  name: string;
  identifier: string; // e.g. "youtube", "facebook", "instagram", "tiktok"
  profile?: string;    // e.g. "@atolye-hanem"
  picture?: string;
  disabled?: boolean;
  workspaceId?: string;
};

export type OpenPostWorkspace = {
  id: string;
  name: string;
  organizationId?: string;
  color?: string;
};

const DEFAULT_OPENPOST_URL = "https://sm.atolyehanem.com";

export function getOpenPostStoredConfig(): {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  maskedKey: string;
  defaultWorkspaceId: string;
} {
  const database = getDatabase();
  const row = database
    .prepare("SELECT enabled, base_url, encrypted_api_key, settings_json FROM integration_configs WHERE service = 'openpost'")
    .get() as { enabled?: number; base_url?: string; encrypted_api_key?: string; settings_json?: string } | undefined;

  let apiKey = process.env.OPENPOST_API_KEY || "";
  const baseUrl = row?.base_url?.trim() || process.env.OPENPOST_BASE_URL || DEFAULT_OPENPOST_URL;
  const enabled = row ? Boolean(row.enabled) : Boolean(apiKey);

  if (row?.encrypted_api_key) {
    try {
      apiKey = decryptSecret(row.encrypted_api_key);
    } catch {
      apiKey = "";
    }
  }

  let defaultWorkspaceId = "";
  if (row?.settings_json) {
    try {
      const parsed = JSON.parse(row.settings_json);
      defaultWorkspaceId = parsed.default_workspace_id || "";
    } catch {
      // ignore
    }
  }

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    hasApiKey: Boolean(apiKey),
    maskedKey: apiKey ? maskSecret(apiKey) : "",
    defaultWorkspaceId,
  };
}

export function saveOpenPostStoredConfig(input: {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  defaultWorkspaceId?: string;
}) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT encrypted_api_key, settings_json FROM integration_configs WHERE service = 'openpost'")
    .get() as { encrypted_api_key?: string; settings_json?: string } | undefined;

  const encryptedKey = input.apiKey?.trim()
    ? encryptSecret(input.apiKey.trim())
    : existing?.encrypted_api_key || null;

  const baseUrl = (input.baseUrl?.trim() || DEFAULT_OPENPOST_URL).replace(/\/+$/, "");
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1;

  let settings: Record<string, unknown> = {};
  if (existing?.settings_json) {
    try {
      settings = JSON.parse(existing.settings_json);
    } catch {
      settings = {};
    }
  }
  if (input.defaultWorkspaceId !== undefined) {
    settings.default_workspace_id = input.defaultWorkspaceId.trim();
  }

  database
    .prepare(`
      INSERT INTO integration_configs (service, enabled, base_url, encrypted_api_key, settings_json, updated_at)
      VALUES ('openpost', ?, ?, ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        enabled = excluded.enabled,
        base_url = excluded.base_url,
        encrypted_api_key = excluded.encrypted_api_key,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
    `)
    .run(enabled, baseUrl, encryptedKey, JSON.stringify(settings), new Date().toISOString());

  return getOpenPostStoredConfig();
}

export async function testOpenPostConnection(
  overrideBaseUrl?: string,
  overrideApiKey?: string
): Promise<{
  ok: boolean;
  message: string;
  workspaces?: OpenPostWorkspace[];
  accounts?: OpenPostAccount[];
}> {
  const current = getOpenPostStoredConfig();
  const baseUrl = (overrideBaseUrl?.trim() || current.baseUrl || DEFAULT_OPENPOST_URL).replace(/\/+$/, "");
  const apiKey = overrideApiKey?.trim() || current.apiKey;

  if (!apiKey) {
    return { ok: false, message: "OpenPost API token girilmemiş." };
  }

  try {
    const wsUrl = `${baseUrl}/api/v1/workspaces`;
    const wsRes = await fetch(wsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!wsRes.ok) {
      if (wsRes.status === 401) {
        return { ok: false, message: "Yetkilendirme başarısız (401): API token geçersiz veya süresi dolmuş." };
      }
      return { ok: false, message: `OpenPost API hata döndürdü: HTTP ${wsRes.status}` };
    }

    const rawWorkspaces = (await wsRes.json()) as Array<{ id: string; name: string; organization_id?: string; color?: string }>;
    const workspaces: OpenPostWorkspace[] = rawWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      organizationId: w.organization_id,
      color: w.color,
    }));

    const primaryWorkspaceId = workspaces[0]?.id || current.defaultWorkspaceId;
    let accounts: OpenPostAccount[] = [];

    if (primaryWorkspaceId) {
      accounts = await fetchOpenPostAccounts(primaryWorkspaceId, baseUrl, apiKey);
    }

    return {
      ok: true,
      message: `Bağlantı başarılı! ${workspaces.length} çalışma alanı ve ${accounts.length} sosyal hesap bulundu.`,
      workspaces,
      accounts,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `OpenPost servisine bağlanılamadı: ${errMessage}` };
  }
}

export async function fetchOpenPostAccounts(
  workspaceId?: string,
  overrideBaseUrl?: string,
  overrideApiKey?: string
): Promise<OpenPostAccount[]> {
  const current = getOpenPostStoredConfig();
  const baseUrl = (overrideBaseUrl?.trim() || current.baseUrl || DEFAULT_OPENPOST_URL).replace(/\/+$/, "");
  const apiKey = overrideApiKey?.trim() || current.apiKey;

  if (!apiKey) return [];

  let targetWorkspaceId = workspaceId?.trim() || current.defaultWorkspaceId;
  if (!targetWorkspaceId) {
    // Attempt auto-discover primary workspace
    const wsRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (wsRes.ok) {
      const list = (await wsRes.json()) as Array<{ id: string }>;
      targetWorkspaceId = list[0]?.id || "";
    }
  }

  if (!targetWorkspaceId) return [];

  const url = `${baseUrl}/api/v1/accounts?workspace_id=${encodeURIComponent(targetWorkspaceId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenPost hesapları alınamadı: HTTP ${response.status}`);
  }

  const rawList = (await response.json()) as Array<{
    id: string;
    slug?: string;
    platform: string;
    account_id: string;
    account_username?: string;
    account_avatar_url?: string;
    is_active?: boolean;
  }>;

  return rawList.map((item) => {
    let picture = item.account_avatar_url || "";
    if (picture && picture.startsWith("/")) {
      picture = `${baseUrl}${picture}`;
    }
    return {
      id: item.id,
      slug: item.slug,
      name: item.account_username || item.platform,
      identifier: item.platform,
      profile: item.account_username || "",
      picture,
      disabled: item.is_active === false,
      workspaceId: targetWorkspaceId,
    };
  });
}

export type OpenPostUploadedMedia = {
  id: string;
  url: string;
  mimeType: string;
  originalFilename: string;
};

export async function uploadMediaToOpenPost(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  workspaceId?: string
): Promise<OpenPostUploadedMedia> {
  const current = getOpenPostStoredConfig();
  if (!current.enabled || !current.apiKey) {
    throw new Error("OpenPost entegrasyonu etkin değil veya API token eksik.");
  }

  const baseUrl = current.baseUrl;
  const apiKey = current.apiKey;
  const targetWorkspaceId = workspaceId?.trim() || current.defaultWorkspaceId || "451b4a2b-a35e-443f-8627-7e3509b00199";

  // 1. Create upload session
  const sessUrl = `${baseUrl}/api/v1/media/upload-session`;
  const sessRes = await fetch(sessUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      workspace_id: targetWorkspaceId,
      filename,
      size: fileBuffer.length,
      mime_type: mimeType,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!sessRes.ok) {
    const errorText = await sessRes.text().catch(() => "");
    throw new Error(`OpenPost medya yükleme oturumu açılamadı (${sessRes.status}): ${errorText}`);
  }

  const sessionData = (await sessRes.json()) as {
    media_id: string;
    upload: {
      method: string;
      url: string;
      headers?: Record<string, string>;
    };
    complete_url: string;
    deduped?: boolean;
  };

  const mediaId = sessionData.media_id;

  // If already deduped on OpenPost, return immediately
  if (sessionData.deduped) {
    return {
      id: mediaId,
      url: `${baseUrl}/media/${mediaId}`,
      mimeType,
      originalFilename: filename,
    };
  }

  // 2. Upload file bytes to streaming target
  let uploadTargetUrl = sessionData.upload.url;
  if (uploadTargetUrl.startsWith("/")) {
    uploadTargetUrl = `${baseUrl}${uploadTargetUrl}`;
  }

  const uploadHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": mimeType,
    ...(sessionData.upload.headers || {}),
  };

  const uploadRes = await fetch(uploadTargetUrl, {
    method: sessionData.upload.method || "PUT",
    headers: uploadHeaders,
    body: fileBuffer,
    signal: AbortSignal.timeout(120_000),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => "");
    throw new Error(`OpenPost medya verisi iletilemedi (${uploadRes.status}): ${errorText}`);
  }

  // 3. Finalize upload session
  let completeTargetUrl = sessionData.complete_url;
  if (completeTargetUrl.startsWith("/")) {
    completeTargetUrl = `${baseUrl}${completeTargetUrl}`;
  }

  const compRes = await fetch(completeTargetUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_id: targetWorkspaceId }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!compRes.ok) {
    const errorText = await compRes.text().catch(() => "");
    throw new Error(`OpenPost medya tamamlama hatası (${compRes.status}): ${errorText}`);
  }

  const completeResult = (await compRes.json()) as {
    id: string;
    url?: string;
    mime_type?: string;
    original_filename?: string;
  };

  return {
    id: completeResult.id || mediaId,
    url: completeResult.url?.startsWith("/") ? `${baseUrl}${completeResult.url}` : completeResult.url || `${baseUrl}/media/${mediaId}`,
    mimeType: completeResult.mime_type || mimeType,
    originalFilename: completeResult.original_filename || filename,
  };
}

export type CreateOpenPostPublicationParams = {
  type: "now" | "schedule" | "draft";
  date?: string; // ISO 8601 UTC
  accountIds: string[]; // OpenPost social_account_ids
  title: string;
  caption: string;
  media?: Array<{ id: string; path?: string }>;
  postType?: "post" | "reel" | "story" | "short_video" | "video";
  workspaceId?: string;
};

export async function createOpenPostPublication(
  params: CreateOpenPostPublicationParams
): Promise<{ publicationId: string; status: string }> {
  const current = getOpenPostStoredConfig();
  if (!current.enabled || !current.apiKey) {
    throw new Error("OpenPost entegrasyonu etkin değil veya API token eksik.");
  }

  const baseUrl = current.baseUrl;
  const apiKey = current.apiKey;
  const targetWorkspaceId = params.workspaceId?.trim() || current.defaultWorkspaceId || "451b4a2b-a35e-443f-8627-7e3509b00199";

  // Map postType to OpenPost creation_preset:
  // "post" | "thread" | "story" | "short_video" | "video"
  let preset: "post" | "short_video" | "story" | "video" = "post";
  if (params.postType === "reel" || params.postType === "short_video") {
    preset = "short_video";
  } else if (params.postType === "story") {
    preset = "story";
  } else if (params.postType === "video") {
    preset = "video";
  }

  const mediaItems = (params.media || []).map((m) => ({ media_id: m.id }));

  // Auto-resolve dynamic platform destination options (e.g. YouTube category & playlist)
  const renditions: Array<Record<string, unknown>> = [];
  for (const accId of params.accountIds) {
    try {
      const optRes = await fetch(`${baseUrl}/api/v1/accounts/${accId}/destination-options`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (optRes.ok) {
        const optData = (await optRes.json()) as {
          options?: {
            youtube_categories?: Array<{ value: string; label: string }>;
            youtube_playlists?: Array<{ value: string; label: string }>;
          };
        };
        const settings: Record<string, unknown> = {};
        if (optData.options?.youtube_categories && optData.options.youtube_categories.length > 0) {
          settings.category_id =
            optData.options.youtube_categories.find((c) => c.value === "27")?.value ||
            optData.options.youtube_categories[0].value;
          settings.privacy = "public";
        }
        if (optData.options?.youtube_playlists && optData.options.youtube_playlists.length > 0) {
          settings.playlist_id = optData.options.youtube_playlists[0].value;
        }
        if (Object.keys(settings).length > 0) {
          renditions.push({
            social_account_id: accId,
            title: params.title || params.caption.slice(0, 50) || "Gönderi",
            body: params.caption,
            settings,
          });
        }
      }
    } catch {
      // Non-blocking fallback to server defaults
    }
  }

  const payload: Record<string, unknown> = {
    workspace_id: targetWorkspaceId,
    title: params.title || params.caption.slice(0, 50) || "Gönderi",
    content_profile: "default",
    creation_preset: preset,
    source_text: params.caption,
    social_account_ids: params.accountIds,
    media: mediaItems.length > 0 ? mediaItems : null,
    ...(renditions.length > 0 ? { renditions } : {}),
  };

  if (params.type === "schedule" && params.date) {
    payload.scheduled_at = params.date;
  }

  // 1. Create publication
  const pubUrl = `${baseUrl}/api/v1/publications`;
  const pubRes = await fetch(pubUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!pubRes.ok) {
    const errorText = await pubRes.text().catch(() => "");
    throw new Error(`OpenPost gönderi oluşturma hatası (${pubRes.status}): ${errorText}`);
  }

  const pubData = (await pubRes.json()) as { id: string; status: string; revision?: number };
  const publicationId = pubData.id;

  // 2. If immediate publishing requested, wait for media analysis to settle then call publish-now
  if (params.type === "now") {
    const publishNowUrl = `${baseUrl}/api/v1/publications/${publicationId}/publish-now`;
    let lastErr = "";
    for (let attempt = 1; attempt <= 6; attempt++) {
      const publishRes = await fetch(publishNowUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ expected_revision: pubData.revision || 1 }),
        signal: AbortSignal.timeout(30_000),
      });

      if (publishRes.ok) {
        return { publicationId, status: "publishing" };
      }

      lastErr = await publishRes.text().catch(() => "");
      if (lastErr.includes("Video analysis must finish") && attempt < 6) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`OpenPost anında yayınlama hatası (${publishRes.status}): ${lastErr}`);
    }
    throw new Error(`OpenPost anında yayınlama hatası: ${lastErr}`);
  } else if (params.type === "schedule") {
    const scheduleUrl = `${baseUrl}/api/v1/publications/${publicationId}/schedule`;
    let lastErr = "";
    for (let attempt = 1; attempt <= 6; attempt++) {
      const schedRes = await fetch(scheduleUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ expected_revision: pubData.revision || 1 }),
        signal: AbortSignal.timeout(30_000),
      });

      if (schedRes.ok) {
        return { publicationId, status: "scheduled" };
      }

      lastErr = await schedRes.text().catch(() => "");
      if (lastErr.includes("Video analysis must finish") && attempt < 6) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`OpenPost zamanlama hatası (${schedRes.status}): ${lastErr}`);
    }
    throw new Error(`OpenPost zamanlama hatası: ${lastErr}`);
  }

  return { publicationId, status: pubData.status || "draft" };
}

export type OpenPostPublicationStatus = {
  id: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  releaseUrl?: string | null;
  errorMessage?: string | null;
};

export async function fetchOpenPostPublicationStatus(
  publicationId: string,
  workspaceId?: string
): Promise<OpenPostPublicationStatus> {
  const current = getOpenPostStoredConfig();
  if (!current.apiKey) {
    throw new Error("OpenPost API token yapılandırılmamış.");
  }

  const baseUrl = current.baseUrl;
  const apiKey = current.apiKey;
  const targetWorkspaceId = workspaceId?.trim() || current.defaultWorkspaceId || "451b4a2b-a35e-443f-8627-7e3509b00199";

  const url = `${baseUrl}/api/v1/publications/${publicationId}?workspace_id=${encodeURIComponent(targetWorkspaceId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OpenPost gönderi durumu alınamadı (${res.status})`);
  }

  const pub = (await res.json()) as {
    id: string;
    status: string;
    renditions?: Array<{
      status: string;
      error_message?: string;
      external_url?: string;
      permalink_url?: string;
    }>;
  };

  let status: OpenPostPublicationStatus["status"] = "draft";
  const rawStatus = (pub.status || "").toLowerCase();
  if (rawStatus === "published" || rawStatus === "complete") status = "published";
  else if (rawStatus === "publishing" || rawStatus === "queued" || rawStatus === "processing") status = "publishing";
  else if (rawStatus === "scheduled") status = "scheduled";
  else if (rawStatus === "failed" || rawStatus === "error") status = "failed";
  else if (rawStatus === "cancelled") status = "cancelled";

  let releaseUrl: string | null = null;
  let errorMessage: string | null = null;

  for (const rend of pub.renditions || []) {
    if (rend.external_url) {
      releaseUrl = rend.external_url;
    } else if (rend.permalink_url) {
      releaseUrl = rend.permalink_url;
    }
    if (rend.error_message) {
      errorMessage = rend.error_message;
    }
  }

  return {
    id: pub.id,
    status,
    releaseUrl,
    errorMessage,
  };
}
