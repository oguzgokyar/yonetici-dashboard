import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const helperUrl = new URL('../src/lib/music-provider-form.ts', import.meta.url);
const uiUrl = new URL('../src/features/settings/music-provider-settings.tsx', import.meta.url);

test('API tab offers dedicated music cards without replacing AI providers', () => {
  assert.ok(existsSync(uiUrl), 'music settings UI exists');
  const ui = readFileSync(uiUrl, 'utf8');
  const tabs = readFileSync(new URL('../src/features/settings/settings-tabs.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<AiProviders\s*\/>/);
  assert.match(tabs, /<MusicProviderSettings\s*\/>/);
  assert.match(ui, /Müzik Kaynakları/);
  assert.match(ui, /"password"/);
  assert.match(ui, /autoComplete="off"/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|type="file"/);
  assert.match(ui, /disabled=\{busy/);
  assert.match(ui, /role="status"/);
});

test('music secrets are gated by an ephemeral administrator session', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  assert.match(ui, /\/api\/settings\/music\/session/);
  assert.match(ui, /authorized \?/);
  assert.match(ui, /Yönetici doğrulaması/);
  assert.match(ui, /setAdminToken\(""\)/);
});

test('connecting saves edited app settings before requesting user consent', async () => {
  const { connectMusicProvider } = await import(helperUrl.href);
  assert.equal(typeof connectMusicProvider, 'function');
  const calls = [];
  const url = await connectMusicProvider('youtube', {enabled:true,regionCode:'TR',clientId:'app',clientSecret:'secret',apiKey:'',accessToken:'',userId:''}, async (path, method, payload) => { calls.push({path,method,payload}); return path.endsWith('/start') ? {authorizationUrl:'https://accounts.google.com/consent'} : {}; });
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].payload.clientSecret, 'secret');
  assert.equal(calls[1].path, '/api/settings/music/youtube/oauth/start');
  assert.equal(url, 'https://accounts.google.com/consent');
});

test('cards expose explicit tested lifecycle actions and a matching callback guide', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  for (const text of ['Bağlantıyı test et', 'Yeniden bağla', 'Devre dışı bırak', 'Bağlantıyı kes', 'Tüm ayarları kaldır', 'Kurulum rehberi', '/oauth/callback', 'window.confirm', 'expiresAt', 'accountChoices']) assert.ok(ui.includes(text), text);
});

test('music cards stack at phone widths without fixed minimum overflow', () => {
  const cssUrl = new URL('../src/features/settings/music-provider-settings.css', import.meta.url);
  assert.ok(existsSync(cssUrl), 'responsive music card CSS exists');
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('failed app save never starts OAuth and untrusted authorization URLs are rejected', async () => {
  const { connectMusicProvider } = await import(helperUrl.href);
  const form = { enabled:true, regionCode:'TR', clientId:'app', clientSecret:'', apiKey:'', accessToken:'', userId:'' };
  let calls = 0;
  await assert.rejects(connectMusicProvider('youtube', form, async () => { calls++; throw Error('save failed'); }), /save failed/);
  assert.equal(calls, 1);
  await assert.rejects(connectMusicProvider('instagram', form, async (url) => url.endsWith('/start') ? {authorizationUrl:'https://attacker.example/login'} : {}), /Güvenli/);
});

test('callback setup prefers canonical server URI and exposes unlock smoke selector', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  assert.match(ui, /value\.redirectUri\s*\|\|/);
  assert.match(ui, /music-provider-unlock music-unlock/);
});

test('blank secrets preserve saved credentials while changed secrets are submitted', async () => {
  assert.ok(existsSync(helperUrl), 'music provider form helper exists');
  const { musicFormPayload } = await import(helperUrl.href);
  assert.deepEqual(musicFormPayload('youtube', { enabled:true, regionCode:'TR', clientId:'app', apiKey:'', clientSecret:'   ', accessToken:'', userId:'' }), { enabled:true, regionCode:'TR', clientId:'app' });
  assert.deepEqual(musicFormPayload('instagram', { enabled:false, regionCode:'TR', clientId:'meta', apiKey:'ignore', clientSecret:'new-secret', accessToken:'manual-token', userId:'123' }), { enabled:false, regionCode:'TR', clientId:'meta', clientSecret:'new-secret', accessToken:'manual-token', userId:'123' });
});
