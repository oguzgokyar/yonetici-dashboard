import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const load = () => import('../src/lib/server/transient-music.ts');
const url = 'https://cdn.pixabay.com/audio/synthetic-test.mp3';
const bodyOf = (...chunks) => (async function* () { yield* chunks; })();

test('temporary download exists only during callback and returns callback result', async () => {
  const { createTransientMusic } = await load();
  let path;
  const run = createTransientMusic({ download: async () => ({ statusCode: 200, headers: {}, body: (async function* () { yield Buffer.from('synthetic test bytes, not provider data'); })() }) });
  assert.equal(await run(url, async localPath => {
    path = localPath;
    assert.match(await readFile(path, 'utf8'), /synthetic test bytes/);
    return 'rendered';
  }), 'rendered');
  await assert.rejects(access(path));
  await assert.rejects(access(new URL('.', `file://${path}`).pathname));
});

test('URL policy rejects unapproved hosts, credentials, ports and local/file inputs before network', async () => {
  const { validateMusicDownloadUrl, createTransientMusic } = await load();
  assert.equal(validateMusicDownloadUrl(url).hostname, 'cdn.pixabay.com');
  assert.equal(validateMusicDownloadUrl('https://www.scottbuckley.com.au/library/wp-content/uploads/test.mp3').hostname, 'www.scottbuckley.com.au');
  for (const bad of ['file:///etc/passwd', '/tmp/audio', 'http://cdn.pixabay.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://cdn.pixabay.com.evil.test/a', 'https://evilcdn.pixabay.com/a', 'https://cdninstagram.com/a', 'https://cdn.pixabay.com:8443/a', 'https://user:pass@cdn.pixabay.com/a', 'https://cdn.pixabay.com./a']) {
    assert.throws(() => validateMusicDownloadUrl(bad));
    let called = false;
    await assert.rejects(createTransientMusic({ download: async () => { called = true; throw Error('network'); } })(bad, async () => {}));
    assert.equal(called, false);
  }
});

test('private, local, mapped and special-use DNS addresses fail closed', async () => {
  const { isPublicMusicAddress } = await load();
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '192.0.2.1', '198.18.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', 'invalid']) assert.equal(isPublicMusicAddress(ip), false, ip);
  for (const ip of ['8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicMusicAddress(ip), true, ip);
});

test('redirects and non-200 responses never invoke rendering', async () => {
  const { createTransientMusic } = await load();
  for (const statusCode of [302, 307, 404, 500, 206]) {
    let rendered = false;
    await assert.rejects(createTransientMusic({ download: async () => ({ statusCode, headers: { location: 'http://127.0.0.1/' }, body: [] }) })(url, async () => { rendered = true; }));
    assert.equal(rendered, false);
  }
});

test('25 MiB limit is enforced from headers and streamed bytes; empty downloads rejected', async () => {
  const { createTransientMusic, MAX_MUSIC_BYTES } = await load();
  assert.equal(MAX_MUSIC_BYTES, 25 * 1024 * 1024);
  for (const response of [
    { headers: { 'content-length': String(MAX_MUSIC_BYTES + 1) }, body: [] },
    { headers: {}, body: bodyOf(Buffer.alloc(MAX_MUSIC_BYTES), Buffer.alloc(1)) },
    { headers: {}, body: bodyOf() },
  ]) await assert.rejects(createTransientMusic({ download: async () => ({ statusCode: 200, ...response }) })(url, async () => assert.fail('must not render')), /size limit|empty/);
});

test('deadline aborts stalled headers and stalled body without invoking callback', async () => {
  const { createTransientMusic, MUSIC_DOWNLOAD_TIMEOUT_MS } = await load();
  assert.equal(MUSIC_DOWNLOAD_TIMEOUT_MS, 30_000);
  for (const stallBody of [false, true]) {
    let signal;
    const run = createTransientMusic({ timeoutMs: 20, download: async (_url, s) => {
      signal = s;
      if (!stallBody) return await new Promise(() => {});
      return { statusCode: 200, headers: {}, body: { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } } };
    } });
    await assert.rejects(run(url, async () => assert.fail('must not render')), /timed out/i);
    assert.equal(signal.aborted, true);
  }
});

