import "server-only";

import { getDatabase } from "@/lib/server/database";
import {
  getOpenPostStoredConfig,
  fetchOpenPostAccounts,
  uploadMediaToOpenPost,
  createOpenPostPublication,
  fetchOpenPostPublicationStatus,
  OpenPostAccount,
} from "@/lib/server/openpost-client";
import {
  getPostizStoredConfig,
  fetchPostizIntegrations,
  uploadMediaToPostiz,
  createPostizPost,
  deletePostizPost,
  PostizIntegration,
  CreatePostizPostParams,
  YouTubePostSettings,
  TikTokPostSettings,
} from "@/lib/server/postiz-client";

export type PublisherService = "openpost" | "postiz";

export type UnifiedAccount = {
  id: string;
  service: PublisherService;
  integrationId: string;
  name: string;
  identifier: string; // "youtube" | "facebook" | "instagram" | "tiktok"
  profile?: string;
  picture?: string;
  disabled?: boolean;
};

export function getActivePublisherService(): {
  activeService: PublisherService;
  isOpenPostConfigured: boolean;
  isPostizConfigured: boolean;
  openPostEnabled: boolean;
  postizEnabled: boolean;
  openPostWebUrl: string;
  postizWebUrl: string;
} {
  const openPostConfig = getOpenPostStoredConfig();
  const postizConfig = getPostizStoredConfig();

  // If OpenPost is explicitly enabled, it takes precedence
  let activeService: PublisherService = "openpost";
  if (!openPostConfig.enabled && postizConfig.enabled) {
    activeService = "postiz";
  } else if (openPostConfig.enabled) {
    activeService = "openpost";
  } else if (postizConfig.hasApiKey && !openPostConfig.hasApiKey) {
    activeService = "postiz";
  }

  return {
    activeService,
    isOpenPostConfigured: openPostConfig.hasApiKey,
    isPostizConfigured: postizConfig.hasApiKey,
    openPostEnabled: openPostConfig.enabled,
    postizEnabled: postizConfig.enabled,
    openPostWebUrl: openPostConfig.baseUrl || "https://sm.atolyehanem.com",
    postizWebUrl: postizConfig.baseUrl.includes("10.0.1.1")
      ? "http://postiz.43.131.47.253.sslip.io"
      : postizConfig.baseUrl,
  };
}

export async function fetchAvailableAccountsForActivePublisher(): Promise<UnifiedAccount[]> {
  const { activeService } = getActivePublisherService();

  if (activeService === "openpost") {
    const opAccounts = await fetchOpenPostAccounts().catch(() => []);
    return opAccounts.map((a) => ({
      id: a.id,
      service: "openpost",
      integrationId: a.id,
      name: a.name,
      identifier: a.identifier,
      profile: a.profile,
      picture: a.picture,
      disabled: a.disabled,
    }));
  } else {
    const postizIntegrations = await fetchPostizIntegrations().catch(() => []);
    return postizIntegrations.map((p) => ({
      id: p.id,
      service: "postiz",
      integrationId: p.id,
      name: p.name,
      identifier: p.identifier,
      profile: p.profile,
      picture: p.picture,
      disabled: p.disabled,
    }));
  }
}

export type UnifiedUploadedMedia = {
  id: string;
  path: string;
  name?: string;
  service: PublisherService;
};

export async function uploadSocialMedia(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  serviceOverride?: PublisherService
): Promise<UnifiedUploadedMedia> {
  const { activeService } = getActivePublisherService();
  const targetService = serviceOverride || activeService;

  if (targetService === "openpost") {
    const res = await uploadMediaToOpenPost(fileBuffer, filename, mimeType);
    return {
      id: res.id,
      path: res.url,
      name: res.originalFilename,
      service: "openpost",
    };
  } else {
    const res = await uploadMediaToPostiz(fileBuffer, filename, mimeType);
    return {
      id: res.id,
      path: res.path,
      name: res.name,
      service: "postiz",
    };
  }
}

export type CreateUnifiedPostParams = {
  type: "now" | "schedule" | "draft";
  date?: string; // ISO 8601 UTC
  integrationId: string;
  service?: PublisherService;
  platformIdentifier?: string;
  caption: string;
  title?: string;
  media?: Array<{ id: string; path?: string }>;
  postType?: "post" | "reel" | "story" | "short_video" | "video";
  youtubeSettings?: YouTubePostSettings;
  tiktokSettings?: TikTokPostSettings;
  isAiGenerated?: boolean;
  relatedVideoUrl?: string;
};

export async function createUnifiedSocialPost(
  params: CreateUnifiedPostParams
): Promise<Array<{ postId: string; integration: string }>> {
  const database = getDatabase();

  // If service not explicitly provided, check what service is associated with this integrationId in project_social_accounts
  let targetService = params.service;
  if (!targetService) {
    const accountRow = database
      .prepare("SELECT service FROM project_social_accounts WHERE integration_id = ? LIMIT 1")
      .get(params.integrationId) as { service?: string } | undefined;
    if (accountRow?.service === "openpost" || accountRow?.service === "postiz") {
      targetService = accountRow.service as PublisherService;
    } else {
      targetService = getActivePublisherService().activeService;
    }
  }

  if (targetService === "openpost") {
    let preset: "post" | "short_video" | "story" | "video" = "post";
    if (params.postType === "reel" || params.postType === "short_video") {
      preset = "short_video";
    } else if (params.postType === "story") {
      preset = "story";
    } else if (params.postType === "video") {
      preset = "video";
    }

    const firstLine = params.caption ? params.caption.split("\n")[0].trim() : "";
    const safeFallbackTitle = firstLine.length > 80 ? firstLine.slice(0, 80).replace(/\s+\S*$/, "") : firstLine;
    const pubResult = await createOpenPostPublication({
      type: params.type,
      date: params.date,
      accountIds: [params.integrationId],
      title: params.title || safeFallbackTitle || "Gönderi",
      caption: params.caption,
      media: params.media,
      postType: preset,
    });

    return [
      {
        postId: pubResult.publicationId,
        integration: params.integrationId,
      },
    ];
  } else {
    return await createPostizPost({
      type: params.type,
      date: params.date,
      integrationId: params.integrationId,
      platformIdentifier: params.platformIdentifier,
      caption: params.caption,
      media: params.media?.map((m) => ({ id: m.id, path: m.path || "" })),
      postType: params.postType === "reel" ? "reel" : params.postType === "story" ? "story" : "post",
      youtubeSettings: params.youtubeSettings,
      tiktokSettings: params.tiktokSettings,
      isAiGenerated: params.isAiGenerated,
      relatedVideoUrl: params.relatedVideoUrl,
    });
  }
}

export async function deleteUnifiedSocialPost(postId: string): Promise<boolean> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
  if (isUuid) {
    const config = getOpenPostStoredConfig();
    if (!config.apiKey) return false;
    const targetWorkspaceId = config.defaultWorkspaceId || "451b4a2b-a35e-443f-8627-7e3509b00199";
    try {
      const url = `${config.baseUrl}/api/v1/publications/${postId}?workspace_id=${encodeURIComponent(targetWorkspaceId)}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  } else {
    return await deletePostizPost(postId);
  }
}

