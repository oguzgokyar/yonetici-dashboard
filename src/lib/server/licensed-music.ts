import "server-only";
import type { MusicProvider, MusicSearchItem } from "../music-discovery";

// No catalog, file archive, database or metadata cache: all rights are checked per request.
export function createLicensedMusic(fetcher: typeof fetch) {
  async function read(url: URL | string): Promise<string> {
    const response = await fetcher(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Lisanslı müzik kaynağı alınamadı.");
    const limit = 600_000;
    if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new Error("Kaynak boyutu sınırı aşıldı."); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Kaynak gövdesi boş.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Error("Kaynak boyutu sınırı aşıldı."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  }
  async function verify(provider: MusicProvider, slug: string) {
    if (!validSlug(slug) || !["instagram", "youtube"].includes(provider)) throw new Error("Geçersiz lisanslı müzik kimliği.");
    const url = new URL(`${ORIGIN}/library/wp-json/wp/v2/posts`);
    url.searchParams.set("slug", slug); url.searchParams.set("per_page", "1");
    url.searchParams.set("_fields", "slug,status,type,link,title,content");
    const rows: unknown = JSON.parse(await read(url));
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Parça bulunamadı.");
    const row = rows[0];
    if (row.slug !== slug || row.status !== "publish" || row.type !== "post" || row.link !== `${ORIGIN}/library/${slug}/` || row.content?.protected || typeof row.content?.rendered !== "string" || typeof row.title?.rendered !== "string") throw new Error("Parça kimliği doğrulanamadı.");
    // WP REST content is the authoritative canonical track page body, without sidebar claims.
    const html = `<link rel="canonical" href="${row.link}"><article><h1>${row.title.rendered}</h1>${row.content.rendered}</article>`;
    const track = parseLicensedTrack(html, slug, provider);
    if (!track?.previewUrl) throw new Error("Parçanın CC BY 4.0 lisansı ve indirme kaynağı doğrulanamadı.");
    return { ...track, downloadUrl: track.previewUrl };
  }
  return {
    async search(provider: MusicProvider, query: string, limit = 8): Promise<MusicSearchItem[]> {
      const mapping: Record<string, string> = { sakin: "peaceful", huzurlu: "peaceful", rahatlatıcı: "peaceful", piyano: "piano", mutlu: "uplifting", neşeli: "upbeat", enerjik: "energetic", hüzünlü: "melancholic", duygusal: "emotional", epik: "epic", sinematik: "cinematic", karanlık: "dark", romantik: "romantic", nostaljik: "nostalgic", umutlu: "hopeful" };
      const keywords = query.trim().toLocaleLowerCase("tr").split(/\s+/).map(word => mapping[word] || word).join(" ");
      const count = Math.min(8, Math.max(1, Math.floor(limit) || 8));
      const url = new URL(`${ORIGIN}/library/wp-json/wp/v2/posts`);
      url.searchParams.set("per_page", String(count)); url.searchParams.set("_fields", "slug,status,type,link");
      if (keywords) url.searchParams.set("search", keywords.slice(0, 200));
      const rows: unknown = JSON.parse(await read(url));
      if (!Array.isArray(rows)) throw new Error("Lisanslı müzik arama yanıtı geçersiz.");
      const seen = new Set<string>();
      const slugs: string[] = [];
      for (const row of rows.slice(0, 8)) {
        if (!row || typeof row.slug !== "string" || !validSlug(row.slug) || row.status !== "publish" || row.type !== "post" || row.link !== `${ORIGIN}/library/${row.slug}/` || seen.has(row.slug)) continue;
        seen.add(row.slug); slugs.push(row.slug);
      }
      const tracks = await Promise.all(slugs.slice(0, count).map(async slug => { try { return await verify(provider, slug); } catch { return null; } }));
      return tracks.filter((track): track is NonNullable<typeof track> => track !== null);
    },
    async resolve(provider: MusicProvider, id: string) {
      if (typeof id !== "string" || !id.startsWith("sb:")) throw new Error("Geçersiz lisanslı müzik kimliği.");
      return verify(provider, id.slice(3));
    },
  };
}

const ORIGIN = "https://www.scottbuckley.com.au";
const REASON = "Ücretsiz CC BY 4.0 alternatif; platform trendi değildir; açıklamada atıf gerekli";
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120 && !/(remix|licens|using-this-music|copyright|category|contact|about)/i.test(slug);
function plain(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n: string) => {
    const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
export function parseLicensedTrack(html: string, slug: string, provider: MusicProvider): MusicSearchItem | null {
  if (!validSlug(slug)) return null;
  const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
  const sourceUrl = `${ORIGIN}/library/${slug}/`;
  if (canonical !== sourceUrl) return null;
  // Only the track's content, never a site-wide sidebar license or another track's audio.
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (!article || /creativecommons\.org\/licenses\/(?:by-nc|by-nd|by-sa)|CC[- ]?BY[- ]?(?:NC|ND|SA)|all rights reserved/i.test(article)) return null;
  const title = plain(article.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  if (!title || /remix/i.test(title)) return null;
  if (!/<a\b(?=[^>]*\brel=["']license["'])[^>]*\bhref=["']https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/["']/i.test(article)) return null;
  const credit = plain(article.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1] || "");
  if (!credit.includes("Scott Buckley") || !/CC-BY 4\.0/i.test(credit) || !credit.includes("www.scottbuckley.com.au")) return null;
  let previewUrl: string | undefined;
  for (const match of article.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    if (!/\bdownload\s*=/i.test(match[0])) continue;
    try {
      const url = new URL(plain(match[1]));
      if (url.protocol === "https:" && ["www.scottbuckley.com.au", "scottbuckley.com.au"].includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/(?:library\/|wp-content\/)/.test(url.pathname) && /\.mp3$/i.test(url.pathname) && !/%|\.\./.test(url.pathname)) { previewUrl = url.href; break; }
    } catch { /* Invalid audio links are not downloadable evidence. */ }
  }
  if (!previewUrl) return null;
  return { provider, id: `sb:${slug}`, title, artist: "Scott Buckley", durationSeconds: null, sourceUrl, previewUrl, canEmbed: true, isTrending: false, sourceKind: "licensed-alternative", embedReason: REASON, attribution: `${credit}\nKaynak: ${sourceUrl}\nLisans: https://creativecommons.org/licenses/by/4.0/\nUyarlama: video ile senkronizasyon; seçilen bölüme kırpma ve ses seviyesi ayarı uygulanabilir. Açıklamada atıf gereklidir; bağımsız müzik dağıtımı veya Content ID kaydı yapılmamalıdır.` };
}
