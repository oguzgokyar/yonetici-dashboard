import { mkdtemp, open, rm, lstat, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, extname, isAbsolute } from 'node:path';
import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const MAX_MUSIC_BYTES = 25 * 1024 * 1024;
export const MUSIC_DOWNLOAD_TIMEOUT_MS = 30_000;
// Transport allowlist, NOT a license assertion. Caller must re-resolve an approved track.
export const MUSIC_DOWNLOAD_HOSTS = Object.freeze(['cdn.pixabay.com', 'prod-1.storage.jamendo.com', 'www.scottbuckley.com.au', 'scottbuckley.com.au']);

export function validateMusicDownloadUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !MUSIC_DOWNLOAD_HOSTS.includes(url.hostname) || url.hash) {
    throw new Error('Music URL must be an approved HTTPS provider URL');
  }
  return url;
}

export function isPublicMusicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Only IPv6 global unicast; conservatively reject special-use 2001::/23 and 6to4.
  if (isIP(address) === 6) {
    const first = parseInt(address.split(':')[0], 16);
    const second = parseInt(address.split(':')[1] || '0', 16);
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
      !(first === 0x3fff && second <= 0x0fff);
  }
  return false;
}

type DownloadResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
};
type Download = (url: URL, signal: AbortSignal) => Promise<DownloadResponse>;

const downloadHttps: Download = (url, signal) => new Promise((resolve, reject) => {
  // Node HTTPS does not follow redirects. Custom lookup pins the checked DNS result
  // to the socket, retaining the original hostname for TLS certificate verification.
  const req = request(url, {
    signal,
    agent: false,
    lookup: (hostname, options, callback) => {
      lookup(hostname, { all: true, verbatim: true }).then(addresses => {
        if (!addresses.length || addresses.some(({ address }) => !isPublicMusicAddress(address))) {
          callback(new Error('Music provider DNS resolved to a non-public address'), '', 4);
          return;
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      }).catch(error => callback(error, '', 4));
    },
  }, response => {
    resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: response });
  });
  req.on('error', reject);
  req.end();
});

/** DI is for trusted tests only: injected transports must never follow redirects. */
export function createTransientMusic({ download = downloadHttps, timeoutMs = MUSIC_DOWNLOAD_TIMEOUT_MS }: { download?: Download; timeoutMs?: number } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MUSIC_DOWNLOAD_TIMEOUT_MS) throw new Error('Invalid download timeout');
  return async function withTransientMusic<T>(downloadUrl: string, callback: (localPath: string) => Promise<T>): Promise<T> {
    const url = validateMusicDownloadUrl(downloadUrl);
    const directory = await mkdtemp(join(tmpdir(), 'transient-music-'));
    const controller = new AbortController();
    const timeoutError = new Error('Music download timed out');
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(timeoutError); reject(timeoutError); }, timeoutMs);
    });
    const bounded = <V>(promise: Promise<V>): Promise<V> => Promise.race([promise, deadline]);
    try {
      const response = await bounded(download(url, controller.signal));
      if (response.statusCode !== 200) throw new Error(`Music download rejected HTTP ${response.statusCode} (redirects forbidden)`);
      const length = response.headers['content-length'];
      if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > MAX_MUSIC_BYTES)) throw new Error('Music download exceeds size limit or has invalid length');
      const path = join(directory, 'music.audio');
      const file = await open(path, 'wx', 0o600);
      try {
        let bytes = 0;
        const iterator = response.body[Symbol.asyncIterator]();
        while (true) {
          const item = await bounded(iterator.next());
          if (item.done) break;
          const chunk = item.value;
          bytes += chunk.byteLength;
          if (bytes > MAX_MUSIC_BYTES) throw new Error('Music download exceeds size limit');
          let offset = 0;
          while (offset < chunk.byteLength) {
            const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset);
            if (!bytesWritten) throw new Error('Music temporary file write failed');
            offset += bytesWritten;
          }
        }
        if (!bytes) throw new Error('Music download is empty');
      } finally {
        await file.close();
      }
      clearTimeout(timer!);
      return await callback(path);
    } finally {
      clearTimeout(timer!);
      controller.abort();
      await rm(directory, { recursive: true, force: true });
    }
  };
}

export const withTransientMusic = createTransientMusic();

type MusicFilterOptions = {
  inputIndex: number;
  offsetSeconds: number;
  durationSeconds: number;
  volume: number;
  fadeSeconds: number;
};

