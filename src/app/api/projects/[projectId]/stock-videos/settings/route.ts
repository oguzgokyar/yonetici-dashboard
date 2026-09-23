import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type StockProjectSettingsRow = {
  project_id: string;
  frame_style: string;
  headline_color: string;
  subtitle_color: string;
  headline_bg_color: string;
  logo_position: string;
  logo_size: number;
  music_track: string;
  original_volume: number;
  music_volume: number;
  selected_outro_id: string;
  updated_at: string;
};

type OutroRow = {
  id: string;
  project_id: string;
  title: string;
  video_url: string;
  local_path: string;
  duration_seconds: number;
  created_at: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();

  const settingsRow = db
    .prepare("SELECT * FROM stock_project_settings WHERE project_id = ?")
    .get(projectId) as unknown as StockProjectSettingsRow | undefined;

  const outrosRows = db
    .prepare("SELECT * FROM project_outro_videos WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as unknown as OutroRow[];

  return Response.json({
    ok: true,
    settings: settingsRow
      ? {
          frameStyle: settingsRow.frame_style,
          headlineColor: settingsRow.headline_color,
          subtitleColor: settingsRow.subtitle_color,
          headlineBgColor: settingsRow.headline_bg_color,
          logoPosition: settingsRow.logo_position,
          logoSize: settingsRow.logo_size,
          musicTrack: settingsRow.music_track,
          originalVolume: settingsRow.original_volume,
          musicVolume: settingsRow.music_volume,
          selectedOutroId: settingsRow.selected_outro_id,
        }
      : null,
    outros: outrosRows.map((o) => ({
      id: o.id,
      title: o.title,
      videoUrl: o.video_url,
      durationSeconds: o.duration_seconds,
      createdAt: o.created_at,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const body = (await request.json().catch(() => ({}))) as {
    frameStyle?: string;
    headlineColor?: string;
    subtitleColor?: string;
    headlineBgColor?: string;
    logoPosition?: string;
    logoSize?: number;
    musicTrack?: string;
    originalVolume?: number;
    musicVolume?: number;
    selectedOutroId?: string;
  };

  const now = new Date().toISOString();
  const frameStyle = body.frameStyle || "blur_padding";
  const headlineColor = body.headlineColor || "#ffffff";
  const subtitleColor = body.subtitleColor || "#cbd5e1";
  const headlineBgColor = body.headlineBgColor || "rgba(10, 12, 20, 0.82)";
  const logoPosition = body.logoPosition || "top_right";
  const logoSize = typeof body.logoSize === "number" ? body.logoSize : 130;
  const musicTrack = body.musicTrack || "/audio/ambient_track.mp3";
  const originalVolume = typeof body.originalVolume === "number" ? body.originalVolume : 1.0;
  const musicVolume = typeof body.musicVolume === "number" ? body.musicVolume : 0.4;
  const selectedOutroId = body.selectedOutroId || "";

  db.prepare(`
    INSERT INTO stock_project_settings (
      project_id, frame_style, headline_color, subtitle_color, headline_bg_color,
      logo_position, logo_size, music_track, original_volume, music_volume, selected_outro_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      frame_style = excluded.frame_style,
      headline_color = excluded.headline_color,
      subtitle_color = excluded.subtitle_color,
      headline_bg_color = excluded.headline_bg_color,
      logo_position = excluded.logo_position,
      logo_size = excluded.logo_size,
      music_track = excluded.music_track,
      original_volume = excluded.original_volume,
      music_volume = excluded.music_volume,
      selected_outro_id = excluded.selected_outro_id,
      updated_at = excluded.updated_at
  `).run(
    projectId,
    frameStyle,
    headlineColor,
    subtitleColor,
    headlineBgColor,
    logoPosition,
    logoSize,
    musicTrack,
    originalVolume,
    musicVolume,
    selectedOutroId,
    now
  );

  return Response.json({
    ok: true,
    message: "Stok video ayarları bu firma için varsayılan olarak kaydedildi.",
  });
}
