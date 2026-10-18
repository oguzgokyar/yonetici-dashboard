import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  BRAND_VISUAL_SPECS,
  BrandVisualSpec,
  BrandVisualType,
  BrandVisualsState,
  SavedVisualItem,
} from "@/lib/brand-visuals";
import { normalizeBrandConcept } from "@/lib/brand-concept";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { loadMedia, MediaInput, renderCreative } from "@/lib/server/cliproxy-creative";

export const runtime = "nodejs";

type ProviderRow = {
  base_url: string;
  encrypted_api_key: string;
  text_model: string;
  image_model: string;
  vision_model: string;
  edit_model: string;
};

type ProjectRow = {
  id: string;
  name: string;
  brand_json: string;
  brand_concept_json: string;
  brand_visuals_json: string;
};

function getProject(projectId: string): ProjectRow | undefined {
  return getDatabase()
    .prepare(
      "SELECT id, name, brand_json, brand_concept_json, brand_visuals_json FROM projects WHERE id = ?"
    )
    .get(projectId) as ProjectRow | undefined;
}

function parseVisuals(jsonString?: string): BrandVisualsState {
  if (!jsonString) return { items: {}, updatedAt: "" };
  try {
    const parsed = JSON.parse(jsonString);
    return {
      items: parsed.items || {},
      updatedAt: parsed.updatedAt || "",
    };
  } catch {
    return { items: {}, updatedAt: "" };
  }
}

// GET: Projenin mevcut marka görsellerini listeler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ ok: false, message: "Proje ID gerekli." }, { status: 400 });
  }

  const project = getProject(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const visuals = parseVisuals(project.brand_visuals_json);
  return Response.json({ ok: true, visuals });
}

// POST: Seçilen görsel türünü Agency Agents mimarisiyle sentezleyip üretir
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      projectId?: string;
      type?: BrandVisualType;
      customDirection?: string;
    };

    if (!input.projectId || !input.type) {
      return Response.json(
        { ok: false, message: "Proje ID ve görsel tipi gerekli." },
        { status: 400 }
      );
    }

    const spec: BrandVisualSpec | undefined = BRAND_VISUAL_SPECS[input.type];
    if (!spec) {
      return Response.json(
        { ok: false, message: "Geçersiz görsel tipi: " + input.type },
        { status: 400 }
      );
    }

    const database = getDatabase();
    const project = getProject(input.projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    const brand = JSON.parse(project.brand_json || "{}") as Record<string, string>;
    const concept = normalizeBrandConcept(
      JSON.parse(project.brand_concept_json || "{}")
    );

    // AI Provider ayarlarını çek
    const provider = database
      .prepare(
        "SELECT base_url, encrypted_api_key, text_model, image_model, vision_model, edit_model FROM ai_provider_configs WHERE provider='cliproxy' AND enabled=1"
      )
      .get() as ProviderRow | undefined;

    if (!provider?.base_url || !provider.encrypted_api_key) {
      return Response.json(
        { ok: false, message: "CliProxyAPI sağlayıcısı aktif veya yapılandırılmış değil." },
        { status: 409 }
      );
    }

    const apiKey = decryptSecret(provider.encrypted_api_key);
    const baseUrl = provider.base_url.replace(/\/+$/, "");
    const renderModel = provider.image_model || "gemini-3.1-flash-image";

    // Referans görselleri hazırla (Varsa mevcut logo ve Key Visual stil panosu)
    const references: MediaInput[] = [];
    if (brand.logo) {
      const logoMedia = await loadMedia(brand.logo);
      if (logoMedia) references.push(logoMedia);
    }
    if (concept.sampleVisualUrl) {
      const styleMedia = await loadMedia(concept.sampleVisualUrl);
      if (styleMedia) references.push(styleMedia);
    }

    // ─────────────────────────────────────────────────────────────
    // AGENCY AGENTS DİREKTİFLERİ & KATMANLI PROMPT SENTEZİ
    // (Brand Guardian + Paid Social Strategist + Image Prompt Engineer)
    // ─────────────────────────────────────────────────────────────
    const brandName = brand.brandName || project.name || "Marka";
    const industry = brand.industry || "Teknoloji & Eğitim";
    const audience = brand.audience || "Kullanıcılar";
    const groundColor = concept.groundColor || "#FDFBF7";
    const primaryColor = concept.primaryColor || brand.primaryColor || "#FF6B35";
    const secondaryColor = concept.secondaryColor || brand.secondaryColor || "#0F4C81";
    const accentColor = concept.accentColor || "#FFD166";

    const promptLayers = [
      `[BRAND GUARDIAN IDENTITY SPECIFICATION]`,
      `Brand Name: "${brandName}"`,
      `Industry & Niche: ${industry}`,
      `Target Audience: ${audience}`,
      `Color Contract: 60% Ground ${groundColor}, 30% Structure ${secondaryColor}, 10% Primary Action ${primaryColor}, Accent Highlight ${accentColor}.`,
      concept.visualStyle && `Visual Style Guidelines: ${concept.visualStyle}`,
      concept.photographyStyle && `Texture & Material Language: ${concept.photographyStyle}`,
      concept.personality && `Brand Character Traits: ${concept.personality}`,
      ``,
      `[PAID SOCIAL STRATEGIST FORMAT & SAFE ZONE DIRECTIVE]`,
      `Target Platform: ${spec.platform}`,
      `Asset Type: ${spec.title} (${spec.dimensions})`,
      `Composition Rule: ${spec.agentDirectives.safeZoneNote}`,
      `Safe Zone Guide: ${spec.safeZoneGuide}`,
      ``,
      `[IMAGE PROMPT ENGINEER MULTI-LAYER COMPOSITION]`,
      `Subject Layer: ${spec.agentDirectives.subjectPrompt} tailored specifically for ${brandName} in ${industry}.`,
      input.customDirection?.trim() && `User Creative Direction: ${input.customDirection.trim()}`,
      `Environment & Ground Layer: Clean, sophisticated solid background in hex ${groundColor}, studio backdrop with soft organic shadow gradation. Zero busy background clutter.`,
      `Lighting Specification: Softbox diffused studio lighting, gentle rim light defining edges, matte tactile texture, professional lighting.`,
      `Compositional Layout: ${spec.agentDirectives.compositionPrompt}`,
      `Technical Execution: Razor-sharp vector clarity, hyper-clean aesthetic, high resolution commercial asset. NO watermarks, NO stock photo artifacts, NO arbitrary floating lorem ipsum words.`,
    ]
      .filter(Boolean)
      .join("\n");

    // Cliproxy / Gemini Flash Image ile görseli oluştur
    const renderedImage = await renderCreative({
      baseUrl,
      apiKey,
      model: renderModel,
      prompt: promptLayers,
      ratio: spec.generatorRatio,
      references: references.length > 0 ? references : undefined,
    });

    if (!renderedImage?.bytes) {
      throw new Error("Görsel üretim modeli geçerli bir çıktı üretemedi.");
    }

    // Sharp ile platformun tam piksel ölçülerine göre işleme
    const processedBuffer = await sharp(renderedImage.bytes)
      .resize({
        width: spec.width,
        height: spec.height,
        fit: "contain",
        background: groundColor,
      })
      .png({ quality: 95 })
      .toBuffer();

    // Küçük WebP önizleme (hızlı UI yüklemesi için)
    const thumbBuffer = await sharp(processedBuffer)
      .resize({
        width: Math.min(spec.width, 480),
        height: Math.min(spec.height, Math.round((spec.height / spec.width) * 480)),
        fit: "contain",
        background: groundColor,
      })
      .webp({ quality: 82 })
      .toBuffer();

    // Dosyaları .data/assets klasörüne kaydet
    const assetsDir = path.join(process.cwd(), ".data", "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const assetId = `brand-visual-${input.projectId}-${input.type}-${Date.now()}`;
    const mainFilePath = path.join(assetsDir, `${assetId}.png`);
    const thumbFilePath = path.join(assetsDir, `${assetId}_thumb.webp`);

    fs.writeFileSync(mainFilePath, processedBuffer);
    fs.writeFileSync(thumbFilePath, thumbBuffer);

    const assetUrl = `/api/assets/${assetId}`;
    const nowIso = new Date().toISOString();

    const newVisualItem: SavedVisualItem = {
      type: input.type,
      url: assetUrl,
      createdAt: nowIso,
      updatedAt: nowIso,
      dimensions: spec.dimensions,
      promptUsed: input.customDirection || undefined,
    };

    // Veritabanını güncelle
    const currentVisuals = parseVisuals(project.brand_visuals_json);
    currentVisuals.items[input.type] = newVisualItem;
    currentVisuals.updatedAt = nowIso;

    database
      .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
      .run(JSON.stringify(currentVisuals), input.projectId);

    return Response.json({
      ok: true,
      item: newVisualItem,
      visuals: currentVisuals,
      message: `${spec.title} başarıyla üretildi.`,
    });
  } catch (error) {
    console.error("Brand visual generation error:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Görsel üretimi sırasında hata oluştu.",
      },
      { status: 500 }
    );
  }
}

