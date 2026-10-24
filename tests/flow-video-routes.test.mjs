import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE IF NOT EXISTS integration_configs (
    service TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    base_url TEXT NOT NULL DEFAULT '',
    encrypted_api_key TEXT,
    settings_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_provider_configs (
    provider TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    base_url TEXT NOT NULL DEFAULT '',
    encrypted_api_key TEXT,
    text_model TEXT NOT NULL DEFAULT '',
    image_model TEXT NOT NULL DEFAULT '',
    vision_model TEXT NOT NULL DEFAULT '',
    edit_model TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    request_json TEXT NOT NULL DEFAULT '{}',
    response_json TEXT NOT NULL DEFAULT '{}',
    progress_json TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );
`);

globalThis.__flowRoutesTestDb = db;
process.env.APP_ENCRYPTION_KEY = 'flow-test-super-secret-key-32-chars!!';
process.env.FLOW_MOCK = 'true';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    }
    if (specifier === '@/lib/server/database') {
      return {
        url: 'data:text/javascript,export const getDatabase = () => globalThis.__flowRoutesTestDb;',
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('@/')) {
      return {
        url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
});

const flowVideosRoute = await import('../src/app/api/projects/[projectId]/flow-videos/route.ts');
const flowSettingsRoute = await import('../src/app/api/settings/flow-provider/route.ts');
const flowVideoItemRoute = await import('../src/app/api/projects/[projectId]/flow-videos/[id]/route.ts');

test('settings API GET and POST updates configuration without returning raw secret', async () => {
  // 1. Save config via POST
  const saveReq = new Request('https://example.com/api/settings/flow-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: 'https://api.useapi.net/v1/google-flow',
      apiKey: 'secret-flow-key-12345',
      defaultModel: 'veo-3.1-quality',
    }),
  });

  const saveRes = await flowSettingsRoute.POST(saveReq);
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.equal(saveData.ok, true);
  assert.equal(saveData.config.hasApiKey, true);
  assert.equal(saveData.config.defaultModel, 'veo-3.1-quality');
  assert.doesNotMatch(JSON.stringify(saveData), /secret-flow-key-12345/);

  // 2. Read back config via GET
  const getRes = await flowSettingsRoute.GET();
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.ok, true);
  assert.equal(getData.hasApiKey, true);
  assert.match(getData.maskedKey, /sec••••••••2345/);
});

test('flow-videos POST creates new job and GET returns list', async () => {
  const ctx = { params: Promise.resolve({ projectId: 'proj_beta' }) };

  // POST create job
  const postReq = new Request('https://example.com/api/projects/proj_beta/flow-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'A futuristic electric flying car gliding through neon city, 8k cinematic',
      model: 'veo-3.1-fast',
      aspectRatio: '9:16',
      durationSeconds: 8,
    }),
  });

  const postRes = await flowVideosRoute.POST(postReq, ctx);
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.ok, true);
  assert.ok(postData.job.id);
  assert.equal(postData.job.status, 'running');

  // GET list
  const getReq = new Request('https://example.com/api/projects/proj_beta/flow-videos');
  const getRes = await flowVideosRoute.GET(getReq, ctx);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.ok, true);
  assert.equal(getData.videos.length, 1);
  assert.equal(getData.videos[0].id, postData.job.id);

  // DELETE item
  const itemCtx = { params: Promise.resolve({ projectId: 'proj_beta', id: postData.job.id }) };
  const delReq = new Request(`https://example.com/api/projects/proj_beta/flow-videos/${postData.job.id}`, {
    method: 'DELETE',
  });
  const delRes = await flowVideoItemRoute.DELETE(delReq, itemCtx);
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.ok, true);

  // Verify deletion
  const getResAfter = await flowVideosRoute.GET(getReq, ctx);
  const getDataAfter = await getResAfter.json();
  assert.equal(getDataAfter.videos.length, 0);
});