test('temporary files are removed when renderer throws', async () => {
  const { createTransientMusic } = await load();
  let path;
  await assert.rejects(createTransientMusic({ download: async () => ({ statusCode: 200, headers: {}, body: bodyOf(Buffer.from('synthetic')) }) })(url, async p => { path = p; throw Error('render failed'); }), /render failed/);
  await assert.rejects(access(path));
  await assert.rejects(access(new URL('.', `file://${path}`).pathname));
});

test('filter trims source offset, bounds duration and rejects invalid numbers', async () => {
  const { buildMusicFilter } = await load();
  assert.equal(buildMusicFilter({ inputIndex: 1, offsetSeconds: 0.75, durationSeconds: 2.5, volume: 0.4, fadeSeconds: 0.25 }), '[1:a]atrim=start=0.75,asetpts=PTS-STARTPTS,atrim=duration=2.5,volume=0.4,afade=t=in:st=0:d=0.25,afade=t=out:st=2.25:d=0.25[music]');
  for (const patch of [{ inputIndex: 0.5 }, { inputIndex: -1 }, { offsetSeconds: -1 }, { durationSeconds: 0 }, { volume: 2 }, { fadeSeconds: -1 }, { fadeSeconds: 2 }, { durationSeconds: Infinity }, { offsetSeconds: NaN }]) assert.throws(() => buildMusicFilter({ inputIndex: 1, offsetSeconds: 0, durationSeconds: 2, volume: 1, fadeSeconds: 0.1, ...patch }));
});

