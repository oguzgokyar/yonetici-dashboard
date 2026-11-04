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

    const isMaster = sceneIndex === "master" || sceneIndex === "full";
    const sceneDir = path.join(process.cwd(), ".data", "flow-scenes", jobId);
    const sceneFile = isMaster
      ? path.join(sceneDir, "master_full.mp4")
      : path.join(sceneDir, `scene-${sceneIndex}.mp4`);

    if (isMaster && !fs.existsSync(sceneFile) && fs.existsSync(sceneDir)) {
      // Otomatik hızlı sahne birleştirme (0 CPU stream copy)
      const sceneFiles = fs
        .readdirSync(sceneDir)
        .filter((f) => /^scene-\d+\.mp4$/.test(f))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10);
          const numB = parseInt(b.replace(/\D/g, ""), 10);
          return numA - numB;
        });

      if (sceneFiles.length > 0) {
        const concatListPath = path.join(sceneDir, "concat.txt");
        const listContent = sceneFiles.map((f) => `file '${path.join(sceneDir, f)}'`).join("\n");
        fs.writeFileSync(concatListPath, listContent, "utf-8");
        try {
          execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${sceneFile}"`, {
            timeout: 15000,
            stdio: "ignore",
          });
        } catch {}
      }
    }

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
