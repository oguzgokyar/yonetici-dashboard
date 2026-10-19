export type VisualMoodOption = {
  key:
    | "cinematic_photoreal"
    | "golden_hour"
    | "moody_chiaroscuro"
    | "documentary_nature"
    | "retro_vintage_80s"
    | "minimal_commercial"
    | "stylized_3d"
    | "diy_craft_macro";
  label: string;
  desc: string;
};

export const VISUAL_MOOD_OPTIONS: VisualMoodOption[] = [
  {
    key: "cinematic_photoreal",
    label: "Sinematik & Fotogerçekçi (35mm)",
    desc: "Doğal derinlik, film greni ve gerçekçi doku",
  },
  {
    key: "golden_hour",
    label: "Sıcak Altın Saat (Golden Hour)",
    desc: "Batan güneş ışığı, sıcak amber ve bal tonları",
  },
  {
    key: "moody_chiaroscuro",
    label: "Dramatik & Kara Film (Moody)",
    desc: "Derin gölgeler, tek yönlü kontrast ve atmosferik ışık",
  },
  {
    key: "documentary_nature",
    label: "Belgesel & Doğal Çevre",
    desc: "NatGeo tarzı gerçekçi doğa, makro/telefoto detaylar",
  },
  {
    key: "retro_vintage_80s",
    label: "Retro & Vintage 80s Sinematik",
    desc: "Nostaljik film stoğu, yumuşak ışık halasyonu",
  },
  {
    key: "minimal_commercial",
    label: "Minimalist & Modern Reklam",
    desc: "Stüdyo netliği, temiz hatlar ve keskin ürün odağı",
  },
  {
    key: "stylized_3d",
    label: "Animasyon & Stilize 3D",
    desc: "Zengin hacimsel ışık ve canlı animasyon paleti",
  },
  {
    key: "diy_craft_macro",
    label: "Masaüstü DIY & Karton Zanaat (Crafty Makro)",
    desc: "Yakın plan masaüstü zanaat, karton dokusu ve mekanizma testi",
  },
];

export type CharacterAnchorSpec = {
  name: string;
  archetypeTr: string;
  masterVisualPromptEn: string;
  fixedTraitsEn: string;
  referenceImageUrl?: string;
};

export type ScriptScenePlan = {
  sceneIndex: number;
  shotType: "establishing" | "action_development" | "resolution_climax";
  durationSeconds: number;
  actionType: "new_scene" | "extend";
  cameraSetup: string;
  lightingSetup: string;
  summaryTr: string;
  promptEn: string;
  voiceoverTr?: string;
  dialogueTr?: string;
  audioCueEn?: string;
  sfxCueEn?: string;
};

export type MusicMoodSpec = {
  moodTr: string;
  instrumentationTr: string;
  musicPromptEn: string;
  tempoBpm?: number;
};

export type StoryboardResponse = {
  title: string;
  narrativeTr: string;
  narrativeMode?: "voiceover_only" | "dialogue_only" | "hybrid";
  totalDurationSeconds: number;
  visualMood: VisualMoodOption["key"];
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec;
  musicSpec?: MusicMoodSpec;
  scenes: ScriptScenePlan[];
  isSceneClip?: boolean;
};

export type RenderedVideo = {
  id: string;
  url: string;
  title?: string;
  isGoogleVids?: boolean;
  googleVidsUrl?: string;
  durationSeconds?: number;
  motionStyle?: string;
  storyboard?: StoryboardResponse;
  sourceTopic?: string;
  topic?: string;
  createdAt: string;
};

export type PoolAccount = {
  id: string;
  email: string;
  authuser_index: number;
  profile_directory?: string;
  quota_status: "available" | "exhausted" | "cooldown";
  total_videos_rendered: number;
  is_active: number;
};

export type ActiveJob = {
  id: string;
  status: string;
  prompt: string;
  error: string | null;
  createdAt: string;
  progress?: {
    phase?: string;
    percent?: number;
    detail?: string;
    googleVidsUrl?: string;
    updatedAt?: string;
  };
  request?: {
    title?: string;
    topic?: string;
    aspectRatio?: "9:16" | "16:9" | "1:1";
    durationSeconds?: number;
    visualMood?: VisualMoodOption["key"];
    narrativeTr?: string;
    characterAnchor?: CharacterAnchorSpec;
    scenes?: ScriptScenePlan[];
    origin?: string;
  };
  googleVidsUrl?: string;
};
