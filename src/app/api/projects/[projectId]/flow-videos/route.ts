import {
  createFlowVideoJob,
  listFlowVideos,
  getFlowConfig,
  type FlowVideoModel,
  type FlowAspectRatio,
  type FlowDurationSeconds,
} from "@/lib/server/flow-video-service";
import { listGoogleVidsAccounts } from "@/lib/server/google-vids-account-pool";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return Response.json({ ok: false, message: "Proje kimliği gereklidir." }, { status: 400 });
    }

    const videos = await listFlowVideos(projectId);
    const config = getFlowConfig();

    let accounts: unknown[] = [];
    try {
      accounts = listGoogleVidsAccounts();
    } catch {}

    return Response.json({
      ok: true,
      videos,
      accounts,
      configured: config.hasApiKey,
      defaultModel: config.defaultModel,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    if (!projectId) {
      return Response.json({ ok: false, message: "Proje kimliği gereklidir." }, { status: 400 });
    }

    const body = await request.json();
    const { prompt, model, aspectRatio, durationSeconds, sourceAssetId, preferredAccountId } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json(
        { ok: false, message: "Video üretimi için prompt açıklaması gereklidir." },
        { status: 400 }
      );
    }

    const job = await createFlowVideoJob({
      projectId,
      prompt: prompt.trim(),
      model: model as FlowVideoModel | undefined,
      aspectRatio: aspectRatio as FlowAspectRatio | undefined,
      durationSeconds: durationSeconds as FlowDurationSeconds | undefined,
      sourceAssetId: sourceAssetId ? String(sourceAssetId) : undefined,
      preferredAccountId: preferredAccountId ? String(preferredAccountId) : undefined,
    });

    return Response.json({
      ok: true,
      job,
      message: "Flow video üretim görevi başlatıldı.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Video üretim görevi başlatılamadı.";
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
