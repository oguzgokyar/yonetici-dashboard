import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const exists = getDatabase().prepare("SELECT 1 FROM generation_jobs WHERE id=? AND type IN ('video', 'google-vids') AND status='complete'").get(id);
  if (!exists) return new Response("Not found", { status: 404 });

  const url = new URL(_request.url);
  const isThumb = url.searchParams.get("thumb") === "1";
  const videoRendersDir = path.join(process.cwd(), ".data", "video-renders");
  const thumbPath = path.join(videoRendersDir, `${id}_thumb.webp`);

  if (isThumb) {
    if (fs.existsSync(thumbPath)) {
      const bytes = fs.readFileSync(thumbPath);
      return new Response(bytes, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Check if sourceAssetId exists
    const jobRow = getDatabase()
      .prepare("SELECT request_json FROM generation_jobs WHERE id=? AND type='video'")
      .get(id) as { request_json?: string } | undefined;

    if (jobRow?.request_json) {
      try {
        const req = JSON.parse(jobRow.request_json);
        if (req.sourceAssetId) {
          const assetThumbPath = path.join(process.cwd(), ".data", "assets", `${req.sourceAssetId}_thumb.webp`);
          if (fs.existsSync(assetThumbPath)) {
            const bytes = fs.readFileSync(assetThumbPath);
            return new Response(bytes, {
              headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          }
        }
      } catch {
        // ignore
      }
    }

    const videoPath = path.join(videoRendersDir, `${id}.mp4`);
    if (fs.existsSync(videoPath)) {
      try {
        execSync(
          `ffmpeg -y -ss 00:00:00.5 -i "${videoPath}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbPath}"`,
          { timeout: 5000, stdio: "ignore" }
        );
        if (fs.existsSync(thumbPath)) {
          const bytes = fs.readFileSync(thumbPath);
          return new Response(bytes, {
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      } catch {
        // ignore
      }
    }
  }

  const videoPath = path.join(videoRendersDir, `${id}.mp4`);
  if (!fs.existsSync(videoPath)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const rangeHeader = _request.headers.get("range");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(videoPath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new Response(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunksize),
          "Content-Type": "video/mp4",
          "Content-Disposition": `inline; filename="motion-creative-${id}.mp4"`,
        },
      });
    }

    const fileStream = fs.createReadStream(videoPath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="motion-creative-${id}.mp4"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ ok: false, message: "Geçersiz video ID." }, { status: 400 });

  const db = getDatabase();
  const exists = db.prepare("SELECT id FROM generation_jobs WHERE id=? AND type IN ('video', 'google-vids')").get(id);
  if (!exists) return Response.json({ ok: false, message: "Video bulunamadı." }, { status: 404 });

  const filePath = path.join(process.cwd(), ".data", "video-renders", `${id}.mp4`);
  if (fs.existsSync(filePath)) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // ignore
    }
  }

  db.prepare("DELETE FROM generation_jobs WHERE id=? AND type IN ('video', 'google-vids')").run(id);
  return Response.json({ ok: true, message: "Video başarıyla silindi." });
}