/** Requires -stream_loop -1 before the music input. Output label is [music]. */
export function buildMusicFilter({ inputIndex, offsetSeconds, durationSeconds, volume, fadeSeconds }: MusicFilterOptions): string {
  if (![inputIndex, offsetSeconds, durationSeconds, volume, fadeSeconds].every(Number.isFinite) ||
      !Number.isInteger(inputIndex) || inputIndex < 0 || offsetSeconds < 0 || durationSeconds <= 0 ||
      volume < 0 || volume > 1 || fadeSeconds < 0 || fadeSeconds > durationSeconds / 2) {
    throw new Error('Invalid music filter parameters');
  }
  const base = `[${inputIndex}:a]atrim=start=${offsetSeconds},asetpts=PTS-STARTPTS,atrim=duration=${durationSeconds},volume=${volume}`;
  const fades = fadeSeconds ? `,afade=t=in:st=0:d=${fadeSeconds},afade=t=out:st=${durationSeconds - fadeSeconds}:d=${fadeSeconds}` : '';
  return `${base}${fades}[music]`;
}

const execFileAsync = promisify(execFile);
type Probe = { format?: { duration?: string }; streams?: { codec_type?: string; duration?: string }[] };
async function probeMedia(path: string): Promise<Probe> {
  const { stdout } = await execFileAsync('/usr/bin/ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams', '-of', 'json', path], { timeout: 30_000, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout) as Probe;
}

export type MixMusicIntoVideoOptions = {
  videoPath: string;
  musicPath: string;
  offsetSeconds: number;
  musicVolume: number;
  originalVolume: number;
  outroIncluded: boolean;
};

/** Server-internal only: paths must come from the renderer and withTransientMusic,
 * never request input. Mixes the already assembled final video (including outro),
 * then atomically replaces videoPath. No separate outro-duration assumptions. */
export async function mixMusicIntoVideo({ videoPath, musicPath, offsetSeconds, musicVolume, originalVolume, outroIncluded }: MixMusicIntoVideoOptions): Promise<void> {
  for (const path of [videoPath, musicPath]) {
    if (!isAbsolute(path) || path.includes('\0') || !(await lstat(path)).isFile()) throw new Error('Mixer requires trusted absolute regular-file paths');
  }
  if (videoPath === musicPath || typeof outroIncluded !== 'boolean' ||
      !Number.isFinite(originalVolume) || originalVolume < 0 || originalVolume > 1) throw new Error('Invalid mixer parameters');
  // Validate numeric input before probing or running FFmpeg.
  buildMusicFilter({ inputIndex: 1, offsetSeconds, durationSeconds: 1, volume: musicVolume, fadeSeconds: 0 });
  const [video, music] = await Promise.all([probeMedia(videoPath), probeMedia(musicPath)]);
  const duration = Number(video.format?.duration);
  const musicDuration = Number(music.streams?.find(stream => stream.codec_type === 'audio')?.duration ?? music.format?.duration);
  if (!video.streams?.some(stream => stream.codec_type === 'video') || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid final video duration or missing video');
  if (!music.streams?.some(stream => stream.codec_type === 'audio') || !Number.isFinite(musicDuration) || musicDuration <= 0 || offsetSeconds >= musicDuration) throw new Error('Music offset must be within a valid audio source duration');
  const musicFilter = buildMusicFilter({ inputIndex: 1, offsetSeconds, durationSeconds: duration, volume: musicVolume, fadeSeconds: Math.min(0.2, duration / 2) });
  const hasAudio = video.streams.some(stream => stream.codec_type === 'audio');
  const filter = hasAudio ? `${musicFilter};[0:a]asetpts=PTS-STARTPTS,volume=${originalVolume}[original];[original][music]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[mixed]` : musicFilter;
  const directory = await mkdtemp(join(dirname(videoPath), '.music-mix-'));
  const output = join(directory, `mixed${extname(videoPath) || '.mp4'}`);
  try {
    await execFileAsync('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-i', videoPath,
      '-stream_loop', '-1', '-protocol_whitelist', 'file,pipe', '-i', musicPath,
      '-filter_complex', filter, '-map', '0:v:0', '-map', hasAudio ? '[mixed]' : '[music]',
      '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', output], { timeout: 10 * 60_000, maxBuffer: 1024 * 1024 });
    await rename(output, videoPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
