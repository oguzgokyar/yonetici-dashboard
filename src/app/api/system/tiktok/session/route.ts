import { checkTikTokBrowserSession } from "@/lib/server/tiktok-browser-service";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PYTHON_PATH = "/opt/hermes/.venv/bin/python";
const MANAGER_PATH = "/opt/data/scripts/tiktok_browser_manager.py";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionStatus = await checkTikTokBrowserSession();
  const novncUrl = "http://43.131.47.253:8080/novnc/vnc.html?autoconnect=true&reconnect=true&path=novnc/websockify%3Fservice%3Dtiktok";

  return Response.json({
    ok: true,
    loggedIn: sessionStatus.logged_in,
    error: sessionStatus.error,
    novncUrl,
    profileDir: "/opt/data/chrome_profile_tiktok",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: "start" | "stop" };
    const action = body.action || "start";

    const { stdout } = await execFileAsync(PYTHON_PATH, [MANAGER_PATH, action], { timeout: 30_000 });
    const parsed = JSON.parse(stdout.trim());
    return Response.json({ ok: true, ...parsed });
  } catch (err) {
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : "TikTok tarayıcısı başlatılamadı." },
      { status: 500 }
    );
  }
}
