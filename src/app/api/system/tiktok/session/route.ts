import { checkTikTokBrowserSession } from "@/lib/server/tiktok-browser-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkTikTokBrowserSession();
  return Response.json(result);
}
