import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE integration_configs(service TEXT PRIMARY KEY, enabled INTEGER, base_url TEXT, encrypted_api_key TEXT, settings_json TEXT, updated_at TEXT)`);
globalThis.__musicConfigTestDb = db;
process.env.APP_ENCRYPTION_KEY = 'isolated-test-encryption-key';
registerHooks({ resolve(s, c, next) {
  if (s === 'server-only') return {url:'data:text/javascript,export {};',shortCircuit:true};
  if (s === '@/lib/server/database') return {url:'data:text/javascript,export const getDatabase = () => globalThis.__musicConfigTestDb;',shortCircuit:true};
  if (s === './licensed-music') return {url:new URL('../src/lib/server/licensed-music.ts',import.meta.url).href,shortCircuit:true};
  if (s.startsWith('@/')) return {url:new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,shortCircuit:true};
  return next(s,c);
}});
const config = await import('../src/lib/server/music-provider-config.ts');
test('provider secret bundle is encrypted and public configuration is safe', () => {
  config.saveMusicProviderStoredConfig('youtube',{enabled:true,apiKey:'synthetic-youtube-key',clientSecret:'synthetic-client-secret',regionCode:'US'});
  const row = db.prepare('SELECT * FROM integration_configs WHERE service = ?').get('music-youtube');
  assert.match(row.encrypted_api_key,/^v1\./);
  assert.doesNotMatch(JSON.stringify(row),/synthetic-youtube-key|synthetic-client-secret/);
  assert.equal(config.getMusicProviderStoredConfig('youtube').apiKey,'synthetic-youtube-key');
  const publicConfig = config.getMusicProviderPublicConfig('youtube');
  assert.equal(publicConfig.hasApiKey,true);
  assert.equal(publicConfig.regionCode,'US');
  assert.doesNotMatch(JSON.stringify(publicConfig),/synthetic-youtube-key|synthetic-client-secret/);
});

test('blank preserves and explicit lifecycle prevents environment resurrection', () => {
 process.env.INSTAGRAM_MUSIC_ACCESS_TOKEN='synthetic-env'; process.env.INSTAGRAM_MUSIC_USER_ID='42';
 assert.equal(config.getMusicProviderStoredConfig('instagram').source,'environment');
 config.saveMusicProviderStoredConfig('instagram',{accessToken:'synthetic-saved',userId:'123',enabled:true});
 config.saveMusicProviderStoredConfig('instagram',{accessToken:' '});
 assert.equal(config.getMusicProviderStoredConfig('instagram').accessToken,'synthetic-saved');
 config.disconnectMusicProvider('instagram');
 assert.equal(config.getMusicProviderStoredConfig('instagram').accessToken,'');
 config.removeMusicProvider('instagram');
 const removed=config.getMusicProviderStoredConfig('instagram');
 assert.equal(removed.enabled,false); assert.equal(removed.accessToken,''); assert.equal(removed.source,'database');
});

test('settings routes require admin session, same origin, validation and never return secrets',async()=>{
 process.env.MUSIC_SETTINGS_ADMIN_TOKEN='synthetic-admin';
 const sec=await import('../src/lib/server/music-provider-security.ts');
 const route=await import('../src/app/api/settings/music/[provider]/route.ts');
 const ctx={params:Promise.resolve({provider:'youtube'})};
 const url='https://dashboard.example/api/settings/music/youtube';
 assert.equal((await route.GET(new Request(url),ctx)).status,401);
 const headers={Cookie:sec.createMusicSettingsAdminSession('synthetic-admin').split(';')[0],Origin:'https://dashboard.example','Content-Type':'application/json'};
 const put=(body,h=headers)=>route.PUT(new Request(url,{method:'PUT',headers:h,body:JSON.stringify(body)}),ctx);
 assert.equal((await put({apiKey:'synthetic-route-key'})).status,200);
 assert.equal((await put({regionCode:'BAD'})).status,400);
 assert.equal((await put({baseUrl:'https://evil.example'})).status,400);
 assert.equal((await put({accountChoices:[]})).status,400);
 assert.equal((await put({enabled:false},{Cookie:headers.Cookie})).status,403);
 const response=await route.GET(new Request(url,{headers}),ctx);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.doesNotMatch(JSON.stringify(await response.json()),/synthetic-route-key/);
 const auth=await import('../src/app/api/settings/music/session/route.ts');
 assert.equal((await auth.GET(new Request(url))).status,200);
 const unlock=await auth.POST(new Request(url,{method:'POST',headers:{Origin:'https://dashboard.example'},body:JSON.stringify({token:'synthetic-admin'})}));
 assert.equal(unlock.status,200); assert.match(unlock.headers.get('Set-Cookie'),/HttpOnly/);
});

test('test endpoint requires authorized explicit same-origin action',async()=>{
 const sec=await import('../src/lib/server/music-provider-security.ts');
 const route=await import('../src/app/api/settings/music/[provider]/test/route.ts');
 const ctx={params:Promise.resolve({provider:'youtube'})};
 const url='https://dashboard.example/api/settings/music/youtube/test';
 assert.equal((await route.POST(new Request(url,{method:'POST'}),ctx)).status,401);
 const headers={Cookie:sec.createMusicSettingsAdminSession('synthetic-admin').split(';')[0],Origin:'https://dashboard.example'};
 config.saveMusicProviderStoredConfig('youtube',{enabled:false});
 const response=await route.POST(new Request(url,{method:'POST',headers}),ctx);
 assert.equal(response.status,200);assert.equal((await response.json()).code,'disabled');
});

test('explicit secret clear and corrupted bundle never fall back to environment',()=>{
 process.env.YOUTUBE_MUSIC_API_KEY='synthetic-environment-key';
 config.saveMusicProviderStoredConfig('youtube',{apiKey:'synthetic-key',enabled:false});
 config.saveMusicProviderStoredConfig('youtube',{clearFields:['apiKey']});
 assert.equal(config.getMusicProviderStoredConfig('youtube').apiKey,'');
 db.prepare('UPDATE integration_configs SET encrypted_api_key=? WHERE service=?').run('broken','music-youtube');
 assert.equal(config.getMusicProviderStoredConfig('youtube').apiKey,'');
});

test('session lock deletes scoped cookie and reports unconfigured setup safely',async()=>{
 const route=await import('../src/app/api/settings/music/session/route.ts');
 const request=new Request('https://dashboard.example/api/settings/music/session',{method:'DELETE',headers:{Origin:'https://dashboard.example'}});
 const response=await route.DELETE(request);
 assert.equal(response.status,200); assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await response.json()).authorized,false);
});
