import { getUpdateStatus, installUpdate } from "@/lib/server/github-updater";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateState = globalThis as typeof globalThis & { __yoneticiUpdateRunning?: boolean };

function authorized(request: Request) {
  const configuredToken = process.env.SYSTEM_UPDATE_TOKEN;
  if (!configuredToken) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-update-token") === configuredToken;
}

function messageFrom(error: unknown) {
  if (!(error instanceof Error)) return "Güncelleme işlemi tamamlanamadı.";
  const stderr = (error as Error & { stderr?: string }).stderr?.trim();
  return stderr || error.message;
}

export async function GET() {
  try {
    return Response.json({ ok: true, status: await getUpdateStatus(false), running: Boolean(updateState.__yoneticiUpdateRunning) });
  } catch (error) {
    return Response.json({ ok: false, message: messageFrom(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Güncelleme yetkisi doğrulanamadı. Sunucudaki SYSTEM_UPDATE_TOKEN ile devam edin." }, { status: 401 });
  const input = await request.json().catch(() => ({})) as { action?: "check" | "update" };
  if (!input.action || !["check", "update"].includes(input.action)) return Response.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  if (updateState.__yoneticiUpdateRunning) return Response.json({ ok: false, message: "Başka bir güncelleme işlemi devam ediyor." }, { status: 409 });

  updateState.__yoneticiUpdateRunning = true;
  try {
    const status = input.action === "check" ? await getUpdateStatus(true) : await installUpdate();
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ ok: false, message: messageFrom(error) }, { status: 500 });
  } finally {
    updateState.__yoneticiUpdateRunning = false;
  }
}
