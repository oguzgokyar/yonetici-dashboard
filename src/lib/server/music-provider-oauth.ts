import "server-only";
import { randomBytes, createHash, createHmac } from "node:crypto";

type Provider = "youtube" | "instagram";
type Account = { userId: string; pageId?: string; accountName: string };
type Config = { enabled: boolean; clientId: string; clientSecret: string; accessToken?: string; refreshToken?: string; expiresAt?: string; accountName?: string; userId?: string; accountChoices?: Account[]; permissions?: string[] };
type Session = { state: string; binding: string; provider: Provider; verifier: string; redirectUri: string; expiresAt: number; clientId: string; adminBinding: string };
type Dependencies = {
 origin: string; trustedDeployment: boolean; production?: boolean; now?: () => number;
 getConfig: (p: Provider) => Config; saveConfig: (p: Provider, c: Partial<Config>) => unknown;
 putSession: (s: Session) => void; consumeSession: (state: string, binding: string, p: Provider, now: number) => Session | null;
 authorize?: (r: Request) => void; getAdminBinding?: (r: Request) => string; fetch?: typeof fetch; clearConfig?: (p: Provider) => unknown;
};
const scopes = { youtube: "https://www.googleapis.com/auth/youtube.readonly openid email", instagram: "pages_show_list,instagram_basic,instagram_content_publish" };
const cookieName = (p: Provider) => `music_oauth_${p}`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export function createMusicProviderOAuth(d: Dependencies) {
 const now = d.now ?? Date.now;
 const transport = d.fetch ?? fetch;
 const canonical = () => { const u = new URL(d.origin); if(u.origin !== d.origin || (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost","127.0.0.1"].includes(u.hostname) && !d.production))) throw Error("OAuth origin unavailable"); return u.origin; };
 const cookie = (p: Provider, value: string, age: number) => `${cookieName(p)}=${value}; Path=/api/settings/music/${p}/oauth; Max-Age=${age}; HttpOnly; SameSite=Lax${d.production ? "; Secure" : ""}`;
 const authorized = (r: Request) => {try {d.authorize?.(r);return d.trustedDeployment;}catch{return false;}};
 const allowed = (r: Request) => authorized(r) && r.method === "POST" && r.headers.get("origin") === canonical() && !["cross-site","same-site"].includes(r.headers.get("sec-fetch-site") ?? "");
 const call = async (url: string, init: RequestInit = {}) => {
  try { const r=await transport(url,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)}); const data=await r.json();if(!r.ok || data.error) throw Error();return data; } catch { throw Error("Provider request failed; reconnect or check app permissions"); }
 };
 const token = async (url: string, values: Record<string,string>) => call(url,{method:"POST",body:new URLSearchParams(values)});
 const expiry = (seconds: unknown) => {if(typeof seconds!=="number" || !Number.isFinite(seconds) || seconds<=0) throw Error("Invalid token expiry");return new Date(now()+seconds*1000).toISOString();};
 return {
 async getAccessToken(p: Provider) {
  const c=d.getConfig(p);if(!c.enabled)throw Error("Music provider disabled");
  if(c.accessToken && (!c.expiresAt || Date.parse(c.expiresAt)>now()+60000))return c.accessToken;
  if(p!=="youtube" || !c.refreshToken || !c.clientId || !c.clientSecret)throw Error("Token expired; reconnect required");
  const data=await token("https://oauth2.googleapis.com/token",{grant_type:"refresh_token",refresh_token:c.refreshToken,client_id:c.clientId,client_secret:c.clientSecret});
  if(typeof data.access_token!=="string" || !data.access_token)throw Error("Token refresh failed; reconnect required");
  d.saveConfig(p,{accessToken:data.access_token,refreshToken:data.refresh_token || c.refreshToken,expiresAt:expiry(data.expires_in)});return data.access_token as string;
 },
 async disconnect(p: Provider) {
  const c=d.getConfig(p);let revoked=false;
  try {
   if(p==="youtube" && (c.refreshToken||c.accessToken)) {const response=await transport("https://oauth2.googleapis.com/revoke",{method:"POST",body:new URLSearchParams({token:c.refreshToken||c.accessToken||""}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});revoked=response.ok;}
   else if(p==="instagram" && c.accessToken) {const url=new URL("https://graph.facebook.com/v26.0/me/permissions");url.searchParams.set("appsecret_proof",createHmac("sha256",c.clientSecret).update(c.accessToken).digest("hex"));const result=await call(url.href,{method:"DELETE",headers:{Authorization:`Bearer ${c.accessToken}`}});revoked=result.success===true;}
  }catch{ /* Revocation failure never prevents local disconnect. */ }
  if(!d.clearConfig)throw Error("Local credential clearing unavailable");d.clearConfig(p);return {revoked,localCleared:true};
 },
 async selectAccount(r: Request,p: Provider) {
  try {if(!allowed(r))return json({error:"Music settings access denied"},403);if(p!=="instagram")return json({error:"Account selection unavailable"},400);
   const body=await r.json();const config=d.getConfig(p);const account=config.accountChoices?.find(a=>a.userId===body.userId);if(!account || !config.accessToken || !config.expiresAt || Date.parse(config.expiresAt)<=now())return json({error:"Select a verified, valid account"},400);
   d.saveConfig(p,{userId:account.userId,accountName:account.accountName});return json({userId:account.userId,accountName:account.accountName});
  }catch{return json({error:"Account selection failed"},400);}
 },
 async callback(r: Request,p: Provider) {
  let result="error";
  try {
   if(!authorized(r)) throw Error();
   const u=new URL(r.url);const binding=r.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(cookieName(p)+"="))?.slice(cookieName(p).length+1) ?? "";
   const state=u.searchParams.get("state") ?? "";
   const session=d.consumeSession(state,hash(binding),p,now());
   if(!session || session.adminBinding!==(d.getAdminBinding?.(r) ?? "") || !binding || session.redirectUri!==canonical()+`/api/settings/music/${p}/oauth/callback` || u.searchParams.has("error")) throw Error();
   const config=d.getConfig(p);if(config.clientId!==session.clientId || !config.clientSecret) throw Error();
   const code=u.searchParams.get("code");if(!code)throw Error();
   if(p === "youtube") {
    const data=await token("https://oauth2.googleapis.com/token",{client_id:config.clientId,client_secret:config.clientSecret,grant_type:"authorization_code",code,redirect_uri:session.redirectUri,code_verifier:session.verifier});
    if(typeof data.access_token!=="string" || !data.access_token || !String(data.scope ?? "").split(" ").includes("https://www.googleapis.com/auth/youtube.readonly"))throw Error();
    const profile=await call("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${data.access_token}`}});
    if(typeof profile.sub!=="string" || !profile.sub.trim())throw Error();
    d.saveConfig(p,{accessToken:data.access_token,refreshToken:data.refresh_token || (config.userId && config.userId===profile.sub ? config.refreshToken : "") || "",expiresAt:expiry(data.expires_in),userId:profile.sub,accountName:typeof profile.email==="string"?profile.email:"Google account"});
    result="connected";
   } else {
    const endpoint="https://graph.facebook.com/v26.0/oauth/access_token";
    const short=await token(endpoint,{client_id:config.clientId,client_secret:config.clientSecret,code,redirect_uri:session.redirectUri});
    if(typeof short.access_token!=="string")throw Error();
    const long=await token(endpoint,{grant_type:"fb_exchange_token",client_id:config.clientId,client_secret:config.clientSecret,fb_exchange_token:short.access_token});
    if(typeof long.access_token!=="string" || !long.access_token)throw Error();
    const debugUrl=new URL("https://graph.facebook.com/v26.0/debug_token");debugUrl.searchParams.set("input_token",long.access_token);
    const debug=(await call(debugUrl.href,{headers:{Authorization:`Bearer ${config.clientId}|${config.clientSecret}`}})).data;
    if(!debug?.is_valid || debug.app_id!==config.clientId || debug.type!=="USER" || !scopes.instagram.split(",").every(s=>debug.scopes?.includes(s)))throw Error();
    const deadlines=[Date.parse(expiry(long.expires_in)),Number(debug.expires_at)*1000,Number(debug.data_access_expires_at)*1000].filter(v=>Number.isFinite(v)&&v>0);
    const expiresAt=Math.min(...deadlines);if(expiresAt<=now())throw Error();
    const accounts:Account[]=[];let after="";
    for(let page=0;page<100;page++) {
     const url=new URL("https://graph.facebook.com/v26.0/me/accounts");url.search=new URLSearchParams({fields:"id,name,instagram_business_account{id,username}",limit:"100",appsecret_proof:createHmac("sha256",config.clientSecret).update(long.access_token).digest("hex"),...(after?{after}:{})}).toString();
     const response=await call(url.href,{headers:{Authorization:`Bearer ${long.access_token}`}});if(!Array.isArray(response.data))throw Error();
     for(const account of response.data) {const ig=account?.instagram_business_account;if(/^\d+$/.test(String(ig?.id ?? ""))&&/^\d+$/.test(String(account.id ?? ""))&&!accounts.some(a=>a.userId===ig.id))accounts.push({pageId:String(account.id),userId:String(ig.id),accountName:String(ig.username || account.name || ig.id).slice(0,200)});}
     if(!response.paging?.next)break;
     const cursor=response.paging?.cursors?.after;if(typeof cursor!=="string"||!cursor||cursor===after||page===99)throw Error();after=cursor;
    }
    if(!accounts.length)throw Error();
    d.saveConfig(p,{accessToken:long.access_token,refreshToken:"",expiresAt:new Date(expiresAt).toISOString(),userId:"",accountName:"",accountChoices:accounts,permissions:debug.scopes});result="select-account";
   }
  } catch { /* Provider messages and request URLs never leave the server. */ }
  try { return new Response(null,{status:303,headers:{Location:canonical()+`/settings?tab=api&musicOAuth=${result}&provider=${p}`,"Set-Cookie":cookie(p,"",0),"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}}); } catch { return json({error:"OAuth configuration unavailable"},503); }
 },
 async start(r: Request, p: Provider) {
  try {
   if(!allowed(r)) return json({error:"Music settings access denied"},403);
   const config=d.getConfig(p); if(!config.clientId || !config.clientSecret) return json({error:"OAuth client configuration required"},400);
   const state=randomBytes(32).toString("base64url"), binding=randomBytes(32).toString("base64url"), verifier=randomBytes(48).toString("base64url");
   const redirectUri=canonical()+`/api/settings/music/${p}/oauth/callback`;
   d.putSession({state,binding:hash(binding),provider:p,verifier,redirectUri,expiresAt:now()+600000,clientId:config.clientId,adminBinding:d.getAdminBinding?.(r) ?? ""});
   const u=new URL(p === "youtube" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://www.facebook.com/v26.0/dialog/oauth");
   u.search=new URLSearchParams({client_id:config.clientId,redirect_uri:redirectUri,state,response_type:"code",scope:scopes[p]}).toString();
   if(p === "youtube") { u.searchParams.set("access_type","offline");u.searchParams.set("prompt","consent");u.searchParams.set("code_challenge",createHash("sha256").update(verifier).digest("base64url"));u.searchParams.set("code_challenge_method","S256"); }
   const response=json({authorizationUrl:u.href});response.headers.set("Set-Cookie",cookie(p,binding,600));return response;
  } catch { return json({error:"OAuth configuration unavailable"},503); }
 },
 };
}

export async function getMusicProviderOAuth() {
 const [{getDatabase},{encryptSecret,decryptSecret},config,security]=await Promise.all([
  import("@/lib/server/database"),import("@/lib/server/secrets"),import("@/lib/server/music-provider-config"),import("@/lib/server/music-provider-security"),
 ]);
 const db=getDatabase();
 return createMusicProviderOAuth({
  origin:process.env.MUSIC_OAUTH_ORIGIN || process.env.MUSIC_SETTINGS_TRUSTED_ORIGIN || "",
  trustedDeployment:true,production:process.env.NODE_ENV==="production",
  authorize:security.requireMusicSettingsAdmin,
  getAdminBinding:(r)=>hash(r.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("music_settings_admin=")) ?? ""),
  getConfig:config.getMusicProviderStoredConfig,
  saveConfig:config.saveMusicProviderStoredConfig,
  clearConfig:config.disconnectMusicProvider,
  putSession(s) {db.prepare("DELETE FROM music_oauth_sessions WHERE expires_at <= ?").run(Date.now());db.prepare("INSERT INTO music_oauth_sessions(state,binding,provider,encrypted_payload,expires_at) VALUES(?,?,?,?,?)").run(hash(s.state),s.binding,s.provider,encryptSecret(JSON.stringify(s)),s.expiresAt);},
  consumeSession(state,binding,p,now) {
   const row=db.prepare("DELETE FROM music_oauth_sessions WHERE state=? AND binding=? AND provider=? AND expires_at>? RETURNING encrypted_payload").get(hash(state),binding,p,now) as {encrypted_payload:string}|undefined;
   if(!row)return null;try{return JSON.parse(decryptSecret(row.encrypted_payload)) as Session;}catch{return null;}
  },
 });
}
export async function getMusicProviderAccessToken(provider: Provider) {return (await getMusicProviderOAuth()).getAccessToken(provider);}
export async function disconnectMusicProvider(provider: Provider) {return (await getMusicProviderOAuth()).disconnect(provider);}
