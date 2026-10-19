import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  BRAND_VISUAL_SPECS,
  BrandVisualSpec,
  BrandVisualType,
  BrandVisualsState,
  GeneratedLogoConcept,
  LOGO_STYLE_ARCHETYPES,
  LOGO_TYPOGRAPHY_STYLES,
  LogoEngine,
  LogoLayout,
  LogoReferenceMode,
  LogoStyleArchetype,
  LogoTypographyStyle,
  LogoStudioPreferences,
  SavedVisualItem,
} from "@/lib/brand-visuals";
import { normalizeBrandConcept } from "@/lib/brand-concept";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret } from "@/lib/server/secrets";
import { loadMedia, MediaInput, renderCreative } from "@/lib/server/cliproxy-creative";
import { completeText } from "@/lib/server/cliproxy-text";

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
  if (!jsonString) return { items: {}, logoConcepts: [], updatedAt: "" };
  try {
    const parsed = JSON.parse(jsonString);
    return {
      items: parsed.items || {},
      logoConcepts: Array.isArray(parsed.logoConcepts) ? parsed.logoConcepts : [],
      activeLogoConceptId: parsed.activeLogoConceptId || undefined,
      preferences: parsed.preferences || undefined,
      updatedAt: parsed.updatedAt || "",
    };
  } catch {
    return { items: {}, logoConcepts: [], updatedAt: "" };
  }
}

// GET: Projenin mevcut marka görsellerini ve logo konseptlerini listeler
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

