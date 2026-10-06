import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const load = () => import('../src/lib/server/stock-video-poster.ts');

test('route uses project/video SQL scope and list maps only to revisioned local posters', async () => {
  const { readFile } = await import('node:fs/promises');
  const ts = (await import('typescript')).default;
  const route = await readFile(new URL('../src/app/api/projects/[projectId]/stock-videos/[id]/poster/route.ts', import.meta.url), 'utf8');
  const list = await readFile(new URL('../src/app/api/projects/[projectId]/stock-videos/route.ts', import.meta.url), 'utf8');
  assert.match(list, /thumbnailUrl: `\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/stock-videos\/\$\{encodeURIComponent\(r.id\)\}\/poster\?v=\$\{encodeURIComponent\(r.updated_at\)\}`/);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE stock_videos (id TEXT, project_id TEXT, drive_file_id TEXT, updated_at TEXT); INSERT INTO stock_videos VALUES (\'video\', \'project\', \'drive\', \'revision-1\')');
  const { createStockVideoPoster } = await load();
  const png = await image();
  globalThis.__posterTest = { getDatabase: () => db, getValidAccessToken: async () => 'test', createStockVideoPoster: deps => createStockVideoPoster({ ...deps, fetch: async url => url.includes('www.googleapis.com') ? Response.json({ thumbnailLink: row.thumbnail_url }) : new Response(png, { headers: { 'content-type': 'image/png' } }) }) };
  try {
    const source = route.replace(/^import .*;$/gm, '') + '\n';
    const code = ts.transpileModule('const { getDatabase, getValidAccessToken, createStockVideoPoster } = globalThis.__posterTest;\n' + source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const { GET } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const run = (projectId, id) => GET(new Request('https://app.test/poster'), { params: Promise.resolve({ projectId, id }) });
    assert.equal((await run('other', 'video')).status, 404);
    assert.equal((await run('project', 'missing')).status, 404);
    const response = await run('project', 'video');
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 320);
  } finally { db.close(); delete globalThis.__posterTest; }
});
const row = { id: 'video', project_id: 'project', drive_file_id: 'drive', thumbnail_url: 'https://lh3.googleusercontent.com/old', updated_at: 'revision-1' };
const image = () => sharp({ create: { width: 800, height: 450, channels: 3, background: '#ff0000' } }).png().toBuffer();

test('scoped endpoint returns real small WebP from fresh authorized Drive metadata', async () => {
  const { createStockVideoPoster } = await load();
  const calls = [];
  const png = await image();
  const get = createStockVideoPoster({
    findVideo: async (project, id) => { assert.equal(project, 'project'); assert.equal(id, 'video'); return row; },
    getAccessToken: async project => { assert.equal(project, 'project'); return 'test-token'; },
    fetch: async (url, options) => {
      calls.push([url, options]);
      if (url.includes('www.googleapis.com')) return Response.json({ thumbnailLink: 'https://lh3.googleusercontent.com/fresh' });
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    },
  });
  const response = await get(new Request('https://app.test/poster'), 'project', 'video');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.match(response.headers.get('cache-control'), /private/);
  const bytes = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 180);
  assert.ok(bytes.length < png.length);
  assert.match(calls[0][0], /files\/drive\?fields=thumbnailLink/);
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1][0], 'https://lh3.googleusercontent.com/fresh');
  assert.equal(calls[1][1].headers, undefined, 'never forward OAuth to image hosts');
});


test('missing or cross-project video is 404 before OAuth/network', async () => {
  const { createStockVideoPoster } = await load();
  for (const found of [undefined, { ...row, project_id: 'other' }]) {
    const get = createStockVideoPoster({ findVideo: async () => found, getAccessToken: async () => assert.fail('OAuth must not run'), fetch: async () => assert.fail('network must not run') });
    assert.equal((await get(new Request('https://app.test'), 'project', 'video')).status, 404);
  }
});

test('untrusted thumbnail URLs and redirects yield honest icon without fetching private hosts', async () => {
  const { createStockVideoPoster, validatePosterUrl } = await load();
  for (const url of ['http://lh3.googleusercontent.com/a', 'https://127.0.0.1/a', 'https://lh3.googleusercontent.com.evil.test/a', 'https://user:pass@lh3.googleusercontent.com/a', 'https://lh3.googleusercontent.com:8443/a', 'file:///etc/passwd']) assert.throws(() => validatePosterUrl(url));
  for (const url of ['https://lh3.googleusercontent.com/a', 'https://drive.google.com/thumbnail?id=test']) assert.equal(validatePosterUrl(url).protocol, 'https:');
  for (const thumbnailLink of ['https://127.0.0.1/a', 'https://lh3.googleusercontent.com/redirect']) {
    const get = createStockVideoPoster({ findVideo: async () => row, getAccessToken: async () => 'test', fetch: async (url, options) => {
      if (url.includes('www.googleapis.com')) return Response.json({ thumbnailLink });
      assert.equal(options.redirect, 'manual');
      assert.ok(!url.includes('127.0.0.1'));
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1' } });
    } });
    const response = await get(new Request('https://app.test'), 'project', 'video');
    assert.equal(response.headers.get('content-type'), 'image/svg+xml');
    assert.match(await response.text(), /Poster unavailable/);
  }
});

