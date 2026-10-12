import { getDatabase } from "@/lib/server/database";
import { ensureTikTokSchedulersRehydrated } from "@/lib/server/tiktok-exact-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getDatabase().prepare("SELECT 1 AS healthy").get();
    ensureTikTokSchedulersRehydrated();
    return Response.json({ ok: true, service: "yonetici-dashboard" });
  } catch {
    return Response.json({ ok: false, service: "yonetici-dashboard" }, { status: 503 });
  }
}
