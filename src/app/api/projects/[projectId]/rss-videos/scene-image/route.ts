import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { renderCreative } from "@/lib/server/cliproxy-creative";
import type { RssAspectRatio } from "@/features/generation/rss-video/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      sceneIndex?: number;
      promptEn?: string;
      aspectRatio?: RssAspectRatio;
    };

    const promptEn = (body.promptEn || "").trim();
    if (!promptEn) {
      return Response.json(
        { ok: false, message: "Sahne görseli üretmek için görsel promptu gerekli." },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    const providerRow = db
      .prepare(
        "SELECT base_url, encrypted_api_key, image_model FROM ai_provider_configs WHERE provider = 'cliproxy' AND enabled = 1"
      )
      .get() as { base_url: string; encrypted_api_key: string; image_model: string } | undefined;

    if (!providerRow?.base_url || !providerRow.encrypted_api_key) {
      return Response.json(
        {
          ok: false,
          message: "Sistem Ayarları > CliProxyAPI bağlantısı aktif değil.",
        },
        { status: 400 }
      );
    }

    const apiKey = decryptSecret(providerRow.encrypted_api_key);
    const baseUrl = providerRow.base_url.replace(/\/+$/, "");
    const imageModel = providerRow.image_model || "gemini-3.1-flash-image";
    const ratio: RssAspectRatio = body.aspectRatio || "9:16";

    const rendered = await renderCreative({
      baseUrl,
      apiKey,
      model: imageModel,
      prompt: promptEn,
      ratio,
    });

    const assetId = crypto.randomUUID();
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    const pngBytes = await sharp(rendered.bytes).png().toBuffer();
    const pngPath = path.join(assetsDir, `${assetId}.png`);
    const thumbPath = path.join(assetsDir, `${assetId}_thumb.webp`);
    const metaPath = path.join(assetsDir, `${assetId}.json`);

    fs.writeFileSync(pngPath, pngBytes);
    await sharp(pngBytes)
      .resize({ width: 360, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbPath);

    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        id: assetId,
        projectId,
        mimeType: "image/png",
        extension: "png",
        isRssSceneImage: true,
        sceneIndex: body.sceneIndex || 1,
        createdAt: new Date().toISOString(),
      }),
      "utf-8"
    );

    const imageUrl = `/api/assets/${assetId}`;
    return Response.json({
      ok: true,
      assetId,
      imageUrl,
      sceneIndex: body.sceneIndex,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Sahne görseli üretilirken bir hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
