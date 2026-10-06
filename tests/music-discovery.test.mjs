import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// The Next.js marker has no runtime behavior in this isolated backend test.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {};', shortCircuit: true };
  if (specifier === '@/lib/server/music-discovery') return { url: new URL('../src/lib/server/music-discovery.ts', import.meta.url).href, shortCircuit: true };
  if (specifier === '@/lib/server/database') return { url: 'data:text/javascript,export function getDatabase() { return { prepare() { return { get(id) { return id === "project-a" ? { id } : undefined; } }; } }; }', shortCircuit: true };
  if (specifier === '@/lib/server/music-provider-config') return {url:'data:text/javascript,export function getMusicProviderStoredConfig() {return {source: "none",enabled:false,regionCode:"TR",apiKey:""};}',shortCircuit:true};
  if (specifier === '@/lib/server/music-provider-oauth') return {url:'data:text/javascript,export async function getMusicProviderAccessToken() {return "";}',shortCircuit:true};
  if (specifier === './licensed-music') return { url: new URL('../src/lib/server/licensed-music.ts', import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { createMusicDiscovery } = await import('../src/lib/server/music-discovery.ts');

const setup = (overrides = {}) => createMusicDiscovery({
  projectExists: async (id) => id === 'project-a',
  getInstagramCredentials: () => null,
  getYouTubeKey: () => '',
  fetch: async () => { throw new Error('Unexpected network request'); },
  ...overrides,
  fetch: async (url, init) => {
    if (new URL(url).hostname.endsWith('scottbuckley.com.au')) throw new Error('External source unavailable in native-provider fixture');
    return overrides.fetch ? overrides.fetch(url, init) : Promise.reject(new Error('Unexpected network request'));
  },
});

test('missing Instagram configuration returns no invented music and names backend prerequisites', async () => {
  const result = await setup().searchMusic({ projectId: 'project-a', provider: 'instagram' });
  assert.equal(result.status, 'not-configured');
  assert.deepEqual(result.items, []);
  assert.match(result.message, /INSTAGRAM_MUSIC_ACCESS_TOKEN/);
  assert.match(result.message, /INSTAGRAM_MUSIC_USER_ID/);
  assert.match(result.message, /Facebook Login/);
});

test('unknown project rejects before credentials or provider network access', async () => {
  const service = setup({ getInstagramCredentials: () => { throw new Error('must not read credentials'); } });
  await assert.rejects(service.searchMusic({ projectId: 'other', provider: 'instagram' }), /Proje bulunamadı/);
});

test('official Instagram music and original_sound responses normalize fractional duration without granting rights', async () => {
  const calls = [];
  const service = setup({
    getInstagramCredentials: () => ({ accessToken: 'test-only-token', userId: '123' }),
    fetch: async (url, init) => {
      calls.push([new URL(url), init]);
      return Response.json({ audio: [{ audio_id: new URL(url).searchParams.get('audio_type') === 'music' ? '111' : '222', title: 'Parça', display_artist: 'Sanatçı', duration_in_ms: 153760, download_url: 'https://cdn.example/preview.mp3', is_ads_eligible: true }] });
    },
  });
  const result = await service.searchMusic({ projectId: 'project-a', provider: 'instagram', query: '  piyano  ' });
  assert.equal(result.status, 'ok');
  assert.equal(result.items.length, 2);
  assert.deepEqual(calls.map(([url]) => url.searchParams.get('audio_type')), ['music', 'original_sound']);
  for (const [url, init] of calls) {
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(url.pathname, '/v22.0/ig_audio');
    assert.equal(url.searchParams.get('user_id'), '123');
    assert.equal(url.searchParams.get('search_query'), 'piyano');
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(init.headers.Authorization, 'Bearer test-only-token');
    assert.equal(init.cache, 'no-store');
  }
  const item = result.items[0];
  assert.equal(item.durationSeconds, 153.76);
  assert.equal(item.provider, 'instagram');
  assert.equal(item.title, 'Parça');
  assert.equal(item.artist, 'Sanatçı');
  assert.equal(item.previewUrl, 'https://cdn.example/preview.mp3');
  assert.equal(item.canEmbed, false);
  assert.equal(item.isTrending, false);
  assert.match(item.embedReason, /MP4/);
  assert.equal('downloadUrl' in item, false);
});

test('omitted query is official trends; malformed records and unsafe preview URLs are never emitted', async () => {
  const service = setup({
    getInstagramCredentials: () => ({ accessToken: 'test-only-token', userId: '123' }),
    fetch: async (url) => {
      assert.equal(new URL(url).searchParams.has('search_query'), false);
      return Response.json({ audio: [null, { title: 'missing id' }, { audio_id: '333', ig_username: 'creator', duration_in_ms: -1, download_url: 'javascript:alert(1)', on_platform_audio_preview_link: 'https://evil.example/?access_token=oops' }] });
    },
  });
  const result = await service.searchMusic({ projectId: 'project-a', provider: 'instagram' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].isTrending, true);
  assert.equal(result.items[0].durationSeconds, null);
  assert.equal(result.items[0].artist, 'creator');
  assert.equal(result.items[0].previewUrl, undefined);
  assert.equal(result.items[0].sourceUrl, 'https://www.instagram.com/reels/audio/333/');
});

test('provider errors including HTTP 200 error envelopes never leak token-bearing messages', async () => {
  for (const fetch of [
    async () => Response.json({ error: { message: 'secret-provider-token' } }),
    async () => Response.json({ audio: [] }, { status: 403 }),
    async () => { throw new Error('secret-provider-token'); },
    async () => Response.json({ unexpected: [] }),
  ]) {
    const result = await setup({ getInstagramCredentials: () => ({ accessToken: 'test-only-token', userId: '123' }), fetch }).searchMusic({ projectId: 'project-a', provider: 'instagram' });
    assert.equal(result.status, 'error');
    assert.deepEqual(result.items, []);
    assert.doesNotMatch(result.message, /secret-provider-token/);
  }
});

test('YouTube key enables official music-video search without audio extraction or trend assertions', async () => {
  const input = { projectId: 'project-a', provider: 'youtube', query: 'piyano' };
  const absent = await setup().searchMusic(input);
  assert.equal(absent.status, 'not-configured');
  assert.match(absent.message, /YOUTUBE_MUSIC_API_KEY/);
  const configured = await setup({ getYouTubeKey: () => 'test-key', fetch: async (url) => {
    const u = new URL(url);
    assert.equal(u.origin, 'https://www.googleapis.com');
    assert.equal(u.searchParams.get('q'), 'piyano');
    assert.equal(u.searchParams.get('type'), 'video');
    assert.equal(u.searchParams.get('videoCategoryId'), '10');
    return Response.json({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'Piyano', channelTitle: 'Müzisyen' } }] });
  } }).searchMusic(input);
  assert.equal(configured.status, 'ok');
  assert.equal(configured.items[0].sourceUrl, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(configured.items[0].canEmbed, false);
  assert.equal(configured.items[0].isTrending, false);
  assert.equal(configured.items[0].previewUrl, undefined);
});

