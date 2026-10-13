import 'server-only';
import { completeText, parseJsonResponse } from './cliproxy-text';
import { GROWTH_AGENTS, growthSystemPrompt } from './agency-growth-registry';
import { platformContext } from './platform-growth-context';
import { GROWTH_FORMATS, validateGrowthResult } from '@/lib/strategy-growth-validation';
import type { GrowthContext, GrowthPlatform, PlatformGrowthStrategy } from '@/lib/strategy-types';
const contract = {objective:'string',diagnosis:'string',missingData:['string'],evidence:[],recommendations:[{title:'string',rationale:'string',steps:['string'],effort:'low|medium|high',impactHypothesis:'string',evidenceIds:[],experimentIds:['experiment-1'],kpiIds:['kpi-1'],contentEligible:true,format:'native format'}],contentMix:[{format:'native format',postsPerWeek:1,purpose:'string'}],weeklyCadence:'string',first7Days:['string'],experiments:[{id:'experiment-1',title:'string',hypothesis:'string',steps:['string'],metric:'string',periodDays:30,contentEligible:true,format:'native format'}],kpis:[{id:'kpi-1',name:'string',definition:'string',baseline:null,target:'proposed hypothesis',targetType:'proposed',periodDays:30}],constraints:['string']};
export async function generatePlatformGrowth(platform:GrowthPlatform,context:GrowthContext,complete:typeof completeText=completeText):Promise<PlatformGrowthStrategy> {
 const ctx=platformContext(context,platform);const system=growthSystemPrompt(platform)+`\nYalnız JSON. Şema: ${JSON.stringify(contract)}. evidence aynen verilen kaynaklar. Format whitelist: ${GROWTH_FORMATS[platform].join(',')}. contentMix toplam postsPerWeek kapasiteyi aşamaz. Her öneride experimentIds ve kpiIds dizileri zorunlu; en az biri dolu olmalı. Bağlantılar experiments/kpis içindeki benzersiz model id değerlerine referans vermeli. 7 gün adımları ve 30 gün deneyi zorunlu.`;
 let correction='';for(let attempt=0;attempt<2;attempt++){
 try{
 const response=await complete(system,JSON.stringify({platform,context:ctx,correction}),{temperature:0.4,maxTokens:4500});
 const strategy=validateGrowthResult(parseJsonResponse(response.content),platform,ctx.capacity);
 // Never accept invented or rewritten source claims from the model.
 for(const e of strategy.evidence) if(!ctx.evidence.some(x=>x.sourceUrl===e.sourceUrl&&x.account===e.account&&x.platform===e.platform)) throw new Error('Kaynak bağlamda yok');
 const agent=GROWTH_AGENTS[platform];strategy.schemaVersion=1;strategy.platform=platform;strategy.evidence=ctx.evidence;strategy.missingData=[...new Set([...ctx.missingData,...strategy.missingData])];
 const experimentIds=new Map(strategy.experiments.map((e,i)=>[e.id,`${platform}-experiment-${i+1}`]));const kpiIds=new Map(strategy.kpis.map((k,i)=>[k.id,`${platform}-kpi-${i+1}`]));
 strategy.recommendations=strategy.recommendations.map((r,i)=>{if(r.evidenceIds.some(id=>!ctx.evidence.some(e=>e.id===id))) throw new Error('Kanıt kimliği geçersiz');return {...r,id:`${platform}-recommendation-${i+1}`,experimentIds:r.experimentIds.map(id=>experimentIds.get(id)!),kpiIds:r.kpiIds.map(id=>kpiIds.get(id)!),label:r.evidenceIds.length?'source_observation':'expert_hypothesis'};});strategy.experiments=strategy.experiments.map(e=>({...e,id:experimentIds.get(e.id)!}));strategy.kpis=strategy.kpis.map(k=>({...k,id:kpiIds.get(k.id)!}));
 strategy.provenance={agentSlug:agent.slug,agentVersion:agent.version,skillSource:agent.skillSource,engineMode:'specialist_prompt',model:response.model,generatedAt:new Date().toISOString(),evidenceTruncated:ctx.evidenceTruncated,confidenceMeaning:'Uzman hipotezi; ölçülmüş doğruluk değil'};
 return strategy;
 }catch(error){if(attempt===1) throw error;correction='Önceki çıktı geçersiz: '+(error instanceof Error?error.message:'schema')+'. Şemaya uygun yeni JSON üret. Kaynak/performans uydurma.';}
 }
 throw new Error('Platform çıktısı üretilemedi');
}
