export type YouTubeTagObject = {
  value: string;
  label: string;
};

export type YouTubePostSettings = {
  title: string;                              // Required, 2-100 chars
  type: "public" | "unlisted" | "private";
  selfDeclaredMadeForKids?: "yes" | "no";
  tags?: Array<string | YouTubeTagObject>;    // Postiz requires [{ value, label }]
};

export type TikTokPostSettings = {
  title?: string;
  content_posting_method?: "DIRECT_POST" | "UPLOAD";
  privacy_level?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  comment?: boolean;
  duet?: boolean;
  stitch?: boolean;
  autoAddMusic?: "yes" | "no";
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
  video_made_with_ai?: boolean;
};

export type PlatformSettingsParams = {
  platformIdentifier?: string;
  caption: string;
  postType?: "post" | "reel" | "story";
  youtubeSettings?: YouTubePostSettings;
  tiktokSettings?: TikTokPostSettings;
  videoDurationSeconds?: number;
  videoAspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
};

/**
 * Detects if a video should be published as YouTube Shorts.
 * Criteria: reel postType OR (9:16 aspect ratio AND duration <= 60 seconds).
 */
export function isYouTubeShorts(
  params: Pick<PlatformSettingsParams, "videoDurationSeconds" | "videoAspectRatio" | "postType">
): boolean {
  if (params.postType === "reel") return true;
  return params.videoAspectRatio === "9:16" && (params.videoDurationSeconds ?? 999) <= 60;
}

/**
 * Normalizes YouTube tags into Postiz's expected [{ value, label }] format.
 * Strips leading '#' hashes, trims whitespace, deduplicates, and limits to 15 tags.
 */
export function formatYouTubeTags(rawTags?: Array<string | YouTubeTagObject>): YouTubeTagObject[] {
  if (!Array.isArray(rawTags) || rawTags.length === 0) return [];

  const seen = new Set<string>();
  const result: YouTubeTagObject[] = [];

  for (const t of rawTags) {
    let val = "";
    let lbl = "";
    if (typeof t === "string") {
      val = t.trim().replace(/^#+/, "").trim();
      lbl = val;
    } else if (t && typeof t === "object") {
      val = String(t.value || "").trim().replace(/^#+/, "").trim();
      lbl = String(t.label || val).trim().replace(/^#+/, "").trim();
    }
    if (!val) continue;

    const lower = val.toLocaleLowerCase("tr-TR");
    if (seen.has(lower)) continue;
    seen.add(lower);

    const cleanVal = val.slice(0, 30);
    const cleanLbl = lbl.slice(0, 30);
    result.push({ value: cleanVal, label: cleanLbl });
    if (result.length >= 15) break;
  }

  return result;
}

/**
 * Builds platform-specific settings for a Postiz post based on the platform identifier.
 */
export function buildPlatformSettings(params: PlatformSettingsParams): Record<string, unknown> {
  const platform = (params.platformIdentifier || "instagram").toLowerCase();

  if (platform.includes("youtube")) {
    const isShorts = isYouTubeShorts(params);
    const title =
      params.youtubeSettings?.title ||
      params.caption.slice(0, 97).trim() ||
      "Video";
    const formattedTags = formatYouTubeTags(params.youtubeSettings?.tags);

    return {
      __type: "youtube",
      title: title.slice(0, 100),
      type: params.youtubeSettings?.type || "public",
      selfDeclaredMadeForKids: params.youtubeSettings?.selfDeclaredMadeForKids || "no",
      ...(isShorts && { shorts: true }),
      tags: formattedTags,
    };
  }

  if (platform.includes("tiktok")) {
    const title =
      params.tiktokSettings?.title ||
      (params.caption ? params.caption.slice(0, 85).trim() : undefined);

    return {
      __type: "tiktok",
      ...(title ? { title: title.slice(0, 90) } : {}),
      content_posting_method: params.tiktokSettings?.content_posting_method || "DIRECT_POST",
      privacy_level: params.tiktokSettings?.privacy_level || "SELF_ONLY",
      comment: params.tiktokSettings?.comment ?? true,
      duet: params.tiktokSettings?.duet ?? true,
      stitch: params.tiktokSettings?.stitch ?? true,
      autoAddMusic: params.tiktokSettings?.autoAddMusic || "no",
      brand_content_toggle: params.tiktokSettings?.brand_content_toggle ?? false,
      brand_organic_toggle: params.tiktokSettings?.brand_organic_toggle ?? false,
      video_made_with_ai: params.tiktokSettings?.video_made_with_ai ?? true,
    };
  }

  // Instagram / Instagram Standalone (default)
  const postizPostType = params.postType === "story" ? "story" : "post";
  return { post_type: postizPostType };
}

/**
 * Auto-appends #Shorts to caption for YouTube Shorts videos if not already present.
 */
export function buildCaption(params: PlatformSettingsParams): string {
  const platform = (params.platformIdentifier || "instagram").toLowerCase();
  if (platform.includes("youtube") && isYouTubeShorts(params)) {
    const hasShorts = params.caption.toLowerCase().includes("#shorts");
    return hasShorts ? params.caption : `${params.caption}\n\n#Shorts`;
  }
  return params.caption;
}
