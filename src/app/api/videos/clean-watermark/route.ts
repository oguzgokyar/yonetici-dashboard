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
      mode?: "delogo" | "logo_cover" | "crop";
      position?: "bottom_right" | "bottom_left" | "top_right" | "top_left";
      logoUrl?: string;
      cropPercent?: number; // varsayılan: 6 (%6 kes)
    };

    const videoUrl = body.videoUrl?.trim() || "";
    let localPath = body.localPath?.trim() || "";
    const mode = body.mode || "delogo";
    const position = body.position || "bottom_right";

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

    const cleanPath = `${localPath}.clean_${Date.now()}.mp4`;

    // 3. Mod seçimine göre filtre oluştur
    if (mode === "crop") {
      // Kadrajı kırp/kes modu: Belirlenen pozisyondaki kenardan %5-10 kes ve orijinal çözünürlüğe ölçekle
      const pct = Math.min(15, Math.max(3, body.cropPercent || 6)) / 100;
      let cropFilter = "";
      if (position === "bottom_right" || position === "bottom_left") {
        // Alttan kes (crop=in_w:in_h*(1-pct):0:0, ardından ölçekle)
        const newH = Math.floor(h * (1 - pct));
        cropFilter = `crop=w=iw:h=floor(ih*${(1 - pct).toFixed(3)}):x=0:y=0,scale=${w}:${h}:flags=lanczos`;
      } else {
        // Üstten kes
        cropFilter = `crop=w=iw:h=floor(ih*${(1 - pct).toFixed(3)}):x=0:y=floor(ih*${pct.toFixed(3)}),scale=${w}:${h}:flags=lanczos`;
      }

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", localPath,
        "-vf", cropFilter,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-c:a", "copy",
        cleanPath,
      ]);
    } else if (mode === "logo_cover") {
      // Marka Logosu ile Kapat modu
      let resolvedLogoPath = "";
      if (body.logoUrl) {
        if (body.logoUrl.startsWith("/")) {
          const l1 = path.join(process.cwd(), "public", body.logoUrl.replace(/^\//, ""));
          const l2 = path.join(dataDir, body.logoUrl.replace(/^\//, ""));
          const l3 = path.join(dataDir, "assets", path.basename(body.logoUrl));
          if (fs.existsSync(l1)) resolvedLogoPath = l1;
          else if (fs.existsSync(l2)) resolvedLogoPath = l2;
          else if (fs.existsSync(l3)) resolvedLogoPath = l3;
        }
      }

      if (!resolvedLogoPath || !fs.existsSync(resolvedLogoPath)) {
        return NextResponse.json(
          { ok: false, message: "Kapatma işlemi için geçerli bir marka logosu bulunamadı." },
          { status: 400 }
        );
      }

      // Pozisyona göre overlay koordinatı (Logo boyutu: video genişliğinin %14'ü)
      const targetLogoW = Math.max(90, Math.floor(w * 0.14));
      let overlayCoord = "W-w-24:H-h-24";
      if (position === "bottom_left") overlayCoord = "24:H-h-24";
      else if (position === "top_right") overlayCoord = "W-w-24:24";
      else if (position === "top_left") overlayCoord = "24:24";

      const complexFilter = `[1:v]scale=${targetLogoW}:-1[scaled_logo];[0:v][scaled_logo]overlay=${overlayCoord}`;

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", localPath,
        "-i", resolvedLogoPath,
        "-filter_complex", complexFilter,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-c:a", "copy",
        cleanPath,
      ]);
    } else {
      // Varsayılan: Akıllı Delogo / Doku Tamamlama
      const ratio = body.aspect_ratio || (h > w ? "9:16" : w > h ? "16:9" : "1:1");
      let boxW = Math.max(80, Math.floor(w * 0.08));
      let boxH = Math.max(80, Math.floor(h * 0.045));
      let x = 0;
      let y = 0;

      if (position === "bottom_right") {
        x = w - boxW - Math.floor(w * 0.035);
        y = h - boxH - Math.floor(h * 0.035);
      } else if (position === "bottom_left") {
        x = Math.floor(w * 0.035);
        y = h - boxH - Math.floor(h * 0.035);
      } else if (position === "top_right") {
        x = w - boxW - Math.floor(w * 0.035);
        y = Math.floor(h * 0.035);
      } else if (position === "top_left") {
        x = Math.floor(w * 0.035);
        y = Math.floor(h * 0.035);
      }

      const delogoFilter = `delogo=x=${x}:y=${y}:w=${boxW}:h=${boxH}:show=0`;

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
    }

    if (!fs.existsSync(cleanPath) || fs.statSync(cleanPath).size < 1000) {
      throw new Error("FFmpeg filigran düzenleme çıktısı oluşturulamadı.");
    }

    // Orijinal dosyanın yerine temizlenmiş dosyayı geçir
    fs.renameSync(cleanPath, localPath);

    return NextResponse.json({
      ok: true,
      message: mode === "logo_cover" 
        ? "Filigran marka logosuyla kapatıldı."
        : mode === "crop"
        ? "Filigranlı alan kadraj dışına kesilerek temizlendi."
        : "Filigran akıllı doku tamamlama (delogo) ile temizlendi.",
      mode,
      position,
      dimensions: { width: w, height: h },
      cleanUrl: videoUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: `Filigran temizleme hatası: ${msg}` }, { status: 500 });
  }
}
