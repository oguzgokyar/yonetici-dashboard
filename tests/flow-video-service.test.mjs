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
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    brand_json TEXT NOT NULL,
    brand_concept_json TEXT NOT NULL DEFAULT '{}'
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

globalThis.__flowTestDb = db;
process.env.APP_ENCRYPTION_KEY = 'flow-test-super-secret-key-32-chars!!';
process.env.FLOW_MOCK = 'true';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    }
    if (specifier === '@/lib/server/database') {
      return {
        url: 'data:text/javascript,export const getDatabase = () => globalThis.__flowTestDb;',
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

const flowService = await import('../src/lib/server/flow-video-service.ts');

test('Flow config save and retrieval encrypts key and stores settings', () => {
  flowService.saveFlowConfig({
    enabled: true,
    baseUrl: 'https://api.useapi.net/v1/google-flow',
    apiKey: 'synthetic-flow-token-12345',
    defaultModel: 'veo-3.1-quality',
  });

  const row = db.prepare('SELECT * FROM integration_configs WHERE service = ?').get('flow');
  assert.ok(row, 'Integration config row for flow must exist');
  assert.match(row.encrypted_api_key, /^v1\./, 'Key must be encrypted with v1 prefix');
  assert.doesNotMatch(JSON.stringify(row), /synthetic-flow-token-12345/, 'Raw secret must never be in DB');

  const config = flowService.getFlowConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.apiKey, 'synthetic-flow-token-12345');
  assert.equal(config.hasApiKey, true);
  assert.equal(config.defaultModel, 'veo-3.1-quality');
  assert.equal(config.baseUrl, 'https://api.useapi.net/v1/google-flow');
  assert.match(config.maskedKey, /syn••••••••2345/);
});

test('createFlowVideoJob inserts job into generation_jobs with flow-video type', async () => {
  const job = await flowService.createFlowVideoJob({
    projectId: 'proj_test_1',
    prompt: 'A golden retriever running on a sunny beach, 4k cinematic',
    model: 'veo-3.1-fast',
    aspectRatio: '9:16',
    durationSeconds: 6,
  });

  assert.ok(job.id);
  assert.equal(job.projectId, 'proj_test_1');
  assert.equal(job.status, 'running');
  assert.equal(job.model, 'veo-3.1-fast');
  assert.equal(job.aspectRatio, '9:16');
  assert.equal(job.durationSeconds, 6);

  const row = db.prepare('SELECT * FROM generation_jobs WHERE id = ?').get(job.id);
  assert.ok(row);
  assert.equal(row.type, 'flow-video');
  assert.equal(row.provider, 'flow-rest');
  assert.equal(row.status, 'running');
  assert.equal(row.prompt, 'A golden retriever running on a sunny beach, 4k cinematic');

  const req = JSON.parse(row.request_json);
  assert.equal(req.model, 'veo-3.1-fast');
  assert.equal(req.aspectRatio, '9:16');
  assert.equal(req.durationSeconds, 6);
});

test('listFlowVideos lists jobs and deleteFlowVideo cleans up database', async () => {
  const list = await flowService.listFlowVideos('proj_test_1');
  assert.equal(list.length, 1);
  assert.equal(list[0].prompt, 'A golden retriever running on a sunny beach, 4k cinematic');

  const deleted = flowService.deleteFlowVideo(list[0].id, 'proj_test_1');
  assert.equal(deleted, true);

  const listAfter = await flowService.listFlowVideos('proj_test_1');
  assert.equal(listAfter.length, 0);
});
