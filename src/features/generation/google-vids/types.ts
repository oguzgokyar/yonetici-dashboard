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
        name: sb.characterAnchor.name || "Genç Maker Can",
        descriptionTr: sb.characterAnchor.archetypeTr || "7-14 yaş aralığında meraklı, üretken genç maker çocuk",
        visualPromptEn:
          sb.characterAnchor.masterVisualPromptEn ||
          sb.characterAnchor.fixedTraitsEn ||
          `Professional 3-view character turnaround model sheet of bright school-age junior maker apprentice Can working on ${title}. ${firstSceneSummary}. Youthful student maker kid with curious expressive eyes, colorful casual workshop hoodie with rolled-up sleeves, nimble young hands eager to craft, warm natural light.`,
        imageUrl: sb.characterAnchor.referenceImageUrl || anchors.person?.imageUrl,
      };
    } else {
      anchors.person = {
        name: anchors.person?.name || "Genç Maker Can",
        descriptionTr: anchors.person?.descriptionTr || "7-14 yaş aralığında meraklı, üretken genç maker çocuk",
        visualPromptEn:
          anchors.person?.visualPromptEn ||
          `Professional 3-view character turnaround model sheet of bright school-age junior maker apprentice Can working on ${title}. ${firstSceneSummary}. Youthful student maker kid with curious expressive eyes, colorful casual workshop hoodie with rolled-up sleeves, nimble young hands eager to craft, warm natural light.`,
        imageUrl: anchors.person?.imageUrl,
      };
    }
  }

  // 2. Location
  if (!anchors.location || !anchors.location.visualPromptEn) {
    anchors.location = {
      name: anchors.location?.name || "Mekan / Atölye",
      descriptionTr: anchors.location?.descriptionTr || "Ahşap atölye masası, yeşil kesim matı ve sıcak stüdyo ışığı",
      visualPromptEn:
        anchors.location?.visualPromptEn ||
        `Authentic cozy maker workshop workbench for ${title}, dark green metric grid cutting mat, neatly arranged brass tools, clean craft setting, warm natural sunlight.`,
      imageUrl: anchors.location?.imageUrl,
    };
  }

  // 3. Object
  if (!anchors.object || !anchors.object.visualPromptEn) {
    anchors.object = {
      name: anchors.object?.name || "Maket / Proje Düzeneği",
      descriptionTr: anchors.object?.descriptionTr || "Montajı tamamlanmış çalışan mekanizma",
      visualPromptEn:
        anchors.object?.visualPromptEn ||
        `Crisp macro photograph of the assembled ${title} working prototype mechanism. ${firstSceneSummary}. Perfectly fitted components, tightly connected tubing, authentic DIY cardboard and acrylic craft aesthetic, sharp focus.`,
      imageUrl: anchors.object?.imageUrl,
    };
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
  };
  googleVidsUrl?: string;
};
