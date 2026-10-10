import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { renderCreative } from "@/lib/server/cliproxy-creative";
import { runInFifoQueue } from "@/lib/server/production-worker";
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
    const body = (await request.json().catch(() => ({}))) as {
      characterName?: string;
      masterVisualPromptEn?: string;
      archetypeTr?: string;
      fixedTraitsEn?: string;
      aspectRatio?: "1:1" | "9:16";
      visualMood?: CinematicVisualMood;
    };

    const promptEn = (body.masterVisualPromptEn || "").trim();
    if (!promptEn) {
      return Response.json(
        { ok: false, message: "Karakter referans promptu gerekli." },
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
    const ratio = body.aspectRatio || "1:1";

    const moodKey: CinematicVisualMood = body.visualMood && CINEMATIC_VISUAL_MOODS[body.visualMood]
      ? body.visualMood
      : "cinematic_photoreal";
    const mood = CINEMATIC_VISUAL_MOODS[moodKey];

    let styleDescriptor = `35mm cinema framing, ${mood.lightingInstruction}, ${mood.lensInstruction}, ${mood.colorGrading}`;
    if (moodKey === "stylized_3d") {
      styleDescriptor = `Stylized 3D animated character design model sheet, Pixar and Unreal Engine 3D digital animation aesthetic, expressive stylized facial features, vibrant three-point volumetric rim lighting, lush saturated palette, clean 3D character render, zero realistic photo texture`;
    } else if (moodKey === "retro_vintage_80s") {
      styleDescriptor = `1980s retro vintage cinema character portrait sheet, vintage Panavision lens halation, authentic 80s film stock grain, nostalgic warm color grading`;
    } else if (moodKey === "moody_chiaroscuro") {
      styleDescriptor = `Dramatic chiaroscuro cinema portrait sheet, single hard directional side lighting, deep inky shadows, noir atmospheric depth`;
    } else if (moodKey === "minimal_commercial") {
      styleDescriptor = `High-end minimalist modern studio portrait sheet, edge-to-edge sharpness, clean neutral studio bounce, calibrated commercial look`;
    } else if (moodKey === "documentary_nature") {
      styleDescriptor = `National Geographic documentary portrait grade, authentic natural environmental lighting, crisp true-to-life textures`;
    } else if (moodKey === "golden_hour") {
      styleDescriptor = `Warm golden hour cinema portrait sheet, low-angle sunset backlighting, golden rim light, rich bronze shadows`;
    }

    // Enhance prompt strictly following visual-skills U7 (Character consistency anchor) and project visual mood
    const enhancedPrompt = `Visual-skills character reference portrait sheet of ${body.characterName || "Hero"}, ${body.archetypeTr || ""}. ${styleDescriptor}. PHYSICAL IDENTITY SPECS: ${body.fixedTraitsEn || promptEn}. Master character reference: consistent facial structure, distinctive wardrobe, clothing textures, eyes and silhouette. Strict character anchor reference sheet, isolated subject, no extra text, no watermarks, no split screen, no duplicate faces.`;

    db.prepare(
      "INSERT INTO generation_jobs (id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at) VALUES (?, ?, 'image', 'cliproxy', ?, 'queued', ?, ?, ?, ?)"
    ).run(
      jobId,
      projectId,
      model,
      `Karakter Referansı: ${body.characterName || "Hero"} (${mood.label})`,
      JSON.stringify({ characterName: body.characterName, ratio, visualMood: moodKey, isCharacterAnchor: true }),
      JSON.stringify({ phase: "rendering", percent: 20, detail: "Karakter master görseli üretiliyor..." }),
      now
    );

    return await runInFifoQueue(jobId, async () => {
      db.prepare("UPDATE generation_jobs SET status='running' WHERE id=?").run(jobId);
      try {
        const renderResult = await renderCreative({
          baseUrl,
          apiKey,
          model,
          prompt: enhancedPrompt,
          ratio,
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
          isCharacterAnchor: true,
          characterName: body.characterName,
          createdAt: new Date().toISOString(),
        };

        fs.writeFileSync(path.join(assetDir, `${assetId}.json`), JSON.stringify(metadata, null, 2));

        const assetUrl = `/api/assets/${assetId}`;

        db.prepare(
          "UPDATE generation_jobs SET status='complete', response_json=?, completed_at=? WHERE id=?"
        ).run(
          JSON.stringify({
            assets: [{ id: assetId, url: assetUrl, mimeType: "image/png" }],
            characterAnchorUrl: assetUrl,
          }),
          new Date().toISOString(),
          jobId
        );

        return Response.json({
          ok: true,
          assetId,
          imageUrl: assetUrl,
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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Referans görseli üretilirken hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