test('resolver rejects client-supplied CC BY, embed flags and download URL for both current providers', async () => {
  for (const provider of ['instagram', 'youtube']) {
    const selection = { offsetSeconds: 0, track: { provider, id: '333', title: 'Parça', artist: 'Sanatçı', durationSeconds: 10, sourceUrl: 'https://example.com', canEmbed: true, embedReason: 'CC BY', attribution: 'CC BY', isTrending: false, downloadUrl: 'https://example.com/music.mp3' } };
    await assert.rejects(setup().resolveEmbeddableMusic('project-a', selection), /doğrulanmış.*lisans/i);
    await assert.rejects(setup().resolveEmbeddableMusic('other', selection), /Proje bulunamadı/);
  }
});

test('invalid provider and oversize query are rejected before any provider access', async () => {
  await assert.rejects(setup().searchMusic({ projectId: 'project-a', provider: 'spotify' }), /sağlayıcı/);
  await assert.rejects(setup().searchMusic({ projectId: 'project-a', provider: 'instagram', query: 'a'.repeat(201) }), /200/);
});

test('HTTP search route returns project 404, invalid provider 400 and no-store results when external source unavailable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('External unavailable'); });
  const { GET } = await import('../src/app/api/projects/[projectId]/music/search/route.ts');
  const call = (id, provider) => GET(new Request(`https://dashboard.example/api/projects/${id}/music/search?provider=${provider}`), { params: Promise.resolve({ projectId: id }) });
  assert.equal((await call('other', 'instagram')).status, 404);
  assert.equal((await call('project-a', 'spotify')).status, 400);
  const response = await call('project-a', 'youtube');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body.items, []);
  assert.ok(['unsupported', 'not-configured'].includes(body.status));
});


