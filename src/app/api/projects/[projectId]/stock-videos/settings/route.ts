import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type StockProjectSettingsRow = {
  project_id: string;
  frame_style: string;
  headline_color: string;
  subtitle_color: string;
  headline_font_size?: number;
  subtitle_font_size?: number;
  headline_bg_color: string;
  logo_position: string;
  logo_size: number;
  show_brand_name?: number;
  brand_name_text?: string;
  brand_name_layout?: string;
  brand_name_color?: string;
  selected_overlay_id?: string;
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

type OverlayRow = {
  id: string;
  project_id: string;
  title: string;
  image_url: string;
  local_path: string;
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

  const overlaysRows = db
    .prepare("SELECT * FROM project_frame_overlays WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as unknown as OverlayRow[];

  return Response.json({
    ok: true,
    settings: settingsRow
      ? {
          frameStyle: settingsRow.frame_style,
          headlineColor: settingsRow.headline_color,
          subtitleColor: settingsRow.subtitle_color,
          headlineFontSize: settingsRow.headline_font_size || 34,
          subtitleFontSize: settingsRow.subtitle_font_size || 20,
          headlineBgColor: settingsRow.headline_bg_color,
          logoPosition: settingsRow.logo_position,
          logoSize: settingsRow.logo_size,
          showBrandName: Boolean(settingsRow.show_brand_name),
          brandNameText: settingsRow.brand_name_text || "",
          brandNameLayout: settingsRow.brand_name_layout || "row",
          brandNameColor: settingsRow.brand_name_color || "#ffffff",
          selectedOverlayId: settingsRow.selected_overlay_id || "",
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
    overlays: overlaysRows.map((o) => ({
      id: o.id,
      title: o.title,
      imageUrl: o.image_url,
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
    headlineFontSize?: number;
    subtitleFontSize?: number;
    headlineBgColor?: string;
    logoPosition?: string;
    logoSize?: number;
    showBrandName?: boolean;
    brandNameText?: string;
    brandNameLayout?: string;
    brandNameColor?: string;
    selectedOverlayId?: string;
    musicTrack?: string;
    originalVolume?: number;
    musicVolume?: number;
    selectedOutroId?: string;
  };

  const now = new Date().toISOString();
  const frameStyle = body.frameStyle || "blur_padding";
  const headlineColor = body.headlineColor || "#ffffff";
  const subtitleColor = body.subtitleColor || "#cbd5e1";
  const headlineFontSize = typeof body.headlineFontSize === "number" ? Math.max(18, Math.min(64, Math.round(body.headlineFontSize))) : 34;
  const subtitleFontSize = typeof body.subtitleFontSize === "number" ? Math.max(12, Math.min(40, Math.round(body.subtitleFontSize))) : 20;
  const headlineBgColor = body.headlineBgColor || "rgba(10, 12, 20, 0.82)";
  const logoPosition = body.logoPosition || "top_right";
  const logoSize = typeof body.logoSize === "number" ? body.logoSize : 130;
  const showBrandName = body.showBrandName ? 1 : 0;
  const brandNameText = (body.brandNameText || "").trim();
  const brandNameLayout = body.brandNameLayout === "stack" ? "stack" : "row";
  const brandNameColor = body.brandNameColor || "#ffffff";
  const selectedOverlayId = (body.selectedOverlayId || "").trim();
  const musicTrack = body.musicTrack || "/audio/ambient_track.mp3";
  const originalVolume = typeof body.originalVolume === "number" ? body.originalVolume : 1.0;
  const musicVolume = typeof body.musicVolume === "number" ? body.musicVolume : 0.4;
  const selectedOutroId = body.selectedOutroId || "";

  if (selectedOutroId) {
    const outro = db.prepare("SELECT id FROM project_outro_videos WHERE id = ? AND project_id = ?")
      .get(selectedOutroId, projectId);
    if (!outro) {
      return Response.json({ ok: false, message: "Seçilen outro bu projeye ait değil." }, { status: 400 });
    }
  }

  if (selectedOverlayId) {
    const overlay = db.prepare("SELECT id FROM project_frame_overlays WHERE id = ? AND project_id = ?")
      .get(selectedOverlayId, projectId);
    if (!overlay) {
      return Response.json({ ok: false, message: "Seçilen çerçeve katmanı bu projeye ait değil." }, { status: 400 });
    }
  }

  db.prepare(`
    INSERT INTO stock_project_settings (
      project_id, frame_style, headline_color, subtitle_color, headline_font_size, subtitle_font_size, headline_bg_color,
      logo_position, logo_size, show_brand_name, brand_name_text, brand_name_layout, brand_name_color, selected_overlay_id,
      music_track, original_volume, music_volume, selected_outro_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      frame_style = excluded.frame_style,
      headline_color = excluded.headline_color,
      subtitle_color = excluded.subtitle_color,
      headline_font_size = excluded.headline_font_size,
      subtitle_font_size = excluded.subtitle_font_size,
      headline_bg_color = excluded.headline_bg_color,
      logo_position = excluded.logo_position,
      logo_size = excluded.logo_size,
      show_brand_name = excluded.show_brand_name,
      brand_name_text = excluded.brand_name_text,
      brand_name_layout = excluded.brand_name_layout,
      brand_name_color = excluded.brand_name_color,
      selected_overlay_id = excluded.selected_overlay_id,
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
    headlineFontSize,
    subtitleFontSize,
    headlineBgColor,
    logoPosition,
    logoSize,
    showBrandName,
    brandNameText,
    brandNameLayout,
    brandNameColor,
    selectedOverlayId,
    musicTrack,
    originalVolume,
    musicVolume,
    selectedOutroId,
    now
  );

  return Response.json({
    ok: true,
    message: "Stok video ve marka ayarları bu firma için varsayılan olarak kaydedildi.",
  });
}
