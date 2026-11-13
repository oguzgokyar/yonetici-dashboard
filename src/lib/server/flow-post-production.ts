import "server-only";

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import type {
  CaptionStyleOption,
  CaptionColorOption,
  VoiceActorOption,
  VoiceSpeedOption,
  VoiceEmotionOption,
  MusicDuckingOption,
  MusicMoodOption,
  AudioProductionSettings,
} from "@/features/generation/google-vids/types";
import { synthesizeGeminiTtsSegment } from "@/lib/server/rss-tts-service";

export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Türkçe fonetik hece ve noktalama ağırlıklı kelime zamanlama dağıtıcısı (0 CPU).
 */
export function alignTurkishPhonetics(text: string, durationSeconds: number): TimedWord[] {
  const rawWords = text.trim().split(/\s+/);
  if (!rawWords.length || !rawWords[0]) return [];

  const vowels = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü", "A", "E", "I", "İ", "O", "Ö", "U", "Ü"]);
  const weights: number[] = [];

  for (const w of rawWords) {
    let sylCount = 0;
    for (const ch of w) {
      if (vowels.has(ch)) sylCount++;
    }
    sylCount = Math.max(1, sylCount);
    const pauseBonus = /[.!?]$/.test(w) ? 0.4 : /[,;:]$/.test(w) ? 0.2 : 0;
    weights.push(sylCount + pauseBonus * 1.5);
  }

  const totalWeight = weights.reduce((acc, val) => acc + val, 0);
  const effectiveDur = Math.max(durationSeconds - 0.4, 1.0);
  let startTime = 0.2;

  const timedWords: TimedWord[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const dur = (weights[i] / totalWeight) * effectiveDur;
    const cleanWord = rawWords[i].replace(/[^\w\sğüşöçıİĞÜŞÖÇ]/gi, "").toUpperCase();
    if (cleanWord) {
      timedWords.push({
        word: cleanWord,
        startMs: Math.round(startTime * 1000),
        endMs: Math.round((startTime + dur) * 1000),
      });
    }
    startTime += dur;
  }

  return timedWords;
}

/**
 * TikTok / Reels tarzı kelime kelime sarı/yeşil vurgulu ve ekran kanca metinli ASS Altyazı Şablonu üretir.
 */
export function generateTikTokAssScript(options: {
  timedWords: TimedWord[];
  color?: CaptionColorOption;
  onScreenText?: string;
  durationSeconds?: number;
  captionStyle?: CaptionStyleOption;
  width?: number;
  height?: number;
}): string {
  const {
    timedWords,
    color = "yellow",
    onScreenText,
    durationSeconds = 5,
    captionStyle = "tiktok",
    width = 720,
    height = 1280,
  } = options;

  const colorMap: Record<CaptionColorOption, string> = {
    yellow: "&H0000FFFF", // BGR
    green: "&H0000FF00",
    cyan: "&H00FFFF00",
  };
  const highlightColor = colorMap[color] || "&H0000FFFF";

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: HookTitle,DejaVu Sans,32,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,3,8,2,8,40,40,140,1
Style: TikTok,DejaVu Sans,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,4,2,2,30,30,260,1
Style: Classic,DejaVu Sans,36,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,3,1,2,30,30,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const fmtTs = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return `${m}:${s < 10 ? "0" : ""}${s}.${cs < 10 ? "0" : ""}${cs}`;
  };

  const events: string[] = [];

  // 1. Ekran Metni (On-Screen Text / Hook Title)
  if (onScreenText && onScreenText.trim()) {
    const cleanHook = onScreenText.trim().replace(/[\r\n]+/g, " ");
    const hookEnd = Math.min(Math.max(durationSeconds, 3.5), 4.5);
    events.push(`Dialogue: 1,0:00.00,${fmtTs(hookEnd)},HookTitle,,0,0,0,,${cleanHook}`);
  }

  // 2. Altyazı (TikTok veya Klasik)
  if (captionStyle !== "off" && timedWords.length > 0) {
    if (captionStyle === "classic") {
      const chunkSize = 5;
      for (let cIdx = 0; cIdx < timedWords.length; cIdx += chunkSize) {
        const chunk = timedWords.slice(cIdx, cIdx + chunkSize);
        const startS = chunk[0].startMs / 1000.0;
        const endS = chunk[chunk.length - 1].endMs / 1000.0;
        const line = chunk.map((c) => c.word).join(" ");
        events.push(`Dialogue: 0,${fmtTs(startS)},${fmtTs(endS)},Classic,,0,0,0,,${line}`);
      }
    } else {
      const chunkSize = 3;
      for (let cIdx = 0; cIdx < timedWords.length; cIdx += chunkSize) {
        const chunk = timedWords.slice(cIdx, cIdx + chunkSize);
        for (let activeIdx = 0; activeIdx < chunk.length; activeIdx++) {
          const activeItem = chunk[activeIdx];
          const startS = activeItem.startMs / 1000.0;
          const endS = activeItem.endMs / 1000.0;

          const lineParts: string[] = [];
          for (let j = 0; j < chunk.length; j++) {
            const item = chunk[j];
            if (j === activeIdx) {
              lineParts.push(`{\\c${highlightColor}\\fscx115\\fscy115}${item.word}{\\r\\c&H00FFFFFF}`);
            } else {
              lineParts.push(item.word);
            }
          }
          events.push(`Dialogue: 0,${fmtTs(startS)},${fmtTs(endS)},TikTok,,0,0,0,,${lineParts.join(" ")}`);
        }
      }
    }
  }

  return header + events.join("\n");
}

