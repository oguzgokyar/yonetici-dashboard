export type TargetDurationOption = "3s" | "10s" | "15s" | "30s" | "60s";

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
  recommendedPacing?: string;
};

export const VISUAL_MOOD_OPTIONS: VisualMoodOption[] = [
  {
    key: "cinematic_photoreal",
    label: "Sinematik & Fotogerçekçi (35mm)",
    desc: "Doğal derinlik, film greni ve gerçekçi doku",
    recommendedPacing: "Akıcı & Derinlikli (7-10s)",
  },
  {
    key: "golden_hour",
    label: "Sıcak Altın Saat (Golden Hour)",
    desc: "Batan güneş ışığı, sıcak amber ve bal tonları",
    recommendedPacing: "Geniş & Süzülen (7-10s)",
  },
  {
    key: "moody_chiaroscuro",
    label: "Dramatik & Kara Film (Moody)",
    desc: "Derin gölgeler, tek yönlü kontrast ve atmosferik ışık",
    recommendedPacing: "Odaklı & Ağır Planlar (8-10s)",
  },
  {
    key: "documentary_nature",
    label: "Belgesel & Doğal Çevre",
    desc: "NatGeo tarzı gerçekçi doğa, makro/telefoto detaylar",
    recommendedPacing: "Doğal Gözlem (6-9s)",
  },
  {
    key: "retro_vintage_80s",
    label: "Retro & Vintage 80s Sinematik",
    desc: "Nostaljik film stoğu, yumuşak ışık halasyonu",
    recommendedPacing: "Nostaljik Ritim (5-8s)",
  },
  {
    key: "minimal_commercial",
    label: "Minimalist & Modern Reklam",
    desc: "Stüdyo netliği, temiz hatlar ve keskin ürün odağı",
    recommendedPacing: "Dinamik Ticari Ritim (4-6s)",
  },
  {
    key: "stylized_3d",
    label: "Animasyon & Stilize 3D",
    desc: "Zengin hacimsel ışık ve canlı animasyon paleti",
    recommendedPacing: "Eğlenceli & Akıcı (5-7s)",
  },
  {
    key: "diy_craft_macro",
    label: "Masaüstü DIY & Karton Zanaat (Crafty Makro)",
    desc: "2 olay & 3 dinamik çekim açısı (jump-cut), yakın plan masaüstü zanaat ve akıcı montaj",
    recommendedPacing: "Hızlı Eylem & Montaj Adımları (3-5s)",
  },
];

export type CharacterAnchorSpec = {
  name: string;
  archetypeTr: string;
  masterVisualPromptEn: string;
  fixedTraitsEn: string;
  referenceImageUrl?: string;
};

export type AnchorItemSpec = {
  name: string;
  descriptionTr: string;
  visualPromptEn: string;
  imageUrl?: string;
};

export type VisualAnchorsSpec = {
  person?: AnchorItemSpec;
  location?: AnchorItemSpec;
  object?: AnchorItemSpec;
};

