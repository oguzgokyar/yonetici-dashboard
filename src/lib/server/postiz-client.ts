import "server-only";

import { getDatabase } from "@/lib/server/database";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/server/secrets";

export type PostizConfig = {
  enabled: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  maskedKey: string;
};

export type PostizIntegration = {
  id: string;
  name: string;
  identifier: string; // e.g. "instagram", "instagram-standalone"
  profile?: string;    // e.g. "atolye.hanem"
  picture?: string;
  disabled?: boolean;
};

const DEFAULT_POSTIZ_URL = "http://10.0.1.1:4007/api";

export function getPostizStoredConfig(): {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  maskedKey: string;
} {
  const database = getDatabase();
  const row = database
    .prepare("SELECT enabled, base_url, encrypted_api_key FROM integration_configs WHERE service = 'postiz'")
    .get() as { enabled?: number; base_url?: string; encrypted_api_key?: string } | undefined;

  let apiKey = process.env.POSTIZ_API_KEY || "";
  let baseUrl = row?.base_url?.trim() || process.env.POSTIZ_BASE_URL || DEFAULT_POSTIZ_URL;
  let enabled = row ? Boolean(row.enabled) : Boolean(apiKey);

  if (row?.encrypted_api_key) {
    try {
      apiKey = decryptSecret(row.encrypted_api_key);
    } catch {
      apiKey = "";
    }
  }

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    hasApiKey: Boolean(apiKey),
    maskedKey: apiKey ? maskSecret(apiKey) : "",
  };
}

export function savePostizStoredConfig(input: {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
}) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT encrypted_api_key FROM integration_configs WHERE service = 'postiz'")
    .get() as { encrypted_api_key?: string } | undefined;

  const encryptedKey = input.apiKey?.trim()
    ? encryptSecret(input.apiKey.trim())
    : existing?.encrypted_api_key || null;

  const baseUrl = (input.baseUrl?.trim() || DEFAULT_POSTIZ_URL).replace(/\/+$/, "");
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1;

  database
    .prepare(`
      INSERT INTO integration_configs (service, enabled, base_url, encrypted_api_key, settings_json, updated_at)
      VALUES ('postiz', ?, ?, ?, '{}', ?)
      ON CONFLICT(service) DO UPDATE SET
        enabled = excluded.enabled,
        base_url = excluded.base_url,
        encrypted_api_key = excluded.encrypted_api_key,
        updated_at = excluded.updated_at
    `)
    .run(enabled, baseUrl, encryptedKey, new Date().toISOString());

  return getPostizStoredConfig();
}

export async function testPostizConnection(overrideBaseUrl?: string, overrideApiKey?: string): Promise<{
  ok: boolean;
  message: string;
  integrations?: PostizIntegration[];
}> {
  const current = getPostizStoredConfig();
  const baseUrl = (overrideBaseUrl?.trim() || current.baseUrl || DEFAULT_POSTIZ_URL).replace(/\/+$/, "");
  const apiKey = overrideApiKey?.trim() || current.apiKey;

  if (!apiKey) {
    return { ok: false, message: "Postiz API anahtarı (API Key) girilmemiş." };
  }

  try {
    const url = `${baseUrl}/public/v1/integrations`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { ok: false, message: "Yetkilendirme başarısız (401): API anahtarı geçersiz." };
      }
      return { ok: false, message: `Postiz API hata döndürdü: HTTP ${response.status}` };
    }

    const integrations = (await response.json()) as PostizIntegration[];
    return {
      ok: true,
      message: `Bağlantı başarılı! ${integrations.length} hesap bulundu.`,
      integrations,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Postiz servisine bağlanılamadı: ${errMessage}` };
  }
}

export async function fetchPostizIntegrations(): Promise<PostizIntegration[]> {
  const { baseUrl, apiKey, enabled } = getPostizStoredConfig();
  if (!enabled || !apiKey) return [];

  const url = `${baseUrl}/public/v1/integrations`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Postiz hesapları alınamadı: HTTP ${response.status}`);
  }

  return (await response.json()) as PostizIntegration[];
}

export type PostizUploadedMedia = {
  id: string;
  name: string;
  path: string;
};

export async function uploadMediaToPostiz(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PostizUploadedMedia> {
  const { baseUrl, apiKey, enabled } = getPostizStoredConfig();
  if (!enabled || !apiKey) {
    throw new Error("Postiz entegrasyonu etkin değil veya API anahtarı eksik.");
  }

  const boundary = `----PostizUploadBoundary${Date.now()}`;
  const crlf = "\r\n";
  const header =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;

  const payload = Buffer.concat([
    Buffer.from(header, "utf-8"),
    fileBuffer,
    Buffer.from(footer, "utf-8"),
  ]);

  const url = `${baseUrl}/public/v1/upload`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Accept: "application/json",
    },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Postiz medya yükleme hatası (${response.status}): ${errorText}`);
  }

  return (await response.json()) as PostizUploadedMedia;
}

export type CreatePostizPostParams = {
  type: "now" | "schedule" | "draft";
  date?: string; // ISO 8601 UTC
  integrationId: string;
  caption: string;
  media?: { id: string; path: string }[];
  postType?: "post" | "reel" | "story";
};

export async function createPostizPost(
  params: CreatePostizPostParams
): Promise<{ postId: string; integration: string }[]> {
  const { baseUrl, apiKey, enabled } = getPostizStoredConfig();
  if (!enabled || !apiKey) {
    throw new Error("Postiz entegrasyonu etkin değil veya API anahtarı eksik.");
  }

  const scheduleDate = params.date || new Date(Date.now() + 60_000).toISOString();
  const postType = params.postType || "post";

  const payload = {
    type: params.type,
    date: scheduleDate,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: params.integrationId },
        value: [
          {
            content: params.caption,
            image: params.media || [],
          },
        ],
        settings: {
          post_type: postType,
        },
      },
    ],
  };

  const url = `${baseUrl}/public/v1/posts`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = Array.isArray(errData.message)
      ? errData.message.join(", ")
      : errData.message || `HTTP ${response.status}`;
    throw new Error(`Postiz gönderi oluşturma hatası: ${message}`);
  }

  return (await response.json()) as { postId: string; integration: string }[];
}

export async function deletePostizPost(postId: string): Promise<boolean> {
  const { baseUrl, apiKey, enabled } = getPostizStoredConfig();
  if (!enabled || !apiKey) return false;

  const url = `${baseUrl}/public/v1/posts/${postId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });

  return response.ok;
}
