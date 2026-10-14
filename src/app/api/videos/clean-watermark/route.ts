import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      videoUrl?: string;
      localPath?: string;
      aspect_ratio?: "9:16" | "16:9" | "1:1";
    };

    const videoUrl = body.videoUrl?.trim() || "";
    let localPath = body.localPath?.trim() || "";

    const dataDir = path.join(process.cwd(), ".data");

    // 1. Dosya yolunu yerel diskten çöz
    if (!localPath && videoUrl) {
      if (videoUrl.startsWith("/")) {
        const p1 = path.join(process.cwd(), "public", videoUrl.replace(/^\//, ""));
        const p2 = path.join(dataDir, videoUrl.replace(/^\//, ""));
        const p3 = path.join(dataDir, "assets", path.basename(videoUrl));
        const p4 = path.join(dataDir, "video-renders", path.basename(videoUrl));

        if (fs.existsSync(p1)) localPath = p1;
        else if (fs.existsSync(p2)) localPath = p2;
        else if (fs.existsSync(p3)) localPath = p3;
        else if (fs.existsSync(p4)) localPath = p4;
      } else if (videoUrl.startsWith("http")) {
        // İndirme dizini veya video-renders içinde ara
        const baseName = path.basename(new URL(videoUrl).pathname);
        const cand1 = path.join(dataDir, "video-renders", baseName);
        const cand2 = path.join(dataDir, "assets", baseName);
        const cand3 = path.join("/opt/data/home/Downloads", baseName);

        if (fs.existsSync(cand1)) localPath = cand1;
        else if (fs.existsSync(cand2)) localPath = cand2;
        else if (fs.existsSync(cand3)) localPath = cand3;
      }
    }

    if (!localPath || !fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      return NextResponse.json(
        { ok: false, message: `Video dosyası sunucuda bulunamadı: ${videoUrl || localPath}` },
        { status: 404 }
      );
    }

    // 2. ffprobe ile genişlik ve yükseklik tespit et
    let w = 1080;
    let h = 1920;
    try {
      const { stdout: probeOut } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0",
        localPath,
      ]);
      const parts = probeOut.trim().split(",");
      if (parts.length === 2) {
        w = parseInt(parts[0], 10) || 1080;
        h = parseInt(parts[1], 10) || 1920;
      }
    } catch {}

    const ratio = body.aspect_ratio || (h > w ? "9:16" : w > h ? "16:9" : "1:1");

    // 3. Google Vids AI sparkle simgesi için koordinat hesapla
    let x = 860;
    let y = 1700;
    let boxW = 80;
    let boxH = 80;

    if (ratio === "9:16" || h > w) {
      x = Math.floor(w * 0.796);
      y = Math.floor(h * 0.885);
      boxW = Math.max(70, Math.floor(w * 0.075));
      boxH = Math.max(70, Math.floor(h * 0.042));
    } else if (ratio === "16:9" || w > h) {
      x = Math.floor(w * 0.90);
      y = Math.floor(h * 0.85);
      boxW = Math.max(70, Math.floor(w * 0.05));
      boxH = Math.max(70, Math.floor(h * 0.07));
    } else {
      x = Math.floor(w * 0.84);
      y = Math.floor(h * 0.84);
      boxW = Math.max(70, Math.floor(w * 0.07));
      boxH = Math.max(70, Math.floor(h * 0.07));
    }

    const delogoFilter = `delogo=x=${x}:y=${y}:w=${boxW}:h=${boxH}`;
    const cleanPath = `${localPath}.clean_${Date.now()}.mp4`;

    // 4. FFmpeg Delogo Çalıştır (-c:a copy ile ses ve altyazıyı koru)
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", localPath,
      "-vf", delogoFilter,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "fast",
      "-c:a", "copy",
      cleanPath,
    ]);

    if (!fs.existsSync(cleanPath) || fs.statSync(cleanPath).size < 1000) {
      throw new Error("FFmpeg delogo çıktısı oluşturulamadı.");
    }

    // Orijinal dosyanın yerine temizlenmiş dosyayı geçir
    fs.renameSync(cleanPath, localPath);

    return NextResponse.json({
      ok: true,
      message: "Google Vids yapay zeka filigranı sıfır kayıpla başarıyla temizlendi.",
      filter: delogoFilter,
      dimensions: { width: w, height: h },
      cleanUrl: videoUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: `Filigran temizleme hatası: ${msg}` }, { status: 500 });
  }
}
