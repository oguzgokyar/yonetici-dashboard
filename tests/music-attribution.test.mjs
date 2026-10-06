import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const load = () => import('../src/lib/music-attribution.ts');

async function routeHarness() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE generation_jobs (id TEXT, project_id TEXT, type TEXT, status TEXT, response_json TEXT);
    CREATE TABLE project_social_accounts (project_id TEXT, integration_id TEXT, identifier TEXT);
    CREATE TABLE content_posts (id TEXT, project_id TEXT, title TEXT, content_type TEXT, media_url TEXT, local_path TEXT DEFAULT '', caption TEXT, hashtags TEXT, status TEXT, schedule_type TEXT, scheduled_at TEXT, integration_id TEXT, post_type TEXT, postiz_post_id TEXT, postiz_media_id TEXT, media_package_id TEXT, media_json TEXT, error_message TEXT, created_at TEXT, updated_at TEXT);`);
  db.prepare('INSERT INTO generation_jobs VALUES (?, ?, ?, ?, ?)').run(videoId, 'project', 'video', 'complete', JSON.stringify({ metadata: { music: { attribution: credit } } }));
  db.prepare('INSERT INTO project_social_accounts VALUES (?, ?, ?)').run('project', 'youtube-account', 'youtube');
  const outgoing = [];
  const state = { failPublishing: false };
  const mocks = {
    'node:crypto': crypto, 'node:path': path,
    'node:fs': { existsSync: p => p.includes('video-renders'), readFileSync: () => Buffer.from('mock video bytes') },
    '@/lib/server/database': { getDatabase: () => db },
    '@/lib/music-attribution': await load(),
    '@/lib/server/canva-package-service': { resolvePackageItemsForPublishing: () => assert.fail('not a package') },
    '@/lib/server/postiz-client': {
      uploadMediaToPostiz: async () => ({ id: 'uploaded', path: 'https://postiz.test/uploaded.mp4' }),
      createPostizPost: async params => { outgoing.push(params); if (state.failPublishing) throw new Error('Mock publisher failure'); return [{ postId: 'remote' }]; },
      deletePostizPost: async () => true,
    },
  };
  const source = fs.readFileSync(new URL('../src/app/api/projects/[projectId]/posts/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => mocks[name] ?? require(name), routeModule, routeModule.exports);
  return { db, outgoing, state, ...routeModule.exports };
}
const context = { params: Promise.resolve({ projectId: 'project' }) };
const request = (method, body) => new Request('https://app.test/posts', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const credit = '"Ascension" by Scott Buckley — CC BY 4.0\nhttps://www.scottbuckley.com.au/library/ascension/';
const videoId = '12345678-1234-1234-1234-123456789abc';

test('POST target overrides persist authoritative credit and send it in the YouTube description', async () => {
  const h = await routeHarness();
  try {
    const response = await h.POST(request('POST', { contentType: 'video', mediaUrl: `/api/videos/${videoId}`, caption: 'Base', attribution: 'FORGED', targets: [{ integrationId: 'youtube-account', caption: 'Override', hashtags: 'decor', scheduleType: 'draft' }, { integrationId: 'second-account', caption: '' }] }), context);
    assert.equal(response.status, 200);
    const rows = h.db.prepare('SELECT caption, local_path FROM content_posts ORDER BY rowid').all();
    assert.equal(rows[0].caption, `Override\n\n${credit}`);
    assert.equal(rows[1].caption, credit);
    assert.equal(h.outgoing[0].caption, `Override\n\n${credit}\n\n#decor`);
    assert.equal(h.outgoing[1].caption, credit);
    assert.equal(rows[0].local_path, `/api/videos/${videoId}`);
  } finally { h.db.close(); }
});

