export type RssTargetDuration = "15s" | "30s" | "45s" | "60s";

export type RssAspectRatio = "9:16" | "16:9" | "1:1";

export type RssNarrativeStyleKey =
  | "news_bulletin"
  | "info_documentary"
  | "fairy_tale"
  | "cinematic_story"
  | "mystery_curiosity"
  | "listicle_guide";

export interface RssNarrativeStyleOption {
  key: RssNarrativeStyleKey;
  label: string;
  badge: string;
  desc: string;
  pacingRule: string;
  defaultCameraSequence: RssCameraEffect[];
  defaultTransition: RssTransitionType;
  defaultVoiceEmotion: RssVoiceEmotion;
  defaultVoiceActor: GeminiTtsVoice;
  dramaturgyDirective: string;
}

export type RssVisualMoodKey =
  | "cinematic_photoreal"
  | "golden_hour"
  | "moody_chiaroscuro"
  | "documentary_nature"
  | "stylized_3d"
  | "minimal_commercial";

export interface RssVisualMoodOption {
  key: RssVisualMoodKey;
  label: string;
  desc: string;
  promptSuffixEn: string;
}

export type RssCameraEffect =
  | "ken_burns_zoom_in"
  | "ken_burns_zoom_out"
  | "cinematic_push"
  | "zoom_in_fast"
  | "pan_right"
  | "pan_left"
  | "drift_left_right"
  | "tilt_pan"
  | "pulse"
  | "micro_zoom_jitter";

export type RssTransitionType =
  | "dissolve"
  | "fadeblack"
  | "smoothleft"
  | "wipeleft"
  | "circleopen"
  | "slideleft";

export type GeminiTtsVoice = "Kore" | "Aoede" | "Puck" | "Charon" | "Fenrir";

export type RssVoiceSpeed = 0.9 | 1.0 | 1.15;

export type RssVoiceEmotion =
  | "urgent"
  | "serious"
  | "calm"
  | "warm_storyteller"
  | "dramatic"
  | "mysterious"
  | "excited";

export type RssCaptionStyle = "tiktok_pop" | "bold_box" | "cinema_clean" | "off";

export type RssCaptionColor = "yellow" | "green" | "cyan" | "white";

export type RssMusicMood = "dynamic_news" | "acoustic_warm" | "cinematic_ambient";

export type RssMusicDucking = "-18dB" | "-12dB" | "-24dB";

export interface RssAudioSettings {
  voiceActor: GeminiTtsVoice;
  voiceSpeed: RssVoiceSpeed;
  voiceEmotion: RssVoiceEmotion | "auto";
  captionStyle: RssCaptionStyle;
  captionColor: RssCaptionColor;
  includeMusic: boolean;
  musicMood: RssMusicMood;
  musicDucking: RssMusicDucking;
}

export interface RssScenePlan {
  sceneIndex: number;
  role: "hook" | "body" | "climax" | "outro";
  durationSeconds: number;
  summaryTr: string;
  onScreenTextTr: string;
  voiceoverTr: string;
  promptEn: string;
  cameraEffect: RssCameraEffect;
  transition: RssTransitionType;
  voiceEmotion: RssVoiceEmotion;
  previewImageUrl?: string;
}

export interface RssStoryboard {
  title: string;
  summaryTr: string;
  sourceMode: "rss" | "url" | "prompt";
  sourceUrl?: string;
  narrativeStyle: RssNarrativeStyleKey;
  visualMood: RssVisualMoodKey;
  aspectRatio: RssAspectRatio;
  totalDurationSeconds: number;
  scenes: RssScenePlan[];
}

export interface RssSourceItem {
  id: string;
  projectId: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  lastCheckedAt?: string | null;
  createdAt: string;
}

export interface RssFeedArticle {
  id: string;
  title: string;
  url: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
  score: number;
}

export interface RssActiveJob {
  id: string;
  status: string;
  prompt: string;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
  progress?: {
    phase?: string;
    percent?: number;
    detail?: string;
    currentScene?: number;
    totalScenes?: number;
  };
  request?: {
    title?: string;
    topic?: string;
    narrativeStyle?: RssNarrativeStyleKey;
    visualMood?: RssVisualMoodKey;
    aspectRatio?: RssAspectRatio;
    durationSeconds?: number;
    storyboard?: RssStoryboard;
  };
}

export interface RssRenderedVideo {
  id: string;
  url: string;
  title?: string;
  durationSeconds?: number;
  narrativeStyle?: RssNarrativeStyleKey;
  visualMood?: string;
  sourceTopic?: string;
  storyboard?: RssStoryboard;
  createdAt: string;
}

