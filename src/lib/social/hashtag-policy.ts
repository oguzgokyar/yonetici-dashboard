export type SocialPlatform = "instagram" | "youtube" | "tiktok" | "facebook" | "twitter";

const VISIBLE_LIMITS: Record<SocialPlatform, number> = {
  instagram: 15,
  youtube: 3,
  tiktok: 8,
  facebook: 3,
  twitter: 2,
};

const FOREIGN_PLATFORM_TAGS: Record<SocialPlatform, Set<string>> = {
  instagram: new Set(["youtube", "youtubeshorts", "tiktok", "facebook"]),
  youtube: new Set(["instagram", "instareels", "reelsinstagram", "tiktok", "facebook"]),
  tiktok: new Set(["instagram", "youtube", "facebook"]),
  facebook: new Set(["instagram", "tiktok", "youtube"]),
  twitter: new Set(["instagram", "tiktok", "youtube", "facebook"]),
};

function normalizeOne(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/^#+/, "").replace(/\s+/g, "").replace(/[^\p{L}\p{N}_-]/gu, "");
  if (!compact || compact.length < 2 || compact.length > 40) return "";
  return `#${compact}`;
}

export function normalizeHashtagList(values: string[] | string) {
  const source = Array.isArray(values) ? values : String(values || "").split(/[\s,]+/);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of source) {
    const normalized = normalizeOne(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function platformVisibleHashtagLimit(platform: SocialPlatform) {
  return VISIBLE_LIMITS[platform];
}

function invalidForPlatform(platform: SocialPlatform, hashtag: string) {
  const key = hashtag.replace(/^#/, "").toLocaleLowerCase("tr-TR");
  return (
    FOREIGN_PLATFORM_TAGS[platform].has(key) ||
    /^dd[a-z0-9_-]+$/i.test(key) ||
    key === "studiotoylab"
  );
}

export function mergePlatformHashtags(input: {
  platform: SocialPlatform;
  aiHashtags: string[] | string;
  setHashtags: string[] | string;
  includeSets: boolean;
}) {
  const ai = normalizeHashtagList(input.aiHashtags);
  const saved = input.includeSets ? normalizeHashtagList(input.setHashtags) : [];
  const merged: string[] = [];
  const seen = new Set<string>();
  let removedDuplicates = 0;
  let removedInvalid = 0;
  let aiAdded = 0;
  let setAdded = 0;

  const append = (items: string[], source: "ai" | "set") => {
    for (const item of items) {
      if (invalidForPlatform(input.platform, item)) {
        removedInvalid += 1;
        continue;
      }
      const key = item.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) {
        removedDuplicates += 1;
        continue;
      }
      seen.add(key);
      merged.push(item);
      if (source === "ai") aiAdded += 1;
      else setAdded += 1;
    }
  };

  append(ai, "ai");
  append(saved, "set");

  const visible = merged.slice(0, platformVisibleHashtagLimit(input.platform));
  const tags = input.platform === "youtube"
    ? merged.slice(0, 15).map((tag) => tag.replace(/^#/, "").slice(0, 30))
    : [];

  return { visible, tags, aiAdded, setAdded, removedDuplicates, removedInvalid };
}
