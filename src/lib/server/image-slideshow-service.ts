import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveLocalMediaPath } from "@/lib/server/telegram-client";

const execFileAsync = promisify(execFile);

// Concurrency lock: Max 1 simultaneous video render to protect VPS CPU
let renderQueuePromise: Promise<any> = Promise.resolve();

function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const result = renderQueuePromise.then(task, task);
  renderQueuePromise = result.catch(() => {});
  return result;
}

export interface ConvertImagesToVideoOptions {
  imageUrls: string[];
  durationPerSlide?: number; // default: 3.5 seconds
  targetWidth?: number; // default: 1080
  targetHeight?: number; // default: 1920 (9:16 Shorts)
}

export interface ConvertImagesToVideoResult {
  ok: boolean;
  videoPath?: string;
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
}

/**
 * Ultra-lightweight FFmpeg Slideshow to MP4 Converter
 * Converts static PNG/JPG/WebP images into a smooth 1080x1920 YouTube Shorts compliant MP4.
 * Takes ~1.5 seconds, consumes minimal CPU with -preset ultrafast.
 */
export async function convertImagesToYouTubeVideo(
  options: ConvertImagesToVideoOptions
): Promise<ConvertImagesToVideoResult> {
  const { imageUrls, durationPerSlide = 3.5, targetWidth = 1080, targetHeight = 1920 } = options;

  if (!imageUrls || imageUrls.length === 0) {
    return { ok: false, error: "Dönüştürülecek görsel bulunamadı." };
  }

  // Enqueue to guarantee max 1 active FFmpeg process
  return enqueueRender(async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt_slideshow_"));
    const videoOutputDir = path.join(process.cwd(), ".data", "video-renders");
    fs.mkdirSync(videoOutputDir, { recursive: true });

    const videoId = crypto.randomUUID();
    const finalMp4Path = path.join(videoOutputDir, `${videoId}.mp4`);

    try {
      // 1. Resolve or download images to local temp files
      const localImageFiles: string[] = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const resolved = resolveLocalMediaPath(url);

        const tempImgPath = path.join(tempDir, `img_${String(i).padStart(3, "0")}.png`);

        if (resolved && fs.existsSync(resolved.filePath)) {
          // Local asset already on disk
          fs.copyFileSync(resolved.filePath, tempImgPath);
          localImageFiles.push(tempImgPath);
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          // Remote download
          const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!resp.ok) throw new Error(`Görsel indirilemedi: ${resp.status}`);
          const buf = Buffer.from(await resp.arrayBuffer());
          fs.writeFileSync(tempImgPath, buf);
          localImageFiles.push(tempImgPath);
        } else {
          // Relative path fallback
          const cleanRel = url.replace(/^\/+/, "");
          const candidatePath = path.join(process.cwd(), cleanRel);
          if (fs.existsSync(candidatePath)) {
            fs.copyFileSync(candidatePath, tempImgPath);
            localImageFiles.push(tempImgPath);
          } else {
            throw new Error(`Görsel dosyası bulunamadı: ${url}`);
          }
        }
      }

      if (localImageFiles.length === 0) {
        throw new Error("İşlenecek yerel görsel dosyası oluşturulamadı.");
      }

      // 2. Build FFmpeg concat script
      // Each slide displays for `durationPerSlide` seconds
      const concatFilePath = path.join(tempDir, "input.txt");
      let concatContent = "";
      for (const imgFile of localImageFiles) {
        concatContent += `file '${imgFile}'\nduration ${durationPerSlide}\n`;
      }
      // FFmpeg concat demuxer quirk: repeat last file without duration
      concatContent += `file '${localImageFiles[localImageFiles.length - 1]}'\n`;
      fs.writeFileSync(concatFilePath, concatContent, "utf8");

      const totalDuration = localImageFiles.length * durationPerSlide;

      // 3. Ultra-fast FFmpeg command
      // - Scale and pad with black borders to preserve aspect ratio in 1080x1920
      // - Generate silent audio track (YouTube requires audio stream for smooth playback)
      // - ultrafast preset, crf 23 for crisp quality with negligible CPU impact (~1.5s execution)
      const filterComplex = `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v]`;

      const ffmpegArgs = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-filter_complex",
        filterComplex,
        "-map",
        "[v]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "stillimage",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        "-t",
        String(totalDuration),
        "-movflags",
        "+faststart",
        finalMp4Path,
      ];

      await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 30000 });

      if (!fs.existsSync(finalMp4Path) || fs.statSync(finalMp4Path).size < 1000) {
        throw new Error("FFmpeg video çıktısı oluşturulamadı veya boş dosya üretildi.");
      }

      return {
        ok: true,
        videoPath: finalMp4Path,
        videoUrl: `/api/videos/${videoId}`,
        durationSeconds: Math.round(totalDuration),
      };
    } catch (err: unknown) {
      // Clean output file if failed
      if (fs.existsSync(finalMp4Path)) {
        try {
          fs.unlinkSync(finalMp4Path);
        } catch {}
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      // Clean temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });
}
