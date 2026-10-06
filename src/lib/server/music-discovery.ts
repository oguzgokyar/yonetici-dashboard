import "server-only";
import { createLicensedMusic } from "./licensed-music";
import type { MusicProvider, MusicSearchItem, MusicSearchResult, MusicSelection } from "../music-discovery";

type SearchInput = { projectId: string; provider: MusicProvider; query?: string };
type Dependencies = {
  projectExists: (projectId: string) => Promise<boolean>;
  getInstagramCredentials: () => { accessToken: string; userId: string } | null;
  getYouTubeKey: () => string;
  fetch: typeof fetch;
};
export type VerifiedEmbeddableMusic = MusicSearchItem & { downloadUrl: string };

export class MusicDiscoveryError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "MusicDiscoveryError";
  }
}

const EMBED_REASON = "Instagram önizlemesi ve reklam uygunluğu, platformlar arası MP4 müzik lisansı değildir. Doğrulanmış lisans ve izinli indirme kaynağı gereklidir.";
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

function safeHttpsUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    if ([...url.searchParams.keys()].some((key) => /^(access_token|token|api_key|key)$/i.test(key))) return undefined;
    return url.toString();
  } catch { return undefined; }
}

export function createMusicDiscovery(dependencies: Dependencies) {
  async function requireProject(projectId: string) {
    if (!projectId || !(await dependencies.projectExists(projectId))) {
      throw new MusicDiscoveryError("Proje bulunamadı.", 404);
    }
  }

  const licensed = createLicensedMusic(dependencies.fetch);
  return {
    async searchMusic(input: SearchInput): Promise<MusicSearchResult> {
      const native = await searchNative(input);
      try {
        const alternatives = await licensed.search(input.provider, input.query?.trim() || "", native.items.length ? 3 : 8);
        if (!alternatives.length) return { ...native, message: `${native.message} Doğrulanmış ücretsiz lisanslı alternatif bulunamadı.` };
        return { items: [...native.items, ...alternatives], status: "ok", message: `${native.message} Ücretsiz CC BY 4.0 alternatifler Scott Buckley kaynağından doğrulandı; platform trendi değildir; açıklamada atıf gereklidir.` };
      } catch {
        return { ...native, message: `${native.message} Ücretsiz lisanslı müzik kaynağına erişilemedi; doğrulanmamış parça gösterilmez.` };
      }
    },
    async resolveEmbeddableMusic(projectId: string, selection: MusicSelection): Promise<VerifiedEmbeddableMusic> {
      await requireProject(projectId);
      if (selection?.track?.id?.startsWith("sb:")) {
        try { return await licensed.resolve(selection.track.provider, selection.track.id); }
        catch { throw new MusicDiscoveryError("Parçanın doğrulanmış CC BY 4.0 lisansı ve izinli indirme kaynağı alınamadı.", 422); }
      }
      throw new MusicDiscoveryError("Bu müzik MP4 içine eklenemez: doğrulanmış platformlar arası lisans ve izinli indirilebilir ses kaynağı yok. Instagram önizlemesi veya YouTube bağlantısı bu hakları sağlamaz; bu sağlayıcılardan ses indirme/çıkarma yapılmaz.", 422);
    },
  };

  async function searchNative(input: SearchInput): Promise<MusicSearchResult> {
      await requireProject(input.projectId);
      if (input.provider !== "instagram" && input.provider !== "youtube") {
        throw new MusicDiscoveryError("Geçersiz müzik sağlayıcısı.", 400);
      }
      if (input.query !== undefined && typeof input.query !== "string") {
        throw new MusicDiscoveryError("Müzik araması metin olmalıdır.", 400);
      }
      const query = input.query?.trim() || "";
      if (query.length > 200) throw new MusicDiscoveryError("Müzik araması en fazla 200 karakter olabilir.", 400);
      if (input.provider === "youtube") {
        const key = dependencies.getYouTubeKey();
        if (!key) return { items: [], status: "not-configured", message: "YouTube müzik keşfi için sunucuda YOUTUBE_MUSIC_API_KEY gereklidir. Video keşfi, trend ses sıralaması veya ses indirme izni değildir." };
        try {
          const url = new URL(`https://www.googleapis.com/youtube/v3/${query ? "search" : "videos"}`);
          url.searchParams.set("key", key);
          url.searchParams.set("part", "snippet");
          url.searchParams.set("maxResults", "20");
          url.searchParams.set("videoCategoryId", "10");
          url.searchParams.set("regionCode", "TR");
          if (query) { url.searchParams.set("q", query); url.searchParams.set("type", "video"); url.searchParams.set("order", "date"); }
          else url.searchParams.set("chart", "mostPopular");
          const response = await dependencies.fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
          const payload: unknown = await response.json();
          if (!response.ok || !payload || typeof payload !== "object" || "error" in payload || !("items" in payload) || !Array.isArray(payload.items)) throw new Error("provider-error");
          const items: MusicSearchItem[] = [];
          const seen = new Set<string>();
          for (const value of payload.items) {
            if (!value || typeof value !== "object") continue;
            const row = value as Record<string, unknown>;
            const id = typeof row.id === "object" && row.id ? text((row.id as Record<string, unknown>).videoId) : text(row.id);
            if (!/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id)) continue;
            seen.add(id);
            const snippet = row.snippet && typeof row.snippet === "object" ? row.snippet as Record<string, unknown> : {};
            items.push({ provider: "youtube", id, title: text(snippet.title) || "Müzik videosu", artist: text(snippet.channelTitle), durationSeconds: null, sourceUrl: `https://www.youtube.com/watch?v=${id}`, canEmbed: false, embedReason: "YouTube video bağlantısı izinli ses dosyası veya platformlar arası MP4 lisansı değildir.", isTrending: false });
          }
          return { items, status: items.length ? "ok" : "empty", message: query ? "Güncel müzik videosu arama sonuçları; trend ses sıralaması değildir." : "Türkiye popüler müzik videoları; Shorts trend ses sıralaması değildir." };
        } catch { return { items: [], status: "error", message: "YouTube müzik keşfi alınamadı. API erişimini ve kotayı kontrol edin." }; }
      }
      const credentials = dependencies.getInstagramCredentials();
      if (!credentials?.accessToken || !credentials.userId) {
        return { items: [], status: "not-configured", message: "Instagram için sunucuda INSTAGRAM_MUSIC_ACCESS_TOKEN ve INSTAGRAM_MUSIC_USER_ID gereklidir. Facebook Login, bağlı Facebook Sayfası olan Business/Creator hesabı ve instagram_basic / instagram_content_publish izinleri kullanılmalıdır." };
      }
      const items: MusicSearchItem[] = [];
      const seen = new Set<string>();
      try {
        for (const audioType of ["music", "original_sound"]) {
          const url = new URL("https://graph.facebook.com/v22.0/ig_audio");
          url.searchParams.set("user_id", credentials.userId);
          url.searchParams.set("audio_type", audioType);
          if (query) url.searchParams.set("search_query", query);
          const response = await dependencies.fetch(url, {
            method: "GET", headers: { Authorization: `Bearer ${credentials.accessToken}` },
            cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("provider-error");
          const payload: unknown = await response.json();
          if (!payload || typeof payload !== "object" || "error" in payload || !("audio" in payload) || !Array.isArray(payload.audio)) throw new Error("provider-response-invalid");
          for (const value of payload.audio) {
            if (!value || typeof value !== "object") continue;
            const row = value as Record<string, unknown>;
            const id = text(row.audio_id);
            if (!/^\d+$/.test(id) || seen.has(id)) continue;
            seen.add(id);
            const platformLink = safeHttpsUrl(row.on_platform_audio_preview_link);
            const sourceUrl = platformLink && new URL(platformLink).hostname === "www.instagram.com" ? platformLink : `https://www.instagram.com/reels/audio/${id}/`;
            const duration = row.duration_in_ms;
            items.push({
              provider: "instagram", id, title: text(row.title) || "Orijinal ses",
              artist: text(row.display_artist) || text(row.ig_username),
              durationSeconds: typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration / 1000 : null,
              previewUrl: safeHttpsUrl(row.download_url), sourceUrl,
              canEmbed: false, embedReason: EMBED_REASON, isTrending: !query,
            });
          }
        }
      } catch {
        // Provider bodies and exception strings can contain credentials: never forward/log them.
        return { items: [], status: "error", message: "Instagram ses kataloğu alınamadı. Facebook Login erişimini, hesap izinlerini ve bağlantıyı kontrol edin." };
      }
      return { items, status: items.length ? "ok" : "empty", message: !items.length ? "Instagram ses kataloğunda sonuç bulunamadı." : query ? "Instagram arama sonuçları; trend etiketi ve MP4 gömme izni içermez." : "Instagram güncel trend sesleri; MP4 gömme izni içermez." };
  }
}

const service = createMusicDiscovery({
  async projectExists(projectId) {
    const { getDatabase } = await import("@/lib/server/database");
    return Boolean(getDatabase().prepare("SELECT id FROM projects WHERE id = ?").get(projectId));
  },
  getInstagramCredentials() {
    const accessToken = process.env.INSTAGRAM_MUSIC_ACCESS_TOKEN?.trim();
    const userId = process.env.INSTAGRAM_MUSIC_USER_ID?.trim();
    return accessToken && userId ? { accessToken, userId } : null;
  },
  getYouTubeKey: () => process.env.YOUTUBE_MUSIC_API_KEY?.trim() || "",
  fetch: (input, init) => globalThis.fetch(input, init),
});

export const searchMusic = service.searchMusic;
export const resolveEmbeddableMusic = service.resolveEmbeddableMusic;
