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
 * TikTok / Reels tarzı kelime kelime sarı/yeşil vurgulu ASS Altyazı Şablonu üretir.
 */
export function generateTikTokAssScript(options: {
  timedWords: TimedWord[];
  color?: CaptionColorOption;
  width?: number;
  height?: number;
}): string {
  const { timedWords, color = "yellow", width = 720, height = 1280 } = options;

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
Style: TikTok,Montserrat,46,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,5,2,2,30,30,280,1

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
}): boolean {
  try {
    const { inputVideoPath, outputVideoPath, text, durationSeconds, color = "yellow" } = options;
    if (!fs.existsSync(inputVideoPath)) return false;

    const timed = alignTurkishPhonetics(text, durationSeconds);
    if (!timed.length) return false;

    const assScript = generateTikTokAssScript({ timedWords: timed, color });
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
    try {
      const geminiRes = await synthesizeGeminiTtsSegment({
        text,
        outputPath,
        voice: "Kore",
        emotion: emotion === "energetic" ? "excited" : emotion === "dramatic" ? "dramatic" : "calm",
        speed: speed === 1.15 ? "fast" : speed === 0.9 ? "slow" : "normal",
      });
      if (geminiRes && fs.existsSync(outputPath)) return true;
    } catch (geminiErr) {
      console.warn("[FlowPostProduction] Gemini TTS başarısız, dahili Edge-TTS'e geçiliyor:", geminiErr);
    }
  }

  // 2. Edge-TTS Nöral Motor (Ahmet / Emel)
  try {
    const voice = actor === "edge_emel" ? "tr-TR-EmelNeural" : "tr-TR-AhmetNeural";
    const encText = encodeURIComponent(text);
    const encVoice = encodeURIComponent(voice);
    const ttsUrl = `http://10.0.1.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;
    const fallbackUrl = `http://127.0.0.1:8080/api/internal/tts?text=${encText}&voice=${encVoice}`;

    let resp = await fetch(ttsUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!resp || !resp.ok) {
      resp = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    }

    if (resp && resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outputPath, buf);
      return true;
    }
  } catch (err) {
    console.error("[FlowPostProduction] Ses sentezi başarısız:", err);
  }

  return false;
}

/**
 * Google Flow sahnelerini otomatik olarak master Reels videosu haline getirir.
 */
export function stitchFlowScenesMaster(options: {
  scenesDir: string;
  masterVideoPath: string;
  audioSettings?: Partial<AudioProductionSettings>;
}): boolean {
  try {
    const { scenesDir, masterVideoPath } = options;
    if (!fs.existsSync(scenesDir)) return false;

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
      timeout: 30000,
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
    return false;
  }
}