/**
 * Sahne videosunun üzerine TikTok tarzı animasyonlu altyazıyı ultra hızlı şekilde (1s) basar.
 */
export function burnTikTokSubtitles(options: {
  inputVideoPath: string;
  outputVideoPath: string;
  text: string;
  durationSeconds: number;
  color?: CaptionColorOption;
  onScreenText?: string;
  captionStyle?: CaptionStyleOption;
}): boolean {
  try {
    const {
      inputVideoPath,
      outputVideoPath,
      text,
      durationSeconds,
      color = "yellow",
      onScreenText,
      captionStyle = "tiktok",
    } = options;
    if (!fs.existsSync(inputVideoPath)) return false;

    const timed = alignTurkishPhonetics(text, durationSeconds);
    const assScript = generateTikTokAssScript({
      timedWords: timed,
      color,
      onScreenText,
      durationSeconds,
      captionStyle,
    });
    const tempAssPath = outputVideoPath.replace(/\.mp4$/, ".ass");
    fs.writeFileSync(tempAssPath, assScript, "utf-8");

    execSync(
      `ffmpeg -y -i "${inputVideoPath}" -vf "ass=${tempAssPath}" -c:v libx264 -preset ultrafast -crf 23 -c:a copy "${outputVideoPath}"`,
      { timeout: 30000, stdio: "ignore" }
    );

    try {
      fs.unlinkSync(tempAssPath);
    } catch {}

    return fs.existsSync(outputVideoPath) && fs.statSync(outputVideoPath).size > 1000;
  } catch (err) {
    console.warn("[FlowPostProduction] Altyazı basımı atlandı:", err);
    return false;
  }
}

/**
 * Sahne veya master video için seslendirme sentezler (Gemini veya Edge-TTS).
 */