export const RSS_NARRATIVE_STYLES: RssNarrativeStyleOption[] = [
  {
    key: "news_bulletin",
    label: "Sıcak Haber & Gündem",
    badge: "📰 Haber",
    desc: "Çarpıcı flaş kanca → Ne oldu? → Neden önemli? → Sonuç. Dinamik ve net.",
    pacingRule: "Hızlı kesmeler (4-5 sn/sahne), doğrudan rakam ve olgu odaklı.",
    defaultCameraSequence: ["zoom_in_fast", "pan_right", "ken_burns_zoom_in", "pulse"],
    defaultTransition: "wipeleft",
    defaultVoiceEmotion: "urgent",
    defaultVoiceActor: "Fenrir",
    dramaturgyDirective:
      "Breaking news broadcast dramaturgy: Scene 1 MUST be a 3-4s high-impact factual hook stating the core event immediately. Middle scenes answer What happened, What is the concrete impact, and Who is affected using tangible facts/numbers. Final scene states the forward-looking consequence and sharp CTA.",
  },
  {
    key: "info_documentary",
    label: "Hap Bilgi & Belgesel",
    badge: "🧠 Bilgi",
    desc: "Şaşırtıcı soru/paradoks → Kanıt & mekanizma (Genel → Makro) → Çıkarım.",
    pacingRule: "Dengeli ve merak uyandıran ritim (5-6 sn/sahne).",
    defaultCameraSequence: ["cinematic_push", "ken_burns_zoom_out", "pan_left", "ken_burns_zoom_in"],
    defaultTransition: "dissolve",
    defaultVoiceEmotion: "calm",
    defaultVoiceActor: "Charon",
    dramaturgyDirective:
      "Documentary Discovery pattern (POV/Wide -> Detail -> Macro mechanism -> Reveal): Scene 1 opens with a counter-intuitive fact or paradox. Middle scenes dissect how the mechanism works step by step with concrete visual scale progression. Final scene delivers an unforgettable 'aha' takeaway.",
  },
  {
    key: "fairy_tale",
    label: "Masal & Büyüleyici Anlatı",
    badge: "🧚 Masal",
    desc: "Atmosferik açılış ('Bir zamanlar...') → Kahraman & sınav → Dönüşüm → Kıssadan hisse.",
    pacingRule: "Dingin, sıcak ve akıcı sahneler (6-8 sn/sahne).",
    defaultCameraSequence: ["drift_left_right", "ken_burns_zoom_in", "tilt_pan", "ken_burns_zoom_out"],
    defaultTransition: "circleopen",
    defaultVoiceEmotion: "warm_storyteller",
    defaultVoiceActor: "Aoede",
    dramaturgyDirective:
      "Timeless fable & fairy-tale narrative arc: Scene 1 establishes an enchanting setting and a relatable protagonist's gentle wish. Middle scenes introduce a symbolic test or obstacle and a moment of kindness/wisdom. Final scene resolves with warm transformation and a heartfelt moral lesson.",
  },
  {
    key: "cinematic_story",
    label: "Sinematik Hikâye & Öykü",
    badge: "🎬 Hikâye",
    desc: "Escalation kalıbı: Ortam & arzu → Engel → Kırılma anı → Duygusal final karesi.",
    pacingRule: "Gerilim ve duygu tırmanışlı sinematik akış (5-7 sn/sahne).",
    defaultCameraSequence: ["ken_burns_zoom_out", "tilt_pan", "cinematic_push", "ken_burns_zoom_in"],
    defaultTransition: "fadeblack",
    defaultVoiceEmotion: "dramatic",
    defaultVoiceActor: "Charon",
    dramaturgyDirective:
      "Cinematic Escalation pattern (Wide -> Medium -> Close-up -> Macro -> Emotional Climax): Every scene applies the Scene Formula (desire + obstacle + space geometry). Build emotional tension through physical micro-actions and environmental pressure before landing on a resonant final image.",
  },
  {
    key: "mystery_curiosity",
    label: "Merak & Gizem / Dosya",
    badge: "🕵️ Gizem",
    desc: "Çözülmemiş sır kancası → İpuçları zinciri → Beklenmedik gerçek.",
    pacingRule: "Merak tırmandıran dar açılı planlar (4-6 sn/sahne).",
    defaultCameraSequence: ["cinematic_push", "micro_zoom_jitter", "pan_right", "zoom_in_fast"],
    defaultTransition: "smoothleft",
    defaultVoiceEmotion: "mysterious",
    defaultVoiceActor: "Kore",
    dramaturgyDirective:
      "Investigative mystery file arc: Open with an unexplained anomaly or overlooked detail ('Kimse bu detayı fark etmedi...'). Reveal clues one by one using foreground obstruction and tight macro inserts, culminating in the surprising truth.",
  },
  {
    key: "listicle_guide",
    label: "Pratik Rehber & Liste",
    badge: "⚡ Rehber",
    desc: "Net problem kancası → Madde 1, 2, 3 (somut adımlar) → Harekete geçirici özet.",
    pacingRule: "Yüksek tempolu, net maddeli kurgu (4-5 sn/sahne).",
    defaultCameraSequence: ["zoom_in_fast", "pan_left", "pan_right", "pulse"],
    defaultTransition: "slideleft",
    defaultVoiceEmotion: "excited",
    defaultVoiceActor: "Puck",
    dramaturgyDirective:
      "High-retention actionable guide/listicle: Scene 1 names the exact pain point and promises a numbered solution. Each middle scene delivers one numbered, immediately applicable rule with a clear visual metaphor. Final scene summarizes and triggers saves/shares.",
  },
];

