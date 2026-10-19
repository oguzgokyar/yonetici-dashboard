export type BrandVisualType =
  | "logo_emblem"
  | "logo_horizontal"
  | "logo_stacked"
  | "logo_badge"
  | "logo_monochrome"
  | "avatar_instagram"
  | "avatar_linkedin"
  | "avatar_youtube"
  | "avatar_twitter"
  | "banner_youtube"
  | "banner_twitter"
  | "banner_linkedin"
  | "banner_facebook"
  | "story_highlight_about"
  | "story_highlight_services"
  | "story_highlight_contact"
  | "story_highlight_reviews";

export type VisualCategory = "logos" | "avatars" | "banners" | "highlights";

export type LogoStyleArchetype =
  | "geometric"
  | "monogram"
  | "tactile_3d"
  | "metaphor"
  | "abstract_dynamic"
  | "stamp_badge"
  | "mascot";

export type LogoTypographyStyle =
  | "sans"
  | "tech"
  | "serif"
  | "display"
  | "monogram_only";

export type LogoLayout = "stacked" | "horizontal" | "icon_only" | "badge";

export type LogoReferenceMode = "none" | "evolve" | "custom";

export type LogoEngine = "gemini_image" | "svg_vector";

export type GeneratedLogoConcept = {
  id: string;
  title: string;
  style: LogoStyleArchetype;
  engine: LogoEngine;
  layout: LogoLayout;
  typography: {
    brandName: string;
    tagline?: string;
    fontStyle: LogoTypographyStyle;
  };
  url: string;
  svgContent?: string;
  createdAt: string;
  promptUsed?: string;
  isPrimary?: boolean;
};

export type BrandVisualSpec = {
  type: BrandVisualType;
  category: VisualCategory;
  title: string;
  platform: string;
  dimensions: string;
  width: number;
  height: number;
  aspectRatio: "1:1" | "16:9" | "3:1" | "4:1" | "9:16";
  generatorRatio: "1:1" | "16:9" | "9:16";
  description: string;
  safeZoneGuide: string;
  safeZoneOverlayType?: "circle" | "youtube_banner" | "twitter_header" | "linkedin_banner";
  agentDirectives: {
    subjectPrompt: string;
    compositionPrompt: string;
    safeZoneNote: string;
  };
};

export type SavedVisualItem = {
  type: BrandVisualType;
  url: string;
  createdAt: string;
  updatedAt: string;
  promptUsed?: string;
  dimensions: string;
};

export type BrandVisualsState = {
  items: Partial<Record<BrandVisualType, SavedVisualItem>>;
  logoConcepts?: GeneratedLogoConcept[];
  activeLogoConceptId?: string;
  updatedAt: string;
};