export async function synthesizeVoiceoverAudio(options: {
  text: string;
  outputPath: string;
  actor?: VoiceActorOption;
  speed?: VoiceSpeedOption;
  emotion?: VoiceEmotionOption;
}): Promise<boolean> {
  const { text, outputPath, actor = "gemini_actor", speed = 1.0, emotion = "auto" } = options;
  if (!text || !text.trim()) return false;

  // 1. Gemini Voice Actor
  if (actor === "gemini_actor") {
    const geminiRes = await synthesizeGeminiTtsSegment({
      text,
      outputPath,
      voice: "Kore",
      emotion: emotion === "energetic" ? "excited" : emotion === "dramatic" ? "dramatic" : "calm",
      speed: speed === 1.15 ? "fast" : speed === 0.9 ? "slow" : "normal",
    });
    if (geminiRes && fs.existsSync(outputPath)) return true;
    throw new Error("Gemini TTS ses dosyası üretilemedi.");
  }

  // 2. Edge-TTS Nöral Motor (Ahmet / Emel)
  const voice = actor === "edge_emel" ? "tr-TR-EmelNeural" : "tr-TR-AhmetNeural";
  const encText = encodeURIComponent(text);
  const encVoice = encodeURIComponent(voice);
  const ttsUrl = `http://10.0.1.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;
  const fallbackUrl = `http://127.0.0.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;

  let resp = await fetch(ttsUrl, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!resp || !resp.ok) {
    resp = await fetch(fallbackUrl, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  }

  if (resp && resp.ok) {
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
    return true;
  }

  throw new Error(`Edge-TTS (${voice}) ses servisine ulaşılamadı veya hata döndü.`);
}

/**
 * Sahne videosunu Türkçe dış ses, altyazı ve ekran kanca metniyle donatır.
 */
export async function postProcessFlowScene(options: {
  sceneVideoPath: string;
  outputVideoPath: string;
  voiceoverTr?: string;
  onScreenTextTr?: string;
  durationSeconds: number;
  narrativeMode?: string;
  audioSettings?: Partial<AudioProductionSettings>;
}): Promise<boolean> {
  const {
    sceneVideoPath,
    outputVideoPath,
    voiceoverTr,
    onScreenTextTr,
    durationSeconds,
    narrativeMode = "voiceover_only",
    audioSettings,
  } = options;

  if (!fs.existsSync(sceneVideoPath)) return false;

  const tempDir = path.dirname(outputVideoPath);
  const baseName = path.basename(outputVideoPath, ".mp4");
  const tempVoPath = path.join(tempDir, `${baseName}_vo.mp3`);
  const tempAssPath = path.join(tempDir, `${baseName}_subs.ass`);
  const tempOutPath = path.join(tempDir, `${baseName}_proc.mp4`);

  let hasVoiceover = false;
  const isSilentMode = narrativeMode === "silent_captions" || narrativeMode === "diy_asmr";

  // 1. Türkçe Dış Ses Sentezi
  if (!isSilentMode && voiceoverTr && voiceoverTr.trim()) {
    try {
      hasVoiceover = await synthesizeVoiceoverAudio({
        text: voiceoverTr.trim(),
        outputPath: tempVoPath,
        actor: audioSettings?.voiceActor,
        speed: audioSettings?.voiceSpeed,
        emotion: audioSettings?.voiceEmotion,
      });
    } catch (voErr) {
      console.warn(`[FlowPostProduction] Sahne dış ses sentezi hatası:`, voErr);
      throw voErr;
    }
  }

  // 2. Altyazı ve Ekran Metni ASS Dosyası
  const captionStyle = audioSettings?.captionStyle || "tiktok";
  const captionColor = audioSettings?.captionColor || "yellow";
  const timedWords = hasVoiceover || (voiceoverTr && captionStyle !== "off")
    ? alignTurkishPhonetics(voiceoverTr || "", durationSeconds)
    : [];

  const hasAss = Boolean(
    (onScreenTextTr && onScreenTextTr.trim()) ||
    (captionStyle !== "off" && timedWords.length > 0)
  );

  if (hasAss) {
    const assScript = generateTikTokAssScript({
      timedWords,
      color: captionColor,
      onScreenText: onScreenTextTr,
      durationSeconds,
      captionStyle,
    });
    fs.writeFileSync(tempAssPath, assScript, "utf-8");
  }

  // 3. FFmpeg ile Birleştirme & Miksaj
  try {
    let vfArg = "";
    if (hasAss && fs.existsSync(tempAssPath)) {
      vfArg = `-vf "ass=${tempAssPath}"`;
    }

    // Video dosyasında ses akışı olup olmadığını denetle
    let hasAudioStream = false;
    try {
      const probeOut = execSync(
        `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${sceneVideoPath}"`,
        { encoding: "utf-8", timeout: 8000 }
      );
      hasAudioStream = probeOut.includes("audio");
    } catch {}

    let audioFilterArg = "";
    if (hasVoiceover && fs.existsSync(tempVoPath)) {
      if (hasAudioStream) {
        audioFilterArg = `-i "${tempVoPath}" -filter_complex "[0:a]volume=0.20[amb];[1:a]volume=1.0[vo];[amb][vo]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]"`;
      } else {
        audioFilterArg = `-i "${tempVoPath}" -map 0:v -map 1:a`;
      }
    } else {
      audioFilterArg = `-c:a copy`;
    }

    const ffmpegCmd = `ffmpeg -y -i "${sceneVideoPath}" ${audioFilterArg} ${vfArg} -c:v libx264 -preset ultrafast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k "${tempOutPath}"`;
    execSync(ffmpegCmd, { timeout: 60000, stdio: "ignore" });

    // Temizlik
    if (fs.existsSync(tempVoPath)) {
      try { fs.unlinkSync(tempVoPath); } catch {}
    }
    if (fs.existsSync(tempAssPath)) {
      try { fs.unlinkSync(tempAssPath); } catch {}
    }

    if (fs.existsSync(tempOutPath) && fs.statSync(tempOutPath).size > 1000) {
      fs.renameSync(tempOutPath, outputVideoPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[FlowPostProduction] Sahne post-prodüksiyon hatası:", err);
    if (fs.existsSync(tempVoPath)) { try { fs.unlinkSync(tempVoPath); } catch {} }
    if (fs.existsSync(tempAssPath)) { try { fs.unlinkSync(tempAssPath); } catch {} }
    if (fs.existsSync(tempOutPath)) { try { fs.unlinkSync(tempOutPath); } catch {} }
    throw err;
  }
}

/**
 * Google Flow sahnelerini otomatik olarak master Reels videosu haline getirir.
 */
export async function stitchFlowScenesMaster(options: {
  scenesDir: string;
  masterVideoPath: string;
  scenes?: Array<{
    sceneIndex: number;
    voiceoverTr?: string;
    onScreenTextTr?: string;
    durationSeconds?: number;
  }>;
  narrativeMode?: string;
  audioSettings?: Partial<AudioProductionSettings>;
}): Promise<boolean> {
  try {
    const { scenesDir, masterVideoPath, scenes, narrativeMode, audioSettings } = options;
    if (!fs.existsSync(scenesDir)) return false;

    // Sahnelerin post-prodüksiyon ile işlenmiş olduğundan emin ol
    if (scenes && scenes.length) {
      for (const sc of scenes) {
        const sIndex = sc.sceneIndex;
        const targetMp4 = path.join(scenesDir, `scene-${sIndex}.mp4`);
        const rawBackup = path.join(scenesDir, `raw_scene-${sIndex}.mp4`);

        // Eğer raw yedek yoksa ve targetMp4 varsa, targetMp4 henüz post-process görmemiştir
        if (!fs.existsSync(rawBackup) && fs.existsSync(targetMp4) && fs.statSync(targetMp4).size > 1000) {
          fs.copyFileSync(targetMp4, rawBackup);
          await postProcessFlowScene({
            sceneVideoPath: rawBackup,
            outputVideoPath: targetMp4,
            voiceoverTr: sc.voiceoverTr,
            onScreenTextTr: sc.onScreenTextTr,
            durationSeconds: sc.durationSeconds || 5,
            narrativeMode,
            audioSettings,
          });
        }
      }
    }

    const sceneFiles = fs
      .readdirSync(scenesDir)
      .filter((f) => /^scene-\d+\.mp4$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10);
        const numB = parseInt(b.replace(/\D/g, ""), 10);
        return numA - numB;
      });

    if (!sceneFiles.length) return false;

    const concatListPath = path.join(scenesDir, "concat.txt");
    const listContent = sceneFiles.map((f) => `file '${path.join(scenesDir, f)}'`).join("\n");
    fs.writeFileSync(concatListPath, listContent, "utf-8");

    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterVideoPath}"`, {
      timeout: 45000,
      stdio: "ignore",
    });

    // Master WebP poster karesi
    const thumbPath = masterVideoPath.replace(/\.mp4$/, "_thumb.webp");
    try {
      execSync(
        `ffmpeg -y -ss 00:00:01.0 -i "${masterVideoPath}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 80 "${thumbPath}"`,
        { timeout: 8000, stdio: "ignore" }
      );
    } catch {}

    return fs.existsSync(masterVideoPath) && fs.statSync(masterVideoPath).size > 1000;
  } catch (err) {
    console.error("[FlowPostProduction] Master video birleştirilemedi:", err);
    throw err;
  }
}
