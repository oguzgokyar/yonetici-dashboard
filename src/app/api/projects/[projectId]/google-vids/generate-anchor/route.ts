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

    const project = db
      .prepare("SELECT name, brand_json, brand_concept_json FROM projects WHERE id = ?")
      .get(projectId) as { name?: string; brand_json?: string; brand_concept_json?: string } | undefined;

    let brandPhotographyStyle = "";
    let brandVisualStyle = "";
    if (project?.brand_concept_json) {
      try {
        const concept = JSON.parse(project.brand_concept_json);
        if (concept.photographyStyle) brandPhotographyStyle = String(concept.photographyStyle).trim();
        if (concept.visualStyle) brandVisualStyle = String(concept.visualStyle).trim();
      } catch {}
    }

    const isAnim = moodKey === "stylized_3d";
    let styleLock = "";
    let antiDriftDirective = "";

    if (isAnim) {
      styleLock = `Stylized 3D digital animation aesthetic, Pixar and Unreal Engine 3D character/environment rendering, expressive stylized geometry, vibrant saturated palette, ${mood.lightingInstruction}`;
      antiDriftDirective = "STRICT VISUAL STYLE RULE: Strictly avoid photorealism, avoid live-action photography, avoid real human photographic skin textures. Render strictly as a clean, polished 3D animated model.";
    } else {
      const brandContext = [brandPhotographyStyle, brandVisualStyle].filter(Boolean).join(". ");
      styleLock = `Live-action cinematic 35mm photography, ${mood.lightingInstruction}, ${mood.lensInstruction}, ${mood.colorGrading}.${brandContext ? ` Brand visual style: ${brandContext}.` : ""}`;
      antiDriftDirective = "STRICT VISUAL STYLE RULE: Must be a genuine live-action cinematic photograph of a real subject. Strictly avoid anime, manga, cartoon, 2D illustration, cel shading, comic book art, line art, drawing, digital sketch, CGI video game render. High micro-contrast, authentic physical textures, realistic depth of field.";
    }

    let enhancedPrompt = "";
    if (body.anchorType === "person") {
      const subjectName = body.name ? body.name.trim() : "Character";
      const subjectDesc = body.descriptionTr ? `${body.descriptionTr.trim()}. ` : "";
      enhancedPrompt = `Professional 3-view character turnaround model sheet of ${subjectName}. ${subjectDesc}${promptEn}. Layout: 3-panel comprehensive model sheet showing 1) clean front silhouette and full attire, 2) three-quarter dynamic action or crafting angle, 3) macro close-up detail of hands and expressive facial features. ${styleLock}. ${antiDriftDirective} Consistent facial features, exact clothing colors, neutral clean background, no text labels, no watermarks, no blurry limbs.`;
    } else if (body.anchorType === "location") {
      const locName = body.name ? body.name.trim() : "Environment";
      const locDesc = body.descriptionTr ? `${body.descriptionTr.trim()}. ` : "";
      enhancedPrompt = `Cinematic environment reference photograph of ${locName}. ${locDesc}${promptEn}. Strict environmental anchor: ${styleLock}. ${antiDriftDirective} strictly unmanned workstation, zero people, zero human figures, zero hands, no logos, no text labels.`;
    } else {
      // object / maket / prototype
      const objName = body.name ? body.name.trim() : "Prototype Device";
      const objDesc = body.descriptionTr ? `${body.descriptionTr.trim()}. ` : "";
      enhancedPrompt = `Professional 3-angle technical prototype and mechanism reference sheet of ${objName}. ${objDesc}${promptEn}. 3-panel engineering turnaround sheet showing: 1) 45-degree isometric assembled view showing full 3D spatial layout, 2) orthographic front profile showing complete component arrangement, 3) macro cutaway close-up showing moving mechanical joints, axles, or connections in sharp focus. ${styleLock}. ${antiDriftDirective} Zero floating parts, complete spatial permanence, no text labels, no watermarks, crisp edge definition.`;
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
