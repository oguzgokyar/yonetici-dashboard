import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

const CACHE_DIR = path.join(process.cwd(), ".data", "video-thumbs");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get("url");

  if (!mediaUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  ensureCacheDir();

  // Create unique hash for url
  const hash = crypto.createHash("md5").update(mediaUrl).digest("hex");
  const thumbPath = path.join(CACHE_DIR, `${hash}.webp`);

  if (fs.existsSync(thumbPath)) {
    const bytes = fs.readFileSync(thumbPath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  try {
    let sourcePath = "";
    let tmpDownloadPath = "";

    if (mediaUrl.startsWith("/api/videos/")) {
      const vidId = mediaUrl.replace("/api/videos/", "").split("?")[0];
      const localMp4 = path.join(process.cwd(), ".data", "video-renders", `${vidId}.mp4`);
      if (fs.existsSync(localMp4)) {
        sourcePath = localMp4;
      }
    } else if (mediaUrl.startsWith("/api/assets/")) {
      const assetId = mediaUrl.replace("/api/assets/", "").split("?")[0];
      const localAsset = path.join(process.cwd(), ".data", "assets", `${assetId}.mp4`);
      if (fs.existsSync(localAsset)) {
        sourcePath = localAsset;
      }
    }

    if (!sourcePath) {
      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        // Download small piece or full video to generate thumbnail
        const res = await fetch(mediaUrl, {
          headers: { Range: "bytes=0-3000000" }, // fetch first 3MB
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          tmpDownloadPath = path.join(CACHE_DIR, `tmp_${hash}.mp4`);
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(tmpDownloadPath, buf);
          sourcePath = tmpDownloadPath;
        } else {
          // Fallback to full fetch if range not supported
          const fullRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
          if (fullRes.ok) {
            tmpDownloadPath = path.join(CACHE_DIR, `tmp_${hash}.mp4`);
            const buf = Buffer.from(await fullRes.arrayBuffer());
            fs.writeFileSync(tmpDownloadPath, buf);
            sourcePath = tmpDownloadPath;
          }
        }
      }
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return new NextResponse("Video source could not be resolved", { status: 404 });
    }

    // Generate webp thumbnail via ffmpeg
    const cmd = `ffmpeg -y -ss 00:00:00.5 -i "${sourcePath}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbPath}"`;
    await execAsync(cmd, { timeout: 10000 });

    if (tmpDownloadPath && fs.existsSync(tmpDownloadPath)) {
      try { fs.unlinkSync(tmpDownloadPath); } catch {}
    }

    if (fs.existsSync(thumbPath)) {
      const bytes = fs.readFileSync(thumbPath);
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    return new NextResponse("Failed to generate thumbnail", { status: 500 });
  } catch (err) {
    console.error("[Media Thumbnail API Error]:", err);
    return new NextResponse("Thumbnail generation error", { status: 500 });
  }
}
