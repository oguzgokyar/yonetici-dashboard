import type { MusicProvider, MusicSearchItem, MusicSearchResult } from "./music-discovery";

export function musicSearchNotice(provider: MusicProvider, result: { status?: MusicSearchResult["status"]; nativeStatus?: MusicSearchResult["status"] }) {
  const status = result.nativeStatus || result.status;
  const name = provider === "instagram" ? "Instagram" : "YouTube";
  if (status === "not-configured") return { text: `${name} bağlı değil`, settings: true };
  if (status === "error") return { text: `${name} araması başarısız`, settings: true };
  if (status === "unsupported") return { text: `${name} keşfi kullanılamıyor`, settings: true };
  return { text: "", settings: false };
}

export function presentMusicTrack(item: MusicSearchItem) {
  const alternative = item.sourceKind === "licensed-alternative";
  const seconds = item.durationSeconds;
  const rounded = typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
  return {
    title: `${item.title} — ${item.artist}`,
    duration: rounded === null ? "—" : `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`,
    sourceLabel: alternative ? "Scott" : item.provider === "instagram" ? "IG" : "YT",
    sourceName: alternative ? "Scott Buckley · Lisanslı alternatif" : item.provider === "instagram" ? "Instagram" : "YouTube",
    trending: !alternative && item.isTrending,
    unavailableReason: item.canEmbed ? "" : item.embedReason,
  };
}
