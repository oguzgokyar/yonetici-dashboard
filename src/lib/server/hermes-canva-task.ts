export const HERMES_CANVA_PIPELINE_VERSION = "2026-09-28-v1";

export type CanvaContentType =
  // Carousel (Çoklu Slayt)
  | "instagram_carousel"
  | "square_carousel"
  | "story_carousel"
  | "landscape_carousel"
  // Video (Reels & Animasyonlu Video)
  | "reels_video"
  | "square_video"
  | "portrait_video"
  | "landscape_video"
  // Tekil Görseller
  | "instagram_post"
  | "square_post"
  | "instagram_story"
  | "pinterest_pin";

export interface ContentTypeMeta {
  width: number;
  height: number;
  packageType: "single" | "carousel";
  category: "carousel" | "video" | "single";
  minSlides: number;
  maxSlides: number;
  defaultSlides: number;
  label: string;
  canvaFormat: string;
  aspectRatio: string;
}

export const CANVA_CONTENT_TYPES: Record<CanvaContentType, ContentTypeMeta> = {
  // CAROUSEL
  instagram_carousel: {
    width: 1080,
    height: 1350,
    packageType: "carousel",
    category: "carousel",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 6,
    label: "Instagram Portre Carousel (1080×1350 • 4:5)",
    canvaFormat: "Instagram Post (Portrait)",
    aspectRatio: "4:5",
  },
  square_carousel: {
    width: 1080,
    height: 1080,
    packageType: "carousel",
    category: "carousel",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 6,
    label: "Kare Carousel (1080×1080 • 1:1)",
    canvaFormat: "Instagram Post (Square)",
    aspectRatio: "1:1",
  },
  story_carousel: {
    width: 1080,
    height: 1920,
    packageType: "carousel",
    category: "carousel",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Dikey / Story Carousel (1080×1920 • 9:16)",
    canvaFormat: "Instagram Story",
    aspectRatio: "9:16",
  },
  landscape_carousel: {
    width: 1920,
    height: 1080,
    packageType: "carousel",
    category: "carousel",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Yatay Sunum / LinkedIn (1920×1080 • 16:9)",
    canvaFormat: "Presentation (16:9)",
    aspectRatio: "16:9",
  },

  // VİDEO (Reels & Animasyon)
  reels_video: {
    width: 1080,
    height: 1920,
    packageType: "carousel",
    category: "video",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Instagram Reels / TikTok Video (1080×1920 • 9:16)",
    canvaFormat: "Instagram Story",
    aspectRatio: "9:16",
  },
  square_video: {
    width: 1080,
    height: 1080,
    packageType: "carousel",
    category: "video",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Kare Akış Videosu (1080×1080 • 1:1)",
    canvaFormat: "Instagram Post (Square)",
    aspectRatio: "1:1",
  },
  portrait_video: {
    width: 1080,
    height: 1350,
    packageType: "carousel",
    category: "video",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Portre Akış Videosu (1080×1350 • 4:5)",
    canvaFormat: "Instagram Post (Portrait)",
    aspectRatio: "4:5",
  },
  landscape_video: {
    width: 1920,
    height: 1080,
    packageType: "carousel",
    category: "video",
    minSlides: 3,
    maxSlides: 10,
    defaultSlides: 5,
    label: "Yatay Video / YouTube (1920×1080 • 16:9)",
    canvaFormat: "Presentation (16:9)",
    aspectRatio: "16:9",
  },

  // TEKİL GÖRSELLER
  instagram_post: {
    width: 1080,
    height: 1350,
    packageType: "single",
    category: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Instagram Portre Gönderi (1080×1350 • 4:5)",
    canvaFormat: "Instagram Post (Portrait)",
    aspectRatio: "4:5",
  },
  square_post: {
    width: 1080,
    height: 1080,
    packageType: "single",
    category: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Kare Gönderi (1080×1080 • 1:1)",
    canvaFormat: "Instagram Post (Square)",
    aspectRatio: "1:1",
  },
  instagram_story: {
    width: 1080,
    height: 1920,
    packageType: "single",
    category: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Instagram Story (1080×1920 • 9:16)",
    canvaFormat: "Instagram Story",
    aspectRatio: "9:16",
  },
  pinterest_pin: {
    width: 1000,
    height: 1500,
    packageType: "single",
    category: "single",
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    label: "Pinterest Pin (1000×1500 • 2:3)",
    canvaFormat: "Pinterest Pin",
    aspectRatio: "2:3",
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
        `${meta.label} için sayfa sayısı ${meta.minSlides} ile ${meta.maxSlides} arasında olmalıdır.`
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
  const isVideoFormat = meta.category === "video";
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
      isAutoVideo: isVideoFormat,
      dimensions: `${meta.width}x${meta.height}`,
      slideCount: payload.slideCount,
      style: payload.style || "Modern ve minimalist",
      brand: payload.brandSnapshot || {},
    },
    null,
    2
  );

  const brandInfo = payload.brandSnapshot || {};
  const concept = (brandInfo as any).brandConcept;
  const isBrandStyleActive = (brandInfo as any).applyBrandStyle !== false;

  // YALNIZCA KULLANICININ ARAYÜZDE SEÇTİĞİ BİLGİLERİ DİNAMİK LİSTELE
  const selectedElements: string[] = [];
  if (brandInfo.name) selectedElements.push(`Marka Adı: "${brandInfo.name}"`);
  if (brandInfo.logo) selectedElements.push(`Logo: Markanın resmi logosu uygun bir köşeye yerleştirilecek.`);
  if (brandInfo.website) selectedElements.push(`Web Sitesi: "${brandInfo.website}" alt veya köşe çentiğinde zarifçe belirtilecek.`);
  if (brandInfo.phone) selectedElements.push(`Telefon: "${brandInfo.phone}"`);
  if (brandInfo.email) selectedElements.push(`E-posta: "${brandInfo.email}"`);

  let brandBriefInjection = "";
  if (selectedElements.length > 0) {
    brandBriefInjection = `\n[KULLANICININ SEÇTİĞİ MARKA BİLGİLERİ (Tasarımda Doğal Olarak Kullan)]:\n${selectedElements.map((s) => `- ${s}`).join("\n")}\n(NOT: Yukarıda belirtilmeyen hiçbir marka bilgisi zorla eklenmeyecektir.)\n`;
  }

  let brandGuardianBlock = "";
  if (isBrandStyleActive && concept?.summary) {
    brandGuardianBlock = `
MARKANIN RENK & STİL REHBERİ (İlham ve Denge Rehberi):
- Tasarım Ruhu: ${concept.summary}
- Renk Dengesi İlhamı: %60 Zemin (${concept.groundColor || "#FDFBF7"}), %30 Yapı/Tipografi (${concept.secondaryColor || "#0f172a"}), %10 Ana Aksiyon/Vurgu (${concept.primaryColor || "#FF6B35"})${concept.accentColor ? `, Ekstra Rozet/LED Vurgusu (${concept.accentColor})` : ""}.
- Tipografi Önerisi: Başlıklar güçlü ve net sans-serif (${concept.typographyStyle || "Inter / Plus Jakarta Sans Bold"}), gövdeler okunaklı sans-serif.
${concept.visualStyle ? `- Görsel Stil Kuralı: ${concept.visualStyle}\n` : ""}${concept.layoutGuidelines ? `- Yerleşim ve Kenar Boşluğu: ${concept.layoutGuidelines}\n` : ""}`;
  }

  // Brief metnini dinamik olarak marka seçimi ve evrensel görsel disiplin kuralları ile zenginleştir (Sabit kalıp dayatmadan özgünlüğü korur)
  const effectiveBrief = [
    payload.prompt,
    brandBriefInjection,
    brandGuardianBlock,
    `[ÖZGÜN KOMPOZİSYON & GÖRSEL DİSİPLİN İLKELERİ (Sabit Kalıp Yok, Özgür ve Temiz Mizanpaj)]:
- Serbest ve Özgün Tasarım: Sabit tek tip kalıplar (sol metin / sağ görsel gibi katı şablonlar) KESİNLİKLE KULLANILMAZ. Tasarımın içeriğine ve ruhuna göre serbest, yaratıcı ve özgün mizanpajlar oluşturulur (merkez odaklı, asimetrik, kartlı, katmanlı, ferah vb.).
- UI & Sayaç Güvenli Alanı: Kenarlarda karusel gezinme okları (<, >) ve sağ altta sayfa indikatörü (örn: 5/6) için en az 100px tampon güvenlik payı bırakılır. Kablolar, devreler, logolar veya metinler bu arayüz elemanlarının altına giremez.
- Katman Bağımsızlığı & Netlik: İki boyutlu teknik blueprint/şema çizimleri ile üç boyutlu fiziksel nesneler birbirinin içine karmaşık kolaj şeklinde yedirilmez. Her nesne kendi net alanında, temiz ve belirgin durmalıdır.
- Tipografik Orantı & Okunabilirlik: Başlık devasa iken liste maddeleri veya açıklamalar okunmayacak kadar minyatür olamaz. Gövde metinleri mobilde tek bakışta rahatça okunabilecek puntoda ve ferah satır aralığında olmalıdır.
- Katman Çakışması Kesinlikle Yasaktır (No element collision): Metin kutuları veya objeler hiçbir zaman diğer metinlerin veya karmaşık illüstrasyonların üzerine binemez.`
  ].filter(Boolean).join("\n\n").replace(/"/g, '\\"');

  const isSinglePage = payload.slideCount === 1;

  return `[HERMES_CANVA_MACHINE_TASK v${HERMES_CANVA_PIPELINE_VERSION}]
Bu bir Yönetici Dashboard Canva görsel/video üretim makine görevidir.
Bu görevde 'canva-carousel-director' ve 'canva-mcp' becerilerini kullan.

KOORDİNASYON: Bu işin tüm tarayıcı komutlarını HEAVY_JOB_ID=canva:${payload.jobId} ortam değişkeniyle çalıştır.
Bu aynı iş kimliğiyle mevcut dashboard claim'ine katılır; yeni/farklı iş kimliği kullanma.
ÖNEMLİ KURALLAR:
1. Kullanıcıyla sohbet ETME, clarification sorusu SORMA. Görevi doğrudan yerine getir.
2. Kesinlikle harici Telegram bildirimi GÖNDERME ('send_tg.py' yasaktır).
3. Codex CLI subprocess ÇALIŞTIRMA — terminal aracını kullanma. Sen zaten Canva MCP (canva-mcp) araçlarına sahipsin.
4. Canva MCP araçlarını DOĞRUDAN bu ajan dönüşünden çağır (mcp__canva__create_design vb.).
5. Doğrudan ${meta.width}x${meta.height} boyutunda üret. Asla 16:9 sunum oluşturup resize yapma.
6. Sayfa/sahne sayısı birebir ${payload.slideCount} olmalıdır.
7. Kilitli içerik: Metinleri harfiyen koru, paraphrase yapma, bullet point atlama.
8. Güvenli alanlar: 100px yatay, 140px dikey marjin. Max 2 font ailesi. Bounding box çakışması yok.
${payload.contentType === "instagram_story" ? "9. INSTAGRAM STORY GÜVENLİ ALAN KURALI: 1080x1920 (9:16) Story formatıdır. Üstten 250px (profil adı/kapatma) ve alttan 250px (DM kutusu) boş bırak. Ana soru/mesajı üst-orta alana yerleştir; ortada Instagram interaktif çıkartması (Anket/Soru Kutusu) için temiz, metinsiz alan bırak.\n" : ""}${isVideoFormat ? "10. VİDEO İÇERİK KURALI: Bu bir video formatıdır. Tasarım oluştuktan sonra otomatik olarak 'Sihirli Animasyon' (Magic Animate) işlenecek ve MP4 video olarak arşive kaydedilecektir.\n" : ""}
CANVA TASARIM KURALLARI:
- Format: Doğrudan ${meta.canvaFormat} = ${meta.width}×${meta.height}px (${meta.aspectRatio}).
- Boyut: ${meta.width}x${meta.height}px, ${payload.slideCount} sayfa.
- Tipografi: Başlık net ve vurgulu, gövde okunaklı sans-serif, max 2 font ailesi.
- Style: "${payload.style || "Modern ve minimalist"}".
- Hiyerarşi & Negatif Alan: Metinler illüstrasyonların veya diğer metinlerin üzerine binemez (kesinlikle çakışmasız mizanpaj).
- Kullanıcının Seçtiği Marka Bilgileri: ${JSON.stringify(payload.brandSnapshot || {})} (Yalnızca burada tanımlı olanlar kullanılır, seçilmeyen bilgiler zorlanmaz).

ADIM ADIM YAPMAN GEREKENLER:
1. İlerleme bildir: POST ${progressEndpoint} — { "phase":"generating", "percent":20, "completed":0, "total":${payload.slideCount}, "detail":"Canva tasarımı oluşturuluyor..." }
2. mcp__canva__create_design çağır: brief="${effectiveBrief}", format="${meta.canvaFormat}", sayfa sayısı=${payload.slideCount}.
3. Asenkronsa mcp__canva__get_create_design_async_job ile tamamlanmasını bekle.
4. get_design ile design_id ve edit_url al; get_design_pages ile sayfa sayısını ve boyutları doğrula.
5. İlerleme bildir: POST ${progressEndpoint} — { "phase":"reviewing", "percent":45, "completed":0, "total":${payload.slideCount}, "detail":"Tasarım yerleşimi ve görsel disiplin gözden geçiriliyor..." }
6. GÖZDEN GEÇİRME VE DÜZENLEME (LAYOUT REVIEW & REFINEMENT):
   - get_design_content çağırarak oluşturulan sayfalardaki metin bloklarını ve hiyerarşiyi incele.
   - Gözden Geçirme Kontrolleri:
     a) Okunabilirlik: Başlık aşırı devasa olup liste veya gövde metinleri çok küçük kalmış mı?
     b) Arayüz Marjinleri: Sağ-sol ok butonları ve sağ alttaki sayfa sayacı hizasında ezilen görsel/kablo/yazı var mı?
     c) Katman Çakışması: İllüstrasyon veya arka plan dekoru öndeki metinlerle çarpışıyor mu?
   - Gerekirse cerrahi düzeltme yap:
     - start_editing_transaction(design_id) aç.
     - perform_editing_operations ile çakışan veya aşırı küçük kalan metinlerin boyutunu ferahlat veya karmaşık dekoratif katmanı sadeleştir.
     - commit_editing_transaction ile kaydet.
7. İlerleme bildir: POST ${progressEndpoint} — { "phase":"exporting", "percent":70, "completed":${Math.floor(payload.slideCount / 2)}, "total":${payload.slideCount}, "detail":"Sayfalar dışa aktarılıyor..." }
8. Her sayfa için get_design_thumbnail veya get_design_pages ile signed thumbnail URL'lerini al.
9. terminal aracıyla her URL'yi /tmp/canva_slides_<jobId>/ dizinine PNG olarak indir (curl veya python3 urllib).
10. İlerleme bildir: POST ${progressEndpoint} — { "phase":"uploading", "percent":90, "completed":${payload.slideCount}, "total":${payload.slideCount}, "detail":"Paket arşive kaydediliyor..." }
11. Tüm PNG'leri ve manifest'i multipart/form-data olarak POST ${completeEndpoint} adresine gönder:
   - Header: Authorization: Bearer ${payload.callbackToken}
   - manifest alanı (JSON string):
     { "designId":"<id>", "editUrl":"<url>", "contentType":"${payload.contentType}", "width":${meta.width}, "height":${meta.height}, "pageCount":${payload.slideCount}, "exports":[{"position":1,"name":"slide-01"},{"position":2,"name":"slide-02"},...] }
   - Dosya alanları: "slide-01", "slide-02", ... (${payload.slideCount} adet PNG)
12. Başarıysa: Kısa özet döndür (design_id + edit_url).

HATA DURUMUNDA:
POST ${failEndpoint}
Header: Authorization: Bearer ${payload.callbackToken}
Body JSON: { "jobId":"${payload.jobId}", "error":"<hata açıklaması>", "pipelineVersion":"${HERMES_CANVA_PIPELINE_VERSION}" }

### USER_BRIEF (KİLİTLİ GİRDİ)
\`\`\`json
${userBriefJson}
\`\`\`
`;
}
