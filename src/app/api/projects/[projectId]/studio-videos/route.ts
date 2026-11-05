import { NextRequest, NextResponse } from "next/server";
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface MergedVideoRow {
  id: number;
  title: string | null;
  merged_url: string | null;
  duration: number | null;
  created_at: string | null;
  episode_number: number | null;
  drama_title: string | null;
  aspect_ratio: string | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const dbPath = "/opt/data/sinematik-studio/data/huobao.sqlite3";
  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
    return NextResponse.json({ success: true, videos: [] });
  }

  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(`
      SELECT m.id, m.title, m.merged_url, m.duration, m.created_at, e.episode_number, d.title as drama_title, d.aspect_ratio
      FROM video_merges m
      JOIN episodes e ON m.episode_id = e.id
      JOIN dramas d ON m.drama_id = d.id
      WHERE m.status = 'completed' AND m.merged_url IS NOT NULL
      ORDER BY m.id DESC
    `).all() as unknown as MergedVideoRow[];
    db.close();

    const videos = [];
    for (const r of rows) {
      if (!r.merged_url) continue;
      const absPath = path.join(/*turbopackIgnore: true*/ "/opt/data/sinematik-studio/data", r.merged_url);
      if (!fs.existsSync(/*turbopackIgnore: true*/ absPath)) continue;

      let sizeBytes = 0;
      try {
        sizeBytes = fs.statSync(/*turbopackIgnore: true*/ absPath).size;
      } catch {}

      const ar = r.aspect_ratio || "9:16";
      const epNum = r.episode_number || 1;
      const dramaTitle = r.drama_title || "Sinematik Stüdyo";
      const displayName = `${dramaTitle} - Bölüm ${epNum} (Tam Film)`;

      videos.push({
        id: `studio_merge_${r.id}`,
        name: displayName,
        title: displayName,
        drive_file_id: `studio_merge_${r.id}`, // compatibility with stock-video-renderer
        duration_seconds: Number(r.duration || 0),
        aspect_ratio: ar,
        width: ar === "9:16" ? 720 : 1280,
        height: ar === "9:16" ? 1280 : 720,
        size_bytes: sizeBytes,
        video_relative_path: r.merged_url,
        stream_url: `/api/projects/${projectId}/studio-videos/${r.id}/stream`,
        thumbnail_url: `/api/projects/${projectId}/studio-videos/${r.id}/stream?thumb=1`,
        created_at: r.created_at,
        source: "studio",
        type: "video"
      });
    }

    return NextResponse.json({ success: true, videos });
  } catch (error: any) {
    console.error("[StudioVideos] Error fetching merged studio videos:", error);
    return NextResponse.json({ success: false, error: error?.message || "Bilinmeyen hata" }, { status: 500 });
  }
}
