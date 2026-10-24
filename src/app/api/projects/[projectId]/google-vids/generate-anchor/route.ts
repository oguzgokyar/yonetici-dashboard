import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { renderCreative } from "@/lib/server/cliproxy-creative";
import {
  CINEMATIC_VISUAL_MOODS,
  type CinematicVisualMood,
} from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

type ProviderRow = {
  base_url: string;
  encrypted_api_key: string;
  image_model: string;
};

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const contentType = request.headers.get("content-type") || "";

    // 1. Doğrudan Görsel Yükleme (Upload) Desteği
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as Blob | null;
      const anchorType = (formData.get("anchorType") as string || "object") as "person" | "location" | "object";
      const name = (formData.get("name") as string || "Yüklenen Referans").slice(0, 80);

      if (!file || !("arrayBuffer" in file)) {
        return Response.json({ ok: false, message: "Görsel dosyası eksik." }, { status: 400 });
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const assetId = crypto.randomUUID();
      const assetDir = path.join(process.cwd(), ".data", "assets");
      fs.mkdirSync(assetDir, { recursive: true });

      const originalPath = path.join(assetDir, `${assetId}.png`);
      const thumbPath = path.join(assetDir, `${assetId}_thumb.webp`);

      await sharp(fileBuffer).toFormat("png").toFile(originalPath);
      await sharp(fileBuffer).resize({ width: 360, height: 360, fit: "cover" }).webp({ quality: 80 }).toFile(thumbPath);

      const metadata = {
        id: assetId,
        projectId,
        mimeType: "image/png",
        extension: "png",
        anchorType,
        name,
        isUploadedAnchor: true,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(assetDir, `${assetId}.json`), JSON.stringify(metadata, null, 2));

      return Response.json({
        ok: true,
        assetId,
        imageUrl: `/api/assets/${assetId}`,
        anchorType,
      });
    }

    // 2. Yapay Zeka ile Üretim (T2I)
    const body = (await request.json().catch(() => ({}))) as {
      anchorType: "person" | "location" | "object";
      name?: string;
      descriptionTr?: string;
      visualPromptEn?: string;
      aspectRatio?: "1:1" | "9:16" | "16:9";
      visualMood?: CinematicVisualMood;
    };

    const promptEn = (body.visualPromptEn || "").trim();
    if (!promptEn) {
      return Response.json(
        { ok: false, message: "Görsel üretim promptu gerekli." },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const provider = db
      .prepare(
        "SELECT base_url, encrypted_api_key, image_model FROM ai_provider_configs WHERE provider='cliproxy' AND enabled=1"
      )
      .get() as ProviderRow | undefined;

    if (!provider?.base_url || !provider.encrypted_api_key) {
      return Response.json(
        { ok: false, message: "CliProxyAPI görsel üretici ayarı etkin değil." },
        { status: 409 }
      );
    }

    const apiKey = decryptSecret(provider.encrypted_api_key);
    const baseUrl = provider.base_url.replace(/\/+$/, "");
    const model = provider.image_model || "gemini-3.1-flash-image";

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const ratio = body.aspectRatio || (body.anchorType === "location" ? "16:9" : "1:1");

    const moodKey: CinematicVisualMood = body.visualMood && CINEMATIC_VISUAL_MOODS[body.visualMood]
      ? body.visualMood
      : "cinematic_photoreal";
    const mood = CINEMATIC_VISUAL_MOODS[moodKey];

    let enhancedPrompt = "";
    if (body.anchorType === "person") {
      enhancedPrompt = `Professional reference portrait sheet of ${body.name || "character"}, ${body.descriptionTr || ""}. ${promptEn}. 35mm cinema framing, ${mood.lightingInstruction}, photorealistic textures, isolated single subject, consistent character reference, no extra text, no watermarks, no split screen.`;
    } else if (body.anchorType === "location") {
      enhancedPrompt = `Cinematic environment architecture and setting reference photograph of ${body.name || "location"}, ${body.descriptionTr || ""}. ${promptEn}. Empty background setting, wide environmental view, authentic interior or exterior workshop lighting, ${mood.colorGrading}, photorealistic, zero people, no text, no logos.`;
    } else {
      // object / maket / prototype
      enhancedPrompt = `Macro high-detail reference photo of ${body.name || "maker prototype device"}, ${body.descriptionTr || ""}. ${promptEn}. Crisp macro lens focus, perfectly assembled solid components, tightly connected tubing and wires, clean workshop lighting, tabletop craft aesthetic, single isolated object in sharp focus, no floating parts, zero blur on device.`;
    }

    db.prepare(
      "INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at) VALUES (?, ?, 'visual-anchor', 'cliproxy', ?, 'running', ?, ?, ?, ?)"
    ).run(
      jobId,
      projectId,
      model,
      `Referans Çıpası (${body.anchorType}): ${body.name || "Öğe"}`,
      JSON.stringify({ anchorType: body.anchorType, name: body.name, ratio, visualMood: moodKey }),
      JSON.stringify({ phase: "rendering", percent: 40, detail: "Referans görseli üretiliyor..." }),
      now
    );

    try {
      const renderResult = await renderCreative({
        baseUrl,
        apiKey,
        model,
        prompt: enhancedPrompt,
        ratio: ratio === "16:9" ? "16:9" : ratio === "9:16" ? "9:16" : "1:1",
      });

      const assetId = crypto.randomUUID();
      const assetDir = path.join(process.cwd(), ".data", "assets");
      fs.mkdirSync(assetDir, { recursive: true });

      const originalPath = path.join(assetDir, `${assetId}.png`);
      const thumbPath = path.join(assetDir, `${assetId}_thumb.webp`);

      fs.writeFileSync(originalPath, renderResult.bytes);

      await sharp(renderResult.bytes)
        .resize({ width: 360, height: 360, fit: "cover" })
        .webp({ quality: 80 })
        .toFile(thumbPath);

      const metadata = {
        id: assetId,
        projectId,
        jobId,
        mimeType: "image/png",
        extension: "png",
        ratio,
        anchorType: body.anchorType,
        name: body.name,
        createdAt: new Date().toISOString(),
      };

      fs.writeFileSync(path.join(assetDir, `${assetId}.json`), JSON.stringify(metadata, null, 2));

      const assetUrl = `/api/assets/${assetId}`;

      db.prepare(
        "UPDATE generation_jobs SET status='complete', response_json=?, completed_at=? WHERE id=?"
      ).run(
        JSON.stringify({
          assets: [{ id: assetId, url: assetUrl, mimeType: "image/png" }],
          anchorUrl: assetUrl,
          anchorType: body.anchorType,
        }),
        new Date().toISOString(),
        jobId
      );

      return Response.json({
        ok: true,
        assetId,
        imageUrl: assetUrl,
        anchorType: body.anchorType,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Görsel render edilemedi.";
      db.prepare("UPDATE generation_jobs SET status='failed', error=?, completed_at=? WHERE id=?").run(
        message.slice(0, 1000),
        new Date().toISOString(),
        jobId
      );
      return Response.json({ ok: false, message }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Referans görseli üretilirken hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