const ffmpeg = args => execFileSync('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { timeout: 30_000 });
const probe = path => JSON.parse(execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { encoding: 'utf8' }));
const pcm = path => ffmpeg(['-i', path, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1']);
function toneAmplitude(buffer, hz, start, duration = 0.1) {
  const begin = Math.round(start * 8000), count = Math.round(duration * 8000);
  let sine = 0, cosine = 0;
  for (let i = 0; i < count; i++) {
    const sample = buffer.readFloatLE((begin + i) * 4);
    sine += sample * Math.sin(2 * Math.PI * hz * i / 8000);
    cosine += sample * Math.cos(2 * Math.PI * hz * i / 8000);
  }
  return 2 * Math.hypot(sine, cosine) / count;
}
const syntheticAudio = path => ffmpeg(['-f', 'lavfi', '-i', 'aevalsrc=0.2*sin(2*PI*if(lt(t\\,0.5)\\,440\\,880)*t):s=8000:d=1', path]);

test('real FFmpeg loops synthetic audio, proves source offset and bounds duration', async () => {
  const { buildMusicFilter } = await load();
  const dir = await mkdtemp(join(tmpdir(), 'music-filter-test-'));
  try {
    const source = join(dir, 'synthetic.wav'), output = join(dir, 'out.wav');
    syntheticAudio(source);
    ffmpeg(['-stream_loop', '-1', '-i', source, '-filter_complex', buildMusicFilter({ inputIndex: 0, offsetSeconds: 0.75, durationSeconds: 2.5, volume: 0.5, fadeSeconds: 0 }), '-map', '[music]', output]);
    assert.ok(Math.abs(Number(probe(output).format.duration) - 2.5) < 0.01);
    const samples = pcm(output);
    assert.ok(toneAmplitude(samples, 880, 0.02) > 0.08, 'offset starts at later 880Hz source region');
    assert.ok(toneAmplitude(samples, 440, 0.02) < 0.01);
    assert.ok(toneAmplitude(samples, 880, 2.02) > 0.08, 'loop covers final output');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const hasAudio of [false, true]) test(`real second-pass mixing covers whole final video (original audio=${hasAudio})`, async () => {
  const { mixMusicIntoVideo } = await load();
  const dir = await mkdtemp(join(tmpdir(), 'music-mix-test-'));
  try {
    const videoPath = join(dir, 'synthetic.mp4'), musicPath = join(dir, 'synthetic.wav');
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=20:d=2.5', ...(hasAudio ? ['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=8000:duration=2.5'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(hasAudio ? ['-c:a', 'aac'] : []), videoPath]);
    syntheticAudio(musicPath);
    await mixMusicIntoVideo({ videoPath, musicPath, offsetSeconds: 0.75, musicVolume: 0.5, originalVolume: 0.25, outroIncluded: true });
    const info = probe(videoPath);
    assert.ok(Math.abs(Number(info.format.duration) - 2.5) < 0.05);
    assert.equal(info.streams.find(s => s.codec_type === 'audio').codec_name, 'aac');
    assert.ok(Math.abs(Number(info.streams.find(s => s.codec_type === 'audio').duration) - 2.5) < 0.05);
    const samples = pcm(videoPath);
    assert.ok(toneAmplitude(samples, 880, 0.1) > 0.025, 'offset is applied');
    assert.ok(toneAmplitude(samples, 440, 0.1) < 0.01);
    assert.ok(toneAmplitude(samples, 880, 2.1) > 0.06, 'music covers final/outro duration');
    if (hasAudio) assert.ok(toneAmplitude(samples, 220, 0.5) > 0.02, 'original gain preserved');
    assert.deepEqual((await readdir(dir)).sort(), ['synthetic.mp4', 'synthetic.wav']);
    const before = await readFile(videoPath);
    await assert.rejects(mixMusicIntoVideo({ videoPath, musicPath, offsetSeconds: 1.1, musicVolume: 0.5, originalVolume: 1, outroIncluded: false }), /offset/i);
    assert.deepEqual(await readFile(videoPath), before);
    assert.deepEqual((await readdir(dir)).sort(), ['synthetic.mp4', 'synthetic.wav']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('second-pass mixer rejects URLs and relative paths', async () => {
  const { mixMusicIntoVideo } = await load();
  for (const path of ['https://cdn.pixabay.com/a', 'relative.mp4', 'file:///tmp/a']) await assert.rejects(mixMusicIntoVideo({ videoPath: path, musicPath: '/tmp/a', offsetSeconds: 0, musicVolume: 0.5, originalVolume: 1, outroIncluded: false }));
});

test('download failures and aborts remove their temporary directories; exact limit succeeds', async () => {
  const { createTransientMusic, MAX_MUSIC_BYTES } = await load();
  const snapshot = async () => (await readdir(tmpdir())).filter(n => n.startsWith('transient-music-')).sort();
  const before = await snapshot();
  const failBody = async function* () { yield Buffer.from('partial synthetic'); throw Error('stream failed'); };
  const downloads = [
    async () => { throw Error('network failed'); },
    async () => ({ statusCode: 200, headers: {}, body: failBody() }),
    async () => ({ statusCode: 200, headers: {}, body: bodyOf(Buffer.alloc(MAX_MUSIC_BYTES), Buffer.alloc(1)) }),
    async () => ({ statusCode: 200, headers: {}, body: { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } } }),
  ];
  for (const download of downloads) {
    await assert.rejects(createTransientMusic({ download, timeoutMs: 100 })(url, async () => assert.fail('must not render')));
    assert.deepEqual(await snapshot(), before);
  }
  await createTransientMusic({ download: async () => ({ statusCode: 200, headers: {}, body: bodyOf(Buffer.alloc(MAX_MUSIC_BYTES)) }) })(url, async p => assert.equal((await readFile(p)).length, MAX_MUSIC_BYTES));
  assert.deepEqual(await snapshot(), before);
});

test('actual FFmpeg failure removes second-pass output and preserves original video', async () => {
  const { mixMusicIntoVideo } = await load();
  const dir = await mkdtemp(join(tmpdir(), 'music-mix-failure-test-'));
  try {
    // Valid MP4 contents with unsupported output extension force failure after mkdtemp.
    const videoPath = join(dir, 'synthetic.invalidcontainer'), musicPath = join(dir, 'synthetic.wav');
    ffmpeg(['-f', 'lavfi', '-i', 'color=s=64x64:d=0.5', '-c:v', 'libx264', '-f', 'mp4', videoPath]);
    syntheticAudio(musicPath);
    const before = await readFile(videoPath);
    await assert.rejects(mixMusicIntoVideo({ videoPath, musicPath, offsetSeconds: 0, musicVolume: 0.5, originalVolume: 1, outroIncluded: false }));
    assert.deepEqual(await readFile(videoPath), before);
    assert.deepEqual((await readdir(dir)).sort(), ['synthetic.invalidcontainer', 'synthetic.wav']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
