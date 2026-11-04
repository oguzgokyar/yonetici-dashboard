import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    projectId: string;
    jobId: string;
    sceneIndex: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { jobId, sceneIndex } = await context.params;
    if (!jobId || !sceneIndex) {
      return new Response("Eksik parametre", { status: 400 });
    }

    const sceneFile = path.join(process.cwd(), ".data", "flow-scenes", jobId, `scene-${sceneIndex}.mp4`);
    if (!fs.existsSync(sceneFile)) {
      return new Response("Sahne videosu bulunamadı", { status: 404 });
    }

    const url = new URL(request.url);
    const isThumb = url.searchParams.get("thumb") === "1";

    if (isThumb) {
      const thumbPath = path.join(process.cwd(), ".data", "flow-scenes", jobId, `scene-${sceneIndex}_thumb.webp`);
      if (!fs.existsSync(thumbPath)) {
        try {
          execSync(
            `ffmpeg -y -ss 00:00:00.5 -i "${sceneFile}" -vframes 1 -vf "scale=360:-1" -c:v libwebp -quality 75 "${thumbPath}"`,
            { timeout: 8000, stdio: "ignore" }
          );
        } catch {}
      }

      if (fs.existsSync(thumbPath)) {
        const stream = fs.createReadStream(thumbPath);
        return new Response(stream as unknown as ReadableStream, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    const stat = fs.statSync(sceneFile);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(sceneFile, { start, end });

      return new Response(fileStream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunksize),
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const fileStream = fs.createReadStream(sceneFile);
    return new Response(fileStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Video okunamadı";
    return new Response(msg, { status: 500 });
  }
}
