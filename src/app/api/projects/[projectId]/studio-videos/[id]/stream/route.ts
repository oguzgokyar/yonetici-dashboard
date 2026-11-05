import { NextRequest, NextResponse } from "next/server";
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  const params = await context.params;
  const mergeIdStr = params.id.replace("studio_merge_", "");
  const isThumb = request.nextUrl.searchParams.get("thumb") === "1";

  const dbPath = "/opt/data/sinematik-studio/data/huobao.sqlite3";
  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
    return new NextResponse("Veritabanı bulunamadı", { status: 404 });
  }

  let mergedUrl = "";
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT merged_url FROM video_merges WHERE id = ?").get(mergeIdStr) as { merged_url?: string } | undefined;
    db.close();
    if (row?.merged_url) {
      mergedUrl = row.merged_url;
    }
  } catch (err: any) {
    return new NextResponse(`Sorgu hatası: ${err?.message}`, { status: 500 });
  }

  if (!mergedUrl) {
    return new NextResponse("Stüdyo videosu bulunamadı", { status: 404 });
  }

  const absPath = path.join(/*turbopackIgnore: true*/ "/opt/data/sinematik-studio/data", mergedUrl);
  if (!fs.existsSync(/*turbopackIgnore: true*/ absPath)) {
    return new NextResponse("Video dosyası diskte bulunamadı", { status: 404 });
  }

  // Thumbnail isteği ise poster görselini döndür veya üret
  if (isThumb) {
    const thumbPath = absPath.replace(".mp4", "_poster.jpg");
    if (!fs.existsSync(thumbPath)) {
      try {
        await execFileAsync("/usr/bin/ffmpeg", [
          "-y",
          "-ss", "00:00:01",
          "-i", absPath,
          "-vframes", "1",
          "-vf", "scale=360:-1",
          thumbPath,
        ]);
      } catch (thumbErr) {
        console.warn("[StudioVideos] Thumbnail generation failed:", thumbErr);
      }
    }

    if (fs.existsSync(thumbPath)) {
      const buffer = fs.readFileSync(thumbPath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      });
    }
  }

  // HTTP Range Streaming (Safari / Chrome / iOS uyumlu)
  const stat = fs.statSync(absPath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(absPath, { start, end });

    // Node.js ReadStream'i Web ReadableStream'e dönüştür
    const webStream = new ReadableStream({
      start(controller) {
        file.on("data", (chunk) => controller.enqueue(chunk));
        file.on("end", () => controller.close());
        file.on("error", (err) => controller.error(err));
      },
      cancel() {
        file.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const file = fs.createReadStream(absPath);
  const webStream = new ReadableStream({
    start(controller) {
      file.on("data", (chunk) => controller.enqueue(chunk));
      file.on("end", () => controller.close());
      file.on("error", (err) => controller.error(err));
    },
    cancel() {
      file.destroy();
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
}
