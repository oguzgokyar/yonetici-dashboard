import "server-only";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getDatabase } from "@/lib/server/database";
import { ensureCachedVideo } from "@/lib/server/google-drive";

const execFileAsync = promisify(execFile);

export type FrameStyle = "blur_padding" | "modern_card" | "split_screen" | "minimal_glow";

export type RenderStockVideoOptions = {
  projectId: string;
  stockVideoId: string;
  frameStyle: FrameStyle;
  headline?: string;
  subtitle?: string;
  headlineColor?: string;
  subtitleColor?: string;
  headlineBgColor?: string;
  accentColor?: string;
  logoUrl?: string;
  logoPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none";
  logoSize?: number;
  outroId?: string;
  musicTrack?: string;
  originalVolume?: number;
  musicVolume?: number;
  maxDurationSeconds?: number;
};

export type RenderedStockVideoResult = {
  id: string;
  url: string;
  title: string;
  durationSeconds: number;
  frameStyle: FrameStyle;
  createdAt: string;
};

export async function renderFramedStockVideo(
  options: RenderStockVideoOptions
): Promise<RenderedStockVideoResult> {
  const db = getDatabase();
  const projectDir = process.cwd();
  const outputDir = path.join(projectDir, ".data", "video-renders");
  const tempDir = path.join(projectDir, ".data", "temp-renders");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const renderId = crypto.randomUUID();
  const outputLocation = path.join(outputDir, `${renderId}.mp4`);

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
    } | undefined;

  if (!stockRow) {
    throw new Error("Stok video bulunamadı.");
  }

  // Ensure local video is cached
  const { localPath } = await ensureCachedVideo(stockRow.drive_file_id);

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
  const originalVol = typeof options.originalVolume === "number" ? options.originalVolume : 1.0;
  const musicVol = typeof options.musicVolume === "number" ? options.musicVolume : 0.5;

  // Generate an overlay image with headline / subtitle / badges if text exists
  const overlaySvgPath = path.join(tempDir, `${renderId}_overlay.png`);
  let hasTextOverlay = false;

  const titleText = (options.headline || "").trim();
  const subText = (options.subtitle || "").trim();
  const headlineColor = options.headlineColor || "#ffffff";
  const subtitleColor = options.subtitleColor || "#cbd5e1";
  const headlineBgColor = options.headlineBgColor || "#000000";
  const logoSize = Math.max(60, Math.min(options.logoSize || 140, 260));

  if (titleText || subText) {
    hasTextOverlay = true;
    const sharp = (await import("sharp")).default;

    const svgWidth = 1080;
    const svgHeight = 1920;

    let headlineY = 160;
    let cardHeight = 180;
    if (frameStyle === "split_screen") {
      headlineY = 140;
      cardHeight = 240;
    } else if (frameStyle === "blur_padding") {
      headlineY = 200;
    }

    const svg = `
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
          </filter>
        </defs>
        ${
          titleText
            ? `
          <g filter="url(#shadow)">
            <rect x="80" y="${headlineY - 50}" width="920" height="${subText ? cardHeight + 40 : cardHeight}" rx="28" fill="${headlineBgColor}" fill-opacity="0.82" stroke="${accentColor}" stroke-width="3" />
            <text x="540" y="${headlineY + 40}" font-family="sans-serif" font-size="46" font-weight="bold" fill="${headlineColor}" text-anchor="middle" dominant-baseline="middle">
              ${escapeXml(titleText)}
            </text>
            ${
              subText
                ? `<text x="540" y="${headlineY + 110}" font-family="sans-serif" font-size="28" font-weight="500" fill="${subtitleColor}" text-anchor="middle" dominant-baseline="middle">
                    ${escapeXml(subText)}
                  </text>`
                : ""
            }
          </g>`
            : ""
        }
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(overlaySvgPath);
  }

  // Handle Logo
  let logoPngPath = "";
  const rawLogo = options.logoUrl || brand.logo;
  if (rawLogo && logoPosition !== "none") {
    try {
      const sharp = (await import("sharp")).default;
      logoPngPath = path.join(tempDir, `${renderId}_logo.png`);
      let logoBuf: Buffer | null = null;
      if (rawLogo.startsWith("data:")) {
        const parts = rawLogo.split(",");
        logoBuf = Buffer.from(parts[1], "base64");
      } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
        const r = await fetch(rawLogo);
        if (r.ok) logoBuf = Buffer.from(await r.arrayBuffer());
      } else if (fs.existsSync(rawLogo)) {
        logoBuf = fs.readFileSync(rawLogo);
      }

      if (logoBuf) {
        await sharp(logoBuf)
          .resize({ width: logoSize, height: logoSize, fit: "inside" })
          .png()
          .toFile(logoPngPath);
      }
    } catch {
      logoPngPath = "";
    }
  }

  // Audio configuration
  let musicAudioPath = "";
  if (options.musicTrack && options.musicTrack !== "none") {
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

  // Build FFmpeg inputs and filter complex
  const inputs: string[] = ["-i", localPath];
  let filterStreamIdx = 1;

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

  let musicInputIdx = -1;
  if (musicAudioPath && fs.existsSync(/*turbopackIgnore: true*/ musicAudioPath)) {
    inputs.push("-stream_loop", "-1", "-i", musicAudioPath);
    musicInputIdx = filterStreamIdx++;
  }

  // Compose video filters
  const filterParts: string[] = [];
  let currentVideoOut = "v_base";

  if (frameStyle === "blur_padding") {
    // 9:16 target with blurred background and centered sharp foreground
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:5[bg]",
      "[0:v]scale=980:1740:force_original_aspect_ratio=decrease[fg]",
      "[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]"
    );
  } else if (frameStyle === "split_screen") {
    // Split screen: Top banner header, centered video, bottom banner footer
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:8,eq=brightness=-0.2[bg]",
      "[0:v]scale=1000:1360:force_original_aspect_ratio=decrease[fg]",
      "[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]"
    );
  } else if (frameStyle === "modern_card") {
    // Modern card with padding and subtle shadow/color
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=35:6,eq=brightness=-0.15[bg]",
      "[0:v]scale=940:1680:force_original_aspect_ratio=decrease[fg]",
      "[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]"
    );
  } else {
    // Minimal glow: video scaled with minimal padding
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:4[bg]",
      "[0:v]scale=1020:1820:force_original_aspect_ratio=decrease[fg]",
      "[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]"
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
    let logoX = "W-w-50";
    let logoY = "50";
    if (logoPosition === "top_left") {
      logoX = "50";
      logoY = "50";
    } else if (logoPosition === "bottom_left") {
      logoX = "50";
      logoY = "H-h-80";
    } else if (logoPosition === "bottom_right") {
      logoX = "W-w-50";
      logoY = "H-h-80";
    } else if (logoPosition === "bottom_center") {
      logoX = "(W-w)/2";
      logoY = "H-h-80";
    }
    const nextOut = "v_logo";
    filterParts.push(`[${currentVideoOut}][${logoInputIdx}:v]overlay=${logoX}:${logoY}[${nextOut}]`);
    currentVideoOut = nextOut;
  }

  // Audio filtering
  const audioMapArgs: string[] = [];
  if (musicInputIdx >= 0 && musicVol > 0) {
    if (originalVol > 0) {
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
  } else if (originalVol > 0) {
    audioMapArgs.push("-map", "0:a?");
  }

  const durationLimit = options.maxDurationSeconds || 30;

  const ffmpegArgs: string[] = [
    "-y",
    ...inputs,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    `[${currentVideoOut}]`,
    ...audioMapArgs,
    "-t",
    String(durationLimit),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    mainStageOutput,
  ];

  const now = new Date().toISOString();
  const videoTitle = titleText || `Stok Video - ${stockRow.name}`;

  // Log job in generation_jobs table
  db.prepare(`
    INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, created_at)
    VALUES (?, ?, 'video', 'local', 'ffmpeg-frame-engine', 'rendering', ?, ?, ?)
  `).run(
    renderId,
    options.projectId,
    `Stok videoya özel çerçeve ve başlık ekleme: ${videoTitle}`,
    JSON.stringify({
      sourceStockVideoId: stockRow.id,
      frameStyle,
      headline: titleText,
      subtitle: subText,
      musicTrack: options.musicTrack,
      outroId: options.outroId,
      renderer: "ffmpeg-frame-engine",
    }),
    now
  );

  try {
    await execFileAsync("/usr/bin/ffmpeg", ffmpegArgs, {
      cwd: projectDir,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 180000,
    });

    // If outro exists, concatenate main video with outro
    if (hasOutro && outroRow?.local_path) {
      const outroPath = outroRow.local_path;
      try {
        const concatArgs = [
          "-y",
          "-i", mainStageOutput,
          "-i", outroPath,
          "-filter_complex",
          "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v0];" +
          "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v1];" +
          "[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];" +
          "[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];" +
          "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
          "-map", "[v]",
          "-map", "[a]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "22",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags", "+faststart",
          outputLocation,
        ];
        await execFileAsync("/usr/bin/ffmpeg", concatArgs, { cwd: projectDir, timeout: 180000 });
      } catch {
        // Fallback with silent audio for outro if it lacks an audio stream
        const fallbackArgs = [
          "-y",
          "-i", mainStageOutput,
          "-i", outroPath,
          "-f", "lavfi", "-t", "30", "-i", "anullsrc=r=44100:cl=stereo",
          "-filter_complex",
          "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v0];" +
          "[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1[v1];" +
          "[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];" +
          "[2:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];" +
          "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
          "-map", "[v]",
          "-map", "[a]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "22",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags", "+faststart",
          outputLocation,
        ];
        await execFileAsync("/usr/bin/ffmpeg", fallbackArgs, { cwd: projectDir, timeout: 180000 });
      } finally {
        if (fs.existsSync(mainStageOutput)) {
          fs.rmSync(mainStageOutput, { force: true });
        }
      }
    }

    const finalUrl = `/api/videos/${renderId}`;
    db.prepare(`
      UPDATE generation_jobs
      SET status = 'complete', response_json = ?, completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        url: finalUrl,
        title: videoTitle,
        durationSeconds: durationLimit,
        frameStyle,
      }),
      new Date().toISOString(),
      renderId
    );

    return {
      id: renderId,
      url: finalUrl,
      title: videoTitle,
      durationSeconds: durationLimit,
      frameStyle,
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
