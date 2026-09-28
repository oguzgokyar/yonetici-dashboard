import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const assetDir = path.join(process.cwd(), ".data", "assets");

  try {
    const url = new URL(request.url);
    const isThumb = url.searchParams.get("thumb") === "1";
    const isPreview = url.searchParams.get("preview") === "1" || url.searchParams.has("w");

    // 1. Thumbnail Request (Lightweight ~8-15KB WebP Cached on Disk)
    if (isThumb) {
      const thumbPath = path.join(assetDir, `${id}_thumb.webp`);
      if (fs.existsSync(thumbPath)) {
        const bytes = fs.readFileSync(thumbPath);
        return new Response(bytes, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      // Generate once and persist on disk (0 server load on subsequent requests)
      const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${id}.json`), "utf8")) as {
        extension: string;
      };
      const origBytes = fs.readFileSync(path.join(assetDir, `${id}.${metadata.extension}`));
      const thumbBytes = await sharp(origBytes)
        .resize(360, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      // Write asynchronously to disk cache
      fs.writeFile(thumbPath, thumbBytes, () => {});

      return new Response(thumbBytes, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. High-Quality Lightweight Gallery Preview Request (~70-100KB WebP Cached on Disk)
    if (isPreview) {
      const previewPath = path.join(assetDir, `${id}_preview.webp`);
      if (fs.existsSync(previewPath)) {
        const bytes = fs.readFileSync(previewPath);
        return new Response(bytes, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${id}.json`), "utf8")) as {
        extension: string;
      };
      const origBytes = fs.readFileSync(path.join(assetDir, `${id}.${metadata.extension}`));
      const previewBytes = await sharp(origBytes)
        .resize(720, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      fs.writeFile(previewPath, previewBytes, () => {});

      return new Response(previewBytes, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 3. Full-Resolution Original Asset (Exact PNG/JPEG preserved for publishing & download)
    const metadata = JSON.parse(fs.readFileSync(path.join(assetDir, `${id}.json`), "utf8")) as {
      mimeType: string;
      extension: string;
    };
    const bytes = fs.readFileSync(path.join(assetDir, `${id}.${metadata.extension}`));
    return new Response(bytes, {
      headers: {
        "Content-Type": metadata.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
