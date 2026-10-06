export type MusicProvider = "instagram" | "youtube";

export type MusicSearchItem = {
  provider: MusicProvider;
  id: string;
  title: string;
  artist: string;
  durationSeconds: number | null;
  previewUrl?: string;
  sourceUrl: string;
  canEmbed: boolean;
  embedReason: string;
  isTrending: boolean;
  attribution?: string;
  sourceKind?: "licensed-alternative";
};

export type MusicSelection = {
  track: MusicSearchItem;
  offsetSeconds: number;
};

export function validateMusicSelection(value: unknown): asserts value is MusicSelection {
  const selection = value as Partial<MusicSelection> | null;
  if (!selection || typeof selection !== "object" || !selection.track ||
      !["instagram", "youtube"].includes(selection.track.provider) ||
      typeof selection.track.id !== "string" || !selection.track.id || selection.track.id.length > 200 ||
      typeof selection.offsetSeconds !== "number" || !Number.isFinite(selection.offsetSeconds) ||
      selection.offsetSeconds < 0 || selection.offsetSeconds > 86400) {
    throw new Error("Geçersiz müzik seçimi veya başlangıç noktası.");
  }
}

export type MusicSearchResult = {
  items: MusicSearchItem[];
  status: "ok" | "empty" | "not-configured" | "unsupported" | "error";
  message: string;
  nativeStatus?: MusicSearchResult["status"];
};