// PUT: Görseli "Ana Logo Olarak Ata" veya listeden silme işlemi
export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as {
      projectId?: string;
      action?: "set_primary_logo" | "delete_item";
      type?: BrandVisualType;
      url?: string;
    };

    if (!input.projectId || !input.action) {
      return Response.json(
        { ok: false, message: "Proje ID ve aksiyon gerekli." },
        { status: 400 }
      );
    }

    const database = getDatabase();
    const project = getProject(input.projectId);
    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    // 1. Ana Marka Logosu Olarak Ata
    if (input.action === "set_primary_logo") {
      if (!input.url) {
        return Response.json({ ok: false, message: "Logo URL'si gerekli." }, { status: 400 });
      }

      const brand = JSON.parse(project.brand_json || "{}") as Record<string, unknown>;
      brand.logo = input.url;

      database
        .prepare("UPDATE projects SET brand_json = ? WHERE id = ?")
        .run(JSON.stringify(brand), input.projectId);

      return Response.json({
        ok: true,
        logoUrl: input.url,
        message: "Görsel başarıyla projenin ana marka logosu olarak ayarlandı.",
      });
    }

    // 2. Görseli Listeden Kaldır
    if (input.action === "delete_item") {
      if (!input.type) {
        return Response.json({ ok: false, message: "Silinecek tip gerekli." }, { status: 400 });
      }

      const visuals = parseVisuals(project.brand_visuals_json);
      delete visuals.items[input.type];
      visuals.updatedAt = new Date().toISOString();

      database
        .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
        .run(JSON.stringify(visuals), input.projectId);

      return Response.json({
        ok: true,
        visuals,
        message: "Görsel kaydı kaldırıldı.",
      });
    }

    return Response.json({ ok: false, message: "Geçersiz aksiyon." }, { status: 400 });
  } catch (error) {
    console.error("Brand visual PUT error:", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "İşlem sırasında hata oluştu.",
      },
      { status: 500 }
    );
  }
}