test('PATCH restores deleted credit from retained source and failed recovery sends it', async () => {
  const h = await routeHarness();
  try {
    await h.POST(request('POST', { assetId: videoId, contentType: 'video', integrationId: 'youtube-account', caption: 'Before' }), context);
    const id = h.db.prepare('SELECT id FROM content_posts').get().id;
    let response = await h.PATCH(request('PATCH', { id, caption: 'Edited without credit' }), context);
    assert.equal((await response.json()).post.caption, `Edited without credit\n\n${credit}`);
    assert.equal(h.db.prepare('SELECT caption FROM content_posts').get().caption, `Edited without credit\n\n${credit}`);
    h.db.prepare("UPDATE content_posts SET status='failed', postiz_post_id=NULL").run();
    response = await h.PATCH(request('PATCH', { id, caption: '', hashtags: 'home', status: 'scheduled', scheduleType: 'schedule' }), context);
    assert.equal(response.status, 200);
    assert.equal(h.outgoing.at(-1).caption, `${credit}\n\n#home`);
    assert.equal(h.db.prepare('SELECT caption FROM content_posts').get().caption, credit);
    response = await h.PATCH(request('PATCH', { id, caption: credit }), context);
    assert.equal((await response.json()).post.caption, credit);
  } finally { h.db.close(); }
});

test('failed publishing retains credit/source and PATCH recovery failures keep edited credit', async () => {
  const h = await routeHarness();
  try {
    h.state.failPublishing = true;
    // The harness toggles only the external publisher, not the actual route or SQLite.
    await h.POST(request('POST', { assetId: videoId, contentType: 'video', integrationId: 'youtube-account', caption: 'Before' }), context);
    const row = h.db.prepare('SELECT * FROM content_posts').get();
    assert.equal(row.status, 'failed');
    assert.equal(row.caption, `Before\n\n${credit}`);
    assert.equal(row.local_path, `/api/videos/${videoId}`);
    const response = await h.PATCH(request('PATCH', { id: row.id, caption: 'Recovery', status: 'scheduled' }), context);
    assert.equal(response.status, 500);
    assert.equal(h.db.prepare('SELECT caption FROM content_posts').get().caption, `Recovery\n\n${credit}`);
  } finally { h.db.close(); }
});

test('other-project and incomplete jobs cannot supply credit to a post', async () => {
  for (const update of ["UPDATE generation_jobs SET project_id='other'", "UPDATE generation_jobs SET status='rendering'", "UPDATE generation_jobs SET type='image'"]) {
    const h = await routeHarness();
    try {
      h.db.exec(update);
      await h.POST(request('POST', { assetId: videoId, contentType: 'video', integrationId: 'youtube-account', caption: 'Plain', attribution: credit }), context);
      assert.equal(h.db.prepare('SELECT caption FROM content_posts').get().caption, 'Plain');
      assert.equal(h.outgoing[0].caption, 'Plain');
    } finally { h.db.close(); }
  }
});

test('mandatory attribution is appended verbatim once, including blank or edited captions', async () => {
  const { appendMusicAttribution } = await load();
  assert.equal(appendMusicAttribution('My caption', credit), `My caption\n\n${credit}`);
  assert.equal(appendMusicAttribution('', credit), credit);
  assert.equal(appendMusicAttribution(`My caption\n\n${credit}`, credit), `My caption\n\n${credit}`);
  assert.equal(appendMusicAttribution('No music', ''), 'No music');
});

test('server resolver reads only completed video jobs scoped to the project, never client credits', async () => {
  const { resolveMusicAttribution } = await load();
  const calls = [];
  const database = { prepare(sql) { assert.match(sql, /project_id\s*=\s*\?/); assert.match(sql, /type\s*=\s*'video'/); assert.match(sql, /status\s*=\s*'complete'/); return { get(...args) { calls.push(args); return { response_json: JSON.stringify({ metadata: { music: { attribution: credit } } }) }; } }; } };
  for (const media of [{ assetId: videoId }, { mediaUrl: `/api/videos/${videoId}?download=1` }, { mediaUrl: `https://app.test/api/videos/${videoId}` }]) {
    assert.equal(resolveMusicAttribution(database, 'project', { ...media, attribution: 'FAKE' }), credit);
    assert.deepEqual(calls.at(-1), ['project', videoId]);
  }
  assert.equal(resolveMusicAttribution(database, 'project', { mediaUrl: 'https://external.test/clip.mp4', attribution: 'FAKE' }), '');
  assert.equal(calls.length, 3);
  for (const response_json of ['{bad', '{}', JSON.stringify({ metadata: { music: { attribution: 42 } } })]) {
    assert.equal(resolveMusicAttribution({ prepare: () => ({ get: () => ({ response_json }) }) }, 'project', { assetId: videoId }), '');
  }
  assert.equal(resolveMusicAttribution({ prepare: () => ({ get: () => undefined }) }, 'other-project', { assetId: videoId }), '');
});
