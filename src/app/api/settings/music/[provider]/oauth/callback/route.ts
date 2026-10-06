import { getMusicProviderOAuth } from "@/lib/server/music-provider-oauth";
import { requireMusicSettingsAdmin, MusicSettingsSecurityError } from "@/lib/server/music-provider-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{provider: string}> }) {
 try {
  requireMusicSettingsAdmin(request);
  const {provider}=await context.params;
  if(provider!=="youtube" && provider!=="instagram")return Response.json({error:"Invalid music provider"},{status:400,headers:{"Cache-Control":"no-store"}});
  return (await getMusicProviderOAuth()).callback(request,provider);
 }catch(error){return Response.json({error:"Music settings access unavailable"},{status:error instanceof MusicSettingsSecurityError?error.statusCode:503,headers:{"Cache-Control":"no-store"}});}
}
