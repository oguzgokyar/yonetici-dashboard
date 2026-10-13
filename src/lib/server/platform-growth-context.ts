import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import type { GrowthContext, GrowthRequest, GrowthPlatform, GrowthEvidence } from '@/lib/strategy-types';
import { GROWTH_PLATFORMS } from '@/lib/strategy-types';
import { semanticHash } from './platform-growth-store';
type BrandRow = Record<string,string>;
type EvidenceRow = { platform:string;username:string;title:string;url:string;observed_at?:string };
const parse = (s:string|undefined,fallback:unknown) => {try{return JSON.parse(s||'') as typeof fallback;}catch{return fallback;}};
export function contextHash(context:GrowthContext) {return semanticHash(context);}
export function buildGrowthContext(brand:BrandRow|undefined,accounts:{identifier:string;name:string}[],request:Pick<GrowthRequest,'objective'|'capacity'>,rows:EvidenceRow[],scraperNote=''):GrowthContext {
 if(!brand?.brand_name?.trim() || !brand.brand_description?.trim()) throw new Error('400 Önce marka adı ve açıklamasını kaydedin');
 if(brand.brand_description.length>20000) throw new Error('400 Marka açıklaması çok uzun');
 const competitors=parse(brand.competitors_json,[]) as string[];const handles=new Set(competitors.map(x=>x.trim().replace(/^@/,'').toLowerCase()));
 const matches=rows.filter(r=>GROWTH_PLATFORMS.includes(r.platform as GrowthPlatform)&&handles.has(r.username.replace(/^@/,'').toLowerCase())&&validUrl(r.url,r.platform));
 const evidence:GrowthEvidence[]=matches.slice(0,30).map((r,i)=>({id:`e${i+1}`,sourceUrl:r.url,platform:r.platform as GrowthPlatform,account:r.username,matchType:'competitor_exact',observedAt:r.observed_at&&Number.isFinite(Date.parse(r.observed_at))?r.observed_at:null,title:r.title}));
 return {brandName:brand.brand_name,brandDescription:brand.brand_description,socialChannels:parse(brand.social_channels_json,[]) as string[],competitors,overview:{brandIdentity:parse(brand.brand_identity_json,{}),competitorAnalysis:parse(brand.competitor_analysis_json,{}),audienceVoc:parse(brand.audience_voc_json,{}),growthStrategy:parse(brand.growth_strategy_json,{})},accounts:accounts.map(a=>({identifier:a.identifier,name:a.name})).sort((a,b)=>a.identifier.localeCompare(b.identifier)),evidence,missingData:['Analytics erişimi yok; KPI baseline bilinmiyor',...(evidence.length?[]:['Eşleşen rakip kanıtı yok']),...(scraperNote?[scraperNote]:[])],evidenceTruncated:matches.length>30,...request};
}
function validUrl(value:string,platform:string) {try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&({instagram:['instagram.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be']}[platform]||[]).some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
export function platformContext(context:GrowthContext,platform:GrowthPlatform):GrowthContext {const evidence=context.evidence.filter(e=>e.platform===platform);return {...context,evidence,missingData:[...context.missingData,...(evidence.length?[]:[`${platform}: eşleşen rakip kaynağı yok`])]};}
export function readGrowthContext(db:DatabaseSync,projectId:string,request:Pick<GrowthRequest,'objective'|'capacity'>):GrowthContext {
 const brand=db.prepare('SELECT * FROM project_brand_strategies WHERE project_id=?').get(projectId) as BrandRow|undefined;
 const accounts=db.prepare('SELECT identifier,name FROM project_social_accounts WHERE project_id=? AND disabled=0 ORDER BY identifier,name').all(projectId) as {identifier:string;name:string}[];
 let rows:EvidenceRow[]=[],note='';const file=process.env.GROWTH_SCRAPER_DB_PATH||'/opt/data/social_media_scraper/scraper.db';
 if(fs.existsSync(file)){let scraper:DatabaseSync|undefined;try{scraper=new DatabaseSync(file,{readOnly:true});const competitors=parse(brand?.competitors_json,[]) as string[];const handles=competitors.map(c=>c.trim().replace(/^@/,'').toLowerCase());if(handles.length) rows=scraper.prepare(`SELECT platform,username,title,url FROM scraped_media WHERE lower(username) IN (${handles.map(()=>'?').join(',')}) ORDER BY views DESC LIMIT 31`).all(...handles) as EvidenceRow[];}catch{note='Scraper okunamadı; bağlam eksik';}finally{scraper?.close();}}else note='Scraper bu ortamda erişilebilir değil';
 return buildGrowthContext(brand,accounts,request,rows,note);
}
export function platformAvailability(context:GrowthContext) {const connectedPlatforms=GROWTH_PLATFORMS.filter(p=>context.accounts.some(a=>a.identifier.toLowerCase().includes(p)));const availablePlatforms=GROWTH_PLATFORMS.filter(p=>connectedPlatforms.includes(p)||context.socialChannels.some(c=>c.toLowerCase()===p));return {connectedPlatforms,availablePlatforms};}
