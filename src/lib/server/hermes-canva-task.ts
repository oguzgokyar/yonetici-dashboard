export const HERMES_CANVA_PIPELINE_VERSION = "2026-09-28-v1";

export type CanvaContentType =
  | "instagram_post"
  | "instagram_carousel"
  | "instagram_story"
  | "square_post"
  | "pinterest_pin";

export interface ContentTypeMeta {
  width: number;
  height: number;
  packageType: "single" | "carousel";
  minSlides: number;
  maxSlides: number;
  defaultSlides: number;
  label: string;
}

export const CANVA_CONTENT_TYPES: Record<CanvaContentType, ContentTypeMeta> = {
  instagram_post: {
    width: 1080,
    height: 1350,
    packageType: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Instagram Gönderisi (1080x1350)",
  },
  instagram_carousel: {
    width: 1080,
    height: 1350,
    packageType: "carousel",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 6,
    label: "Instagram Carousel (1080x1350)",
  },
  instagram_story: {
    width: 1080,
    height: 1920,
    packageType: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Instagram Story (1080x1920)",
  },
  square_post: {
    width: 1080,
    height: 1080,
    packageType: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Kare Gönderi (1080x1080)",
  },
  pinterest_pin: {
    width: 1000,
    height: 1500,
    packageType: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Pinterest Pin (1000x1500)",
  },
};

export function resolveContentTypeMeta(contentType: string): ContentTypeMeta {
  if (!contentType || !(contentType in CANVA_CONTENT_TYPES)) {
    throw new Error(
      `Geçersiz içerik türü: "${contentType}". Desteklenenler: ${Object.keys(
        CANVA_CONTENT_TYPES
      ).join(", ")}`
    );
  }
  return CANVA_CONTENT_TYPES[contentType as CanvaContentType];
}

export interface CanvaJobInput {
  prompt: string;
  contentType: CanvaContentType;
  slideCount?: number;
  style?: string;
  idempotencyKey?: string;
  selectedBrandFields?: string[];
}

export interface ValidatedCanvaJob {
  prompt: string;
  contentType: CanvaContentType;
  slideCount: number;
  packageType: "single" | "carousel";
  width: number;
  height: number;
  style: string;
  idempotencyKey?: string;
  selectedBrandFields: string[];
}

export function validateCanvaJobInput(rawInput: unknown): ValidatedCanvaJob {
  if (!rawInput || typeof rawInput !== "object") {
    throw new Error("Geçersiz istek gövdesi.");
  }

  const input = rawInput as Partial<CanvaJobInput>;

  const prompt = (input.prompt || "").trim();
  if (!prompt) {
    throw new Error("Prompt zorunludur.");
  }
  if (prompt.length > 2000) {
    throw new Error("Prompt 2000 karakterden uzun olamaz.");
  }

  if (!input.contentType) {
    throw new Error("İçerik türü zorunludur.");
  }

  const meta = resolveContentTypeMeta(input.contentType);

  let slideCount = meta.defaultSlides;
  if (meta.packageType === "carousel") {
    const rawSlides = Number(input.slideCount);
    if (!Number.isInteger(rawSlides) || rawSlides < meta.minSlides || rawSlides > meta.maxSlides) {
      throw new Error(
        `Carousel için sayfa sayısı ${meta.minSlides} ile ${meta.maxSlides} arasında olmalıdır.`
      );
    }
    slideCount = rawSlides;
  } else {
    slideCount = 1;
  }

  const style = (input.style || "Modern ve minimalist").trim().slice(0, 100);
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  const selectedBrandFields = Array.isArray(input.selectedBrandFields)
    ? input.selectedBrandFields.filter((f): f is string => typeof f === "string")
    : ["logo", "brandName", "website"];

  return {
    prompt,
    contentType: input.contentType,
    slideCount,
    packageType: meta.packageType,
    width: meta.width,
    height: meta.height,
    style,
    idempotencyKey,
    selectedBrandFields,
  };
}

export interface CanvaTaskPayload {
  jobId: string;
  projectId: string;
  prompt: string;
  contentType: CanvaContentType;
  slideCount: number;
  style?: string;
  brandSnapshot?: {
    name?: string;
    logo?: string;
    website?: string;
    phone?: string;
    email?: string;
    colors?: string[];
  };
  callbackBaseUrl: string;
  callbackToken: string;
}

export interface CanvaCompletionExpectation {
  contentType: CanvaContentType;
  slideCount: number;
  width: number;
  height: number;
}

