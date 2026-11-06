import "server-only";

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { renderCreative } from "@/lib/server/cliproxy-creative";
import {
  synthesizeGeminiTtsSegment,
  probeAudioDurationSeconds,
} from "@/lib/server/rss-tts-service";
import type {
  RssAspectRatio,
  RssAudioSettings,
  RssCameraEffect,
  RssCaptionColor,
  RssCaptionStyle,
  RssScenePlan,
  RssStoryboard,
  RssTransitionType,
} from "@/features/generation/rss-video/types";

const execFileAsync = promisify(execFile);

function resolveFfmpegBin(): string {
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  return "ffmpeg";
}

const ASS_COLOR_MAP: Record<RssCaptionColor, { primary: string; highlight: string }> = {
  yellow: { primary: "&H00FFFFFF", highlight: "&H0000E6FF" }, // #FFE600 in BGR
  green: { primary: "&H00FFFFFF", highlight: "&H0088FF00" }, // #00FF88 in BGR
  cyan: { primary: "&H00FFFFFF", highlight: "&H00FFE500" }, // #00E5FF in BGR
  white: { primary: "&H00FFFFFF", highlight: "&H00E2E8F0" },
};

function formatAssTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\r?\n/g, " ")
    .trim();
}

function splitWordsIntoChunks(text: string, maxWords = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

/**
 * CapCut/TikTok kalitesinde, %0 Chromium yüküyle çalışan ASS (Advanced SubStation Alpha)
 * pop-in / vurgu animasyonlu altyazı dosyası oluşturur.
 */
export function buildAnimatedAssSubtitles(options: {
  scenes: Array<{ text: string; onScreenTextTr?: string; durationSeconds: number }>;
  width: number;
  height: number;
  captionStyle: RssCaptionStyle;
  captionColor: RssCaptionColor;
  outputPath: string;
}): string {
  const colors = ASS_COLOR_MAP[options.captionColor] || ASS_COLOR_MAP.yellow;
  const isPortrait = options.height > options.width;
  const fontSize = isPortrait ? 56 : 44;
  const badgeFontSize = isPortrait ? 38 : 32;
  // 1080x1080 merkez güvenli alanında kalması için MarginV (9:16'da alttan 440px)
  const marginV = isPortrait ? 430 : 90;
  const badgeMarginV = isPortrait ? 240 : 60;

  const borderStyle = options.captionStyle === "bold_box" ? 3 : 1;
  const outline = options.captionStyle === "cinema_clean" ? 3 : 5;
  const shadow = options.captionStyle === "bold_box" ? 0 : 3;
  const backColour = options.captionStyle === "bold_box" ? "&H99000000" : "&H80000000";

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${options.width}`,
    `PlayResY: ${options.height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: MainCaption,DejaVu Sans,${fontSize},${colors.primary},${colors.highlight},&H00000000,${backColour},-1,0,0,0,100,100,0.5,0,${borderStyle},${outline},${shadow},2,70,70,${marginV},1`,
    `Style: TopHookBadge,DejaVu Sans,${badgeFontSize},${colors.highlight},${colors.primary},&H00000000,&H99000000,-1,0,0,0,100,100,1,0,3,4,0,8,80,80,${badgeMarginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  let cursor = 0;
  for (const scene of options.scenes) {
    const dur = Math.max(0.5, scene.durationSeconds);
    const chunks = splitWordsIntoChunks(scene.text, 4);

    if (scene.onScreenTextTr && scene.onScreenTextTr.trim()) {
      const badgeStart = formatAssTime(cursor + 0.08);
      const badgeEnd = formatAssTime(cursor + Math.min(dur - 0.1, 3.2));
      const cleanBadge = escapeAssText(scene.onScreenTextTr.toUpperCase());
      lines.push(
        `Dialogue: 2,${badgeStart},${badgeEnd},TopHookBadge,,0,0,0,,{\\fad(120,150)\\fscx92\\fscy92\\t(0,140,\\fscx100\\fscy100)}${cleanBadge}`
      );
    }

    if (chunks.length > 0) {
      const chunkDur = dur / chunks.length;
      for (let i = 0; i < chunks.length; i++) {
        const cStart = cursor + i * chunkDur;
        const cEnd = cStart + chunkDur;
        const words = chunks[i].split(/\s+/);
        // Son kelimeyi veya rakam içeren kelimeyi vurgu rengiyle boya
        const styledWords = words.map((w, wIdx) => {
          const cleanW = escapeAssText(w);
          const isHighlight =
            options.captionStyle === "tiktok_pop" &&
            (wIdx === words.length - 1 || /\d/.test(cleanW));
          return isHighlight
            ? `{\\c${colors.highlight}}${cleanW}{\\c${colors.primary}}`
            : cleanW;
        });

        const popTag =
          options.captionStyle === "tiktok_pop"
            ? "{\\fad(70,50)\\fscx88\\fscy88\\t(0,110,\\fscx105\\fscy105)\\t(110,200,\\fscx100\\fscy100)}"
            : "{\\fad(90,70)}";

        lines.push(
          `Dialogue: 1,${formatAssTime(cStart)},${formatAssTime(cEnd)},MainCaption,,0,0,0,,${popTag}${styledWords.join(" ")}`
        );
      }
    }

    cursor += dur;
  }

  const content = lines.join("\n") + "\n";
  fs.writeFileSync(options.outputPath, content, "utf-8");
  return content;
}

export function resolveDimensions(aspectRatio: RssAspectRatio): { width: number; height: number } {
  if (aspectRatio === "16:9") return { width: 1920, height: 1080 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

export function buildSceneMotionFilter(options: {
  effect: RssCameraEffect;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
}): string {
  const { effect, durationSeconds, width, height, fps } = options;
  const frames = Math.max(1, Math.round(durationSeconds * fps));
  const lastFrame = Math.max(1, frames - 1);
  const progress = `(on/${lastFrame})`;
  const durStr = Math.max(0.1, durationSeconds).toFixed(4);

  // Oversampled buffer prevents sub-pixel jitter in FFmpeg zoompan
  const bufW = Math.ceil((width * 1.36) / 2) * 2;
  const bufH = Math.ceil((height * 1.36) / 2) * 2;

  const makeZoompan = (
    zExpr: string,
    xExpr = "iw/2-(iw/zoom/2)",
    yExpr = "ih/2-(ih/zoom/2)"
  ) =>
    `scale=${bufW}:${bufH}:force_original_aspect_ratio=increase,` +
    `crop=${bufW}:${bufH},` +
    `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}:fps=${fps},` +
    `setsar=1,trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p`;

  switch (effect) {
    case "cinematic_push":
      return makeZoompan(`1.02+0.18*${progress}`);
    case "ken_burns_zoom_out":
      return makeZoompan(`1.18-0.16*${progress}`);
    case "zoom_in_fast":
      return makeZoompan(`1.0+0.26*${progress}`);
    case "pulse":
      return makeZoompan(`1.06+0.06*sin(2*PI*2*${progress})`);
    case "pan_right":
    case "pan_left":
    case "drift_left_right":
    case "tilt_pan": {
      const xExpr =
        effect === "pan_right"
          ? `(in_w-out_w)*min(t/${durStr},1)`
          : effect === "pan_left"
          ? `(in_w-out_w)*(1-min(t/${durStr},1))`
          : effect === "drift_left_right"
          ? `(in_w-out_w)*(0.5+0.35*sin(2*PI*t/${durStr}))`
          : `(in_w-out_w)*0.8*min(t/${durStr},1)`;
      const yExpr =
        effect === "tilt_pan"
          ? `(in_h-out_h)*(0.5+0.2*sin(2*PI*t/${durStr}))`
          : "(in_h-out_h)/2";
      return (
        `scale=${bufW}:${bufH}:force_original_aspect_ratio=increase,` +
        `crop=${bufW}:${bufH},` +
        `crop=${width}:${height}:x='${xExpr}':y='${yExpr}',` +
        `setsar=1,fps=${fps},trim=end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p`
      );
    }
    case "ken_burns_zoom_in":
    default:
      return makeZoompan(`1.0+0.15*${progress}`);
  }
}

function escapeFfmpegFilterPath(filePath: string): string {
  return path
    .resolve(filePath)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Sahne görsellerini, xfade geçişlerini, ASS animasyonlu altyazıyı, Gemini 2.0 TTS seslendirmesini
 * ve arka plan fon müziğini tek bir FFmpeg encode geçişinde birleştirir.
 */
export async function composeRssVideo(options: {
  scenes: Array<{
    imagePath: string;
    durationSeconds: number;
    cameraEffect: RssCameraEffect;
    transition: RssTransitionType;
  }>;
  voiceAudioPath: string;
  totalAudioDuration: number;
  assSubtitlePath?: string;
  bgmPath?: string;
  bgmDuckingDb: number;
  width: number;
  height: number;
  fps?: number;
  outputPath: string;
}): Promise<void> {
  const fps = options.fps || 30;
  const transitionDur = options.scenes.length > 1 ? 0.35 : 0;
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y", "-nostdin"];

  // 1. Her sahne görselini geçiş örtüşmesi (+transitionDur) kadar uzun besle
  for (let i = 0; i < options.scenes.length; i++) {
    const sc = options.scenes[i];
    const isLast = i === options.scenes.length - 1;
    const clipDur = sc.durationSeconds + (isLast ? 0.2 : transitionDur);
    args.push(
      "-loop",
      "1",
      "-framerate",
      String(fps),
      "-t",
      clipDur.toFixed(4),
      "-i",
      sc.imagePath
    );
  }

  // 2. Seslendirme girdisi
  const voiceInputIdx = options.scenes.length;
  args.push("-i", options.voiceAudioPath);

  // 3. Arka plan müziği girdisi (varsa)
  const hasBgm = Boolean(options.bgmPath && fs.existsSync(options.bgmPath));
  const bgmInputIdx = hasBgm ? voiceInputIdx + 1 : null;
  if (hasBgm && options.bgmPath) {
    args.push("-i", options.bgmPath);
  }

  // 4. Filter Complex inşası
  const filterLines: string[] = [];
  for (let i = 0; i < options.scenes.length; i++) {
    const sc = options.scenes[i];
    const isLast = i === options.scenes.length - 1;
    const clipDur = sc.durationSeconds + (isLast ? 0.2 : transitionDur);
    const motionFilter = buildSceneMotionFilter({
      effect: sc.cameraEffect,
      durationSeconds: clipDur,
      width: options.width,
      height: options.height,
      fps,
    });
    filterLines.push(`[${i}:v]${motionFilter}[v${i}]`);
  }

  let currentVideoLabel = "v0";
  if (options.scenes.length > 1) {
    let accumulatedOffset = 0;
    for (let i = 1; i < options.scenes.length; i++) {
      accumulatedOffset += options.scenes[i - 1].durationSeconds;
      const nextLabel = `vx${i}`;
      const tr = options.scenes[i - 1].transition || "dissolve";
      const safeOffset = Math.max(0.1, accumulatedOffset - transitionDur * 0.5);
      filterLines.push(
        `[${currentVideoLabel}][v${i}]xfade=transition=${tr}:duration=${transitionDur.toFixed(2)}:offset=${safeOffset.toFixed(3)}[${nextLabel}]`
      );
      currentVideoLabel = nextLabel;
    }
  }

  if (options.assSubtitlePath && fs.existsSync(options.assSubtitlePath)) {
    const subLabel = "vsub";
    filterLines.push(
      `[${currentVideoLabel}]ass=filename='${escapeFfmpegFilterPath(options.assSubtitlePath)}'[${subLabel}]`
    );
    currentVideoLabel = subLabel;
  }

  const finalVideoLabel = "vout";
  const totDur = Math.max(1, options.totalAudioDuration).toFixed(3);
  filterLines.push(
    `[${currentVideoLabel}]trim=duration=${totDur},setpts=PTS-STARTPTS,format=yuv420p[${finalVideoLabel}]`
  );

  // Audio mix (Voice + optional BGM with ducking)
  const voiceLabel = "avoice";
  filterLines.push(
    `[${voiceInputIdx}:a]aresample=48000,atrim=duration=${totDur},asetpts=PTS-STARTPTS[${voiceLabel}]`
  );

  let finalAudioLabel = voiceLabel;
  if (bgmInputIdx !== null) {
    const bgmLabel = "abgm";
    const mixedLabel = "aout";
    filterLines.push(
      `[${bgmInputIdx}:a]aloop=loop=-1:size=2147483647,atrim=duration=${totDur},asetpts=PTS-STARTPTS,volume=${options.bgmDuckingDb}dB[${bgmLabel}]`
    );
    filterLines.push(
      `[${voiceLabel}][${bgmLabel}]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[${mixedLabel}]`
    );
    finalAudioLabel = mixedLabel;
  }

  const filterComplexStr = filterLines.join(";");
  const partOutputPath = `${options.outputPath}.part.mp4`;

  try {
    args.push(
      "-filter_complex",
      filterComplexStr,
      "-map",
      `[${finalVideoLabel}]`,
      "-map",
      `[${finalAudioLabel}]`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      partOutputPath
    );

    await execFileAsync(resolveFfmpegBin(), args, {
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    });

    if (!fs.existsSync(partOutputPath) || fs.statSync(partOutputPath).size < 1024) {
      throw new Error("FFmpeg video çıktısı oluşturulamadı veya dosya boş.");
    }
    fs.renameSync(partOutputPath, options.outputPath);
  } finally {
    fs.rmSync(partOutputPath, { force: true });
  }
}

async function concatAudioSegments(segmentPaths: string[], outputPath: string): Promise<void> {
  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], outputPath);
    return;
  }
  const listPath = `${outputPath}.concat.txt`;
  const listContent = segmentPaths
    .map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent, "utf-8");
  try {
    await execFileAsync(
      resolveFfmpegBin(),
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath],
      { timeout: 30_000 }
    );
  } finally {
    fs.rmSync(listPath, { force: true });
  }
}

export interface RssVideoJobRequest {
  isRssVideo: true;
  origin: "marka_motoru";
  title: string;
  topic: string;
  sourceMode: "rss" | "url" | "prompt";
  sourceUrl?: string;
  narrativeStyle: RssStoryboard["narrativeStyle"];
  visualMood: RssStoryboard["visualMood"];
  aspectRatio: RssAspectRatio;
  durationSeconds: number;
  storyboard: RssStoryboard;
  audioSettings: RssAudioSettings;
}

export async function processRssVideoJob(job: {
  id: string;
  project_id: string;
  prompt: string;
  request_json: string;
}): Promise<void> {
  const db = getDatabase();
  const updateProgress = (phase: string, percent: number, detail: string, extra?: Record<string, unknown>) => {
    db.prepare(
      "UPDATE generation_jobs SET status = 'rendering', progress_json = ? WHERE id = ?"
    ).run(
      JSON.stringify({
        phase,
        percent,
        detail,
        updatedAt: new Date().toISOString(),
        ...(extra || {}),
      }),
      job.id
    );
  };

  const claimed = db
    .prepare(
      "UPDATE generation_jobs SET status = 'rendering', progress_json = ? WHERE id = ? AND status = 'queued'"
    )
    .run(
      JSON.stringify({
        phase: "starting",
        percent: 8,
        detail: "RSS Video üretim hattı başlatılıyor...",
        updatedAt: new Date().toISOString(),
      }),
      job.id
    );

  if (!claimed.changes) return;

  const tempDir = path.join(process.cwd(), ".data", "temp-renders", `rss-${job.id}`);
  const outputDir = path.join(process.cwd(), ".data", "video-renders");
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    const req = JSON.parse(job.request_json || "{}") as Partial<RssVideoJobRequest>;
    const storyboard = req.storyboard;
    const scenes: RssScenePlan[] = storyboard?.scenes || [];
    if (!scenes.length) {
      throw new Error("Senaryoda işlenecek sahne bulunamadı.");
    }

    const providerRow = db
      .prepare(
        "SELECT base_url, encrypted_api_key, image_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1"
      )
      .get() as { base_url: string; encrypted_api_key: string; image_model: string } | undefined;

    if (!providerRow?.base_url || !providerRow.encrypted_api_key) {
      throw new Error("Sahne görselleri için Sistem Ayarları > CliProxyAPI bağlantısı aktif olmalıdır.");
    }

    const cliproxyApiKey = decryptSecret(providerRow.encrypted_api_key);
    const cliproxyBaseUrl = providerRow.base_url.replace(/\/+$/, "");
    const imageModel = providerRow.image_model || "gemini-3.1-flash-image";
    const aspectRatio: RssAspectRatio = req.aspectRatio || storyboard?.aspectRatio || "9:16";
    const audioSettings: RssAudioSettings = req.audioSettings || {
      voiceActor: "Kore",
      voiceSpeed: 1.0,
      voiceEmotion: "auto",
      captionStyle: "tiktok_pop",
      captionColor: "yellow",
      includeMusic: true,
      musicMood: "dynamic_news",
      musicDucking: "-18dB",
    };

    // 1. ADIM: Sahne Görsellerini CLIProxyAPI ile Üret (Önceden üretilmiş sahne görseli varsa yeniden kullan, yoksa üretip kaydet)
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    const imagePaths: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const imgOutPath = path.join(tempDir, `scene_${i + 1}.png`);

      // Eğer kullanıcı sahne önizlemesinde görseli zaten ürettiyse doğrudan onu kullan
      const existingAssetId = sc.previewImageUrl?.match(/^\/api\/assets\/([a-f0-9-]{36})/i)?.[1];
      const existingAssetPath = existingAssetId
        ? path.join(/*turbopackIgnore: true*/ assetsDir, `${existingAssetId}.png`)
        : "";

      if (existingAssetPath && fs.existsSync(/*turbopackIgnore: true*/ existingAssetPath)) {
        fs.copyFileSync(/*turbopackIgnore: true*/ existingAssetPath, imgOutPath);
        imagePaths.push(imgOutPath);
        continue;
      }

      const pct = Math.round(12 + ((i + 0.5) / scenes.length) * 40);
      updateProgress(
        "imaging",
        pct,
        `Sahne ${i + 1}/${scenes.length} görseli CliProxy (${imageModel}) ile üretiliyor...`,
        { currentScene: i + 1, totalScenes: scenes.length }
      );

      const rendered = await renderCreative({
        baseUrl: cliproxyBaseUrl,
        apiKey: cliproxyApiKey,
        model: imageModel,
        prompt: sc.promptEn,
        ratio: aspectRatio,
      });

      const pngBytes = await sharp(rendered.bytes).png().toBuffer();
      fs.writeFileSync(imgOutPath, pngBytes);
      imagePaths.push(imgOutPath);

      // Kalıcı sahne önizlemesi olarak .data/assets içine de kaydet ki kullanıcı sağ panelde görebilsin
      try {
        const assetId = crypto.randomUUID();
        const assetPngPath = path.join(assetsDir, `${assetId}.png`);
        const assetThumbPath = path.join(assetsDir, `${assetId}_thumb.webp`);
        const assetMetaPath = path.join(assetsDir, `${assetId}.json`);
        fs.writeFileSync(assetPngPath, pngBytes);
        await sharp(pngBytes)
          .resize({ width: 360, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toFile(assetThumbPath);
        fs.writeFileSync(
          assetMetaPath,
          JSON.stringify({
            id: assetId,
            projectId: job.project_id,
            mimeType: "image/png",
            extension: "png",
            isRssSceneImage: true,
            sceneIndex: i + 1,
            createdAt: new Date().toISOString(),
          }),
          "utf-8"
        );
        sc.previewImageUrl = `/api/assets/${assetId}`;
        if (storyboard) {
          storyboard.scenes = scenes;
          req.storyboard = storyboard;
          db.prepare("UPDATE generation_jobs SET request_json = ? WHERE id = ?").run(
            JSON.stringify(req),
            job.id
          );
        }
      } catch {
        // Önizleme kaydı hatası ana video üretimini durdurmaz
      }
    }

    // 2. ADIM: Gemini 2.0 TTS ile Sahne Bazlı Seslendirme (Edge-TTS Yedeği YOK, Fail-Fast)
    const audioSegmentPaths: string[] = [];
    const actualDurations: number[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const pct = Math.round(55 + ((i + 0.5) / scenes.length) * 25);
      updateProgress(
        "tts",
        pct,
        `Sahne ${i + 1}/${scenes.length} Gemini 2.0 TTS (${audioSettings.voiceActor}) ile seslendiriliyor...`,
        { currentScene: i + 1, totalScenes: scenes.length }
      );

      const segPath = path.join(tempDir, `tts_${i + 1}.mp3`);
      const emotion =
        audioSettings.voiceEmotion === "auto"
          ? sc.voiceEmotion || "calm"
          : audioSettings.voiceEmotion;

      const ttsRes = await synthesizeGeminiTtsSegment({
        text: sc.voiceoverTr,
        outputPath: segPath,
        voice: audioSettings.voiceActor || "Kore",
        emotion,
        speed: audioSettings.voiceSpeed || 1.0,
      });

      audioSegmentPaths.push(segPath);
      actualDurations.push(Math.max(2.0, ttsRes.durationSeconds));
    }

    const masterVoicePath = path.join(tempDir, "voice_master.mp3");
    await concatAudioSegments(audioSegmentPaths, masterVoicePath);
    const totalAudioDuration = await probeAudioDurationSeconds(masterVoicePath);

    // 3. ADIM: ASS Animasyonlu Altyazı Oluşturma
    const { width, height } = resolveDimensions(aspectRatio);
    let assPath: string | undefined;
    if (audioSettings.captionStyle !== "off") {
      assPath = path.join(tempDir, "captions.ass");
      buildAnimatedAssSubtitles({
        scenes: scenes.map((sc, idx) => ({
          text: sc.voiceoverTr,
          onScreenTextTr: sc.onScreenTextTr,
          durationSeconds: actualDurations[idx],
        })),
        width,
        height,
        captionStyle: audioSettings.captionStyle,
        captionColor: audioSettings.captionColor,
        outputPath: assPath,
      });
    }

    // 4. ADIM: Arka Plan Müziği & FFmpeg Tek Geçişli Sinematik Kurgu
    updateProgress(
      "composing",
      86,
      "FFmpeg xfade geçişleri, zoompan kamera hareketleri ve ASS altyazılar birleştiriliyor..."
    );

    const defaultBgmPath = path.join(process.cwd(), "public", "audio", "ambient_track.mp3");
    const bgmPath =
      audioSettings.includeMusic && fs.existsSync(defaultBgmPath) ? defaultBgmPath : undefined;
    const duckingDb = parseFloat(String(audioSettings.musicDucking || "-18dB").replace("dB", "")) || -18;

    const finalMp4Path = path.join(outputDir, `${job.id}.mp4`);
    await composeRssVideo({
      scenes: scenes.map((sc, idx) => ({
        imagePath: imagePaths[idx],
        durationSeconds: actualDurations[idx],
        cameraEffect: sc.cameraEffect || "ken_burns_zoom_in",
        transition: sc.transition || "dissolve",
      })),
      voiceAudioPath: masterVoicePath,
      totalAudioDuration,
      assSubtitlePath: assPath,
      bgmPath,
      bgmDuckingDb: duckingDb,
      width,
      height,
      fps: 30,
      outputPath: finalMp4Path,
    });

    const now = new Date().toISOString();
    const roundedDuration = Math.round(totalAudioDuration);
    db.prepare(
      `UPDATE generation_jobs
       SET status = 'complete',
           response_json = ?,
           progress_json = ?,
           completed_at = ?
       WHERE id = ?`
    ).run(
      JSON.stringify({
        url: `/api/videos/${job.id}`,
        title: storyboard?.title || req.title || "RSS Video",
        durationSeconds: roundedDuration,
        isRssVideo: true,
        narrativeStyle: storyboard?.narrativeStyle || req.narrativeStyle,
        visualMood: storyboard?.visualMood || req.visualMood,
      }),
      JSON.stringify({
        phase: "complete",
        percent: 100,
        detail: `RSS Video hazır (${roundedDuration} sn • ${scenes.length} sahne).`,
        updatedAt: now,
      }),
      now,
      job.id
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE generation_jobs
       SET status = 'failed',
           error = ?,
           progress_json = ?,
           completed_at = ?
       WHERE id = ?`
    ).run(
      errorMsg.slice(0, 1200),
      JSON.stringify({
        phase: "failed",
        percent: 100,
        detail: errorMsg.slice(0, 300),
        updatedAt: now,
      }),
      now,
      job.id
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