export function ensureVisualAnchors(
  sb: StoryboardResponse,
  fallbackTopic?: string
): StoryboardResponse {
  const title = sb.title || fallbackTopic || "Maker Projesi";
  const firstSceneSummary = sb.scenes?.[0]?.summaryTr || "";

  const anchors: VisualAnchorsSpec = { ...(sb.visualAnchors || {}) };

  // 1. Person
  if (!anchors.person || !anchors.person.visualPromptEn) {
    if (sb.characterAnchor) {
      anchors.person = {
        name: sb.characterAnchor.name || "Karakter",
        descriptionTr: sb.characterAnchor.archetypeTr || "Hikaye karakteri",
        visualPromptEn:
          sb.characterAnchor.masterVisualPromptEn ||
          sb.characterAnchor.fixedTraitsEn ||
          `Character reference sheet of ${sb.characterAnchor.name || "protagonist"} for ${title}. ${firstSceneSummary}. Left side front-face portrait close-up; right side three equal-height full-body views (front, 90-degree profile, back) in neutral A-pose. Isolated on pure white background, soft uniform studio light.`,
        imageUrl: sb.characterAnchor.referenceImageUrl || anchors.person?.imageUrl,
      };
    } else {
      anchors.person = {
        name: anchors.person?.name || "Karakter",
        descriptionTr: anchors.person?.descriptionTr || "Hikaye karakteri",
        visualPromptEn:
          anchors.person?.visualPromptEn ||
          `Character reference sheet of protagonist for ${title}. ${firstSceneSummary}. Left side front-face portrait close-up; right side three equal-height full-body views (front, 90-degree profile, back) in neutral A-pose. Isolated on pure white background, soft uniform studio light.`,
        imageUrl: anchors.person?.imageUrl,
      };
    }
  }

  // 2. Location
  if (!anchors.location || !anchors.location.visualPromptEn) {
    anchors.location = {
      name: anchors.location?.name || "Ana Çevre / Mekan",
      descriptionTr: anchors.location?.descriptionTr || "Hikayenin geçtiği 3 katmanlı mekan atmosferi (insansız)",
      visualPromptEn:
        anchors.location?.visualPromptEn ||
        `Fixed-camera wide-angle establishing shot of the primary setting for ${title}. ${firstSceneSummary}. Three-layer spatial composition with foreground framing, functional midground space, and background depth. Strictly empty scene, zero people.`,
      imageUrl: anchors.location?.imageUrl,
    };
  }

  // 3. Object
  if (!anchors.object || !anchors.object.visualPromptEn) {
    anchors.object = {
      name: anchors.object?.name || "Merkezi Öğe / Donatı",
      descriptionTr: anchors.object?.descriptionTr || "Hikayede öne çıkan araç, ürün veya obje",
      visualPromptEn:
        anchors.object?.visualPromptEn ||
        `Single-item commercial product photography shot of the key item in ${title}. ${firstSceneSummary}. Standard 3/4 perspective, centered and fully in frame with generous margins, isolated on pure white background, zero hands, soft studio light, high detail.`,
      imageUrl: anchors.object?.imageUrl,
    };
  }

  // Backfill any missing anchor images from referenceChips across scenes
  if (sb.scenes && Array.isArray(sb.scenes)) {
    for (const sc of sb.scenes) {
      const chips = (sc as { referenceChips?: Array<{ kind?: string; url?: string; name?: string }> }).referenceChips || [];
      for (const chip of chips) {
        if (!chip.url) continue;
        if (chip.kind === "person" && !anchors.person?.imageUrl) {
          anchors.person = { ...(anchors.person || {}), name: anchors.person?.name || chip.name || "Kişi", imageUrl: chip.url };
        } else if (chip.kind === "location" && !anchors.location?.imageUrl) {
          anchors.location = { ...(anchors.location || {}), name: anchors.location?.name || chip.name || "Mekan", imageUrl: chip.url };
        } else if (chip.kind === "object" && !anchors.object?.imageUrl) {
          anchors.object = { ...(anchors.object || {}), name: anchors.object?.name || chip.name || "Maket/Obje", imageUrl: chip.url };
        }
      }
    }
  }

  return {
    ...sb,
    visualAnchors: anchors,
  };
}

export type NarrativeModeOption =
  | "voiceover_only"
  | "dialogue_only"
  | "hybrid"
  | "diy_asmr"
  | "silent_captions";

export type ReferenceChipItem = {
  tag: string; // e.g. "@kalpli_bardak"
  slug: string; // e.g. "kalpli_bardak"
  filename: string; // e.g. "kalpli_bardak.png"
  name: string; // e.g. "Kalpli Bardak"
  kind: "person" | "location" | "object";
  url?: string;
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
  onScreenTextTr?: string;
  audioCueEn?: string;
  sfxCueEn?: string;
  referenceChips?: ReferenceChipItem[];
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
  narrativeMode?: NarrativeModeOption;
  totalDurationSeconds: number;
  visualMood: VisualMoodOption["key"];
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec;
  visualAnchors?: VisualAnchorsSpec;
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
    visualAnchors?: VisualAnchorsSpec;
    scenes?: ScriptScenePlan[];
    origin?: string;
    engine?: "vids" | "flow";
  };
  googleVidsUrl?: string;
};

export type CaptionStyleOption = "tiktok" | "classic" | "off";
export type CaptionColorOption = "yellow" | "green" | "cyan";
export type VoiceActorOption = "gemini_actor" | "edge_ahmet" | "edge_emel";
export type VoiceSpeedOption = 0.9 | 1.0 | 1.15;
export type VoiceEmotionOption = "auto" | "energetic" | "calm" | "dramatic";
export type MusicDuckingOption = "-18dB" | "-12dB" | "-24dB";
export type MusicMoodOption = "dynamic_maker" | "acoustic_warm" | "cinematic_ambient";

export type AudioProductionSettings = {
  captionStyle: CaptionStyleOption;
  captionColor: CaptionColorOption;
  voiceActor: VoiceActorOption;
  voiceSpeed: VoiceSpeedOption;
  voiceEmotion: VoiceEmotionOption;
  musicDucking: MusicDuckingOption;
  musicMood: MusicMoodOption;
};