export function validateManifestAgainstJob(
  manifest: {
    contentType: CanvaContentType;
    pageCount: number;
    width: number;
    height: number;
  },
  expectation: CanvaCompletionExpectation
): void {
  if (manifest.contentType !== expectation.contentType) {
    throw new Error("Manifest içerik türü üretim işiyle eşleşmiyor.");
  }
  if (manifest.pageCount !== expectation.slideCount) {
    throw new Error("Manifest sayfa sayısı üretim işiyle eşleşmiyor.");
  }
  if (manifest.width !== expectation.width || manifest.height !== expectation.height) {
    throw new Error("Manifest boyutları üretim işiyle eşleşmiyor.");
  }
}

export function buildHermesCanvaTaskPrompt(payload: CanvaTaskPayload): string {
  const meta = resolveContentTypeMeta(payload.contentType);
  const callbackUrl = payload.callbackBaseUrl.replace(/\/+$/, "");

  const progressEndpoint = `${callbackUrl}/api/internal/hermes-canva/jobs/${payload.jobId}/progress`;
  const completeEndpoint = `${callbackUrl}/api/internal/hermes-canva/jobs/${payload.jobId}/complete`;
  const failEndpoint = `${callbackUrl}/api/internal/hermes-canva/jobs/${payload.jobId}/fail`;

  const userBriefJson = JSON.stringify(
    {
      jobId: payload.jobId,
      projectId: payload.projectId,
      prompt: payload.prompt,
      contentType: payload.contentType,
      dimensions: `${meta.width}x${meta.height}`,
      slideCount: payload.slideCount,
      style: payload.style || "Modern ve minimalist",
      brand: payload.brandSnapshot || {},
    },
    null,
    2
  );

  return `[HERMES_CANVA_MACHINE_TASK v${HERMES_CANVA_PIPELINE_VERSION}]
Bu bir Yönetici Dashboard Canva görsel üretim makine görevidir.

ÖNEMLİ KURALLAR:
1. Kullanıcıyla sohbet ETME, clarification (netleştirme) sorusu SORMA. Görevi doğrudan yerine getir.
2. Kesinlikle harici Telegram bildirimi GÖNDERME ('send_tg.py' çağrısı yasaktır). Final cevabın kısa makine özeti olsun.
3. 'canva-carousel-director' ve 'canva-mcp' skill kurallarını eksiksiz yükle ve uygula.
4. Canva üretimini YALNIZ Codex CLI üzerinden yürüt:
   codex exec --approve-for-me --skip-git-repo-check --ephemeral "<STRUCTURED_PROMPT>"
5. Doğrudan ${meta.width}x${meta.height} boyutunda üret (Asla 16:9 sunumdan resize yapma).
6. Sayfa sayısı birebir ${payload.slideCount} olmalıdır.
7. Kilitli Türkçe içerik sözleşmesine uy: Metinleri harfiyen koru, paraphrase yapma, bullet point atlama.
8. Güvenli alanlar: 100px yatay, 140px dikey. Tipografi ve hero görselleri çakışmamalı, maksimum 2 font ailesi, mobil okunabilirlik.

İLERLEME VE BİTİŞ CALLBACK BİLGİSİ:
Her aşamada ilerleme gönder (Authorization: Bearer ${payload.callbackToken}):
- Aşama bildirimleri için: POST ${progressEndpoint}
  Body JSON: { "phase": "preparing|generating|verifying|exporting|uploading", "percent": 0-100, "completed": X, "total": Y, "detail": "Açıklama" }

BAŞARI DURUMU (COMPLETE):
Canva tasarımı oluşturulup sayfalar PNG olarak dışa aktarıldıktan sonra:
POST ${completeEndpoint}
Headers:
  Authorization: Bearer ${payload.callbackToken}
  Content-Type: multipart/form-data
Alanlar:
  - manifest: JSON string içeren obje:
    {
      "designId": "<canva_design_id>",
      "editUrl": "<canva_edit_url>",
      "contentType": "${payload.contentType}",
      "width": ${meta.width},
      "height": ${meta.height},
      "pageCount": ${payload.slideCount},
      "exports": [
        { "position": 1, "name": "slide-01" },
        ...
      ]
    }
  - Dosyalar: "slide-01", "slide-02", ... (${payload.slideCount} adet PNG dosyası)

BAŞARISIZLIK DURUMU (FAIL):
Tasarım üretilemezse veya hata oluşursa:
POST ${failEndpoint}
Headers:
  Authorization: Bearer ${payload.callbackToken}
  Content-Type: application/json
Body JSON:
  {
    "jobId": "${payload.jobId}",
    "error": "Hata açıklaması",
    "pipelineVersion": "${HERMES_CANVA_PIPELINE_VERSION}"
  }

### USER_BRIEF (KİLİTLİ GİRDİ)
\`\`\`json
${userBriefJson}
\`\`\`
`;
}
