export type SocialPlatform = "instagram" | "youtube" | "tiktok" | "facebook" | "twitter";
export type HashtagCategory = "brand" | "topic" | "trend";
export type HashtagSetPlatform = SocialPlatform | "all";

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
    /^dd[a-z0-9_-]{6,}$/i.test(key) ||
    key === "studiotoylab"
  );
}

export function sampleHashtags(values: string[], count: number, seed?: number): string[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!count || count <= 0 || count >= values.length) return [...values];
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = typeof seed === "number"
      ? Math.floor(Math.abs(Math.sin(seed + i)) * (i + 1))
      : Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy.slice(0, count);
}

export const DEFAULT_HASHTAG_TEMPLATES = [
  {
    name: "Sabit Marka",
    platform: "all" as const,
    category: "brand" as const,
    rotationCount: 0,
    isDefault: true,
    hashtags: ["#AtolyeHanem", "#AtölyeHanem", "#Makerspace", "#StemAtolyesi"],
  },
  {
    name: "Robotik & Kodlama",
    platform: "instagram" as const,
    category: "topic" as const,
    rotationCount: 5,
    isDefault: false,
    hashtags: [
      "#RobotikKodlama",
      "#Arduino",
      "#RobotTasarımı",
      "#StemEgitimi",
      "#KodlamaEgitimi",
      "#ElektronikAtolyesi",
      "#YapayZekaCocuk",
      "#MakerHareketi",
      "#GeleceginMeslekleri",
    ],
  },
  {
    name: "Çocuk Gelişimi & Aile",
    platform: "instagram" as const,
    category: "topic" as const,
    rotationCount: 4,
    isDefault: false,
    hashtags: [
      "#CocukGelisimi",
      "#EbeveynRehberi",
      "#UretenCocuklar",
      "#EkranDetoksu",
      "#PedagogOnayli",
      "#MontessoriAtolye",
      "#HaftaSonuEtkinligi",
      "#BilincliEbeveyn",
    ],
  },
  {
    name: "Viral Keşfet & Trend",
    platform: "tiktok" as const,
    category: "trend" as const,
    rotationCount: 3,
    isDefault: false,
    hashtags: [
      "#KendinYap",
      "#KendinUret",
      "#StemKids",
      "#ViralReels",
      "#BunuBiliyorMuydun",
      "#TeknolojiTrendleri",
      "#Robotik",
    ],
  },
  {
    name: "YouTube Shorts SEO",
    platform: "youtube" as const,
    category: "topic" as const,
    rotationCount: 3,
    isDefault: true,
    hashtags: [
      "#Shorts",
      "#RobotikKodlama",
      "#AtolyeHanem",
      "#Arduino",
      "#StemEgitimi",
    ],
  },
];

export function mergePlatformHashtags(input: {
  platform: SocialPlatform;
  aiHashtags: string[] | string;
  setHashtags?: string[] | string;
  brandHashtags?: string[] | string;
  topicHashtags?: string[] | string;
  trendHashtags?: string[] | string;
  includeSets: boolean;
}) {
  const ai = normalizeHashtagList(input.aiHashtags);
  const brand = input.includeSets && input.brandHashtags ? normalizeHashtagList(input.brandHashtags) : [];
  const topic = input.includeSets && input.topicHashtags ? normalizeHashtagList(input.topicHashtags) : [];
  const trend = input.includeSets && input.trendHashtags ? normalizeHashtagList(input.trendHashtags) : [];
  const legacySaved = input.includeSets && input.setHashtags ? normalizeHashtagList(input.setHashtags) : [];

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

  const hasCategorizedSets = brand.length > 0 || topic.length > 0 || trend.length > 0;
  if (hasCategorizedSets) {
    // 1. Sabit Marka etiketleri (en yüksek öncelik, asla kırpılmaz)
    append(brand, "set");
    // 2. AI Konu etiketleri
    append(ai, "ai");
    // 3. Niş / Konu etiketleri
    append(topic, "set");
    // 4. Trend / Geniş kitle etiketleri
    append(trend, "set");
  } else {
    // Klasik birleşme: AI önce, set sonra
    append(ai, "ai");
    append(legacySaved, "set");
  }

  const visible = merged.slice(0, platformVisibleHashtagLimit(input.platform));
  const tags = input.platform === "youtube"
    ? merged.slice(0, 15).map((tag) => tag.replace(/^#/, "").slice(0, 30))
    : [];

  return { visible, tags, aiAdded, setAdded, removedDuplicates, removedInvalid };
}