test('async credentials, selected region and native status survive licensed fallback', async()=>{
 const result=await setup({getYouTubeKey:async()=> 'synthetic',getYouTubeRegion:()=> 'US',fetch:async url=>{assert.equal(new URL(url).searchParams.get('regionCode'),'US');return Response.json({items:[]});}}).searchMusic({projectId:'project-a',provider:'youtube'});
 assert.equal(result.nativeStatus,'empty');
});
test('explicit provider test distinguishes official errors without diagnostics or licensed fetches',async()=>{
 for(const [reason,code] of [['quotaExceeded','quota'],['keyInvalid','invalid-key'],['accessNotConfigured','permission']]){
 const service=setup({getYouTubeKey:()=> 'synthetic',fetch:async()=>Response.json({error:{message:'sensitive',errors:[{reason}]}},{status:403})});
 const result=await service.testConnection('youtube');
 assert.equal(result.code,code);assert.doesNotMatch(JSON.stringify(result),/sensitive/);
 }
});

test('disabled native provider never reads credentials or spends quota',async()=>{
 const service=setup({isEnabled:()=>false,getYouTubeKey:()=>{throw Error('must not read');}});
 assert.equal((await service.testConnection('youtube')).code,'disabled');
 assert.equal((await service.searchMusic({projectId:'project-a',provider:'youtube'})).nativeStatus,'not-configured');
});
test('credential refresh failure is redacted in search',async()=>{
 const result=await setup({getInstagramCredentials:async()=>{throw Error('secret-refresh');}}).searchMusic({projectId:'project-a',provider:'instagram'});
 assert.equal(result.nativeStatus,'error');assert.doesNotMatch(result.message,/secret-refresh/);
});
test('YouTube OAuth-only discovery uses bearer not token query parameters',async()=>{
 const service=setup({getYouTubeAccessToken:async()=> 'synthetic-oauth',fetch:async(url,init)=>{assert.equal(new URL(url).searchParams.has('key'),false);assert.equal(init.headers.Authorization,'Bearer synthetic-oauth');return Response.json({items:[]});}});
 assert.equal((await service.testConnection('youtube')).code,'ok');
});

test('expired stored token test requests reconnect without network',async()=>{
 const service=setup({getTokenExpiresAt:()=> '2000-01-01T00:00:00Z',getInstagramCredentials:()=>{throw Error('must not read expired token');}});
 assert.equal((await service.testConnection('instagram')).code,'expired');
});

test('expired Google token with failed refresh is distinguished from provider outage',async()=>{
 const service=setup({getTokenExpiresAt:()=> '2000-01-01T00:00:00Z',getYouTubeAccessToken:async()=>{throw Error('synthetic-refresh-failure');}});
 assert.equal((await service.testConnection('youtube')).code,'expired');
});
