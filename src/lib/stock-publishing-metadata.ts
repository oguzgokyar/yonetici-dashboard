export type StockPublishingMetadata = Record<string, unknown> | undefined;

export type ExtractedStockPublishingMetadata = {
  title: string;
  description: string;
  hashtags: string;
};

const STOP_WORDS = new Set([
  "ve", "ile", "için", "bir", "bu", "şu", "o", "da", "de", "gibi", "kadar", "daha",
  "çok", "en", "her", "ama", "fakat", "lakin", "ancak", "veya", "ya", "hem", "ise",
  "var", "yok", "mi", "mı", "mu", "mü", "ne", "nasıl", "neden", "niçin", "kim",
  "the", "and", "or", "for", "with", "in", "on", "at", "to", "a", "an", "is", "of",
  "mp4", "video", "instagram", "reel", "reels", "post", "user", "instagram_user"
]);

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" ? item.split(/,+/) : []);
  }
  return typeof value === "string" ? value.split(/,+/) : [];
}

function normalizedHashtag(value: string): string {
  const clean = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return clean ? `#${clean}` : "";
}

export function mergeHashtagText(...values: Array<string | string[] | undefined>): string {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const parts = Array.isArray(value)
      ? value
      : value?.match(/#[\p{L}\p{N}_-]+/gu) || stringList(value);
    for (const part of parts) {
      const hashtag = normalizedHashtag(part);
      const key = hashtag.toLocaleLowerCase("tr-TR");
      if (!hashtag || seen.has(key)) continue;
      seen.add(key);
      result.push(hashtag);
    }
  }

  return result.join(" ");
}

export function deriveKeywordsFromText(...texts: Array<string | undefined>): string[] {
  const words: string[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    if (!text) continue;
    const tokens = text
      .replace(/[^\p{L}\p{N}\s_]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    for (const token of tokens) {
      const lower = token.toLocaleLowerCase("tr-TR");
      if (!STOP_WORDS.has(lower) && !/^\d+$/.test(lower) && !seen.has(lower)) {
        seen.add(lower);
        words.push(token);
      }
    }
  }
  return words.slice(0, 8);
}

export function extractStockPublishingMetadata(
  metadata: StockPublishingMetadata,
  fallbackContext?: { title?: string; topic?: string; brandName?: string }
): ExtractedStockPublishingMetadata {
  const title = stringValue(metadata?.headline) ||
    stringValue(metadata?.title) ||
    stringValue(metadata?.name) ||
    stringValue(metadata?.başlık) ||
    stringValue(fallbackContext?.title) ||
    stringValue(fallbackContext?.topic);

  const description = stringValue(metadata?.subtitle) ||
    stringValue(metadata?.description) ||
    stringValue(metadata?.desc) ||
    stringValue(metadata?.açıklama) ||
    stringValue(fallbackContext?.topic);

  const rawDesc = description;
  const rawTitle = title;

  let hashtags = mergeHashtagText(
    stringList(metadata?.sourceHashtags),
    stringList(metadata?.hashtags),
    stringList(metadata?.keywords),
    stringList(metadata?.sourceKeywords),
    stringList(metadata?.tags),
    stringList(metadata?.anahtar_kelimeler),
    stringList(metadata?.etiketler),
    rawDesc.match(/#[\p{L}\p{N}_-]+/gu) || [],
    rawTitle.match(/#[\p{L}\p{N}_-]+/gu) || []
  );

  // If no explicit hashtags or keywords were found in metadata, derive smart fallback hashtags from context
  if (!hashtags) {
    const derived = deriveKeywordsFromText(
      fallbackContext?.brandName,
      rawTitle,
      rawDesc
    );
    hashtags = mergeHashtagText(
      fallbackContext?.brandName ? [fallbackContext.brandName] : [],
      derived
    );
  }

  return { title, description, hashtags };
}
