import crypto from "node:crypto";
import { renderFramedStockVideo, type FrameStyle } from "@/lib/server/stock-video-renderer";
import { getDatabase } from "@/lib/server/database";
import { runInFifoQueue, triggerProductionWorker } from "@/lib/server/production-worker";
import type { MusicSelection } from "@/lib/music-discovery";
import { validateMusicSelection } from "@/lib/music-discovery";
import { MusicDiscoveryError } from "@/lib/server/music-discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    async?: boolean;
    stockVideoId?: string;
    frameStyle?: FrameStyle;
    headline?: string;
    subtitle?: string;
    headlineColor?: string;
    subtitleColor?: string;
    headlineFontSize?: number;
    subtitleFontSize?: number;
    headlineBgColor?: string;
    accentColor?: string;
    logoUrl?: string;
    logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
    logoSize?: number;
    showBrandName?: boolean;
    brandNameText?: string;
    brandNameLayout?: "row" | "stack";
    brandNameColor?: string;
    customOverlayId?: string;
    outroId?: string;
    musicTrack?: string;
    musicSelection?: MusicSelection;
    originalVolume?: number;
    musicVolume?: number;
    maxDurationSeconds?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  } | null;

  if (!body?.stockVideoId) {
    return Response.json(
      { ok: false, message: "Stok video seçilmedi." },
      { status: 400 }
    );
  }

  if (body.musicSelection) {
    try {
      validateMusicSelection(body.musicSelection);
    } catch {
      return Response.json(
        { ok: false, message: "Geçersiz müzik seçimi veya başlangıç noktası." },
        { status: 400 }
      );
    }
  }

  const db = getDatabase();
  const stockRow = db
    .prepare("SELECT id, name FROM stock_videos WHERE project_id = ? AND (id = ? OR drive_file_id = ?)")
    .get(projectId, body.stockVideoId, body.stockVideoId) as { id: string; name: string } | undefined;

  if (!stockRow) {
    return Response.json(
      { ok: false, message: "Stok video veritabanında bulunamadı." },
      { status: 404 }
    );
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const videoTitle = body.headline?.trim() || `Stok Video - ${stockRow.name}`;

  const renderOptions = {
    jobId,
    projectId,
    stockVideoId: body.stockVideoId,
    frameStyle: body.frameStyle || "blur_padding",
    headline: body.headline,
    subtitle: body.subtitle,
    headlineColor: body.headlineColor,
    subtitleColor: body.subtitleColor,
    headlineFontSize: body.headlineFontSize,
    subtitleFontSize: body.subtitleFontSize,
    headlineBgColor: body.headlineBgColor,
    accentColor: body.accentColor,
    logoUrl: body.logoUrl,
    logoPosition: body.logoPosition,
    logoSize: body.logoSize,
    showBrandName: body.showBrandName,
    brandNameText: body.brandNameText,
    brandNameLayout: body.brandNameLayout,
    brandNameColor: body.brandNameColor,
    customOverlayId: body.customOverlayId,
    outroId: body.outroId,
    musicTrack: body.musicTrack,
    musicSelection: body.musicSelection,
    originalVolume: body.originalVolume,
    musicVolume: body.musicVolume,
    maxDurationSeconds:
      typeof body.maxDurationSeconds === "number" && body.maxDurationSeconds > 0
        ? body.maxDurationSeconds
        : undefined,
    trimStartSeconds: typeof body.trimStartSeconds === "number" ? body.trimStartSeconds : 0,
    trimEndSeconds: typeof body.trimEndSeconds === "number" ? body.trimEndSeconds : 0,
  };

  // Pre-insert queued job so the Production Queue drawer immediately picks it up
  db.prepare(`
    INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at)
    VALUES (?, ?, 'video', 'local', 'ffmpeg-frame-engine', 'queued', ?, ?, ?, ?)
  `).run(
    jobId,
    projectId,
    `Stok videoya özel çerçeve ve başlık ekleme: ${videoTitle}`,
    JSON.stringify({
      sourceStockVideoId: stockRow.id,
      frameStyle: renderOptions.frameStyle,
      headline: body.headline?.trim() || "",
      subtitle: body.subtitle?.trim() || "",
      renderer: "ffmpeg-frame-engine",
    }),
    JSON.stringify({ percent: 10, phase: "queued", detail: "Stok video hazırlanıyor ve sıraya alındı..." }),
    now
  );

  // If async mode is requested, fire FIFO background worker so jobs process one by one
  if (body.async) {
    triggerProductionWorker();

    return Response.json({
      ok: true,
      queued: true,
      jobId,
      message: "Video render görevi üretim sırasına eklendi.",
    });
  }

  try {
    const result = await runInFifoQueue(jobId, () => renderFramedStockVideo(renderOptions));
    return Response.json({ ok: true, video: result, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, message: msg },
      { status: err instanceof MusicDiscoveryError ? err.statusCode : 500 }
    );
  }
}