export const LOGO_STYLE_ARCHETYPES: {
  id: LogoStyleArchetype;
  name: string;
  tagline: string;
  description: string;
  promptDirectives: string;
}[] = [
  {
    id: "geometric",
    name: "Geometrik & Minimalist",
    tagline: "Kusursuz altın oran, keskin prizmalar ve temiz hatlar",
    description: "Kare, daire ve çokgenlerin matematiksel uyumuyla oluşturulan, küçüldüğünde bile asla bozulmayan ultra-modern amblem.",
    promptDirectives: "pure minimalist geometric emblem, golden ratio precision, intersecting clean geometric planes, elegant negative space, Swiss style corporate design, balanced symmetry, crisp razor-sharp vector execution",
  },
  {
    id: "monogram",
    name: "Akıllı Monogram (Harf Füzyonu)",
    tagline: "Marka baş harflerinin iç içe geçen soyut mimarisi",
    description: "Markanın baş harflerini modern, tipografik ve mimari bir sembole dönüştüren prestijli imza tasarımı.",
    promptDirectives: "clever architectural monogram brandmark, intertwining letters woven into a singular iconic symbol, high-fashion corporate luxury emblem, clever negative space interlocking glyph",
  },
  {
    id: "tactile_3d",
    name: "3D Modern Taktil / Neumorphic",
    tagline: "Yumuşak stüdyo ışığı, gölgeli derinlik ve dokulu form",
    description: "Mat stüdyo zemin üzerinde duran, hafif kabartmalı, dokunma hissi uyandıran modern teknoloji amblemi.",
    promptDirectives: "3D tactile embossed brand insignia, matte polymer texture with soft natural studio lighting, gentle ambient occlusion shadows, modern high-tech industrial design aesthetic, clean tactile depth, zero clutter",
  },
  {
    id: "metaphor",
    name: "Simgesel & Hikaye Anlatan Metafor",
    tagline: "Markanın yaptığı işi ve ruhunu simgeleyen kavramsal birleşim",
    description: "Sektörel araçları ve kavramları (örn: dişli, robot kol, fidan, kıvılcım) tek bir anlamlı görsel metaforda birleştiren sembol.",
    promptDirectives: "conceptual storytelling brand icon, clever visual metaphor combining brand tools and industry identity into a unified sleek emblem, meaningful symbolic silhouette, refined and memorable",
  },
  {
    id: "abstract_dynamic",
    name: "Soyut & Dinamik İnovasyon",
    tagline: "Akışkan, geleceğe bakan fütüristik hatlar",
    description: "Büyümeyi, hızı ve inovasyonu temsil eden akışkan, fütüristik form dili.",
    promptDirectives: "dynamic abstract forward-leaning emblem, kinetic energy, smooth modern aerodynamic curves, visionary innovation motif, vibrant contrasting brand accents",
  },
  {
    id: "stamp_badge",
    name: "Rozet & Kurumsal Mühür",
    tagline: "Güven, onay ve köklü kurumsal miras hissi",
    description: "Dairesel dış halka, tipografik çerçeve ve merkez amblemle kurumsal otorite ve kalite sertifikası hissi veren mühür.",
    promptDirectives: "circular heritage stamp badge, prestigious corporate seal of excellence, clean concentric rings, refined circular typography border, authoritative emblem",
  },
  {
    id: "mascot",
    name: "Modern Maskot / Karakter Formu",
    tagline: "Samimi, akılda kalıcı ve dostane marka yüzü",
    description: "Markanın özellikle çocuk, aile veya genç kitleyle bağ kurmasını sağlayan sevimli, modern geometrik karakter amblemi.",
    promptDirectives: "minimalist modern friendly mascot character emblem, geometric and approachable, high charm, iconic face or friendly robot motif, clean corporate character design",
  },
];

export const LOGO_TYPOGRAPHY_STYLES: {
  id: LogoTypographyStyle;
  name: string;
  example: string;
  fontCategory: string;
  cssStyle: string;
}[] = [
  {
    id: "sans",
    name: "Geometrik Modern Sans",
    example: "Inter / Montserrat",
    fontCategory: "Temiz, net ve çağdaş kurumsal duruş",
    cssStyle: "'Inter', 'Montserrat', -apple-system, sans-serif",
  },
  {
    id: "tech",
    name: "Teknoloji & Fütüristik",
    example: "Space Grotesk / Orbitron",
    fontCategory: "Mühendislik, yapay zeka ve maker ruhu",
    cssStyle: "'Space Grotesk', 'Orbitron', monospace, sans-serif",
  },
  {
    id: "serif",
    name: "Prestijli Serif",
    example: "Playfair / Cinzel",
    fontCategory: "Köklü, zarif ve yüksek kalite hissi",
    cssStyle: "'Playfair Display', 'Cinzel', Georgia, serif",
  },
  {
    id: "display",
    name: "Kalın & Vurucu Display",
    example: "Clash Display / Bebas Neue",
    fontCategory: "Enerjik, güçlü ve uzaktan okunan başlıklar",
    cssStyle: "'Clash Display', 'Bebas Neue', Impact, sans-serif",
  },
  {
    id: "monogram_only",
    name: "Sadece Monogram Baş Harf",
    example: "Örn: AH / Logo İkonu",
    fontCategory: "Yazısız, yalnızca sembolün gücüne odaklı",
    cssStyle: "sans-serif",
  },
];

