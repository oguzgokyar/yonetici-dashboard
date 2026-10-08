import "server-only";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getStockTimeline } from "@/lib/stock-timeline";
import { parseStockVideoProbe } from "@/lib/stock-render-timing";
import { getDatabase } from "@/lib/server/database";
import { ensureCachedVideo } from "@/lib/server/google-drive";
import type { MusicSelection } from "@/lib/music-discovery";
import { resolveEmbeddableMusic } from "@/lib/server/music-discovery";
import { withTransientMusic, mixMusicIntoVideo } from "@/lib/server/transient-music";

const execFileAsync = promisify(execFile);

export type FrameStyle = "none" | "blur_padding" | "modern_card" | "split_screen" | "minimal_glow";

export type RenderStockVideoOptions = {
  jobId?: string;
  projectId: string;
  stockVideoId: string;
  frameStyle: FrameStyle;
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
};

export type RenderedStockVideoResult = {
  id: string;
  url: string;
  title: string;
  durationSeconds: number;
  frameStyle: FrameStyle;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export async function renderFramedStockVideo(
  options: RenderStockVideoOptions
): Promise<RenderedStockVideoResult> {
  if (options.musicSelection) {
    const verified = await resolveEmbeddableMusic(options.projectId, options.musicSelection);
    const verifiedOptions = { ...options, musicSelection: { track: verified, offsetSeconds: options.musicSelection.offsetSeconds } };
    return withTransientMusic(verified.downloadUrl, (localMusicPath) => renderStockVideoCore(verifiedOptions, localMusicPath));
  }
  return renderStockVideoCore(options);
}

async function renderStockVideoCore(options: RenderStockVideoOptions, transientMusicPath?: string): Promise<RenderedStockVideoResult> {
  const db = getDatabase();
  const projectDir = process.cwd();
  const outputDir = path.join(projectDir, ".data", "video-renders");
  const tempDir = path.join(projectDir, ".data", "temp-renders");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const renderId = options.jobId || crypto.randomUUID();
  const outputLocation = path.join(outputDir, `${renderId}.mp4`);

  // Check if custom overlay PNG is requested
  const overlayRow = options.customOverlayId
    ? (db
        .prepare("SELECT * FROM project_frame_overlays WHERE id = ? AND project_id = ?")
        .get(options.customOverlayId, options.projectId) as {
        id: string;
        title: string;
        local_path: string;
      } | undefined)
    : undefined;
  const customOverlayPath = overlayRow?.local_path && fs.existsSync(/*turbopackIgnore: true*/ overlayRow.local_path)
    ? overlayRow.local_path
    : "";

  // Check if outro video is requested
  const outroRow = options.outroId
    ? (db
        .prepare("SELECT * FROM project_outro_videos WHERE id = ? AND project_id = ?")
        .get(options.outroId, options.projectId) as {
        id: string;
        title: string;
        local_path: string;
        video_url: string;
      } | undefined)
    : undefined;

  const hasOutro = Boolean(outroRow?.local_path && fs.existsSync(/*turbopackIgnore: true*/ outroRow.local_path));
  const mainStageOutput = hasOutro ? path.join(tempDir, `${renderId}_main.mp4`) : outputLocation;

  // Fetch stock video record
  const stockRow = db
    .prepare("SELECT * FROM stock_videos WHERE project_id = ? AND (id = ? OR drive_file_id = ?)")
    .get(options.projectId, options.stockVideoId, options.stockVideoId) as {
      id: string;
      name: string;
      drive_file_id: string;
      duration_seconds?: number;
      width?: number;
      height?: number;
      metadata_json?: string;
    } | undefined;

  if (!stockRow) {
    throw new Error("Stok video bulunamadı.");
  }

  // Ensure local video is cached
  const { localPath } = await ensureCachedVideo(stockRow.drive_file_id, options.projectId);

  // Probe failures are fatal: stale database metadata must never substitute for the file.
  const probeVideo = async (file: string) => {
    const result = await execFileAsync("/usr/bin/ffprobe", [
      "-v", "error", "-show_entries", "stream=codec_type,duration:format=duration", "-of", "json", file,
    ]);
    return parseStockVideoProbe(JSON.parse(result.stdout));
  };
  const sourceProbe = await probeVideo(localPath);
  const hasSourceAudio = sourceProbe.hasAudio;
  const sourceDurationSeconds = sourceProbe.durationSeconds;
  const outroProbe = hasOutro && outroRow?.local_path ? await probeVideo(outroRow.local_path) : undefined;
  if (stockRow.duration_seconds !== sourceDurationSeconds) {
    try {
      db.prepare("UPDATE stock_videos SET duration_seconds = ? WHERE id = ?").run(sourceDurationSeconds, stockRow.id);
    } catch {
      // Cache metadata updates are best effort, actual file probing is not.
    }
  }

  // Fetch project brand info for default colors / logo
  const projectRow = db
    .prepare("SELECT brand_json FROM projects WHERE id = ?")
    .get(options.projectId) as { brand_json: string } | undefined;

  const brand = projectRow?.brand_json
    ? (JSON.parse(projectRow.brand_json) as { primaryColor?: string; logo?: string; brandName?: string })
    : {};

  const accentColor = options.accentColor || brand.primaryColor || "#6d5dfc";
  const frameStyle = options.frameStyle || "blur_padding";
  const logoPosition = options.logoPosition || "top_right";
  const originalVol = transientMusicPath ? 1 : typeof options.originalVolume === "number" ? options.originalVolume : 1.0;
  const musicVol = typeof options.musicVolume === "number" ? options.musicVolume : 0.5;

  // Frame Style Geometry & Shadows to match Remotion preview
  // Note: All dimensions MUST be even integers for FFmpeg YUV420p & alphamerge compatibility
  let fgW = 994; // 92% of 1080
  let fgH = 1690; // 88% of 1920
  let rx = 24;
  let borderW = 3;
  let borderAlpha = 0.55;
  let shadowBlur = 24;
  let shadowOpacity = 0.6;
  let glowOpacity = 0;

  if (frameStyle === "blur_padding") {
    fgW = 994;
    fgH = 1690;
    rx = 24;
    borderW = 3;
    borderAlpha = 0.55;
    shadowBlur = 24;
    shadowOpacity = 0.6;
  } else if (frameStyle === "modern_card") {
    fgW = 950;
    fgH = 1574;
    rx = 32;
    borderW = 4;
    borderAlpha = 0.88;
    shadowBlur = 30;
    shadowOpacity = 0.7;
    glowOpacity = 0.35;
  } else if (frameStyle === "split_screen") {
    fgW = 1016; // ensure even number (1016 instead of 1015)
    fgH = 1306;
    rx = 20;
    borderW = 3;
    borderAlpha = 0.44;
    shadowBlur = 20;
    shadowOpacity = 0.6;
  } else if (frameStyle === "minimal_glow") {
    fgW = 1036;
    fgH = 1804; // ensure even number (1804 instead of 1805)
    rx = 16;
    borderW = 2;
    borderAlpha = 1.0;
    shadowBlur = 15;
    shadowOpacity = 0.5;
    glowOpacity = 0.4;
  }

  // Ensure fgW and fgH are strictly even
  fgW = Math.floor(fgW / 2) * 2;
  fgH = Math.floor(fgH / 2) * 2;

  const fgX = Math.floor((1080 - fgW) / 2);
  const fgY = Math.floor((1920 - fgH) / 2);

  const sharp = (await import("sharp")).default;

  // 1. Generate foreground video rounded corner alpha mask (if framed)
  const maskSvgPath = path.join(tempDir, `${renderId}_fg_mask.png`);
  if (frameStyle !== "none") {
    const maskSvg = `
      <svg width="${fgW}" height="${fgH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${fgW}" height="${fgH}" rx="${rx}" fill="#ffffff" />
      </svg>
    `;
    await sharp(Buffer.from(maskSvg)).png().toFile(maskSvgPath);
  }

  // 2. Generate frame border and shadow overlay (if framed)
  const borderSvgPath = path.join(tempDir, `${renderId}_fg_border.png`);
  if (frameStyle !== "none") {
    const borderSvg = `
      <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="card_shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
            ${glowOpacity > 0 ? `<feDropShadow dx="0" dy="0" stdDeviation="15" flood-color="${accentColor}" flood-opacity="${glowOpacity}"/>` : ""}
          </filter>
        </defs>
        <rect x="${fgX}" y="${fgY}" width="${fgW}" height="${fgH}" rx="${rx}" fill="none" stroke="${accentColor}" stroke-width="${borderW}" stroke-opacity="${borderAlpha}" filter="url(#card_shadow)" />
      </svg>
    `;
    await sharp(Buffer.from(borderSvg)).png().toFile(borderSvgPath);
  }

  // 3. Generate headline card overlay (matching Remotion preview)
  const overlaySvgPath = path.join(tempDir, `${renderId}_overlay.png`);
  let hasTextOverlay = false;

  const titleText = (options.headline || "").trim();
  const subText = (options.subtitle || "").trim();
  const headlineColor = options.headlineColor || "#ffffff";
  const subtitleColor = options.subtitleColor || "#cbd5e1";
  const headlineFontSize = typeof options.headlineFontSize === "number" ? Math.max(18, Math.min(64, options.headlineFontSize)) : 34;
  const subtitleFontSize = typeof options.subtitleFontSize === "number" ? Math.max(12, Math.min(40, options.subtitleFontSize)) : 20;
  const headlineBgColor = options.headlineBgColor || "rgba(10, 12, 20, 0.82)";
  const logoSize = Math.max(60, Math.min(options.logoSize || 130, 260));

  if (titleText || subText) {
    hasTextOverlay = true;

    function wrapText(str: string, maxChars: number): string[] {
      const words = str.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let current = "";
      for (const w of words) {
        if ((current + " " + w).trim().length > maxChars) {
          if (current) lines.push(current);
          current = w;
        } else {
          current = current ? current + " " + w : w;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    const cardW = 920;
    const availableWidth = cardW - 64;
    const maxHeadlineChars = Math.max(18, Math.floor(availableWidth / (headlineFontSize * 0.58)));
    const maxSubChars = Math.max(24, Math.floor(availableWidth / (subtitleFontSize * 0.52)));

    const titleLines = titleText ? wrapText(titleText, maxHeadlineChars) : [];
    const subLines = subText ? wrapText(subText, maxSubChars) : [];

    const headlineLineHeight = Math.round(headlineFontSize * 1.25);
    const subtitleLineHeight = Math.round(subtitleFontSize * 1.35);

    const titleTotalH = titleLines.length ? titleLines.length * headlineLineHeight : 0;
    const subTotalH = subLines.length ? subLines.length * subtitleLineHeight : 0;
    const gap = (titleLines.length && subLines.length) ? 14 : 0;
    const totalContentH = titleTotalH + gap + subTotalH;

    const padY = 24;
    const cardH = totalContentH + padY * 2;
    const cardX = (1080 - cardW) / 2;
    const cardY = frameStyle === "split_screen" ? 70 : 120;
    const topLogoPosition = logoPosition === "top_left" || logoPosition === "top_right";
    const hasTopBrand = topLogoPosition && Boolean(
      options.logoUrl || brand.logo || (options.showBrandName && (options.brandNameText || brand.brandName))
    );
    const textCardY = hasTopBrand ? Math.max(cardY, 250) : cardY;

    const titleBaseOffset = Math.round(headlineFontSize * 0.82);
    const titleFirstY = textCardY + padY + titleBaseOffset;

    const subBaseOffset = Math.round(subtitleFontSize * 0.82);
    const subFirstY = textCardY + padY + (titleTotalH ? titleTotalH + gap : 0) + subBaseOffset;

    const titleTspans = titleLines.map((line, idx) =>
      `<tspan x="540" dy="${idx === 0 ? 0 : headlineLineHeight}">${escapeXml(line)}</tspan>`
    ).join("");

    const subTspans = subLines.map((line, idx) =>
      `<tspan x="540" dy="${idx === 0 ? 0 : subtitleLineHeight}">${escapeXml(line)}</tspan>`
    ).join("");

    const svg = `
      <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="text_card_shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000000" flood-opacity="0.6"/>
            <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${accentColor}" flood-opacity="0.2"/>
          </filter>
        </defs>
        <g filter="url(#text_card_shadow)">
          <rect x="${cardX}" y="${textCardY}" width="${cardW}" height="${cardH}" rx="22" fill="${headlineBgColor}" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.5" />
          ${titleLines.length ? `
            <text x="540" y="${titleFirstY}" font-family="DejaVu Sans" font-size="${headlineFontSize}" font-weight="bold" fill="${headlineColor}" text-anchor="middle">
              ${titleTspans}
            </text>
          ` : ""}
          ${subLines.length ? `
            <text x="540" y="${subFirstY}" font-family="DejaVu Sans" font-size="${subtitleFontSize}" font-weight="normal" fill="${subtitleColor}" text-anchor="middle">
              ${subTspans}
            </text>
          ` : ""}
        </g>
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(overlaySvgPath);
  }

  // 4. Handle Logo & Brand Name Badge
  let logoPngPath = "";
  const rawLogo = options.logoUrl || brand.logo;
  const showBrandName = options.showBrandName;
  const brandName = (options.brandNameText || brand.brandName || "").trim();
  const brandLayout = options.brandNameLayout === "stack" ? "stack" : "row";
  const brandColor = options.brandNameColor || "#ffffff";

  if (logoPosition !== "none" && (rawLogo || (showBrandName && brandName))) {
    try {
      logoPngPath = path.join(tempDir, `${renderId}_logo.png`);
      let logoBuf: Buffer | null = null;
      if (rawLogo) {
        if (rawLogo.startsWith("data:")) {
          const parts = rawLogo.split(",");
          logoBuf = Buffer.from(parts[1], "base64");
        } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
          const r = await fetch(rawLogo);
          if (r.ok) logoBuf = Buffer.from(await r.arrayBuffer());
        } else if (fs.existsSync(rawLogo)) {
          logoBuf = fs.readFileSync(rawLogo);
        }
      }

      const logoMaxH = Math.round(logoSize * 0.75);
      let logoResizedBuf: Buffer | null = null;
      let logoW = 0;
      let logoH = 0;

      if (logoBuf) {
        const res = await sharp(logoBuf)
          .resize({ width: logoSize, height: logoMaxH, fit: "inside" })
          .png()
          .toBuffer({ resolveWithObject: true });
        logoResizedBuf = res.data;
        logoW = res.info.width;
        logoH = res.info.height;
      }

      if (showBrandName && brandName) {
        const fontSize = Math.max(16, Math.min(Math.round(logoSize * 0.22), 30));
        const estimatedTextW = Math.round(brandName.length * fontSize * 0.72) + 24;
        const textH = fontSize + 12;

        let totalBadgeW = 0;
        let totalBadgeH = 0;
        let logoX = 0;
        let logoY = 0;
        let textX = 0;
        let textY = 0;

        const isRightSide = (logoPosition === "top_right" || logoPosition === "bottom_right");

        if (brandLayout === "stack") {
          totalBadgeW = Math.max(logoW, estimatedTextW) + 24;
          totalBadgeH = (logoH ? logoH + 8 : 0) + textH + 12;
          logoX = Math.round((totalBadgeW - logoW) / 2);
          logoY = 6;
          textX = Math.round(totalBadgeW / 2);
          textY = (logoH ? logoH + 8 : 0) + Math.round(fontSize * 0.82) + 4;
        } else {
          totalBadgeW = (logoW ? logoW + 16 : 0) + estimatedTextW + 16;
          totalBadgeH = Math.max(logoH, textH) + 12;
          const centerY = Math.round(totalBadgeH / 2);

          if (isRightSide && logoW > 0) {
            textX = 8;
            textY = centerY + Math.round(fontSize * 0.35);
            logoX = estimatedTextW + 16;
            logoY = Math.round((totalBadgeH - logoH) / 2);
          } else {
            logoX = 8;
            logoY = Math.round((totalBadgeH - logoH) / 2);
            textX = (logoW ? logoW + 16 : 8);
            textY = centerY + Math.round(fontSize * 0.35);
          }
        }

        const compositeList: Array<{ input: Buffer; top: number; left: number }> = [];
        if (logoResizedBuf) {
          compositeList.push({ input: logoResizedBuf, top: logoY, left: logoX });
        }

        const textSvg = `
          <svg width="${totalBadgeW}" height="${totalBadgeH}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="badge_text_shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.85"/>
              </filter>
            </defs>
            <text x="${textX}" y="${textY}" font-family="DejaVu Sans" font-size="${fontSize}" font-weight="bold" fill="${brandColor}" ${brandLayout === "stack" ? 'text-anchor="middle"' : 'text-anchor="start"'} filter="url(#badge_text_shadow)">
              ${escapeXml(brandName)}
            </text>
          </svg>
        `;
        compositeList.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

        await sharp({
          create: {
            width: totalBadgeW,
            height: totalBadgeH,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite(compositeList)
          .png()
          .toFile(logoPngPath);
      } else if (logoResizedBuf) {
        await sharp(logoResizedBuf).png().toFile(logoPngPath);
      } else {
        logoPngPath = "";
      }
    } catch {
      logoPngPath = "";
    }
  }

  // Audio configuration
  let musicAudioPath = "";
  if (!transientMusicPath && options.musicTrack && options.musicTrack !== "none") {
    let resolved = options.musicTrack;
    if (resolved.startsWith("/")) {
      resolved = path.join(projectDir, "public", resolved);
    }
    if (fs.existsSync(/*turbopackIgnore: true*/ resolved)) {
      musicAudioPath = resolved;
    } else {
      const defaultPublic = path.join(projectDir, "public", "audio", "ambient_track.mp3");
      if (fs.existsSync(/*turbopackIgnore: true*/ defaultPublic)) {
        musicAudioPath = defaultPublic;
      }
    }
  }

  // The preview and renderer share the same whole-frame trim boundaries.
  const rawTrimEnd = options.trimEndSeconds ?? 0;
  const timeline = getStockTimeline({
    sourceDurationSeconds, trimStartSeconds: options.trimStartSeconds,
    trimEndSeconds: options.trimEndSeconds, hasOutro,
    outroDurationSeconds: outroProbe?.durationSeconds,
  });
  if (!timeline) throw new Error("Video zaman çizelgesi belirlenemedi.");
  const trimStart = timeline.trimStartSeconds;
  const trimDuration = timeline.mainDurationSeconds;

  // Build FFmpeg inputs and filter complex
  const inputs: string[] = [];
  if (trimStart > 0) {
    inputs.push("-ss", String(trimStart));
  }
  if (trimDuration !== null && trimDuration > 0) {
    inputs.push("-t", String(trimDuration));
  }
  inputs.push("-i", localPath);
  let filterStreamIdx = 1;

  if (frameStyle !== "none") {
    inputs.push("-i", maskSvgPath, "-i", borderSvgPath);
    filterStreamIdx = 3;
  }

  let overlayInputIdx = -1;
  if (hasTextOverlay) {
    inputs.push("-i", overlaySvgPath);
    overlayInputIdx = filterStreamIdx++;
  }

  let logoInputIdx = -1;
  if (logoPngPath && fs.existsSync(/*turbopackIgnore: true*/ logoPngPath)) {
    inputs.push("-i", logoPngPath);
    logoInputIdx = filterStreamIdx++;
  }

  let customOverlayInputIdx = -1;
  if (customOverlayPath && fs.existsSync(/*turbopackIgnore: true*/ customOverlayPath)) {
    inputs.push("-i", customOverlayPath);
    customOverlayInputIdx = filterStreamIdx++;
  }

  let musicInputIdx = -1;
  if (musicAudioPath && fs.existsSync(/*turbopackIgnore: true*/ musicAudioPath)) {
    inputs.push("-stream_loop", "-1", "-i", musicAudioPath);
    musicInputIdx = filterStreamIdx++;
  }

  // Compose video filters
  const filterParts: string[] = [];
  let currentVideoOut = "v_frame";

  if (frameStyle === "none") {
    // Direct full-screen 9:16 crop/fill without blur background or frame border
    filterParts.push("[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v_frame]");
  } else {
    filterParts.push(
      "[0:v]scale=1240:2200:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=32:5,eq=brightness=-0.18:saturation=1.2[bg]",
      `[0:v]scale=${fgW}:${fgH}:force_original_aspect_ratio=increase,crop=${fgW}:${fgH}[fg_raw]`,
      "[fg_raw][1:v]alphamerge[fg_rounded]",
      `[bg][fg_rounded]overlay=${fgX}:${fgY}[v_fg]`,
      "[v_fg][2:v]overlay=0:0[v_frame]"
    );
  }

  // Overlay text banner if exists
  if (overlayInputIdx >= 0) {
    const nextOut = "v_overlay";
    filterParts.push(`[${currentVideoOut}][${overlayInputIdx}:v]overlay=0:0[${nextOut}]`);
    currentVideoOut = nextOut;
  }

  // Overlay logo if exists
  if (logoInputIdx >= 0) {
    let logoX = "W-w-40";
    let logoY = "40";
    if (logoPosition === "top_left") {
      logoX = "40";
      logoY = "40";
    } else if (logoPosition === "bottom_left") {
      logoX = "40";
      logoY = "H-h-50";
    } else if (logoPosition === "bottom_right") {
      logoX = "W-w-40";
      logoY = "H-h-50";
    } else if (logoPosition === "bottom_center") {
      logoX = "(W-w)/2";
      logoY = "H-h-50";
    }
    const nextOut = "v_logo";
    filterParts.push(`[${currentVideoOut}][${logoInputIdx}:v]overlay=${logoX}:${logoY}[${nextOut}]`);
    currentVideoOut = nextOut;
  }

  // Overlay custom frame PNG if exists (1080x1920)
  if (customOverlayInputIdx >= 0) {
    const nextOut = "v_custom_overlay";
    filterParts.push(`[${currentVideoOut}][${customOverlayInputIdx}:v]overlay=0:0[${nextOut}]`);
    currentVideoOut = nextOut;
  }

  // Audio filtering
  const audioMapArgs: string[] = [];
  if (musicInputIdx >= 0 && musicVol > 0) {
    if (hasSourceAudio && originalVol > 0) {
      filterParts.push(
        `[0:a]volume=${originalVol}[a_orig]`,
        `[${musicInputIdx}:a]volume=${musicVol}[a_music]`,
        "[a_orig][a_music]amix=inputs=2:duration=first[out_a]"
      );
      audioMapArgs.push("-map", "[out_a]");
    } else {
      filterParts.push(`[${musicInputIdx}:a]volume=${musicVol}[out_a]`);
      audioMapArgs.push("-map", "[out_a]");
    }
  } else if (hasSourceAudio) {
    filterParts.push(`[0:a:0]volume=${originalVol},apad[out_a]`);
    audioMapArgs.push("-map", "[out_a]");
  }

  const maxDuration = options.maxDurationSeconds;
  const effectiveDuration = typeof maxDuration === "number" && Number.isFinite(maxDuration) && maxDuration > 0
    ? Math.min(trimDuration, Math.max(1, Math.floor(maxDuration * timeline.fps)) / timeline.fps)
    : trimDuration;

  if (hasOutro && audioMapArgs.length === 0) {
    const silentAudioIdx = filterStreamIdx++;
    inputs.push("-f", "lavfi", "-t", String(effectiveDuration), "-i", "anullsrc=r=44100:cl=stereo");
    audioMapArgs.push("-map", `${silentAudioIdx}:a:0`);
  }

  const durationArgs = ["-t", String(effectiveDuration), "-r", String(timeline.fps)];

  const ffmpegArgs: string[] = [
    "-y",
    ...inputs,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    `[${currentVideoOut}]`,
    ...audioMapArgs,
    ...durationArgs,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    ...(audioMapArgs.length > 0
      ? ["-c:a", "aac", "-b:a", "192k"]
      : ["-an"]),
    "-movflags",
    "+faststart",
    mainStageOutput,
  ];

  const now = new Date().toISOString();
  const videoTitle = titleText || `Stok Video - ${stockRow.name}`;
  let sourceMetadata: Record<string, unknown> = {};
  try {
    sourceMetadata = JSON.parse(stockRow.metadata_json || "{}");
  } catch {
    sourceMetadata = {};
  }

  // Log job in generation_jobs table (upsert if pre-registered)
  const existingJob = db.prepare("SELECT id FROM generation_jobs WHERE id = ?").get(renderId);
  const jobRequestJson = JSON.stringify({
    sourceStockVideoId: stockRow.id,
    frameStyle,
    headline: titleText,
    subtitle: subText,
    metadata: {
      ...sourceMetadata,
      headline: titleText,
      subtitle: subText,
      sourceStockVideoId: stockRow.id,
    },
    musicTrack: options.musicTrack,
    outroId: options.outroId,
    trimStartSeconds: trimStart,
    trimEndSeconds: rawTrimEnd,
    renderer: "ffmpeg-frame-engine",
  });

  if (existingJob) {
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'rendering', progress_json = ?, request_json = ?
      WHERE id = ?
    `).run(
      JSON.stringify({ percent: 30, phase: "rendering", detail: "FFmpeg ile video çerçevesi ve efektler işleniyor..." }),
      jobRequestJson,
      renderId
    );
  } else {
    db.prepare(`
      INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at)
      VALUES (?, ?, 'video', 'local', 'ffmpeg-frame-engine', 'rendering', ?, ?, ?, ?)
    `).run(
      renderId,
      options.projectId,
      `Stok videoya özel çerçeve ve başlık ekleme: ${videoTitle}`,
      jobRequestJson,
      JSON.stringify({ percent: 30, phase: "rendering", detail: "FFmpeg ile video çerçevesi ve efektler işleniyor..." }),
      now
    );
  }

  try {
    await execFileAsync("/usr/bin/ffmpeg", ffmpegArgs, {
      cwd: projectDir,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 180000,
    });

    // If outro exists, concatenate main video with outro
    if (hasOutro && outroRow?.local_path) {
      db.prepare(`
        UPDATE generation_jobs
        SET progress_json = ?
        WHERE id = ?
      `).run(
        JSON.stringify({ percent: 75, phase: "outro_concatenating", detail: "Bitiş videosu (outro) ana videoya ekleniyor..." }),
        renderId
      );
      const outroPath = outroRow.local_path;
      const outroDuration = timeline.outroDurationInFrames / timeline.fps;
      try {
        const concatInputs = ["-i", mainStageOutput, "-i", outroPath];
        if (!outroProbe?.hasAudio) {
          concatInputs.push("-f", "lavfi", "-t", String(outroDuration), "-i", "anullsrc=r=44100:cl=stereo");
        }
        const videoFilter = (index: number, duration: number) =>
          `[${index}:v:0]trim=duration=${duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=${timeline.fps},setsar=1[v${index}]`;
        const audioFilter = (input: number, output: number, duration: number) =>
          `[${input}:a:0]aformat=sample_rates=44100:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${output}]`;
        const concatArgs = [
          "-y", ...concatInputs, "-filter_complex",
          [videoFilter(0, effectiveDuration), videoFilter(1, outroDuration),
            audioFilter(0, 0, effectiveDuration), audioFilter(outroProbe?.hasAudio ? 1 : 2, 1, outroDuration),
            "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"].join(";"),
          "-map", "[v]", "-map", "[a]", "-t", String(effectiveDuration + outroDuration),
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputLocation,
        ];
        await execFileAsync("/usr/bin/ffmpeg", concatArgs, { cwd: projectDir, timeout: 180000 });
      } finally {
        if (fs.existsSync(mainStageOutput)) {
          fs.rmSync(mainStageOutput, { force: true });
        }
      }
    }

    if (transientMusicPath && options.musicSelection) {
      db.prepare(`
        UPDATE generation_jobs
        SET progress_json = ?
        WHERE id = ?
      `).run(
        JSON.stringify({ percent: 85, phase: "music_mixing", detail: "Arka plan müziği miksleniyor..." }),
        renderId
      );
      await mixMusicIntoVideo({
        videoPath: outputLocation,
        musicPath: transientMusicPath,
        offsetSeconds: options.musicSelection.offsetSeconds,
        musicVolume: musicVol,
        originalVolume: typeof options.originalVolume === "number" ? options.originalVolume : 1,
        outroIncluded: hasOutro,
      });
    }
    const finalDuration = (await probeVideo(outputLocation)).durationSeconds;
    if (!Number.isFinite(finalDuration) || finalDuration <= 0) throw new Error("Üretilen videonun süresi doğrulanamadı.");
    const finalUrl = `/api/videos/${renderId}`;
    const resultMetadata = {
      ...sourceMetadata,
      headline: titleText,
      subtitle: subText,
      sourceStockVideoId: stockRow.id,
      ...(options.musicSelection ? { music: { provider: options.musicSelection.track.provider, trackId: options.musicSelection.track.id, title: options.musicSelection.track.title, offsetSeconds: options.musicSelection.offsetSeconds, attribution: options.musicSelection.track.attribution || "", storage: "transient" } } : {}),
    };

    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete', response_json = ?, progress_json = ?, completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        url: finalUrl,
        title: videoTitle,
        durationSeconds: finalDuration,
        frameStyle,
        metadata: resultMetadata,
      }),
      JSON.stringify({ percent: 100, phase: "complete", detail: "Tamamlandı" }),
      new Date().toISOString(),
      renderId
    );

    return {
      id: renderId,
      url: finalUrl,
      title: videoTitle,
      durationSeconds: finalDuration,
      frameStyle,
      metadata: resultMetadata,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'failed', error = ?, completed_at = ?
      WHERE id = ?
    `).run(errorMsg.slice(0, 1000), new Date().toISOString(), renderId);
    throw new Error(`Video render işlemi başarısız oldu: ${errorMsg}`);
  } finally {
    // Cleanup temporary files
    if (maskSvgPath && fs.existsSync(maskSvgPath)) {
      fs.rmSync(maskSvgPath, { force: true });
    }
    if (borderSvgPath && fs.existsSync(borderSvgPath)) {
      fs.rmSync(borderSvgPath, { force: true });
    }
    if (overlaySvgPath && fs.existsSync(overlaySvgPath)) {
      fs.rmSync(overlaySvgPath, { force: true });
    }
    if (logoPngPath && fs.existsSync(logoPngPath)) {
      fs.rmSync(logoPngPath, { force: true });
    }
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