// POST: Görsel üretimi veya Logo Stüdyosu konsept üretimi
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ─────────────────────────────────────────────────────────────
    // AKŞİYON 1: LOGO TASARIM STÜDYOSU KONSEPT ÜRETİMİ
    // ─────────────────────────────────────────────────────────────
    if (body.action === "generate_logo_concept") {
      const input = body as {
        projectId?: string;
        style?: LogoStyleArchetype;
        engine?: LogoEngine;
        layout?: LogoLayout;
        referenceMode?: LogoReferenceMode;
        customReferenceUrl?: string;
        typography?: {
          brandName?: string;
          tagline?: string;
          fontStyle?: LogoTypographyStyle;
        };
        customDirection?: string;
        count?: number;
      };

      if (!input.projectId) {
        return Response.json({ ok: false, message: "Proje ID gerekli." }, { status: 400 });
      }

      const database = getDatabase();
      const project = getProject(input.projectId);
      if (!project) {
        return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
      }

      const brand = JSON.parse(project.brand_json || "{}") as Record<string, string>;
      const concept = normalizeBrandConcept(JSON.parse(project.brand_concept_json || "{}"));

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

      const styleId = input.style || "geometric";
      const styleMeta = LOGO_STYLE_ARCHETYPES.find((s) => s.id === styleId) || LOGO_STYLE_ARCHETYPES[0];
      const engine = input.engine || "gemini_image";
      const layout = input.layout || "stacked";
      const referenceMode = input.referenceMode || "none";
      const brandName = (input.typography?.brandName !== undefined && input.typography.brandName !== null)
        ? input.typography.brandName.trim()
        : (brand.brandName || project.name || "Marka");

      // ÖNEMLİ KURAL: Eğer kullanıcı sloganı sildiyse veya boş bıraktıysa ASLA brand.industry'yi yedekleme!
      // Boş ise kesinlikle SLOGANSIZ üretilmeli.
      const hasTagline = Boolean(
        input.typography?.tagline && input.typography.tagline.trim().length > 0
      );
      const tagline = hasTagline ? input.typography!.tagline!.trim() : "";
      const fontStyle = input.typography?.fontStyle || "sans";
      const typographyMeta = LOGO_TYPOGRAPHY_STYLES.find((t) => t.id === fontStyle) || LOGO_TYPOGRAPHY_STYLES[0];

      const groundColor = concept.groundColor || "#FDFBF7";
      const primaryColor = concept.primaryColor || brand.primaryColor || "#FF6B35";
      const secondaryColor = concept.secondaryColor || brand.secondaryColor || "#0F4C81";
      const accentColor = concept.accentColor || "#FFD166";
      const industry = brand.industry || "Teknoloji & Eğitim";

      const assetsDir = path.join(process.cwd(), ".data", "assets");
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

      const generatedConcepts: GeneratedLogoConcept[] = [];
      const count = Math.min(Math.max(input.count || 1, 1), 3);

      for (let i = 0; i < count; i++) {
        const randomSeed = Math.floor(Math.random() * 900000) + 100000;
        const conceptId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        if (engine === "svg_vector") {
          // ── SAF VEKTÖR SVG MOTORU (Claude / Gemini 3.8 + Sharp) ──
          const systemPrompt = `You are a world-class principal brand identity designer and SVG vector master.
Your job is to generate a pristine, standalone, scalable XML SVG logo according to the exact brand contract.
Output ONLY the raw <svg>...</svg> element. Do NOT wrap in markdown fences or conversational text.`;

          const userPrompt = `Create a master logo SVG for the brand "${brandName}".
- Industry: ${industry}
${
  hasTagline
    ? `- Slogan/Tagline: "${tagline}" (Render this text neatly beneath or beside the brand name)`
    : `- Slogan/Tagline: STRICTLY NONE. ABSOLUTELY NO TAGLINE, NO MOTTO, NO SUBTITLE TEXT. The user explicitly chose NO SLOGAN. Render ONLY the emblem and the brand name "${brandName}". Do NOT invent, add or render any secondary text words below the brand name!`
}
- Design Archetype: ${styleMeta.name} (${styleMeta.promptDirectives})
- Typography Style: ${typographyMeta.name} (${typographyMeta.fontCategory})
- Layout Architecture: ${
            layout === "horizontal"
              ? `Horizontal lockup: Symbol on the left, brand name typography on the right${hasTagline ? ' with tagline underneath' : ' with NO tagline'}. (viewBox 0 0 1200 400)`
              : layout === "icon_only"
              ? "Standalone iconic symbol/emblem without brand name or any text (viewBox 0 0 800 800)"
              : layout === "badge"
              ? `Circular crest/badge seal with concentric rings and curved/straight brand name${hasTagline ? ' and tagline' : ' (NO tagline)'}. (viewBox 0 0 800 800)`
              : `Stacked composition: Striking emblem on top, brand name "${brandName}" centered below${hasTagline ? ` and tagline "${tagline}" under brand name` : ' with STRICTLY NO tagline or secondary text'}. (viewBox 0 0 800 800)`
          }
- Color Palette:
  * Background fill: ${groundColor}
  * Primary brand action color: ${primaryColor}
  * Secondary structural/text color: ${secondaryColor}
  * Accent highlight: ${accentColor}
- Creative Variation Seed #${randomSeed}: Focus on unique geometry, memorable silhouette, and perfect balance.
${input.customDirection?.trim() ? `User Direction: ${input.customDirection.trim()}` : ""}
- Requirements:
  * Must be 100% valid XML SVG with xmlns="http://www.w3.org/2000/svg"
  * Scalable vector paths, polygons, circles, and clean <text> elements
  * High contrast, professional corporate finish, clean negative space.${!hasTagline ? '\n  * STRICT NEGATIVE CONSTRAINT: Zero subtitle or slogan words. Only "' + brandName + '" text is allowed.' : ''}`;

          const textModel = "gemini-3-flash";
          const { content: svgRaw } = await completeText(systemPrompt, userPrompt, {
            model: textModel,
            temperature: 0.7,
            maxTokens: 2500,
          });

          const svgCleanMatch = svgRaw.match(/<svg[\s\S]*<\/svg>/i);
          if (!svgCleanMatch) {
            throw new Error("Vektör SVG modeli geçerli bir SVG kodu oluşturamadı.");
          }
          const svgContent = svgCleanMatch[0];

          // Sharp ile PNG ve WebP raster çıktıları üret
          const processedBuffer = await sharp(Buffer.from(svgContent))
            .resize(1080, 1080, { fit: "contain", background: groundColor })
            .png({ quality: 95 })
            .toBuffer();

          const thumbBuffer = await sharp(processedBuffer)
            .resize(360, 360, { fit: "contain", background: groundColor })
            .webp({ quality: 82 })
            .toBuffer();

          fs.writeFileSync(path.join(assetsDir, `${conceptId}.svg`), svgContent, "utf8");
          fs.writeFileSync(path.join(assetsDir, `${conceptId}.png`), processedBuffer);
          fs.writeFileSync(path.join(assetsDir, `${conceptId}_thumb.webp`), thumbBuffer);
          fs.writeFileSync(
            path.join(assetsDir, `${conceptId}.json`),
            JSON.stringify({ mimeType: "image/svg+xml", extension: "svg" })
          );

          generatedConcepts.push({
            id: conceptId,
            title: `${styleMeta.name} Vektör Logo ${count > 1 ? `#${i + 1}` : ""}`.trim(),
            style: styleId,
            engine: "svg_vector",
            layout,
            typography: {
              brandName,
              tagline: tagline || undefined,
              fontStyle,
            },
            url: `/api/assets/${conceptId}`,
            svgContent,
            createdAt: nowIso,
            promptUsed: input.customDirection || undefined,
          });
        } else {
          // ── GEMINI 3.1 FLASH IMAGE DIFÜZYON MOTORU ──
          const references: MediaInput[] = [];
          if (referenceMode === "evolve" && brand.logo) {
            const logoMedia = await loadMedia(brand.logo);
            if (logoMedia) references.push(logoMedia);
          } else if (referenceMode === "custom" && input.customReferenceUrl) {
            const customMedia = await loadMedia(input.customReferenceUrl);
            if (customMedia) references.push(customMedia);
          }
          // Note: When referenceMode is "none", references remains completely empty!

          const layoutInstruction =
            layout === "horizontal"
              ? "horizontal lockup: clean iconic emblem on the left paired with clear typography of the brand name on the right. 16:9 ratio."
              : layout === "icon_only"
              ? "standalone high-impact brand emblem symbol without any text words, perfectly centered with wide breathing room. 1:1 square ratio."
              : layout === "badge"
              ? "round circular stamp seal crest, concentric rings, embossed premium insignia. 1:1 square ratio."
              : "stacked corporate logo: striking emblem positioned above the centered brand name typography. 1:1 square ratio.";

          const promptLayers = [
            `[BRAND GUARDIAN LOGO DESIGN CONTRACT]`,
            `Brand Name: "${brandName}"`,
            hasTagline
              ? `Tagline/Subtitle: "${tagline}"`
              : `MANDATORY NEGATIVE TEXT RULE: ABSOLUTELY NO SLOGAN, NO SUBTITLE, NO MOTTO, NO EXTRA TEXT. Render ONLY the emblem icon and the brand name "${brandName}". Zero secondary text lines allowed.`,
            `Industry: ${industry}`,
            `Color Palette: 60% Ground ${groundColor}, 30% Structure ${secondaryColor}, 10% Primary Action ${primaryColor}, Accent Highlight ${accentColor}.`,
            ``,
            `[DESIGN ARCHETYPE & STYLE DIRECTIVE]`,
            `Style Archetype: ${styleMeta.name}`,
            `Archetype Specification: ${styleMeta.promptDirectives}`,
            `Typography Character: ${typographyMeta.name} - ${typographyMeta.fontCategory}`,
            `Composition Layout: ${layoutInstruction}`,
            `Creative Variation Angle #${randomSeed}: Unique perspective, fresh iconic contours, pristine balance.`,
            input.customDirection?.trim() && `User Creative Direction: ${input.customDirection.trim()}`,
            ``,
            `[TECHNICAL EXECUTION STANDARDS]`,
            `Background: Clean solid ${groundColor} studio backdrop with soft ambient occlusion.`,
            `Lighting: Diffused softbox studio lighting, gentle rim light, matte non-reflective texture.`,
            `Quality: Razor-sharp logo graphic design, commercial identity master quality. NO watermarks, NO photo clutter, NO blurry artifacts.`,
          ]
            .filter(Boolean)
            .join("\n");

          const renderModel = provider.image_model || "gemini-3.1-flash-image";
          const renderedImage = await renderCreative({
            baseUrl,
            apiKey,
            model: renderModel,
            prompt: promptLayers,
            ratio: layout === "horizontal" ? "16:9" : "1:1",
            references: references.length > 0 ? references : undefined,
          });

          if (!renderedImage?.bytes) {
            throw new Error("Görsel difüzyon modeli geçerli bir logo çıktısı üretemedi.");
          }

          const targetWidth = layout === "horizontal" ? 1600 : 1080;
          const targetHeight = layout === "horizontal" ? 900 : 1080;

          const processedBuffer = await sharp(renderedImage.bytes)
            .resize({
              width: targetWidth,
              height: targetHeight,
              fit: "contain",
              background: groundColor,
            })
            .png({ quality: 95 })
            .toBuffer();

          const thumbBuffer = await sharp(processedBuffer)
            .resize({
              width: Math.min(targetWidth, 480),
              height: Math.min(targetHeight, Math.round((targetHeight / targetWidth) * 480)),
              fit: "contain",
              background: groundColor,
            })
            .webp({ quality: 82 })
            .toBuffer();

          fs.writeFileSync(path.join(assetsDir, `${conceptId}.png`), processedBuffer);
          fs.writeFileSync(path.join(assetsDir, `${conceptId}_thumb.webp`), thumbBuffer);
          fs.writeFileSync(
            path.join(assetsDir, `${conceptId}.json`),
            JSON.stringify({ mimeType: "image/png", extension: "png" })
          );

          generatedConcepts.push({
            id: conceptId,
            title: `${styleMeta.name} Logo ${count > 1 ? `#${i + 1}` : ""}`.trim(),
            style: styleId,
            engine: "gemini_image",
            layout,
            typography: {
              brandName,
              tagline: tagline || undefined,
              fontStyle,
            },
            url: `/api/assets/${conceptId}`,
            createdAt: nowIso,
            promptUsed: input.customDirection || undefined,
          });
        }
      }

      // Projenin brand_visuals_json alanını güncelle
      const currentVisuals = parseVisuals(project.brand_visuals_json);
      currentVisuals.logoConcepts = [
        ...generatedConcepts,
        ...(currentVisuals.logoConcepts || []),
      ];
      // Tercihleri kalıcı hafızaya kaydet
      currentVisuals.preferences = {
        style: styleId,
        engine,
        layout,
        referenceMode,
        fontStyle,
        brandName,
        tagline: input.typography?.tagline || "",
        includeTagline: hasTagline,
      };
      currentVisuals.updatedAt = new Date().toISOString();

      database
        .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
        .run(JSON.stringify(currentVisuals), input.projectId);

      return Response.json({
        ok: true,
        concepts: generatedConcepts,
        visuals: currentVisuals,
        message: `${generatedConcepts.length} adet yeni logo konsepti üretildi.`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // AKŞİYON 2: SOSYAL MEDYA STANDART GÖRSELİ ÜRETİMİ
    // ─────────────────────────────────────────────────────────────
    const input = body as {
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

    // ÖNEMLİ KURAL: Eğer üretilen şey bir LOGO ise, eski logoyu referans olarak besleme!
    // Sadece bannerlar, avatarlar ve öne çıkanlar gibi logoyu KULLANAN alanlarda referans ver.
    const references: MediaInput[] = [];
    if (spec.category !== "logos" && brand.logo) {
      const logoMedia = await loadMedia(brand.logo);
      if (logoMedia) references.push(logoMedia);
    }
    if (concept.sampleVisualUrl && spec.category === "banners") {
      const styleMedia = await loadMedia(concept.sampleVisualUrl);
      if (styleMedia) references.push(styleMedia);
    }

    const brandName = brand.brandName || project.name || "Marka";
    const industry = brand.industry || "Teknoloji & Eğitim";
    const audience = brand.audience || "Kullanıcılar";
    const groundColor = concept.groundColor || "#FDFBF7";
    const primaryColor = concept.primaryColor || brand.primaryColor || "#FF6B35";
    const secondaryColor = concept.secondaryColor || brand.secondaryColor || "#0F4C81";
    const accentColor = concept.accentColor || "#FFD166";
    const randomVariationSeed = Math.floor(Math.random() * 900000) + 100000;

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
      `Creative Concept Variation #${randomVariationSeed}: Fresh original composition with dynamic visual interest.`,
      input.customDirection?.trim() && `User Creative Direction: ${input.customDirection.trim()}`,
      `Environment & Ground Layer: Clean, sophisticated solid background in hex ${groundColor}, studio backdrop with soft organic shadow gradation. Zero busy background clutter.`,
      `Lighting Specification: Softbox diffused studio lighting, gentle rim light defining edges, matte tactile texture, professional lighting.`,
      `Compositional Layout: ${spec.agentDirectives.compositionPrompt}`,
      `Technical Execution: Razor-sharp vector clarity, hyper-clean aesthetic, high resolution commercial asset. NO watermarks, NO stock photo artifacts, NO arbitrary floating lorem ipsum words.`,
    ]
      .filter(Boolean)
      .join("\n");

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

    const processedBuffer = await sharp(renderedImage.bytes)
      .resize({
        width: spec.width,
        height: spec.height,
        fit: "contain",
        background: groundColor,
      })
      .png({ quality: 95 })
      .toBuffer();

    const thumbBuffer = await sharp(processedBuffer)
      .resize({
        width: Math.min(spec.width, 480),
        height: Math.min(spec.height, Math.round((spec.height / spec.width) * 480)),
        fit: "contain",
        background: groundColor,
      })
      .webp({ quality: 82 })
      .toBuffer();

    const assetsDir = path.join(process.cwd(), ".data", "assets");
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const assetId = crypto.randomUUID();
    const mainFilePath = path.join(assetsDir, `${assetId}.png`);
    const thumbFilePath = path.join(assetsDir, `${assetId}_thumb.webp`);
    const metaFilePath = path.join(assetsDir, `${assetId}.json`);

    fs.writeFileSync(mainFilePath, processedBuffer);
    fs.writeFileSync(thumbFilePath, thumbBuffer);
    fs.writeFileSync(
      metaFilePath,
      JSON.stringify({ mimeType: "image/png", extension: "png" })
    );

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

// PUT: "Ana Logo Olarak Ata", "Logo Konsepti Sil" veya "Görsel Sil"
export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as {
      projectId?: string;
      action?: "set_primary_logo" | "delete_item" | "delete_logo_concept" | "save_preferences";
      type?: BrandVisualType;
      conceptId?: string;
      url?: string;
      preferences?: LogoStudioPreferences;
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

    const visuals = parseVisuals(project.brand_visuals_json);

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

      // Aktif logo konseptini işaretle
      if (input.conceptId) {
        visuals.activeLogoConceptId = input.conceptId;
        if (visuals.logoConcepts) {
          visuals.logoConcepts = visuals.logoConcepts.map((c) => ({
            ...c,
            isPrimary: c.id === input.conceptId,
          }));
        }
      }

      // Ayrıca standart logo_emblem alanına da senkronize et
      visuals.items.logo_emblem = {
        type: "logo_emblem",
        url: input.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dimensions: "1080 × 1080 px",
      };
      visuals.updatedAt = new Date().toISOString();

      database
        .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
        .run(JSON.stringify(visuals), input.projectId);

      return Response.json({
        ok: true,
        logoUrl: input.url,
        visuals,
        message: "Görsel başarıyla projenin ana marka logosu olarak ayarlandı.",
      });
    }

    // 2. Logo Konseptini Sil
    if (input.action === "delete_logo_concept") {
      if (!input.conceptId) {
        return Response.json({ ok: false, message: "Silinecek konsept ID gerekli." }, { status: 400 });
      }

      visuals.logoConcepts = (visuals.logoConcepts || []).filter((c) => c.id !== input.conceptId);
      if (visuals.activeLogoConceptId === input.conceptId) {
        visuals.activeLogoConceptId = undefined;
      }
      visuals.updatedAt = new Date().toISOString();

      database
        .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
        .run(JSON.stringify(visuals), input.projectId);

      return Response.json({
        ok: true,
        visuals,
        message: "Logo konsepti kaldırıldı.",
      });
    }

    // 4. Tercihleri Hafızaya Kaydet
    if (input.action === "save_preferences") {
      visuals.preferences = (input as { preferences?: any }).preferences;
      visuals.updatedAt = new Date().toISOString();
      database
        .prepare("UPDATE projects SET brand_visuals_json = ? WHERE id = ?")
        .run(JSON.stringify(visuals), input.projectId);

      return Response.json({
        ok: true,
        visuals,
        message: "Tercihler hafızaya kaydedildi.",
      });
    }

    // 3. Standart Görseli Listeden Kaldır
    if (input.action === "delete_item") {
      if (!input.type) {
        return Response.json({ ok: false, message: "Silinecek tip gerekli." }, { status: 400 });
      }

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
