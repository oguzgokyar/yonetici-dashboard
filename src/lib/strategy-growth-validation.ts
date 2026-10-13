import { GROWTH_PLATFORMS, type GrowthPlatform, type GrowthRequest, type GrowthCapacity, type PlatformGrowthStrategy } from './strategy-types';
export const GROWTH_FORMATS: Record<GrowthPlatform, string[]> = { instagram: ['reels','carousel','story','post'], tiktok: ['video'], youtube: ['shorts','long_video'] };
function fail(): never { throw new Error('Geçersiz platform büyümesi sözleşmesi'); }
// Inspect every visible string, not a hand-picked subset of narrative fields.
export function validateVisibleHonesty(value: unknown): void {
 if (typeof value === 'string') {
  for (const sentence of value.split(/[;\n]|(?<=[.!?])\s+/)) {
   if (/IGTV|garanti|guaranteed|araştırma yapt|doğrulanmış outlier|verified outlier/i.test(sentence)) fail();
   const numeric = /\d+\s*%|%\s*\d+|\d+[\s.,]*(takipçi|followers|izlenme|views)/i.test(sentence);
   const proposed = /önerilen hedef|hedef önerisi|proposed target|hipotez|hypothesis/i.test(sentence);
   const measured = /geçen|last month|kazandınız|aldınız|gained|achieved/i.test(sentence);
   if (numeric && (!proposed || measured)) fail();
  }
 } else if (Array.isArray(value)) value.forEach(validateVisibleHonesty);
 else if (value && typeof value === 'object') Object.values(value).forEach(validateVisibleHonesty);
}
function record(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v as Record<string, unknown>; }
function text(v: unknown, max = 2000): asserts v is string { if (typeof v !== 'string' || !v.trim() || v.length > max) fail(); }
function list(v: unknown, min = 0, max = 30): asserts v is unknown[] { if (!Array.isArray(v) || v.length < min || v.length > max) fail(); }
function strings(v: unknown, min = 0) { list(v,min); v.forEach(x => text(x)); }
function number(v: unknown, min: number, max: number): asserts v is number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(); }
export function validateGrowthRequest(value: unknown): GrowthRequest {
 const v = record(value); list(v.platforms,1,3); if (new Set(v.platforms).size !== v.platforms.length || v.platforms.some(p => !GROWTH_PLATFORMS.includes(p as GrowthPlatform))) fail();
 text(v.objective); text(v.idempotencyKey,128); const c = record(v.capacity); number(c.postsPerWeek,1,21); number(c.hoursPerWeek,0.5,80); if (!Number.isInteger(c.postsPerWeek)) fail();
 return { platforms: v.platforms as GrowthPlatform[], objective: v.objective, capacity: {postsPerWeek:c.postsPerWeek,hoursPerWeek:c.hoursPerWeek}, idempotencyKey:v.idempotencyKey };
}
export function validateGrowthResult(value: unknown, platform: GrowthPlatform, capacity: GrowthCapacity): PlatformGrowthStrategy {
 const v = record(value); if (JSON.stringify(v).length > 60000) fail();
 text(v.objective); text(v.diagnosis); text(v.weeklyCadence); strings(v.first7Days,1); strings(v.missingData); strings(v.constraints,1);
 list(v.evidence); v.evidence.forEach(x => { const e=record(x); text(e.sourceUrl); const u=new URL(e.sourceUrl); if (!['https:','http:'].includes(u.protocol) || e.platform!==platform || e.matchType!=='competitor_exact') fail(); text(e.account); if(e.observedAt!==null && (typeof e.observedAt!=='string' || !Number.isFinite(Date.parse(e.observedAt)))) fail(); });
 const format = (x: unknown) => { if(typeof x!=='string' || !GROWTH_FORMATS[platform].includes(x)) fail(); };
 list(v.contentMix,1,5); let count=0; v.contentMix.forEach(x=>{const c=record(x); format(c.format); number(c.postsPerWeek,0,21); count+=c.postsPerWeek; text(c.purpose);}); if(count>capacity.postsPerWeek) fail();
 list(v.recommendations,1,10); v.recommendations.forEach(x=>{const r=record(x); text(r.title);text(r.rationale);strings(r.steps,1);text(r.impactHypothesis);strings(r.evidenceIds); if(!['low','medium','high'].includes(String(r.effort)) || typeof r.contentEligible!=='boolean') fail();format(r.format);});
 list(v.experiments,1,10); v.experiments.forEach(x=>{const e=record(x);text(e.title);text(e.hypothesis);strings(e.steps,1);text(e.metric);number(e.periodDays,1,30);format(e.format);if(typeof e.contentEligible!=='boolean') fail();});
 list(v.kpis,1,10);v.kpis.forEach(x=>{const k=record(x);text(k.name);text(k.definition);if(k.baseline!==null || k.targetType!=='proposed') fail();text(k.target);number(k.periodDays,1,90);});
 const ids = (items: unknown[]) => {const out=items.map(x=>{const r=record(x);text(r.id,128);return r.id;});if(new Set(out).size!==out.length)fail();return new Set(out);};
 const experimentIds=ids(v.experiments), kpiIds=ids(v.kpis);
 v.recommendations.forEach(x=>{const r=record(x);strings(r.experimentIds);strings(r.kpiIds);const experiments=r.experimentIds as string[],kpis=r.kpiIds as string[];if(!experiments.length&&!kpis.length)fail();if(experiments.some(id=>!experimentIds.has(id))||kpis.some(id=>!kpiIds.has(id)))fail();});
 validateVisibleHonesty(v);
 return v as unknown as PlatformGrowthStrategy;
}
