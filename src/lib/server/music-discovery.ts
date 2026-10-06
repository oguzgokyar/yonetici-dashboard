import "server-only";
import { createLicensedMusic } from "./licensed-music";
import type { MusicProviderTestResult } from "../music-provider-settings";
import type { MusicProvider, MusicSearchItem, MusicSearchResult, MusicSelection } from "../music-discovery";

type SearchInput = { projectId: string; provider: MusicProvider; query?: string };
type Dependencies = {
  projectExists: (projectId: string) => Promise<boolean>;
  getInstagramCredentials: () => { accessToken: string; userId: string; expiresAt?: string } | null | Promise<{ accessToken: string; userId: string; expiresAt?: string } | null>;
  getYouTubeKey: () => string | Promise<string>;
  getYouTubeRegion?: () => string | Promise<string>;
  getYouTubeAccessToken?: () => Promise<string>;
  isEnabled?: (provider: MusicProvider) => boolean | Promise<boolean>;
  getTokenExpiresAt?: (provider: MusicProvider) => string | Promise<string>;
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

class ProviderFailure extends Error {
  code: MusicProviderTestResult["code"];
  constructor(code: MusicProviderTestResult["code"]) { super("Provider request failed"); this.code = code; }
}
function classifyFailure(status: number, payload: unknown): MusicProviderTestResult["code"] {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error as { code?: number; errors?: { reason?: string }[]; status?: string } : undefined;
  const reasons = error?.errors?.map(e => e.reason) || [];
  if (status === 429 || error?.code === 4 || error?.code === 17 || reasons.some(r => r === "quotaExceeded" || r === "dailyLimitExceeded")) return "quota";
  if (error?.code === 190 || status === 401) return "expired";
  if (reasons.some(r => r === "keyInvalid" || r === "API_KEY_INVALID") || error?.status === "INVALID_ARGUMENT") return "invalid-key";
  if (status === 403 || error?.code === 10 || error?.code === 200 || reasons.includes("accessNotConfigured")) return "permission";
  return "unavailable";
}
const testMessages: Record<MusicProviderTestResult["code"], string> = { ok: "Resmi müzik keşfi bağlantısı doğrulandı.", disabled: "Sağlayıcı kapalı.", "not-configured": "Bağlantı ayarları eksik.", expired: "Token geçersiz veya süresi dolmuş; yeniden bağlanın.", quota: "Sağlayıcı kotası doldu.", permission: "API etkinliği, hesap veya katalog izni reddedildi.", "invalid-key": "API anahtarı reddedildi.", unavailable: "Sağlayıcıya erişilemedi." };
export function createMusicDiscovery(dependencies: Dependencies) {
  async function requireProject(projectId: string) {
    if (!projectId || !(await dependencies.projectExists(projectId))) {
      throw new MusicDiscoveryError("Proje bulunamadı.", 404);
    }
  }

  const licensed = createLicensedMusic(dependencies.fetch);
  return {
    async testConnection(provider: MusicProvider): Promise<MusicProviderTestResult> {
      let code: MusicProviderTestResult["code"] = "unavailable";
      try {
        if (dependencies.isEnabled && !(await dependencies.isEnabled(provider))) code = "disabled";
        else if (provider === "instagram" && Date.parse(await dependencies.getTokenExpiresAt?.(provider) || "") <= Date.now()) code = "expired";
        else {
          const result = await searchNative({ projectId: "", provider }, true);
          code = result.status === "not-configured" ? "not-configured" : result.status === "ok" || result.status === "empty" ? "ok" : "unavailable";
        }
      } catch (error) {
        code = error instanceof ProviderFailure ? error.code : "unavailable";
        if (code === "unavailable" && Date.parse(await dependencies.getTokenExpiresAt?.(provider) || "") <= Date.now()) code = "expired";
      }
      return { ok: code === "ok", code, message: testMessages[code] };
    },
    async searchMusic(input: SearchInput): Promise<MusicSearchResult> {
      const response = await searchNative(input).catch(error => {
        if (error instanceof MusicDiscoveryError) throw error;
        return {items: [], status: "error" as const, message: "Müzik bağlantısı doğrulanamadı; ayarlardan yeniden bağlanın."};
      });
      const native = { ...response, nativeStatus: response.status };
      try {
        const alternatives = await licensed.search(input.provider, input.query?.trim() || "", native.items.length ? 3 : 8);
        if (!alternatives.length) return { ...native, message: `${native.message} Doğrulanmış ücretsiz lisanslı alternatif bulunamadı.` };
        return { items: [...native.items, ...alternatives], nativeStatus: native.status, status: "ok", message: `${native.message} Ücretsiz CC BY 4.0 alternatifler Scott Buckley kaynağından doğrulandı; platform trendi değildir; açıklamada atıf gereklidir.` };
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

  async function searchNative(input: SearchInput, test = false): Promise<MusicSearchResult> {
      if (!test) await requireProject(input.projectId);
      if (input.provider !== "instagram" && input.provider !== "youtube") {
        throw new MusicDiscoveryError("Geçersiz müzik sağlayıcısı.", 400);
      }
      if (input.query !== undefined && typeof input.query !== "string") {
        throw new MusicDiscoveryError("Müzik araması metin olmalıdır.", 400);
      }
      if (dependencies.isEnabled && !(await dependencies.isEnabled(input.provider))) return {items: [], status: "not-configured", message: "Müzik sağlayıcısı kapalı."};
      const query = input.query?.trim() || "";
      if (query.length > 200) throw new MusicDiscoveryError("Müzik araması en fazla 200 karakter olabilir.", 400);
      if (input.provider === "youtube") {
        const key = await dependencies.getYouTubeKey();
        const accessToken = !key ? await dependencies.getYouTubeAccessToken?.() : "";
        if (!key && !accessToken) return { items: [], status: "not-configured", message: "YouTube müzik keşfi için sunucuda YOUTUBE_MUSIC_API_KEY gereklidir. Video keşfi, trend ses sıralaması veya ses indirme izni değildir." };
        try {
          const url = new URL(`https://www.googleapis.com/youtube/v3/${query ? "search" : "videos"}`);
          if (key) url.searchParams.set("key", key);
          url.searchParams.set("part", "snippet");
          url.searchParams.set("maxResults", "20");
          url.searchParams.set("videoCategoryId", "10");
          url.searchParams.set("regionCode", await dependencies.getYouTubeRegion?.() || "TR");
          if (query) { url.searchParams.set("q", query); url.searchParams.set("type", "video"); url.searchParams.set("order", "date"); }
          else url.searchParams.set("chart", "mostPopular");
          const response = await dependencies.fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
          const payload: unknown = await response.json();
          if (!response.ok || !payload || typeof payload !== "object" || "error" in payload || !("items" in payload) || !Array.isArray(payload.items)) throw new ProviderFailure(classifyFailure(response.status, payload));
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
        } catch (error) { if (test) throw error; return { items: [], status: "error", message: "YouTube müzik keşfi alınamadı. API erişimini ve kotayı kontrol edin." }; }
      }
      const credentials = await dependencies.getInstagramCredentials();
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
          const payload: unknown = await response.json();
          if (!response.ok || (payload && typeof payload === "object" && "error" in payload)) throw new ProviderFailure(classifyFailure(response.status, payload));
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
      } catch (error) {
        if (test) throw error;
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
  async getInstagramCredentials() {
    const { getMusicProviderStoredConfig } = await import("@/lib/server/music-provider-config");
    const c = getMusicProviderStoredConfig("instagram");
    if (!c.enabled) return null;
    const { getMusicProviderAccessToken } = await import("@/lib/server/music-provider-oauth");
    const accessToken = await getMusicProviderAccessToken("instagram");
    return accessToken && c.userId ? { accessToken, userId: c.userId, expiresAt: c.expiresAt } : null;
  },
  async getYouTubeKey() {
    const { getMusicProviderStoredConfig } = await import("@/lib/server/music-provider-config");
    const c = getMusicProviderStoredConfig("youtube"); return c.enabled ? c.apiKey : "";
  },
  async getYouTubeAccessToken() {
    const { getMusicProviderAccessToken } = await import("@/lib/server/music-provider-oauth");
    return getMusicProviderAccessToken("youtube");
  },
  getTokenExpiresAt: async provider => (await import("@/lib/server/music-provider-config")).getMusicProviderStoredConfig(provider).expiresAt,
  getYouTubeRegion: async () => (await import("@/lib/server/music-provider-config")).getMusicProviderStoredConfig("youtube").regionCode,
  isEnabled: async provider => { const c = (await import("@/lib/server/music-provider-config")).getMusicProviderStoredConfig(provider); return c.source === "none" || c.enabled; },
  fetch: (input, init) => globalThis.fetch(input, init),
});

export const testMusicProviderConnection = service.testConnection;
export const searchMusic = service.searchMusic;
export const resolveEmbeddableMusic = service.resolveEmbeddableMusic;