export const BRAND_VISUAL_SPECS: Record<BrandVisualType, BrandVisualSpec> = {
  logo_emblem: {
    type: "logo_emblem",
    category: "logos",
    title: "Sosyal Medya Amblemi / İkonu",
    platform: "Tüm Platformlar (Instagram, TikTok, Profil)",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Daire veya kare profillerde küçüldüğünde kaybolmayan, yüksek kontrastlı ana marka amblemi.",
    safeZoneGuide: "Merkez %64 daire güvenli bölgedir. Köşeler daire kırpmasında kesileceği için merkezlenmiştir.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "high-end minimalist iconic brand emblem, centered standalone symbol",
      compositionPrompt: "isolated on clean solid brand background, perfectly centered, wide generous 25% margin padding from edges, circular crop safe, crisp vector-like 3D tactile finish",
      safeZoneNote: "Crucial: Keep the entire emblem strictly within the central 60% circular safe zone.",
    },
  },
  logo_horizontal: {
    type: "logo_horizontal",
    category: "logos",
    title: "Yatay Header Logo",
    platform: "Web & E-Bülten Üst Bandı",
    dimensions: "1600 × 533 px",
    width: 1600,
    height: 533,
    aspectRatio: "3:1",
    generatorRatio: "16:9",
    description: "Amblem solda, temiz kurumsal marka tipografisi sağda dengeli yatay yerleşim.",
    safeZoneGuide: "Sol ve sağ kenarlardan %10 iç marjin, dikeyde ortalanmış kompozisyon.",
    agentDirectives: {
      subjectPrompt: "horizontal corporate logo lockup, clean minimalist brand emblem on the left paired with bold elegant typography of the brand name on the right",
      compositionPrompt: "horizontal banner composition, wide aspect, modern graphic design, solid clean background, generous padding around typography and emblem",
      safeZoneNote: "Horizontal alignment, text on right side, emblem on left side, balanced negative space.",
    },
  },
  logo_stacked: {
    type: "logo_stacked",
    category: "logos",
    title: "Stacked (Kare) Kurumsal Logo",
    platform: "Katalog & Basılı / Dijital Kartvizit",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Amblem üstte, marka adı hemen altta ortalanmış dengeli dikey logo.",
    safeZoneGuide: "Merkez kare blok, 150px kenar boşluğu.",
    agentDirectives: {
      subjectPrompt: "stacked vertical corporate logo composition, striking brand symbol positioned above the clean typography of the brand name",
      compositionPrompt: "symmetrical vertical alignment, centered composition, premium studio backdrop, ample breathing room",
      safeZoneNote: "Vertical stack: symbol on top, typography below, centered.",
    },
  },
  logo_badge: {
    type: "logo_badge",
    category: "logos",
    title: "Rozet / Damga Amblem (Stamp Style)",
    platform: "Sertifika, Kalite & Güven Mührü",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Dairesel mühür veya damga formunda, güven ve kurumsal onay hissi veren amblem.",
    safeZoneGuide: "Dairesel dış halka ve iç ikon dengesi.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "circular seal of authenticity, embossed brand crest stamp badge, elegant concentric rings, premium insignia",
      compositionPrompt: "centered round badge design, subtle tactile depth, crisp vector detailing, balanced circular typography and central brand motif",
      safeZoneNote: "Keep within circular boundary, perfectly symmetrical.",
    },
  },
  logo_monochrome: {
    type: "logo_monochrome",
    category: "logos",
    title: "Monokrom / Negatif Logo (Koyu Zemin)",
    platform: "Koyu Tema, Filigran & Lazer/Baskı",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Koyu renk zemin üzerinde parlak beyaz/açık silüet halinde çalışan tek renk amblem.",
    safeZoneGuide: "Tek renk silüet, yüksek kontrast.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "monochrome silhouette brand logo emblem, clean crisp white silhouette on deep luxury dark background",
      compositionPrompt: "ultra high contrast, single color vector aesthetic, minimalist, perfectly centered, zero noise",
      safeZoneNote: "Single-color white/light silhouette on dark contrasting background.",
    },
  },
  avatar_instagram: {
    type: "avatar_instagram",
    category: "avatars",
    title: "Instagram & TikTok Profil Resmi",
    platform: "Instagram / TikTok / Threads",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Instagram dairesel avatarına tam oturan, akışta ve bildirimlerde anında fark edilen canlı profil görseli.",
    safeZoneGuide: "Çapı 680px olan merkez daire tam güvenli alandır. Dış kenarlar platform tarafından kırpılır.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "punchy social media profile avatar featuring the brand identity motif",
      compositionPrompt: "tight circular focal point, vibrant contrasting brand palette, high visual clarity at 32px tiny thumbnail scale, centered composition with solid ground",
      safeZoneNote: "Mandatory: Subject must fit inside a circle that occupies the central 65% of the frame.",
    },
  },
  avatar_linkedin: {
    type: "avatar_linkedin",
    category: "avatars",
    title: "LinkedIn Şirket Avatarı",
    platform: "LinkedIn Şirket Sayfası",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "B2B profesyonel güven veren, kurumsal ciddiyet ve netlik taşıyan şirket avatarı.",
    safeZoneGuide: "Kare ve hafif yuvarlatılmış köşeler için 120px iç marjin.",
    agentDirectives: {
      subjectPrompt: "distinguished corporate B2B company avatar, clean polished brand mark",
      compositionPrompt: "trustworthy enterprise presentation, soft premium lighting, clean geometric alignment, corporate prestige",
      safeZoneNote: "Square crop safe with 15% inner padding.",
    },
  },
  avatar_youtube: {
    type: "avatar_youtube",
    category: "avatars",
    title: "YouTube Kanal Avatarı",
    platform: "YouTube Kanalı & Yorum İkonu",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Video altı yorumlarda ve abone listelerinde minik boyutta bile net okunan kanal ikonu.",
    safeZoneGuide: "Merkez daire güvenli bölge.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "high visibility YouTube channel icon, bold striking brand insignia",
      compositionPrompt: "optimized for tiny thumbnail readability, vibrant high-contrast accents, centered circular framing",
      safeZoneNote: "Must remain instantly recognizable when scaled down to 32x32 pixels.",
    },
  },
  avatar_twitter: {
    type: "avatar_twitter",
    category: "avatars",
    title: "X (Twitter) Profil Resmi",
    platform: "X / Twitter",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Zaman tünelinde ve yanıtlarda öne çıkan keskin profil ikonu.",
    safeZoneGuide: "Dairesel kırpma güvenli alanı.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "sharp modern social avatar for X/Twitter timeline, modern bold brand emblem",
      compositionPrompt: "clean edges, bold silhouette, centered in circular safe zone",
      safeZoneNote: "Circular crop safe, centered.",
    },
  },
  banner_youtube: {
    type: "banner_youtube",
    category: "banners",
    title: "YouTube Kanal Bannerı",
    platform: "YouTube Masaüstü, Mobil & TV",
    dimensions: "2560 × 1440 px",
    width: 2560,
    height: 1440,
    aspectRatio: "16:9",
    generatorRatio: "16:9",
    description: "Tüm cihazlarda uyumlu; ortadaki 1546×423 px mobil güvenli alanına tam oturan geniş banner.",
    safeZoneGuide: "DİKKAT: Metin, logo ve ana mesaj dikeyde tam ortadaki 423px yüksekliğindeki bantta yer almalıdır. Üst ve alt alanlar TV'de görünür.",
    safeZoneOverlayType: "youtube_banner",
    agentDirectives: {
      subjectPrompt: "cinematic wide YouTube channel banner artwork embodying the brand essence, futuristic workshop / educational atmosphere",
      compositionPrompt: "panoramic layout where ALL critical brand elements, logo and typography are strictly concentrated inside the horizontal middle band (1546x423 px center strip). The top and bottom areas feature ambient brand lighting, abstract textures and clean gradients",
      safeZoneNote: "Strict rule: Keep central action inside the middle horizontal strip. Top and bottom 35% must be ambient background only.",
    },
  },
  banner_twitter: {
    type: "banner_twitter",
    category: "banners",
    title: "X (Twitter) Header / Kapak",
    platform: "X (Twitter) Masaüstü & Mobil",
    dimensions: "1500 × 500 px",
    width: 1500,
    height: 500,
    aspectRatio: "3:1",
    generatorRatio: "16:9",
    description: "Sol alt köşesi profil fotoğrafı için boş bırakılmış, sağ tarafa odaklı modern kapak.",
    safeZoneGuide: "Sol alt köşeye profil fotoğrafı geleceği için ana slogan ve görseller orta ve sağ alana yerleştirilmelidir.",
    safeZoneOverlayType: "twitter_header",
    agentDirectives: {
      subjectPrompt: "sleek wide header banner for X/Twitter, dynamic brand composition",
      compositionPrompt: "asymmetrical composition: the bottom-left 25% area is left clean and open (where user profile picture overlaps). Main brand graphics, tagline and visual energy are placed in the center and right side. 3:1 panoramic aspect",
      safeZoneNote: "Bottom-left area MUST be free of text or focal graphics to prevent avatar collision.",
    },
  },
  banner_linkedin: {
    type: "banner_linkedin",
    category: "banners",
    title: "LinkedIn Şirket Kapağı",
    platform: "LinkedIn Kurumsal Sayfa",
    dimensions: "1584 × 396 px",
    width: 1584,
    height: 396,
    aspectRatio: "4:1",
    generatorRatio: "16:9",
    description: "Kurumsal vizyonu ve marka değerlerini yansıtan prestijli geniş şirket bannerı.",
    safeZoneGuide: "Sol taraftaki şirket logosu payı ve mobil sağ/sol kırpma payları gözetilmiştir.",
    safeZoneOverlayType: "linkedin_banner",
    agentDirectives: {
      subjectPrompt: "premium corporate LinkedIn company background banner, executive elegance, brand mission aesthetics",
      compositionPrompt: "ultra wide panoramic strip, minimalist and professional, subtle textures and harmonious brand palette, clear message zone in right-center",
      safeZoneNote: "Ultra-wide 4:1 format. Solitary text in safe center.",
    },
  },
  banner_facebook: {
    type: "banner_facebook",
    category: "banners",
    title: "Facebook Sayfa Kapağı",
    platform: "Facebook Sayfası",
    dimensions: "1200 × 462 px",
    width: 1200,
    height: 462,
    aspectRatio: "16:9",
    generatorRatio: "16:9",
    description: "Hem masaüstünde hem mobilde kesilmeden görünen optimize Facebook kapak görseli.",
    safeZoneGuide: "Merkez 820×312 px ana içerik alanıdır.",
    agentDirectives: {
      subjectPrompt: "engaging friendly Facebook page cover banner showcasing the brand community and mission",
      compositionPrompt: "welcoming warm atmosphere, centered headline area, balanced negative space",
      safeZoneNote: "Center focused, mobile friendly.",
    },
  },
  story_highlight_about: {
    type: "story_highlight_about",
    category: "highlights",
    title: "Öne Çıkanlar: Biz Kimiz / Hakkımızda",
    platform: "Instagram Hikaye Kapağı",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Marka kimliğini anlatan zarif bina/topluluk/hikaye ikonu.",
    safeZoneGuide: "Merkez 400px yuvarlak ikon.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "minimalist 3D icon for Instagram Story Highlight cover representing 'About Us / Brand Story', subtle heart or workshop building motif",
      compositionPrompt: "clean monochrome or duotone brand palette, isolated on brand ground color, centered within small circle",
      safeZoneNote: "Icon must be tightly centered, perfectly readable in tiny circle.",
    },
  },
  story_highlight_services: {
    type: "story_highlight_services",
    category: "highlights",
    title: "Öne Çıkanlar: Eğitimler & Hizmetler",
    platform: "Instagram Hikaye Kapağı",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Atölye, eğitim, ürün veya servisleri simgeleyen teknolojik/maker ikon.",
    safeZoneGuide: "Merkez 400px yuvarlak ikon.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "minimalist 3D icon for Instagram Story Highlight cover representing 'Programs & Workshops', robotic arm, gear or lightbulb discovery motif",
      compositionPrompt: "sleek brand colors, clean isolated background, centered round framing",
      safeZoneNote: "Centered icon, circular safe.",
    },
  },
  story_highlight_contact: {
    type: "story_highlight_contact",
    category: "highlights",
    title: "Öne Çıkanlar: İletişim & Konum",
    platform: "Instagram Hikaye Kapağı",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Mesaj, telefon veya harita pinini marka stilinde yansıtan ikon.",
    safeZoneGuide: "Merkez 400px yuvarlak ikon.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "minimalist 3D icon for Instagram Story Highlight cover representing 'Contact & Location', sleek map pin or speech bubble",
      compositionPrompt: "brand colors, clean minimal, centered round framing",
      safeZoneNote: "Centered icon, circular safe.",
    },
  },
  story_highlight_reviews: {
    type: "story_highlight_reviews",
    category: "highlights",
    title: "Öne Çıkanlar: Yorumlar & Başarılar",
    platform: "Instagram Hikaye Kapağı",
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    generatorRatio: "1:1",
    description: "Yıldız, kupa veya ödülü marka renkleriyle birleştiren ikon.",
    safeZoneGuide: "Merkez 400px yuvarlak ikon.",
    safeZoneOverlayType: "circle",
    agentDirectives: {
      subjectPrompt: "minimalist 3D icon for Instagram Story Highlight cover representing 'Reviews & Testimonials', award star or medal motif",
      compositionPrompt: "warm celebratory brand colors, clean minimal, centered round framing",
      safeZoneNote: "Centered icon, circular safe.",
    },
  },
};

export const VISUAL_CATEGORIES: { id: VisualCategory; label: string; count: number }[] = [
  { id: "logos", label: "Logo & Amblemler", count: 5 },
  { id: "avatars", label: "Profil Avatarları", count: 4 },
  { id: "banners", label: "Kapak & Bannerlar", count: 4 },
  { id: "highlights", label: "Öne Çıkanlar", count: 4 },
];
