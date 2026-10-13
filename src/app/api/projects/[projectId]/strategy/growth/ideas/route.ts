import { getDatabase } from '@/lib/server/database';
import { GrowthStore } from '@/lib/server/platform-growth-store';
import { GrowthIdeaBridge } from '@/lib/server/platform-growth-ideas';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}) {
 try{const {projectId}=await params;const body=await request.json();const {action,strategyId,recommendationId,format}=body;
 if(!['preview','add'].includes(action)||typeof strategyId!=='string'||strategyId.length>100||typeof recommendationId!=='string'||recommendationId.length>100)throw new Error('400 Geçersiz kaynak');
 const bridge=new GrowthIdeaBridge(new GrowthStore(getDatabase()));const result=action === 'preview'?await bridge.preview(projectId,strategyId,recommendationId,format):bridge.add(projectId,strategyId,recommendationId);
 return Response.json(result);
 }catch(e){const error=e instanceof Error?e.message:'Fikir işlemi başarısız';return Response.json({error},{status:Number(/^(400|404|409)/.exec(error)?.[1]||500)});}
}
