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
  toChipSlug,
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

      const slug = toChipSlug(name);
      const filename = `${slug}.png`;

      const metadata = {
        id: assetId,
        projectId,
        mimeType: "image/png",
        extension: "png",
        anchorType,
        name,
        slug,
        filename,
        tag: `@${slug}`,
        isUploadedAnchor: true,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(assetDir, `${assetId}.json`), JSON.stringify(metadata, null, 2));

      return Response.json({
        ok: true,
        assetId,
        imageUrl: `/api/assets/${assetId}`,
        anchorType,
        slug,
        filename,
        tag: `@${slug}`,
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
      enhancedPrompt = `Professional 3-view character turnaround model sheet of ${body.name || "artisan maker"}, ${body.descriptionTr || ""}. ${promptEn}. 3-panel comprehensive model sheet layout showing: 1) clean front profile showing costume, wardrobe textures and silhouette, 2) three-quarter dynamic crafting angle holding precision tools, 3) macro close-up detail of artisan hands, finger precision and tool grip. Master visual character anchor for AI video consistency: consistent facial features, exact clothing colors, neutral clean workshop background, ${mood.lightingInstruction}, high micro-contrast, photorealistic textures, no text labels, no watermarks, no blurry limbs.`;
    } else if (body.anchorType === "location") {
      enhancedPrompt = `Cinematic workbench and craft workstation environment reference photograph of ${body.name || "artisan workshop"}, ${body.descriptionTr || ""}. ${promptEn}. Focused maker workstation layout: clean wooden craft workbench surface, dark green grid cutting mat, neatly arranged hand tools (cutter, metal rulers, glue stand, wire spools) in background tool racks, shallow depth of field with soft workshop background blur. Strict environmental anchor: clear motivated lighting vector with warm directional task lamp from upper left, ambient fill, ${mood.colorGrading}, strictly unmanned workstation, zero people, zero human figures, zero hands, no logos, no text labels.`;
    } else {
      // object / maket / prototype
      enhancedPrompt = `Professional 3-angle technical prototype and mechanism reference sheet of ${body.name || "maker project device"}, ${body.descriptionTr || ""}. ${promptEn}. 3-panel engineering turnaround sheet showing: 1) 45-degree isometric assembled view showing full 3D spatial layout with all tubing, wires and structure rigidly aligned, 2) orthographic front profile showing complete component arrangement and mechanical proportions, 3) macro cutaway close-up showing moving mechanical joints, axles, gears or electrical terminals in ultra-sharp focus. Tabletop craft aesthetic on cutting mat, clean workshop task lighting, zero floating parts, strictly zero liquid spillage, complete spatial permanence, no text labels, no watermarks, crisp edge definition.`;
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

      const slug = toChipSlug(body.name || "referans");
      const filename = `${slug}.png`;

      const metadata = {
        id: assetId,
        projectId,
        jobId,
        mimeType: "image/png",
        extension: "png",
        ratio,
        anchorType: body.anchorType,
        name: body.name,
        slug,
        filename,
        tag: `@${slug}`,
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
          slug,
          filename,
          tag: `@${slug}`,
        }),
        new Date().toISOString(),
        jobId
      );

      return Response.json({
        ok: true,
        assetId,
        imageUrl: assetUrl,
        anchorType: body.anchorType,
        slug,
        filename,
        tag: `@${slug}`,
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