export const RSS_VISUAL_MOODS: RssVisualMoodOption[] = [
  {
    key: "cinematic_photoreal",
    label: "Sinematik & Fotogerçekçi (35mm)",
    desc: "Doğal alan derinliği, 35mm lens dokusu ve gerçekçi ışık",
    promptSuffixEn:
      "Shot on 35mm anamorphic cinema lens, natural motivated key light, organic depth of field with distinct foreground/midground/background separation, subtle film grain, full-bleed borderless frame, strictly zero text or watermarks.",
  },
  {
    key: "golden_hour",
    label: "Sıcak Altın Saat (Golden Hour)",
    desc: "Batan güneş ışığı, sıcak kehribar ve yumuşak kontur ışığı",
    promptSuffixEn:
      "Low-angle golden hour sunset backlighting, warm amber rim light, 50mm f/1.8 lens with creamy bokeh, rich bronze shadows, full-bleed borderless frame, strictly zero text or watermarks.",
  },
  {
    key: "moody_chiaroscuro",
    label: "Dramatik & Kara Film (Moody)",
    desc: "Derin gölgeler, yüksek kontrast ve atmosferik ışık hüzmeleri",
    promptSuffixEn:
      "Chiaroscuro dramatic side lighting, deep inky shadows, volumetric light shafts, 40mm cinema prime lens, high contrast moody color grade, full-bleed borderless frame, strictly zero text or watermarks.",
  },
  {
    key: "documentary_nature",
    label: "Belgesel & Doğal Çevre",
    desc: "NatGeo/BBC kalitesinde gerçekçi detaylar ve net doku",
    promptSuffixEn:
      "National Geographic editorial documentary photography, 85mm crisp lens, authentic environmental lighting, razor-sharp micro-textures, true-to-life colors, full-bleed borderless frame, strictly zero text or watermarks.",
  },
  {
    key: "stylized_3d",
    label: "Masalsı 3D & Stilize İllüstrasyon",
    desc: "Pixar/DreamWorks tarzı hacimsel ışık ve büyüleyici atmosfer",
    promptSuffixEn:
      "High-end stylized 3D feature animation still, expressive volumetric three-point lighting, rich tactile materials, enchanting color harmony, full-bleed borderless frame, strictly zero text or watermarks.",
  },
  {
    key: "minimal_commercial",
    label: "Minimalist & Modern Stüdyo",
    desc: "Temiz kompozisyon, keskin obje odağı ve modern estetik",
    promptSuffixEn:
      "High-end commercial studio photography, clean diffused softbox lighting, crisp focal separation, modern minimalist aesthetic, full-bleed borderless frame, strictly zero text or watermarks.",
  },
];

export const RSS_CAMERA_EFFECT_LABELS: Record<RssCameraEffect, string> = {
  ken_burns_zoom_in: "Yavaş Yakınlaşma (Ken Burns In)",
  ken_burns_zoom_out: "Genişleyen Kadraj (Ken Burns Out)",
  cinematic_push: "Sinematik İleri İtiş (Push-In)",
  zoom_in_fast: "Dinamik Hızlı Zoom (Kanca)",
  pan_right: "Sağa Akıcı Kaydırma (Pan Right)",
  pan_left: "Sola Akıcı Kaydırma (Pan Left)",
  drift_left_right: "Yumuşak Salınım (Drift)",
  tilt_pan: "Dikey + Yatay Perspektif (Tilt & Pan)",
  pulse: "Ritmik Vurgu (Pulse)",
  micro_zoom_jitter: "Gerilim Mikro Titreşim (Jitter)",
};

export const RSS_TRANSITION_LABELS: Record<RssTransitionType, string> = {
  dissolve: "Yumuşak Geçiş (Dissolve)",
  fadeblack: "Siyaha Kararma (Fade Black)",
  smoothleft: "Akıcı Sola Kayma (Smooth Left)",
  wipeleft: "Keskin Haber Geçişi (Wipe Left)",
  circleopen: "Masalsı İris Açılışı (Circle Open)",
  slideleft: "Dinamik Slayt (Slide Left)",
};

export const GEMINI_TTS_VOICE_OPTIONS: Array<{
  id: GeminiTtsVoice;
  label: string;
  gender: "Kadın" | "Erkek";
  tone: string;
}> = [
  { id: "Kore", label: "Kore (Kadın • Net & Profesyonel)", gender: "Kadın", tone: "Haber, Bilgi & Gizem" },
  { id: "Aoede", label: "Aoede (Kadın • Sıcak & Masalsı)", gender: "Kadın", tone: "Masal, Hikâye & Anlatı" },
  { id: "Charon", label: "Charon (Erkek • Derin & Belgesel)", gender: "Erkek", tone: "Belgesel & Sinematik" },
  { id: "Fenrir", label: "Fenrir (Erkek • Otoriter & Güçlü)", gender: "Erkek", tone: "Sıcak Haber & Gündem" },
  { id: "Puck", label: "Puck (Erkek • Enerjik & Dinamik)", gender: "Erkek", tone: "Pratik Rehber & Liste" },
];
