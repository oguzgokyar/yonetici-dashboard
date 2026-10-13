import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDatabase } from './database';
import { GrowthStore } from './platform-growth-store';
import { generatePlatformGrowth } from './platform-growth-generator';
import type { GrowthContext, GrowthRun, GrowthPlatform } from '@/lib/strategy-types';
export async function processGrowthRun(store:GrowthStore,run:GrowthRun,owner:string,generate:typeof generatePlatformGrowth=generatePlatformGrowth,clock=Date.now) {
 const errors:Record<string,string>=JSON.parse(run.errors_json);const completed=new Set(store.savedPlatforms(run.id));let lost=false;
 const heartbeat=setInterval(()=>{if(!store.heartbeat(run.id,owner,clock())) lost=true;},20000);heartbeat.unref();
 try{for(const platform of JSON.parse(run.platforms_json) as GrowthPlatform[]){if(completed.has(platform))continue;if(lost||!store.heartbeat(run.id,owner,clock()))return;
 try{const strategy=await generate(platform,JSON.parse(run.context_json) as GrowthContext);if(lost||!store.save(run.id,owner,platform,strategy,clock()))return;delete errors[platform];}catch(e){errors[platform]=e instanceof Error?e.message:'Platform üretilemedi';}}
 if(!lost)store.finish(run.id,owner,errors,clock());
 }finally{clearInterval(heartbeat);}
}
const state=globalThis as typeof globalThis & {__growthWorker?:{busy:boolean;timer:ReturnType<typeof setTimeout>|null;owner:string}};
export function triggerGrowthWorker() {
 const worker=state.__growthWorker??(state.__growthWorker={busy:false,timer:null,owner:randomUUID()});if(worker.busy||worker.timer)return;
 worker.timer=setTimeout(()=>{worker.timer=null;void drain();},10);worker.timer.unref();
 async function drain(){if(worker.busy)return;worker.busy=true;try{const store=new GrowthStore(getDatabase());for(;;){const run=store.claim(worker.owner);if(!run)break;await processGrowthRun(store,run,worker.owner);}
 const pending=store.db.prepare("SELECT id FROM project_growth_runs WHERE status IN ('queued','running') LIMIT 1").get();if(pending){worker.timer=setTimeout(()=>{worker.timer=null;void drain();},30000);worker.timer.unref();}
 }catch(e){console.error('[Growth worker]',e);worker.timer=setTimeout(()=>{worker.timer=null;void drain();},30000);worker.timer.unref();}finally{worker.busy=false;}}
}
