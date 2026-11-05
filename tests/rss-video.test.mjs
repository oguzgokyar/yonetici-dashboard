import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = "/opt/data/yonetici-dashboard";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

test("1. VideoGenerationStudio exposes 4th tab 'RSS Video' (?studio=rss) without Remotion preview in RssVideoStudio", () => {
  const studioCode = read("src/features/generation/video-generation-studio.tsx");
  assert.match(studioCode, /switchStudioTab\("rss"\)/);
  assert.match(studioCode, /RSS Video/);
  assert.match(studioCode, /<RssVideoStudio projectId=\{projectId\} \/>/);
  assert.match(studioCode, /!v\.isRssVideo/);

  const rssStudioCode = read("src/features/generation/rss-video-studio.tsx");
  const rssDeckCode = read("src/features/generation/rss-video/components/rss-storyboard-deck.tsx");
  assert.doesNotMatch(rssStudioCode, /@remotion\/player/);
  assert.doesNotMatch(rssDeckCode, /@remotion\/player/);
});

test("2. Narrative styles & Gemini 2.0 TTS strict fail-fast rules (no Edge-TTS fallback)", () => {
  const typesCode = read("src/features/generation/rss-video/types.ts");
  for (const styleKey of [
    "news_bulletin",
    "info_documentary",
    "fairy_tale",
    "cinematic_story",
    "mystery_curiosity",
    "listicle_guide",
  ]) {
    assert.match(typesCode, new RegExp(`key:\\s*"${styleKey}"`));
  }

  const ttsCode = read("src/lib/server/rss-tts-service.ts");
  assert.match(ttsCode, /responseModalities:\s*\["AUDIO"\]/);
  assert.match(ttsCode, /prebuiltVoiceConfig/);
  assert.doesNotMatch(ttsCode, /edge_tts|\/api\/internal\/tts/i);
  assert.match(ttsCode, /Edge-TTS yedeği kapalıdır/);
});

test("3. Isolation across /api/videos, production-worker, and production-queue", () => {
  const videosRoute = read("src/app/api/videos/route.ts");
  assert.match(videosRoute, /isRssVideo/);
  assert.match(videosRoute, /!isRssVideo &&/);

  const workerCode = read("src/lib/server/production-worker.ts");
  assert.match(workerCode, /processRssVideoJob/);
  assert.match(workerCode, /rss-video-composer/);

  const queueRoute = read("src/app/api/projects/[projectId]/production-queue/route.ts");
  assert.match(queueRoute, /📰 RSS Video \(FIFO\)/);
});

test("4. Real FFmpeg single-pass xfade + oversampled zoompan + ASS pop-in subtitle + BGM ducking render", () => {
  const ffmpegBin = fs.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : "/usr/local/bin/ffmpeg";
  const ffprobeBin = fs.existsSync("/usr/bin/ffprobe") ? "/usr/bin/ffprobe" : "/usr/local/bin/ffprobe";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rss-video-e2e-"));
  try {
    const img1 = path.join(tmpDir, "scene1.png");
    const img2 = path.join(tmpDir, "scene2.png");
    const voiceMp3 = path.join(tmpDir, "voice.mp3");
    const bgmMp3 = path.join(tmpDir, "bgm.mp3");
    const assFile = path.join(tmpDir, "captions.ass");
    const outMp4 = path.join(tmpDir, "output.mp4");

    // Generate two 1080x1920 test images & 4s voice + bgm audio with FFmpeg
    execFileSync(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=#1e1b4b:s=1080x1920:d=1",
      "-frames:v",
      "1",
      img1,
    ]);
    execFileSync(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=#0f172a:s=1080x1920:d=1",
      "-frames:v",
      "1",
      img2,
    ]);
    execFileSync(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4",
      "-c:a",
      "libmp3lame",
      voiceMp3,
    ]);
    execFileSync(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=6",
      "-c:a",
      "libmp3lame",
      bgmMp3,
    ]);

    const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MainCaption,DejaVu Sans,56,&H00FFFFFF,&H0000E6FF,&H00000000,&H80000000,-1,0,0,0,100,100,0.5,0,1,5,3,2,70,70,430,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 1,0:00:00.00,0:00:02.00,MainCaption,,0,0,0,,{\\fad(70,50)\\fscx88\\fscy88\\t(0,110,\\fscx105\\fscy105)}Sahne bir {\\c&H0000E6FF}test{\\c&H00FFFFFF}
Dialogue: 1,0:00:02.00,0:00:04.00,MainCaption,,0,0,0,,{\\fad(70,50)\\fscx88\\fscy88\\t(0,110,\\fscx105\\fscy105)}Sahne iki {\\c&H0000E6FF}kurgu{\\c&H00FFFFFF}
`;
    fs.writeFileSync(assFile, assContent, "utf-8");

    const filterComplex = [
      "[0:v]scale=1470:2612:force_original_aspect_ratio=increase,crop=1470:2612,zoompan=z='1.0+0.15*(on/70)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,trim=end_frame=71,setpts=PTS-STARTPTS,format=yuv420p[v0]",
      "[1:v]scale=1470:2612:force_original_aspect_ratio=increase,crop=1470:2612,zoompan=z='1.18-0.16*(on/66)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,trim=end_frame=66,setpts=PTS-STARTPTS,format=yuv420p[v1]",
      "[v0][v1]xfade=transition=dissolve:duration=0.35:offset=1.825[vx1]",
      `[vx1]ass=filename='${assFile.replace(/:/g, "\\:")}'[vsub]`,
      "[vsub]trim=duration=4.000,setpts=PTS-STARTPTS,format=yuv420p[vout]",
      "[2:a]aresample=48000,atrim=duration=4.000,asetpts=PTS-STARTPTS[avoice]",
      "[3:a]aloop=loop=-1:size=2147483647,atrim=duration=4.000,asetpts=PTS-STARTPTS,volume=-18dB[abgm]",
      "[avoice][abgm]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]",
    ].join(";");

    execFileSync(ffmpegBin, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-t",
      "2.35",
      "-i",
      img1,
      "-loop",
      "1",
      "-framerate",
      "30",
      "-t",
      "2.20",
      "-i",
      img2,
      "-i",
      voiceMp3,
      "-i",
      bgmMp3,
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      outMp4,
    ]);

    assert.equal(fs.existsSync(outMp4), true);
    const stat = fs.statSync(outMp4);
    assert.ok(stat.size > 5000, "Output MP4 should be non-empty");

    const probeOut = execFileSync(ffprobeBin, [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,width,height:format=duration",
      "-of",
      "json",
      outMp4,
    ]).toString();
    const parsedProbe = JSON.parse(probeOut);
    assert.equal(parsedProbe.streams.length, 2);
    assert.equal(parsedProbe.streams[0].width, 1080);
    assert.equal(parsedProbe.streams[0].height, 1920);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
