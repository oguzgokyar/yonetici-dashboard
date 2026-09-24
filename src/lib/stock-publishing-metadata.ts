export type StockPublishingMetadata = Record<string, unknown> | undefined;

type ExtractedStockPublishingMetadata = {
  title: string;
  description: string;
  hashtags: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" ? item.split(/,+/) : []);
  }
  return typeof value === "string" ? value.split(/,+/) : [];
}

function normalizedHashtag(value: string) {
  const clean = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return clean ? `#${clean}` : "";
}

export function mergeHashtagText(...values: Array<string | string[] | undefined>) {
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

export function extractStockPublishingMetadata(metadata: StockPublishingMetadata): ExtractedStockPublishingMetadata {
  if (!metadata) return { title: "", description: "", hashtags: "" };

  const title = stringValue(metadata.headline) ||
    stringValue(metadata.title) ||
    stringValue(metadata.name) ||
    stringValue(metadata.başlık);
  const description = stringValue(metadata.subtitle) ||
    stringValue(metadata.description) ||
    stringValue(metadata.desc) ||
    stringValue(metadata.açıklama);
  const hashtags = mergeHashtagText(
    stringList(metadata.sourceHashtags),
    stringList(metadata.hashtags),
    stringList(metadata.keywords),
    stringList(metadata.tags),
    stringList(metadata.anahtar_kelimeler),
  );

  return { title, description, hashtags };
}
