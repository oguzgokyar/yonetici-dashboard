import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){if(s==='server-only')return{url:'data:text/javascript,export {};',shortCircuit:true};return n(s,c);}});
const security=await import('../src/lib/server/music-provider-security.ts');
test('admin access fails closed and signed session cannot be tampered',()=>{
 process.env.MUSIC_SETTINGS_ADMIN_TOKEN='synthetic-admin-token';
 const req=new Request('https://dashboard.example/api/settings/music/auth',{headers:{Origin:'https://dashboard.example'}});
 assert.throws(()=>security.requireMusicSettingsAdmin(req));
 const cookie=security.createMusicSettingsAdminSession('synthetic-admin-token');
 assert.ok(cookie.includes('HttpOnly'));
 security.requireMusicSettingsAdmin(new Request(req.url,{headers:{Cookie:cookie.split(';')[0]}}));
 assert.throws(()=>security.requireMusicSettingsAdmin(new Request(req.url,{headers:{Cookie:cookie.split(';')[0]+'x'}})));
 assert.throws(()=>security.createMusicSettingsAdminSession('wrong'));
});
test('origin guard rejects missing origin, cross-site metadata and forwarded host spoofing',()=>{
 const request=(headers)=>new Request('https://dashboard.example/api/settings/music/youtube',{headers});
 assert.throws(()=>security.assertMusicSettingsSameOrigin(request({})));
 assert.throws(()=>security.assertMusicSettingsSameOrigin(request({Origin:'https://evil.example','X-Forwarded-Host':'evil.example'})));
 assert.throws(()=>security.assertMusicSettingsSameOrigin(request({Origin:'https://dashboard.example','Sec-Fetch-Site':'cross-site'})));
 security.assertMusicSettingsSameOrigin(request({Origin:'https://dashboard.example','Sec-Fetch-Site':'same-origin'}));
});

test('unlock limiter bounds attempts',()=>{
 const req=new Request('https://dashboard.example/api/settings/music/auth');
 for(let i=0;i<5;i++) security.checkMusicSettingsUnlockRateLimit(req);
 assert.throws(()=>security.checkMusicSettingsUnlockRateLimit(req),e=>e.statusCode===429);
});
