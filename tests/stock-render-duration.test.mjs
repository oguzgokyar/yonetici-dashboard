import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const timing = async () => {
  const module = await import('../src/lib/stock-render-timing.ts').catch(() => ({}));
  assert.equal(typeof module.parseStockVideoProbe, 'function', 'finite JSON video duration parser must exist');
  return module;
};
test('probe prefers fractional video duration over longer container audio and rejects non-finite data', async () => {
  const { parseStockVideoProbe } = await timing();
  assert.deepEqual(parseStockVideoProbe({ streams: [{ codec_type: 'video', duration: '1.433333' }, { codec_type: 'audio', duration: '30' }], format: { duration: '30' } }), { durationSeconds: 1.433333, hasAudio: true });
  assert.equal(parseStockVideoProbe({ streams: [{ codec_type: 'video', duration: 'N/A' }], format: { duration: '0.733333' } }).durationSeconds, 0.733333);
  for (const value of ['Infinity', 'NaN', '0', '-1', undefined]) assert.throws(() => parseStockVideoProbe({ streams: [{ codec_type: 'video', duration: value }], format: { duration: value } }), /duration/i);
  assert.throws(() => parseStockVideoProbe({ streams: [{ codec_type: 'audio', duration: '4' }], format: { duration: '4' } }), /video/i);
});

