import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,n) {
 if(s==='server-only') return {url:'data:text/javascript,export {};',shortCircuit:true};
 if(s.startsWith('@/')) return {url:new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};
 return n(s,c);
}});
const {createMusicProviderOAuth}=await import('../src/lib/server/music-provider-oauth.ts');
const origin='https://dashboard.example';
function setup(extra={}) {
 const sessions=new Map(); let config={enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh'};
 const service=createMusicProviderOAuth({origin, trustedDeployment:true, production:true, now:()=>1000000,
 getConfig:()=>config,saveConfig:(_,value)=>{config={...config,...value};},
 putSession:(s)=>sessions.set(s.state,s),consumeSession:(state,binding,provider,now)=>{const s=sessions.get(state); if(!s||s.binding!==binding||s.provider!==provider||s.expiresAt<=now)return null;sessions.delete(state);return s;},
 fetch:async()=>{throw Error('must not call transport');},...extra});
 return {service,sessions,config:()=>config};
}
const startReq=(headers={})=>new Request(origin+'/api/settings/music/youtube/oauth/start',{method:'POST',headers:{Origin:origin,...headers}});
test('Meta denies wrong app, Page tokens and incomplete Audio API permissions before discovery',async()=>{
 for(const invalid of [{app_id:'other'},{type:'PAGE'},{scopes:['instagram_basic','pages_show_list']},{is_valid:false}]) {
  const {service,config}=setup({fetch:async(u)=>u.includes('debug_token')?Response.json({data:{is_valid:true,app_id:'client',type:'USER',expires_at:6000,scopes:['instagram_basic','pages_show_list','instagram_content_publish'],...invalid}}):Response.json({access_token:'user',expires_in:3600})});
  const b=await begin(service,'instagram');const r=await service.callback(callbackReq(b.state,b.cookie),'instagram');assert.match(r.headers.get('location'),/musicOAuth=error/);assert.equal(config().accessToken,undefined);
 }
});
test('unsafe configured origins fail closed regardless of forwarded headers',async()=>{
 for(const unsafe of ['http://public.example','https://dashboard.example/path','https://user:pass@dashboard.example',''])assert.equal((await setup({origin:unsafe}).service.start(startReq({'x-forwarded-host':'dashboard.example'}),'youtube')).status,503);
});
test('real SQLite routes persist encrypted state, consume atomically and bind admin session through callback',()=>{
 const dir=mkdtempSync(tmpdir()+'/music-oauth-');const root=new URL('../src/',import.meta.url).href;
 const script=`import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
 registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {};',shortCircuit:true};if(s.startsWith('@/'))return {url:${JSON.stringify(root)}+s.slice(2)+'.ts',shortCircuit:true};return n(s,c);}});
 process.env.MUSIC_SETTINGS_ADMIN_TOKEN='fixture-admin';process.env.MUSIC_SETTINGS_TRUSTED_ORIGIN='https://dashboard.example';process.env.APP_ENCRYPTION_KEY='fixture-key';
 const security=await import('@/lib/server/music-provider-security');const config=await import('@/lib/server/music-provider-config');const {getDatabase}=await import('@/lib/server/database');
 config.saveMusicProviderStoredConfig('youtube',{enabled:true,clientId:'fixture-client',clientSecret:'fixture-secret'});
 const admin=security.createMusicSettingsAdminSession('fixture-admin').split(';')[0];const ctx={params:Promise.resolve({provider:'youtube'})};
 const start=await import(${JSON.stringify(root)}+'app/api/settings/music/[provider]/oauth/start/route.ts');const callback=await import(${JSON.stringify(root)}+'app/api/settings/music/[provider]/oauth/callback/route.ts');
 const req=new Request('https://dashboard.example/api/settings/music/youtube/oauth/start',{method:'POST',headers:{Origin:'https://dashboard.example',Cookie:admin}});const r=await start.POST(req,ctx);assert.equal(r.status,200);const auth=new URL((await r.json()).authorizationUrl);const state=auth.searchParams.get('state');const binding=r.headers.get('set-cookie').split(';')[0];
 const row=getDatabase().prepare('SELECT * FROM music_oauth_sessions').get();assert.ok(!row.encrypted_payload.includes('fixture-client'));assert.notEqual(row.state,state);
 let calls=0;globalThis.fetch=async(u)=>{calls++;return Response.json(String(u).includes('userinfo')?{sub:'google-fixture',email:'account@example.test'}:{access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'});};
 const cb=new Request(auth.searchParams.get('redirect_uri')+'?state='+state+'&code=fixture',{headers:{Cookie:admin+'; '+binding}});const result=await callback.GET(cb,ctx);assert.match(result.headers.get('location'),/musicOAuth=connected/);assert.equal(calls,2);assert.equal(getDatabase().prepare('SELECT count(*) n FROM music_oauth_sessions').get().n,0);
 await callback.GET(cb,ctx);assert.equal(calls,2);const stored=config.getMusicProviderStoredConfig('youtube');assert.equal(stored.accessToken,'fixture-access');assert.equal(stored.refreshToken,'fixture-refresh');assert.equal(stored.userId,'google-fixture');assert.ok(!JSON.stringify(config.getMusicProviderPublicConfig('youtube')).includes('fixture-access'));config.disconnectMusicProvider('youtube');const cleared=config.getMusicProviderStoredConfig('youtube');assert.equal(cleared.userId,'');assert.equal(cleared.refreshToken,'');assert.equal(cleared.accessToken,'');
 `;
 try{execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:dir,stdio:'pipe'});}finally{rmSync(dir,{recursive:true,force:true});}
});
test('actual OAuth routes reject anonymous requests and expose POST-only start',async()=>{
 const start=await import('../src/app/api/settings/music/[provider]/oauth/start/route.ts');const callback=await import('../src/app/api/settings/music/[provider]/oauth/callback/route.ts');const accounts=await import('../src/app/api/settings/music/[provider]/accounts/route.ts');
 const ctx={params:Promise.resolve({provider:'youtube'})};assert.equal(start.GET,undefined);assert.equal((await start.POST(startReq(),ctx)).status,401);assert.equal((await callback.GET(callbackReq('x',''),ctx)).status,401);assert.equal((await accounts.POST(startReq(),ctx)).status,401);
});
test('expired sessions, cancelled consent and provider errors redact secrets and cannot be replayed',async()=>{
 const {service,sessions}=setup({fetch:async()=>{throw Error('secret-token secret-client');}});
 const b=await begin(service);let r=await service.callback(callbackReq(b.state,b.cookie),'youtube');assert.match(r.headers.get('location'),/musicOAuth=error/);assert.ok(!r.headers.get('location').includes('secret'));assert.equal(sessions.size,0);
 const c=await begin(service);sessions.get(c.state).expiresAt=0;r=await service.callback(callbackReq(c.state,c.cookie),'youtube');assert.match(r.headers.get('location'),/musicOAuth=error/);
 const a=await begin(service);r=await service.callback(callbackReq(a.state,a.cookie,'&error=access_denied'),'youtube');assert.match(r.headers.get('location'),/musicOAuth=error/);assert.equal(sessions.has(a.state),false);
});
test('OAuth session binds the administrator identity and requires current admin authentication',async()=>{
 let admin='first',authorized=true;
 const {service}=setup({authorize:()=>{if(!authorized)throw Error('unauthorized');},getAdminBinding:()=>admin,fetch:async()=>Response.json({access_token:'token',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly'})});
 const b=await begin(service);admin='second';assert.match((await service.callback(callbackReq(b.state,b.cookie),'youtube')).headers.get('location'),/musicOAuth=error/);
 authorized=false;assert.equal((await service.start(startReq(),'youtube')).status,403);
});
test('Google revocation accepts the documented empty successful response',async()=>{
 let cleared=false;const {service}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'refresh'}),clearConfig:()=>{cleared=true;},fetch:async(u,init)=>{assert.equal(u,'https://oauth2.googleapis.com/revoke');assert.equal(init.body.get('token'),'refresh');return new Response(null,{status:200});}});
 assert.deepEqual(await service.disconnect('youtube'),{revoked:true,localCleared:true});assert.ok(cleared);
});
test('expired Google access refreshes and Meta expiry requires reconnect without fake refresh',async()=>{
 const calls=[];const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',accessToken:'expired',refreshToken:'refresh',expiresAt:new Date(0).toISOString()}),fetch:async(u,init)=>{calls.push(init);return Response.json({access_token:'fresh',expires_in:3600});}});
 assert.equal(await service.getAccessToken('youtube'),'fresh');assert.equal(calls[0].body.get('grant_type'),'refresh_token');assert.equal(config().refreshToken,'refresh');
 await assert.rejects(service.getAccessToken('instagram'),/reconnect/i);assert.equal(calls.length,1);
});
test('disconnect clears local credentials even when remote revoke fails',async()=>{
 let cleared=false;const {service}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',accessToken:'user-token',refreshToken:'refresh'}),clearConfig:()=>{cleared=true;},fetch:async()=>Response.json({error:{message:'secret'}},{status:400})});
 assert.deepEqual(await service.disconnect('instagram'),{revoked:false,localCleared:true});assert.ok(cleared);
});
test('start binds random single-use state to secure browser cookie with Google PKCE and static callback',async()=>{
 const {service,sessions}=setup();const r=await service.start(startReq({'x-forwarded-host':'evil.example'}),'youtube');assert.equal(r.status,200);
 const u=new URL((await r.json()).authorizationUrl);assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('redirect_uri'),origin+'/api/settings/music/youtube/oauth/callback');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('access_type'),'offline');assert.equal(u.searchParams.get('scope'),'https://www.googleapis.com/auth/youtube.readonly openid email');
 assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Secure/);assert.equal(sessions.size,1);assert.ok(sessions.get(u.searchParams.get('state')).verifier.length>=43);
});
const callbackReq=(state,cookie,extra='')=>new Request(origin+'/api/settings/music/youtube/oauth/callback?state='+state+'&code=fixture'+extra,{headers:{cookie}});
async function begin(service,p='youtube') {const r=await service.start(startReq(),p); const u=new URL((await r.json()).authorizationUrl);return {state:u.searchParams.get('state'),cookie:r.headers.get('set-cookie').split(';')[0]};}
test('Google callback rejects browser mismatch, exchanges PKCE once, preserves refresh and redirects only to settings',async()=>{
 const calls=[];const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh',userId:'google-owner'}),fetch:async(u,init)=>{calls.push([u,init]);return Response.json(String(u).includes('userinfo')?{sub:'google-owner',email:'owner@example.test'}:{access_token:'access',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'});}});
 const b=await begin(service);assert.match((await service.callback(callbackReq(b.state,'music_oauth_youtube=wrong'),'youtube')).headers.get('location'),/musicOAuth=error/);assert.equal(calls.length,0);
 const r=await service.callback(callbackReq(b.state,b.cookie,'&returnTo=https://evil.example'),'youtube');assert.equal(r.status,303);assert.equal(r.headers.get('location'),origin+'/settings?tab=api&musicOAuth=connected&provider=youtube');assert.equal(config().refreshToken,'old-refresh');assert.equal(config().accountName,'owner@example.test');assert.equal(config().expiresAt,new Date(4600000).toISOString());assert.ok(calls[0][1].body.get('code_verifier'));
 await service.callback(callbackReq(b.state,b.cookie),'youtube');assert.equal(calls.length,2);
});
test('Google callback drops another subject refresh token when no new refresh token is issued',async()=>{
 const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh',userId:'google-old'}),fetch:async(u)=>Response.json(String(u).includes('userinfo')?{sub:'google-new',email:'owner@example.test'}:{access_token:'new-access',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'})});
 const b=await begin(service);const r=await service.callback(callbackReq(b.state,b.cookie),'youtube');
 assert.match(r.headers.get('location'),/musicOAuth=connected/);assert.equal(config().refreshToken,'');assert.equal(config().userId,'google-new');assert.equal(config().accessToken,'new-access');
});
test('Google callback preserves refresh only for the same verified subject without a new refresh token',async()=>{
 const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh',userId:'google-owner'}),fetch:async(u)=>Response.json(String(u).includes('userinfo')?{sub:'google-owner',email:'changed-email@example.test'}:{access_token:'new-access',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'})});
 const b=await begin(service);const r=await service.callback(callbackReq(b.state,b.cookie),'youtube');
 assert.match(r.headers.get('location'),/musicOAuth=connected/);assert.equal(config().refreshToken,'old-refresh');assert.equal(config().userId,'google-owner');assert.equal(config().accountName,'changed-email@example.test');
});
test('Google callback cannot preserve an unbound legacy refresh token',async()=>{
 for(const userId of [undefined,'']) {
  const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh',userId}),fetch:async(u)=>Response.json(String(u).includes('userinfo')?{sub:'google-owner'}:{access_token:'new-access',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'})});
  const b=await begin(service);const r=await service.callback(callbackReq(b.state,b.cookie),'youtube');
  assert.match(r.headers.get('location'),/musicOAuth=connected/);assert.equal(config().refreshToken,'');assert.equal(config().userId,'google-owner');
 }
});
test('Google callback binds a newly issued refresh token to a changed subject',async()=>{
 const {service,config}=setup({getConfig:()=>({enabled:true,clientId:'client',clientSecret:'secret',refreshToken:'old-refresh',userId:'google-old'}),fetch:async(u)=>Response.json(String(u).includes('userinfo')?{sub:'google-new'}:{access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'})});
 const b=await begin(service);const r=await service.callback(callbackReq(b.state,b.cookie),'youtube');
 assert.match(r.headers.get('location'),/musicOAuth=connected/);assert.equal(config().refreshToken,'new-refresh');assert.equal(config().userId,'google-new');
});
test('Google callback fails closed without a valid userinfo subject even with a new refresh token',async()=>{
 for(const sub of [undefined,null,'','   ',123,{}]) {
  const previous={enabled:true,clientId:'client',clientSecret:'secret',accessToken:'old-access',refreshToken:'old-refresh',userId:'google-old'};let writes=0;
  const {service,sessions}=setup({getConfig:()=>previous,saveConfig:()=>{writes++;},fetch:async(u)=>Response.json(String(u).includes('userinfo')?{sub,email:'owner@example.test'}:{access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.readonly openid email'})});
  const b=await begin(service);const r=await service.callback(callbackReq(b.state,b.cookie),'youtube');
  assert.match(r.headers.get('location'),/musicOAuth=error/);assert.equal(writes,0);assert.equal(sessions.size,0);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 }
});
test('start fails closed for untrusted deployment, missing origin, cross origin, GET and spoofed proxy',async()=>{
 for(const req of [new Request(origin,{method:'GET'}),startReq({Origin:'https://evil.example'}),new Request(origin,{method:'POST'}),startReq({'sec-fetch-site':'cross-site'})])assert.equal((await setup().service.start(req,'youtube')).status,403);
 assert.equal((await setup({trustedDeployment:false}).service.start(startReq(),'youtube')).status,403);
});
test('Meta exchanges long-lived USER token, validates app/scopes, discovers server verified professional accounts and rejects invented selection',async()=>{
 const calls=[];
 const {service,config}=setup({fetch:async(u,init)=>{
  calls.push([new URL(u),init]);
  if(u.includes('/oauth/access_token'))return Response.json({access_token:init.body?.get('grant_type')==='fb_exchange_token'?'long-user':'short-user',expires_in:3600});
  if(u.includes('/debug_token'))return Response.json({data:{is_valid:true,app_id:'client',type:'USER',expires_at:6000,data_access_expires_at:5000,scopes:['pages_show_list','instagram_basic','instagram_content_publish']}});
  return Response.json({data:[{id:'10',name:'Page',access_token:'never-page-token',instagram_business_account:{id:'20',username:'creator'}}]});
 }});
 const b=await begin(service,'instagram');const r=await service.callback(callbackReq(b.state,b.cookie),'instagram');assert.match(r.headers.get('location'),/musicOAuth=select-account/);
 assert.equal(config().accessToken,'long-user');assert.equal(config().expiresAt,new Date(4600000).toISOString());assert.equal(config().userId,'');assert.deepEqual(config().accountChoices,[{pageId:'10',userId:'20',accountName:'creator'}]);
 const bad=new Request(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({userId:'999'})});assert.equal((await service.selectAccount(bad,'instagram')).status,400);
 const good=new Request(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({userId:'20',accountName:'forged'})});assert.equal((await service.selectAccount(good,'instagram')).status,200);assert.equal(config().userId,'20');assert.equal(config().accountName,'creator');
 assert.equal(calls.at(-1)[1].headers.Authorization,'Bearer long-user');assert.ok(calls.at(-1)[0].searchParams.get('appsecret_proof'));assert.ok(!JSON.stringify(config()).includes('never-page-token'));
});