test('expired image link refreshes metadata once then caches and deduplicates by revision', async () => {
  const { createStockVideoPoster } = await load();
  let metadataCalls = 0, imageCalls = 0, revision = row.updated_at;
  const png = await image();
  const get = createStockVideoPoster({ findVideo: async () => ({ ...row, updated_at: revision }), getAccessToken: async () => 'test', fetch: async url => {
    if (url.includes('www.googleapis.com')) return Response.json({ thumbnailLink: `https://lh3.googleusercontent.com/${++metadataCalls}` });
    if (++imageCalls === 1) return new Response(null, { status: 403 });
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  } });
  const request = () => new Request('https://app.test/poster');
  const results = await Promise.all(Array.from({ length: 10 }, () => get(request(), 'project', 'video')));
  assert.equal(metadataCalls, 2);
  assert.equal(imageCalls, 2);
  assert.equal(results[0].headers.get('content-type'), 'image/webp');
  const etag = results[0].headers.get('etag');
  assert.ok(etag);
  assert.equal((await get(new Request('https://app.test', { headers: { 'if-none-match': etag } }), 'project', 'video')).status, 304);
  assert.equal(metadataCalls, 2);
  revision = 'revision-2';
  const updated = await get(request(), 'project', 'video');
  assert.notEqual(updated.headers.get('etag'), etag);
  assert.equal(metadataCalls, 3);
});

test('bounded memory LRU evicts oldest entries and expires cached results', async () => {
  const { createStockVideoPoster } = await load();
  let now = 0, calls = 0;
  const png = await image();
  const get = createStockVideoPoster({ maxEntries: 2, now: () => now, ttlMs: 100, findVideo: async (_project, id) => ({ ...row, id }), getAccessToken: async () => 'test', fetch: async url => {
    if (url.includes('www.googleapis.com')) { calls++; return Response.json({ thumbnailLink: row.thumbnail_url }); }
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  } });
  const run = id => get(new Request('https://app.test'), 'project', id);
  await run('a'); await run('b'); await run('a'); await run('c'); await run('b');
  assert.equal(calls, 4);
  now = 101; await run('b');
  assert.equal(calls, 5);
});

test('download byte limits and non-image input return icon', async () => {
  const { createStockVideoPoster, MAX_POSTER_BYTES } = await load();
  assert.equal(MAX_POSTER_BYTES, 2 * 1024 * 1024);
  for (const response of [
    () => new Response('x', { headers: { 'content-length': String(MAX_POSTER_BYTES + 1), 'content-type': 'image/png' } }),
    () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_POSTER_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close(); } }), { headers: { 'content-type': 'image/png' } }),
    () => new Response('not an image', { headers: { 'content-type': 'text/html' } }),
    () => new Response('not an image', { headers: { 'content-type': 'image/png' } }),
  ]) {
    const get = createStockVideoPoster({ findVideo: async () => row, getAccessToken: async () => 'test', fetch: async url => url.includes('www.googleapis.com') ? Response.json({ thumbnailLink: row.thumbnail_url }) : response() });
    assert.equal((await get(new Request('https://app.test'), 'project', 'video')).headers.get('content-type'), 'image/svg+xml');
  }
});

test('concurrent unique poster jobs are capped at eight with honest overload fallback', async () => {
  const { createStockVideoPoster } = await load();
  let calls = 0;
  const get = createStockVideoPoster({ timeoutMs: 30, findVideo: async (_project, id) => ({ ...row, id }), getAccessToken: async () => 'test', fetch: async () => { calls++; return new Promise(() => {}); } });
  const responses = await Promise.all(Array.from({ length: 24 }, (_, i) => get(new Request('https://app.test'), 'project', String(i))));
  assert.equal(calls, 8);
  assert.ok(responses.every(response => response.headers.get('content-type') === 'image/svg+xml'));
});

test('deadline bounds stalled OAuth, network headers and streamed bodies', async () => {
  const { createStockVideoPoster } = await load();
  for (const stage of ['oauth', 'headers', 'body']) {
    let signal;
    const get = createStockVideoPoster({ timeoutMs: 20, findVideo: async () => row, getAccessToken: async () => stage === 'oauth' ? new Promise(() => {}) : 'test', fetch: async (url, options) => {
      signal = options.signal;
      if (stage === 'headers') return new Promise(() => {});
      if (url.includes('www.googleapis.com')) return Response.json({ thumbnailLink: row.thumbnail_url });
      return new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'image/png' } });
    } });
    const response = await get(new Request('https://app.test'), 'project', 'video');
    assert.equal(response.headers.get('content-type'), 'image/svg+xml');
    if (signal) assert.equal(signal.aborted, true);
  }
});