async function loadRenderer(db, localPath) {
  const ts = (await import('typescript')).default;
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const require = createRequire(import.meta.url);
  const original = await readFile(new URL('../src/lib/server/stock-video-renderer.ts', import.meta.url), 'utf8');
  const helpers = { ...(await import('../src/lib/stock-timeline.ts')), ...(await import('../src/lib/stock-render-timing.ts')) };
  const concat = await import('../src/lib/server/stock-video-concat.ts').catch(() => ({}));
  globalThis.__durationTest = { ...helpers, ...concat, getDatabase: () => db, ensureCachedVideo: async () => ({ localPath }), resolveEmbeddableMusic: async () => assert.fail('no network'), withTransientMusic: () => assert.fail('no music'), mixMusicIntoVideo: () => assert.fail('no music') };
  const injected = 'const { getDatabase, ensureCachedVideo, resolveEmbeddableMusic, withTransientMusic, mixMusicIntoVideo, parseStockVideoProbe, getStockTimeline, buildStockTimeline, probeStockVideo, concatStockVideo } = globalThis.__durationTest;\n';
  const code = ts.transpileModule(injected + original.replace(/^import .*;$/gm, line => line.includes('"node:') ? line : '').replace('import("sharp")', `import(${JSON.stringify(pathToFileURL(require.resolve('sharp')).href)})`), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code + '\n//' + Math.random()).toString('base64')}`);
}

test('real renderer retains fractional frame-aware trim, one gained source audio, and actual short outro', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = await mkdtemp(path.join(tmpdir(), 'stock-render-'));
  const cwd = process.cwd();
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE stock_videos (id TEXT, project_id TEXT, name TEXT, drive_file_id TEXT, duration_seconds REAL, metadata_json TEXT);
    CREATE TABLE projects (id TEXT, brand_json TEXT);
    CREATE TABLE project_outro_videos (id TEXT, project_id TEXT, local_path TEXT);
    CREATE TABLE generation_jobs (id TEXT, project_id TEXT, type TEXT, provider TEXT, model TEXT, status TEXT, prompt TEXT, request_json TEXT, created_at TEXT, response_json TEXT, completed_at TEXT, error TEXT);`);
  try {
    const source = fixture(dir, 'source', 1.433333);
    db.prepare('INSERT INTO stock_videos VALUES (?, ?, ?, ?, ?, ?)').run('video', 'project', 'fixture', 'drive', 300, '{}');
    db.prepare('INSERT INTO projects VALUES (?, ?)').run('project', '{}');
    const { renderFramedStockVideo } = await loadRenderer(db, source);
    process.chdir(dir);
    for (const audio of [false, true]) {
      const outro = fixture(dir, `outro-${audio}`, 0.733333, audio);
      db.prepare('INSERT INTO project_outro_videos VALUES (?, ?, ?)').run(`outro-${audio}`, 'project', outro);
      const result = await renderFramedStockVideo({ projectId: 'project', stockVideoId: 'video', frameStyle: 'none', logoPosition: 'none', trimStartSeconds: 0.2, trimEndSeconds: 0.1, originalVolume: 0.25, outroId: `outro-${audio}` });
      const output = path.join(dir, '.data', 'video-renders', result.id + '.mp4');
      const data = probe(output);
      assert.equal(data.streams.filter(s => s.codec_type === 'audio').length, 1);
      const { getStockTimeline } = await import('../src/lib/stock-timeline.ts');
      const expectedTimeline = getStockTimeline({ sourceDurationSeconds: Number(probe(source).streams.find(s => s.codec_type === 'video').duration), trimStartSeconds: 0.2, trimEndSeconds: 0.1, hasOutro: true, outroDurationSeconds: Number(probe(outro).streams.find(s => s.codec_type === 'video').duration) });
      assert.ok(Math.abs(result.durationSeconds - expectedTimeline.durationInFrames / 30) <= 1 / 30, `actual duration ${result.durationSeconds}`);
      const expectedRms = rms(source, 0.3, 0.3) * 0.25;
      assert.ok(Math.abs(rms(output, 0.3, 0.3) / expectedRms - 1) < 0.12, 'source gain must be applied exactly once');
      if (audio) assert.ok(Math.abs(rms(output, 1.3, 0.3) / rms(outro, 0.2, 0.3) - 1) < 0.12, 'outro audio preserved at original gain');
      else assert.ok(rms(output, 1.3, 0.3) < 0.001, 'silent outro stays silent');
      assert.equal(db.prepare('SELECT duration_seconds FROM stock_videos').get().duration_seconds, 1.433333);
    }
    // No source audio: concatenate exactly one finite silence stream, not two maps.
    const silentSource = fixture(dir, 'silent-source', 0.733333, false);
    const silentRenderer = await loadRenderer(db, silentSource);
    const silentResult = await silentRenderer.renderFramedStockVideo({ projectId: 'project', stockVideoId: 'video', frameStyle: 'none', logoPosition: 'none', outroId: 'outro-false' });
    const silentOutput = path.join(dir, '.data', 'video-renders', silentResult.id + '.mp4');
    assert.equal(probe(silentOutput).streams.filter(s => s.codec_type === 'audio').length, 1);
    assert.ok(silentResult.durationSeconds < 1.5);
    assert.ok(rms(silentOutput, 0.1, 0.3) < 0.001);
    // A stale valid database duration must not rescue an actual ffprobe failure.
    db.prepare('UPDATE stock_videos SET duration_seconds = 300').run();
    const brokenRenderer = await loadRenderer(db, path.join(dir, 'does-not-exist.mp4'));
    await assert.rejects(() => brokenRenderer.renderFramedStockVideo({ projectId: 'project', stockVideoId: 'video', frameStyle: 'none' }), /ffprobe|No such file/i);
    assert.equal(db.prepare('SELECT duration_seconds FROM stock_videos').get().duration_seconds, 300);
  } finally { process.chdir(cwd); db.close(); delete globalThis.__durationTest; await rm(dir, { recursive: true, force: true }); }
});

export const fixture = (dir, name, duration, audio = true) => {
  const file = path.join(dir, name + '.mp4');
  execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=blue:s=90x160:r=30:d=${duration}`, ...(audio ? ['-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=44100:duration=${duration}`] : []), '-t', String(duration), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac'] : ['-an']), file]);
  return file;
};
const probe = file => JSON.parse(execFileSync('/usr/bin/ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file], { encoding: 'utf8' }));
const rms = (file, start, duration) => {
  const buffer = execFileSync('/usr/bin/ffmpeg', ['-v','error','-ss',String(start),'-i',file,'-t',String(duration),'-map','0:a:0','-ac','1','-ar','44100','-f','f32le','pipe:1']);
  let sum = 0; for (let i = 0; i < buffer.length; i += 4) sum += buffer.readFloatLE(i) ** 2;
  return Math.sqrt(sum / (buffer.length / 4));
};
