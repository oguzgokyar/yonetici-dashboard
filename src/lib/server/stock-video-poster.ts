import crypto from "node:crypto";
import sharp from "sharp";

export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
export type PosterVideo = {
  id: string;
  project_id: string;
  drive_file_id: string;
  thumbnail_url?: string | null;
  updated_at: string;
};
type PosterDependencies = {
  findVideo: (projectId: string, id: string) => Promise<PosterVideo | undefined>;
  getAccessToken: (projectId: string) => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  ttlMs?: number;
  maxEntries?: number;
};
type Poster = { bytes: Buffer; mime: string; expires: number; etag: string; fallback: boolean };
const FALLBACK = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#18202b"/><path d="M142 52v48l42-24z" fill="#94a3b8"/><text x="160" y="140" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#94a3b8">Poster unavailable</text></svg>');

// Only Google-owned thumbnail hosts; never follow redirects or send OAuth to these hosts.
export function validatePosterUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !(url.hostname === "drive.google.com" || url.hostname === "lh3.google.com" || /^lh\d+\.googleusercontent\.com$/.test(url.hostname))) {
    throw new Error("Unapproved poster URL");
  }
  return url;
}

async function readBounded(response: Response, limit: number, signal: AbortSignal): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > limit || !response.body) {
    await response.body?.cancel();
    throw new Error("Poster size limit");
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Poster size limit");
      chunks.push(Buffer.from(value));
    }
    signal.throwIfAborted();
    if (!size) throw new Error("Empty poster");
    return Buffer.concat(chunks, size);
  } finally {
    signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {});
  }
}

/** Memory-only 5 minute LRU, bounded to 128 entries/8 MiB, with at most 8 jobs. */
export function createStockVideoPoster(deps: PosterDependencies) {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const ttl = Math.min(Math.max(deps.ttlMs ?? 300_000, 1), 300_000);
  const maxEntries = Math.min(Math.max(deps.maxEntries ?? 128, 1), 128);
  const cache = new Map<string, Poster>();
  const pending = new Map<string, Promise<Poster>>();
  const makePoster = (key: string, bytes: Buffer, fallback: boolean): Poster => ({
    bytes, fallback, mime: fallback ? "image/svg+xml" : "image/webp",
    expires: now() + (fallback ? Math.min(ttl, 30_000) : ttl),
    etag: `"${crypto.createHash("sha256").update(key).update(bytes).digest("hex")}"`,
  });
  const remember = (key: string, poster: Poster) => {
    cache.set(key, poster);
    let size = 0;
    for (const [id, entry] of cache) {
      if (entry.expires <= now()) cache.delete(id);
      else size += entry.bytes.length;
    }
    while (cache.size > maxEntries || size > 8 * 1024 * 1024) {
      const oldest = cache.keys().next().value!;
      size -= cache.get(oldest)!.bytes.length;
      cache.delete(oldest);
    }
  };
  const generate = async (video: PosterVideo, key: string): Promise<Poster> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Poster timed out")); }, Math.min(Math.max(deps.timeoutMs ?? 8000, 1), 8000));
    });
    const work = async () => {
      const token = await deps.getAccessToken(video.project_id);
      controller.signal.throwIfAborted();
      for (let attempt = 0; attempt < 2; attempt++) {
        const metadata = await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(video.drive_file_id)}?fields=thumbnailLink`, {
          headers: { Authorization: `Bearer ${token}` }, redirect: "manual", signal: controller.signal, cache: "no-store",
        });
        if (!metadata.ok) { await metadata.body?.cancel(); throw new Error("Drive metadata unavailable"); }
        const data = JSON.parse((await readBounded(metadata, 64 * 1024, controller.signal)).toString("utf8")) as { thumbnailLink?: string };
        if (!data.thumbnailLink) throw new Error("No Drive thumbnail");
        const response = await fetcher(validatePosterUrl(data.thumbnailLink).href, { redirect: "manual", signal: controller.signal, cache: "no-store" });
        if (!response.ok || response.status !== 200) {
          await response.body?.cancel();
          if (attempt === 0 && [401, 403, 404, 410].includes(response.status)) continue;
          throw new Error("Poster unavailable");
        }
        if (!/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get("content-type") ?? "")) {
          await response.body?.cancel(); throw new Error("Not a poster image");
        }
        const input = await readBounded(response, MAX_POSTER_BYTES, controller.signal);
        const bytes = await sharp(input, { limitInputPixels: 16_000_000, animated: false })
          .rotate().resize(320, 180, { fit: "inside", withoutEnlargement: true }).webp({ quality: 72, effort: 2 }).toBuffer();
        controller.signal.throwIfAborted();
        return makePoster(key, bytes, false);
      }
      throw new Error("Poster unavailable");
    };
    try { return await Promise.race([work(), deadline]); }
    catch { return makePoster(key, FALLBACK, true); }
    finally { clearTimeout(timer); controller.abort(); }
  };
  return async (request: Request, projectId: string, id: string): Promise<Response> => {
    // Scope lookup precedes cache access, including conditional HTTP responses.
    const video = await deps.findVideo(projectId, id);
    if (!video || video.project_id !== projectId) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const key = JSON.stringify([projectId, video.id, video.drive_file_id, video.updated_at, "poster-v1"]);
    let poster = cache.get(key);
    if (poster && poster.expires > now()) { cache.delete(key); cache.set(key, poster); }
    else {
      cache.delete(key);
      let job = pending.get(key);
      if (!job && pending.size < 8) {
        job = generate(video, key).then(result => { remember(key, result); return result; }).finally(() => pending.delete(key));
        pending.set(key, job);
      }
      poster = job ? await job : makePoster(key, FALLBACK, true);
    }
    const headers = {
      "Content-Type": poster.mime,
      "Cache-Control": `private, max-age=${Math.max(0, Math.floor((poster.expires - now()) / 1000))}, must-revalidate`,
      "ETag": poster.etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (request.headers.get("if-none-match")?.split(",").some(value => value.trim() === poster.etag || value.trim() === `W/${poster.etag}` || value.trim() === "*")) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(poster.bytes), { headers });
  };
}
