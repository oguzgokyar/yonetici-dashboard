import "server-only";

import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";

export type CinematicVisualMood =
  | "cinematic_photoreal"
  | "golden_hour"
  | "moody_chiaroscuro"
  | "documentary_nature"
  | "retro_vintage_80s"
  | "minimal_commercial"
  | "stylized_3d"
  | "diy_craft_macro";

export interface CinematicVisualMoodMeta {
  key: CinematicVisualMood;
  label: string;
  description: string;
  lightingInstruction: string;
  lensInstruction: string;
  colorGrading: string;
}

export const CINEMATIC_VISUAL_MOODS: Record<CinematicVisualMood, CinematicVisualMoodMeta> = {
  cinematic_photoreal: {
    key: "cinematic_photoreal",
    label: "Sinematik & Fotogerçekçi (35mm)",
    description: "Doğal derinlik, film greni, dengeli kontrast ve gerçekçi doku.",
    lightingInstruction: "Natural diffused daylight or motivated practical key light, soft natural fill, realistic catchlights.",
    lensInstruction: "Shot on 35mm anamorphic or 50mm spherical lens, organic depth of field, subtle film grain.",
    colorGrading: "Subtle clean cinema color grade, rich deep blacks, natural authentic skin tones, balanced saturation. Full-bleed borderless edge-to-edge frame, strictly zero film border, zero frame rebate, zero printed brand text.",
  },
  golden_hour: {
    key: "golden_hour",
    label: "Sıcak Altın Saat (Golden Hour)",
    description: "Batan güneşin sıcak ışığı, yumuşak gölgeler, amber ve bal tonları.",
    lightingInstruction: "Low-angle warm sunset backlighting, golden rim light separating subjects, volumetric sunbeams, warm lens flare.",
    lensInstruction: "Shot on 50mm or 85mm portrait prime lens at f/2.0, gentle bokeh circles, atmospheric haze.",
    colorGrading: "Warm golden and amber palette, soft warm highlights, rich bronze shadows, honey undertones.",
  },
  moody_chiaroscuro: {
    key: "moody_chiaroscuro",
    label: "Dramatik & Kara Film (Moody)",
    description: "Yüksek kontrast, derin gölgeler, tek yönlü sert veya neon ışık.",
    lightingInstruction: "Chiaroscuro lighting, single hard side light, deep inky shadows, subtle volumetric dust in shafts of light.",
    lensInstruction: "Shot on 40mm Cooke anamorphic lens, sharp falloff, high acutance, controlled low-key framing.",
    colorGrading: "High contrast monochrome or desaturated cool tones with single neon accent, crushed blacks, moody atmosphere.",
  },
  documentary_nature: {
    key: "documentary_nature",
    label: "Belgesel & Doğal Çevre",
    description: "BBC/NatGeo tarzı gerçekçi çevre, tele/makro detaylar, ham doğa dokusu.",
    lightingInstruction: "True authentic ambient environmental light, raw weather physics, subtle ground bounce.",
    lensInstruction: "Shot on 70-200mm telephoto or 100mm macro lens, high shutter speed capturing micro-movements, crisp textures.",
    colorGrading: "National Geographic documentary grade, true-to-life greens and earth tones, zero artificial stylization.",
  },
  retro_vintage_80s: {
    key: "retro_vintage_80s",
    label: "Retro & Vintage 80s Sinematik",
    description: "Nostaljik VHS/Super-8 sıcaklığı, hafif halasyon ve yumuşak ışık kırılmaları.",
    lightingInstruction: "Motivated tungsten light, warm soft lanterns, gentle bloom around bright light sources.",
    lensInstruction: "Vintage Panavision C-series lens with subtle chromatic aberration, horizontal anamorphic flares, soft edges.",
    colorGrading: "Faded vintage film stock, slightly crushed warm cyan-orange tint, nostalgic pastel warmth.",
  },
  minimal_commercial: {
    key: "minimal_commercial",
    label: "Minimalist & Modern Reklam",
    description: "Stüdyo netliği, yüksek çözünürlüklü ürün/nesne odağı, temiz hatlar.",
    lightingInstruction: "High-end studio softbox lighting, clean white-card bounce fill, precise specular highlights.",
    lensInstruction: "Shot on 85mm or 50mm clean modern cinema lens, edge-to-edge sharpness, minimal distortion.",
    colorGrading: "Commercial clean look, crisp punchy whites, vivid pure primary accents, neutral calibrated greys.",
  },
  stylized_3d: {
    key: "stylized_3d",
    label: "Animasyon & Stilize 3D",
    description: "Pixar/Unreal Engine benzeri zengin hacimsel ışık ve canlı renk paleti.",
    lightingInstruction: "Stylized three-point lighting, expressive rim light glow, vibrant soft bounce radiance.",
    lensInstruction: "Digital cinema camera with smooth virtual dolly tracking, clean depth separation.",
    colorGrading: "Lush vibrant color saturation, expressive lighting gradients, fairytale clarity.",
  },
  diy_craft_macro: {
    key: "diy_craft_macro",
    label: "Masaüstü DIY & Karton Zanaat (Crafty Makro)",
    description: "Yakın plan masaüstü zanaat, 2 olay & 3 dinamik çekim açısı (jump-cut), net karton dokusu ve akıcı montaj.",
    lightingInstruction: "Focused warm tungsten task lamp, soft overhead daylight fill, crisp micro-shadows defining cardboard flutes and tactile edges.",
    lensInstruction: "3-shot dynamic jump cuts: 45° overhead desk angle -> macro tight focus -> low-angle motion profile, shallow depth of field, rapid fluid cuts.",
    colorGrading: "Warm inviting workshop grade, rich organic cardboard kraft browns, vibrant colorful accent pieces (caps, rubber bands, balloon), clean high micro-contrast.",
  },
};

export type TargetDurationRange = "3s" | "10s" | "15s" | "30s" | "60s";

export interface ReferenceChipItem {
  tag: string; // e.g. "@kalpli_bardak"
  slug: string; // e.g. "kalpli_bardak"
  filename: string; // e.g. "kalpli_bardak.png"
  name: string; // e.g. "Kalpli Bardak"
  kind: "person" | "location" | "object";
  url?: string;
}

export function toChipSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/â/g, "a")
      .replace(/î/g, "i")
      .replace(/û/g, "u")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "ref_asset"
  );
}

export interface CharacterAnchorSpec {
  name: string; // Karakter adı (örn: "Nasreddin Hoca")
  archetypeTr: string; // Türkçe arketip tanımı
  masterVisualPromptEn: string; // Referans görsel üretiminde ve sahnelerde kilitlenecek İngilizce master prompt
  fixedTraitsEn: string; // Her sahnede tekrar eden sabit fiziksel özellikler (kıyafet, sakal, sarık, renkler)
  referenceImageUrl?: string; // Üretilen veya yüklenen master referans portre görseli URL'si
}

export interface ScriptScenePlan {
  sceneIndex: number;
  shotType: "establishing" | "action_development" | "resolution_climax";
  durationSeconds: number; // 3 - 10 saniye arası
  actionType: "new_scene" | "extend"; // Google Vids'te yeni sahne mi yoksa uzatma (Extend) mi?
  cameraSetup: string; // örn: "35mm anamorphic, slow push-in"
  lightingSetup: string; // örn: "Low-angle golden hour rim light"
  summaryTr: string; // Kullanıcının arayüzde Türkçe göreceği özet
  promptEn: string; // Google Vids Omni'ye gönderilecek katı İngilizce prompt (Veo/Vids resmi Audio/Says/SFX sentaksı)
  voiceoverTr?: string; // Google Vids yerleşik Voiceover paneline girilecek Türkçe dış ses anlatımı
  dialogueTr?: string; // Sahne içinde karakterlerin konuşmaları / replikleri (Türkçe)
  onScreenTextTr?: string; // Ekranda görünecek büyük kanca, adım veya altyazı metni
  audioCueEn?: string; // Veo/Vids Audio katmanı (örn: "Audio: rustling leaves, distant creek stream")
  sfxCueEn?: string; // Veo/Vids SFX katmanı (örn: "SFX: (water splash at 2s)")
  referenceChips?: ReferenceChipItem[]; // Google Vids ve Veo için iliştirilen referans çipleri (@tag listesi)
}

export type NarrativeMode =
  | "voiceover_only"
  | "dialogue_only"
  | "hybrid"
  | "diy_asmr"
  | "silent_captions";

export interface MusicMoodSpec {
  moodTr: string; // örn: "Nüktedan ve Neşeli Halk Müziği"
  instrumentationTr: string; // örn: "Akustik kanun, ney ve hafif ritmik perküsyon"
  musicPromptEn: string; // Google Vids Audio için: "Playful Anatolian folklore acoustic track, light rhythmic qanun and wooden flute, gentle comedic cadence, no vocals"
  tempoBpm?: number;
}

export interface AnchorItemSpec {
  name: string;
  descriptionTr: string;
  visualPromptEn: string;
  imageUrl?: string;
}

export interface VisualAnchorsSpec {
  person?: AnchorItemSpec;
  location?: AnchorItemSpec;
  object?: AnchorItemSpec;
}

export function resolveVisualAnchorChips(
  visualAnchors?: VisualAnchorsSpec,
  characterAnchor?: CharacterAnchorSpec
): ReferenceChipItem[] {
  const result: ReferenceChipItem[] = [];

  const addChip = (name: string, kind: "person" | "location" | "object", url?: string) => {
    if (!name || result.length >= 3) return;
    const slug = toChipSlug(name);
    const tag = `@${slug}`;
    if (!result.some((r) => r.tag === tag || r.slug === slug)) {
      result.push({
        tag,
        slug,
        filename: `${slug}.png`,
        name,
        kind,
        url,
      });
    }
  };

  const person =
    visualAnchors?.person ||
    (characterAnchor
      ? {
          name: characterAnchor.name,
          descriptionTr: characterAnchor.archetypeTr,
          visualPromptEn:
            characterAnchor.masterVisualPromptEn || characterAnchor.fixedTraitsEn,
          imageUrl: characterAnchor.referenceImageUrl,
        }
      : undefined);
  if (person?.name) {
    addChip(person.name, "person", person.imageUrl);
  }

  const obj = visualAnchors?.object;
  if (obj?.name) {
    addChip(obj.name, "object", obj.imageUrl);
  }

  const loc = visualAnchors?.location;
  if (loc?.name) {
    addChip(loc.name, "location", loc.imageUrl);
  }

  return result.slice(0, 3);
}

export function bindReferenceChipsToPrompt(
  promptEn: string,
  chips: ReferenceChipItem[]
): string {
  if (!chips.length) return promptEn;
  let res = promptEn;

  for (const chip of chips) {
    const { tag, name, slug, kind } = chip;
    if (res.includes(tag)) continue;

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`(?<!@)\\b${escapedName}\\b`, "gi");
    if (nameRegex.test(res)) {
      res = res.replace(nameRegex, tag);
      continue;
    }

    const slugPattern = slug.replace(/_/g, "[\\s_]");
    const slugRegex = new RegExp(`(?<!@)\\b${slugPattern}\\b`, "gi");
    if (slugRegex.test(res)) {
      res = res.replace(slugRegex, tag);
      continue;
    }

    if (kind === "person") {
      // Use clean descriptive phrase without '@' to prevent Veo from rendering watermarks
      const cleanDesc = name || "character";
      if (!res.toLowerCase().includes(cleanDesc.toLowerCase())) {
        res = res.trim() + ` Featuring ${cleanDesc}.`;
      }
    } else if (kind === "object") {
      const cleanObj = name || "featured object";
      if (!res.toLowerCase().includes(cleanObj.toLowerCase())) {
        res = res.trim() + ` Central focus on ${cleanObj}.`;
      }
    } else if (kind === "location") {
      const cleanLoc = name || "environment";
      if (!res.toLowerCase().includes(cleanLoc.toLowerCase())) {
        res = `Set at ${cleanLoc}, ` + res.trim();
      }
    }
  }

  // Strip any accidental @ symbols from final prompt to guarantee clean frame
  res = res.replace(/@([a-z0-9_]+)/gi, "$1");
  if (!res.toLowerCase().includes("zero watermarks") && !res.toLowerCase().includes("no text overlays")) {
    res += " Clean photographic frame, strictly no text overlays, zero watermarks, zero handles, zero subtitles.";
  }

  return res;
}

export interface StoryboardResponse {
  title: string;
  narrativeTr: string;
  narrativeMode?: NarrativeMode;
  totalDurationSeconds: number;
  visualMood: CinematicVisualMood;
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec; // Hikayede sabit kalması gereken ana karakter/obje
  visualAnchors?: VisualAnchorsSpec; // 3'lü referans çıpası: Kişi, Mekan, Obje/Maket
  musicSpec?: MusicMoodSpec; // Hikayenin duygusuna göre üretilen müzik spesifikasyonu
  scenes: ScriptScenePlan[];
}

/**
 * Builds director-level storyboard according to visual-skills dramaturgy rules.
 * Automatically distributes scene count and individual durations based on the target duration.
 */
export async function planCinematicStoryboard(input: {
  topic: string;
  visualMood?: CinematicVisualMood;
  targetDuration?: TargetDurationRange;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  narrativeMode?: NarrativeMode;
  includeMusic?: boolean;
  brandName?: string;
  brandConcept?: { summary?: string; visualStyle?: string; photographyStyle?: string; primaryColor?: string; secondaryColor?: string };
  revisionFeedback?: string;
  currentStoryboard?: StoryboardResponse;
}): Promise<StoryboardResponse> {
  const moodKey: CinematicVisualMood = input.visualMood && CINEMATIC_VISUAL_MOODS[input.visualMood]
    ? input.visualMood
    : "cinematic_photoreal";
  const mood = CINEMATIC_VISUAL_MOODS[moodKey];
  const targetDur = input.targetDuration || "30s";
  const ratio = input.aspectRatio || "9:16";
  const narrativeMode: NarrativeMode = input.narrativeMode || "hybrid";
  const includeMusic = input.includeMusic !== false;
  const isDiyCraft = moodKey === "diy_craft_macro";

  const systemPrompt = `You are a world-class AI Film Director, Screenwriter and Dramaturge operating strictly under the 'smixs/visual-skills' framework (references: dramaturgy.md, universal-rules.md, veo.md).
Your specialty is directing Google Vids Omni / Veo cinematic video generators.

MANDATORY LAWS FROM THE VISUAL-SKILLS REPOSITORY:
1. "Dramaturgy first, details intensify emotion, syntax serves story":
   - BANNED LAZY ADJECTIVES: Never output words like "cinematic", "photorealistic", "ultra realistic", "8k", "masterpiece", "stunning", "epic", "amazing", "beautiful lighting", "dynamic camera".
   - Replace abstract feelings ("he is sad/happy") with concrete physical facts: bodily micro-actions, tight jaw, posture shift, observable breath.
   - GOOGLE SAFETY POLICY STRICT GUARDRAIL (CRITICAL):
     * NEVER mention numerical or spelled-out child/minor ages (e.g. NEVER write "8-year-old girl", "10-year-old boy", "young child", "toddler"). Google Vids triggers automatic Generative AI Prohibited Use policy violations on age-defined minors. Instead, use generic stylized persona titles like "Artisan apprentice Maya", "Young craftsman Leo", "Apprentice companion".
     * NEVER mention weapons, blades, utility knives, slicing, slit, or sharp cuts. Instead, write "precision craft creasing tool", "scoring fold guide", "cutting card mat".
     * NEVER mention medical paraphernalia like syringes, plungers, needles, or injections. Instead, write "hydraulic fluid cylinder", "fluid piston conduit", "pressure transfer tube".
     * NEVER depict children or minors in scenarios involving stranger chats, open chat feeds, incoming online messages, or online grooming risks. Instead, depict creative geometric 3D building blocks, voxel world architecture, and clean graphic system settings toggles.
     * Avoid peril or sensitive physical intimacy cues: do NOT write "lower lip quivers", "slumping under frustration", "hands wrapped over trembling palms". Replace with neutral or collaborative phrases: "focuses intently on the wheel", "steadying the terracotta base alongside her".
2. "The Three-Detail Rule per Shot (dramaturgy.md §2 & universal-rules.md U12)":
   - Environmental pressure: weather/space acting as character (cold fridge spill, rain on single pane, wet mud traction, low dust motes).
   - Physical micro-action on body: jaw locks, knuckles whiten, fingers grip sash, eyes drop a quarter-inch.
   - Perceptual sound anchor or visual motif: creek current, wind in willows, splashing foam.
3. "The Three-Jobs Rule (dramaturgy.md §3)":
   - Every shot MUST do at least one of three things: (1) change emotion, (2) advance action, or (3) increase pressure.
4. "Veo / Google Vids Official Audio & Dialogue Syntax (veo.md §4 & §5)":
   - In each scene's 'promptEn', construct the prompt with explicit Veo layers:
     [Subject/Action + Environment + Camera Lens + Lighting + Style/Mood]
     Audio: [environmental texture and ambient sounds]
     Says: [Character] says [voice tone modifier]: "[dialogue text, max 8 seconds]"  (omit if scene has no speech)
     SFX: [punctual sound event, e.g. (water splashing franticly), (cloth ripping)]
   - In 'audioCueEn', extract the clean Audio line (e.g. "Audio: flowing mountain creek, wind through weeping willows").
   - In 'sfxCueEn', extract the SFX line (e.g. "SFX: (frantic water splashing at 2s)").
5. "NARRATIVE MODE LAWS (CRITICAL) - NATIVE GOOGLE VIDS & VEO ONLY, NO EXTERNAL SERVICES":
   - Current mode is: "${narrativeMode.toUpperCase()}"
   - If 'voiceover_only': Scenes MUST NOT have character speech or 'dialogueTr'. Focus 100% on rich, literary, storytelling Turkish narrator voiceover ('voiceoverTr') synthesized natively via Google Vids TTS. Omit 'Says:' lines from 'promptEn'.
   - If 'dialogue_only': Scenes MUST NOT have narrator voiceover ('voiceoverTr' MUST BE EMPTY OR OMITTED). Every scene is driven directly by in-scene character dialogue ('dialogueTr') with full character names and Veo native 'Says: [Character] says [tone]: "[line]"' lip-sync syntax.
   - If 'hybrid': Balance narrator storytelling ('voiceoverTr') with character emotion/dialogue notes ('dialogueTr'), BUT DO NOT include 'Says:' speech lines inside 'promptEn'. In hybrid mode, captions and audio must come strictly from the narrator's voiceover ('voiceoverTr') so that character speech and narrator captions NEVER overlap on screen!
   - If 'diy_asmr': STRICTLY NO SPOKEN WORDS, NO SPEECH, NO NARRATOR ('voiceoverTr' and 'dialogueTr' MUST BE OMITTED OR EMPTY).
     * All auditory focus is on Google Veo's in-world Foley and physical material sounds. NO external audio or external TTS!
     * In 'promptEn', construct rich tactile auditory descriptions: e.g. "Audio: tactile cardboard slicing, rhythmic plastic gear clicks, gentle motor whirr. SFX: (precise mechanical snap at 2s)".
     * Provide punchy on-screen text steps in 'onScreenTextTr' (e.g. "Adım 1: Gövdeyi Kes", "Adım 2: Şırıngayı Bağla").
   - If 'silent_captions': STRICTLY NO SPOKEN VOICEOVER OR DIALOGUE ('voiceoverTr' and 'dialogueTr' MUST BE EMPTY).
     * Designed for silent viewing with bold on-screen text overlays ('onScreenTextTr').
     * Focus 100% on visual clarity and powerful, readable Turkish on-screen text cards and steps!
   - Always provide 'onScreenTextTr' for every scene as a visual anchor.

6. "VISUAL-SKILLS MUSIC DIRECTION (camera-lighting-vocabulary.md §8)":
   - If includeMusic is active, analyze the core emotional spine of the story and design 'musicSpec'.
   - Provide evocative Turkish 'moodTr' and 'instrumentationTr'.
   - Provide an English instrumental music generation prompt 'musicPromptEn' tailored for Google Vids Audio (e.g. "Playful Anatolian folklore acoustic track, light rhythmic qanun and wooden flute, gentle comedic cadence, no vocals").

7. "Character Anchor Law (universal-rules.md U7 - Concept-Native Identity & Cross-Scene Continuity)":
   - CONCEPT-NATIVE PROTAGONIST CREATION:
     * DYNAMIC ADAPTATION: The character MUST be organically derived from the user's specific topic, brand concept, and narrative genre.
       - Medical/Health topic -> Physician, researcher, clinician, or patient in authentic medical attire.
       - Culinary/Food topic -> Chef, baker, food artisan, or cooking enthusiast in authentic kitchen styling.
       - Architectural/Engineering topic -> Architect, structural engineer, or industrial designer with drafting/cad tools.
       - Tech/Software/Cyber topic -> Software developer, data engineer, or tech founder in modern studio setting.
       - Education/Youth/STEM topic -> Enthusiastic student apprentice or young maker in casual creative workshop attire.
       - History/Fable topic -> Period-accurate figure with authentic textiles, historical wardrobe, and cultural styling.
     * ZERO HARDCODED STEREOTYPES: NEVER force "maker Can" or "Genç Kadın Maker Zeynep" unless the user's brief actually asks for a maker/craft workshop project!
   - GOOGLE AI SAFETY COMPLIANCE: Express age and youthfulness visually and stylistically ("youthful apprentice", "young adult professional", "seasoned artisan"), NEVER through numerical ages ("8-year-old") to avoid triggering Google AI safety blocks.
   - EXACT TRAITS DEFINITION (fixedTraitsEn):
     * The characterAnchor's 'fixedTraitsEn' MUST define: (1) exact hairstyle, color, and cut, (2) eye color and facial features, (3) exact clothing pieces with fabric, color, and fit (e.g. "teal rolled-sleeve cotton hoodie over grey crew-neck tee with dark denim trousers"), (4) distinctive accessories.
     * CROSS-SCENE CONTINUITY MANDATE: In EVERY scene prompt ('promptEn') where this character appears, the prompt MUST lead with these EXACT SAME identity tokens. Repeating the exact identity block ensures Google Flow and Google Vids will NOT change the character's face, skin tone, or clothing across scenes!
   - STYLE HARMONY MANDATE: The characterAnchor's 'masterVisualPromptEn' and 'fixedTraitsEn' MUST strictly match the selected visual mood ("${mood.label}")!
     * If 'stylized_3d': The character MUST be designed as a 3D animated character (Pixar / Unreal Engine 3D stylized character render, non-photorealistic stylized proportions), NEVER a live-action photo!
     * If 'retro_vintage_80s': 1980s retro vintage film aesthetic with warm analog halation and vintage wardrobe.
     * If 'moody_chiaroscuro': High-contrast chiaroscuro lighting, deep noir shadows and dramatic character framing.
     * If 'documentary_nature': Raw authentic environmental lighting and authentic candid textures.
     * If 'minimal_commercial': Ultra-clean modern commercial look, crisp studio lighting.
     * If 'cinematic_photoreal' or 'golden_hour': Photorealistic cinematic human portrait with organic film grain and natural light.

8. "Google Vids Omni Dynamic Scene Duration & Timing Rhythm (STRICT)":
   - EXTEND (UZAT) IS FORBIDDEN: Every scene MUST have "actionType": "new_scene". Each clip is an independent Omni clip.
   - TARGET DURATION MAPPING:
     * If target duration is "3s": Exactly ONE 3-second scene (single-scene viral loop hook).
     * If target duration is "10s": 2 balanced scenes [5s, 5s] (or 1 continuous 10s sequence shot if single uninterrupted action).
     * If target duration is "15s": 3 scenes totaling 15 seconds [5s, 5s, 5s].
     * If target duration is "30s": 4 to 5 scenes totaling 30 seconds (e.g. [6s, 6s, 6s, 6s, 6s]).
     * If target duration is "60s": 6 to 8 scenes totaling 60 seconds (each scene 7-10s).
     * TOTAL DURATION ACCURACY: The sum of all scene durationSeconds MUST equal totalDurationSeconds exactly!
   - DYNAMIC VOICEOVER WORD LIMIT (CRITICAL):
     * In Turkish natural speech, pacing is ~2 words per second.
     * Each scene's 'voiceoverTr' word count MUST NOT EXCEED: (durationSeconds - 1) * 2 words!
     * Leave buffer for breath and camera motion so voiceover NEVER overflows the scene clip!

9. "UNIVERSAL PHYSICAL REALISM & RIGID TOPOLOGY LAWS (CRITICAL - NO LOGIC ERRORS)":
   - Closed-Circuit Flow: Any fluid (water, oil, air) moves ONLY through dedicated sealed conduits (tubes, pipes, nozzles).
   - Solid Mechanical Contact: Gears, levers, pistons, and moving parts actuate only via physical direct mechanical interlock and friction-fit contact. Zero floating parts.
   - Always append this strict physical boundary token to EVERY scene's 'promptEn':
     "Strict physical realism: rigid body mechanics, zero liquid spillage on dry surfaces, all forces transfer through direct solid-to-solid contact, downward Newtonian gravity, no floating or phantom parts, complete spatial object permanence."

10. "3-WAY VISUAL ANCHORS SPECIFICATION (PERSON • LOCATION • OBJECT - ZERO-BLEED REUSABILITY)":
    - Define comprehensive 'visualAnchors' in your JSON output with 3 dedicated references strictly matching the topic:
      * 'person': Primary character / protagonist anchor (name, descriptionTr, visualPromptEn).
        - 'visualPromptEn': Clean character reference sheet: left side front-face portrait close-up (head & shoulders); right side 3 equal-height full-body views (front, 90° profile, back) in neutral relaxed A-pose. Tops of heads and soles of feet aligned on the same horizontal plane. Isolated on a PURE WHITE BACKGROUND, soft uniform studio light. Zero props in hand, zero dynamic action poses.
      * 'location': Primary setting / environment anchor (name, descriptionTr, visualPromptEn).
        - 'visualPromptEn': Clear wide-angle establishing shot of the setting organically fitting the topic. Three-layer composition: foreground framing (FG), primary functional midground space (MG), background spatial depth with windows/walls (BG). Explicitly define entrances/exits and fixed relative positions of key fixtures. Strictly empty scene: 100% zero people, zero silhouettes.
      * 'object': Central hero prop, tool, device, or product (name, descriptionTr, visualPromptEn).
        - 'visualPromptEn': Single-item commercial product photography shot. Standard 3/4 perspective (or top-down flat-lay for documents/interfaces), centered and 100% complete in frame with generous margins, isolated on pure white background, zero hands holding it, zero environment clutter, soft studio light, high micro-detail.
    - Also maintain 'characterAnchor' for legacy compatibility.
    - STRICT PROHIBITION OF '@' SYMBOLS & SOCIAL MEDIA HANDLES IN promptEn (CRITICAL):
      * NEVER use '@' symbols or handle names in promptEn (e.g. write 'the young artisan chef', NOT '@genc_sef'; write 'the combination lock box', NOT '@akilli_kasa').
      * In EVERY scene prompt, explicitly enforce: 'Clean photographic frame, strictly zero text overlays, zero watermarks, zero @ handles, zero subtitles, no letters or numbers on screen.'

11. "DEDICATED VISUAL PRODUCTION TYPE & SHOT FLOW":
${isDiyCraft ? `    * SPECIAL MULTI-SHOT & MULTI-ACTION DIRECTIVE ACTIVE FOR THIS STORYBOARD:
      - Every single scene MUST feature TWO distinct micro-events (actions) and THREE different dynamic camera angles (jump cuts / angle shifts) within its 3-5s span.
      - In EVERY scene:
        * Action 1 + Angle 1 (45° Top-Down Desk Angle): Hands measuring, scoring, or aligning parts on the work surface.
        * Action 2 + Angle 2 (Rapid Jump Cut to Extreme Macro Close-Up): Craft shears trimming cleanly, bonding, or assembling components with crisp precision.
        * Resolution + Angle 3 (Dynamic Cut to Low-Angle / Action Profile): Mechanism turning, axle spinning, lever pressing, or moving part engaging smoothly.
      - 'cameraSetup': MUST specify "3-shot dynamic jump cuts: 45° overhead desk -> macro tight focus -> low-angle motion profile".
      - 'promptEn': MUST explicitly be structured as a 3-shot sequence:
        "Three-shot dynamic sequence with rapid jump cuts: [Shot 1: 45-degree top-down desk angle: hands initiate action 1...] -> [Rapid jump cut to Shot 2: extreme macro close-up on precision detail completing action 2...] -> [Dynamic cut to Shot 3: low-angle action profile showcasing movement and result...]. Strict physical realism... Audio: ... SFX: ..."` : `    * INACTIVE FOR CURRENT STYLE ("${mood.label}"):
      - Maintain classic continuous single-camera take with motivated camera movement appropriate for ${mood.label}.
      - Strictly DO NOT use multi-cut jump-cuts or 3-shot sequences.`}`;

  const brandDirective = input.brandConcept?.summary ? `
BRAND VISUAL IDENTITY & LIGHTING MANDATE (CRITICAL):
- Brand Atmosphere: ${input.brandConcept.summary}
${input.brandConcept.visualStyle ? `- Visual Elements & Decor: ${input.brandConcept.visualStyle}\n` : ""}${input.brandConcept.photographyStyle ? `- Lighting & Environment: ${input.brandConcept.photographyStyle} (Strictly avoid gloomy/dark cyberpunk shadows; prioritize daylight and wholesome warmth)\n` : ""}` : "";

  const userPrompt = `TOPIC / USER PROMPT: "${input.topic}"
BRAND: "${input.brandName || "General"}"
${brandDirective}
TARGET DURATION: ${targetDur} (Approximate desired length)
ASPECT RATIO: ${ratio}
NARRATIVE MODE: ${narrativeMode}
INCLUDE MUSIC DIRECTION: ${includeMusic ? "YES" : "NO"}
SELECTED VISUAL STYLE: ${mood.label}
- Lighting Style: ${mood.lightingInstruction}
- Lens / Camera Style: ${mood.lensInstruction}
- Color Grading: ${mood.colorGrading}

${input.revisionFeedback ? `USER REVISION FEEDBACK: "${input.revisionFeedback}"\nPlease revise the previous storyboard while preserving the overall continuity and fixing the requested points.` : ""}
${input.currentStoryboard ? `EXISTING STORYBOARD TO REFINE: ${JSON.stringify(input.currentStoryboard)}` : ""}

TASK:
Determine the optimal scene count, timing rhythm (10s vs 20s extend), extract character anchor traits for continuity, write compelling Turkish voiceover/dialogues for each scene, and write the exact physical English prompt for Google Vids Omni.

Return ONLY a valid JSON object matching this schema (no markdown fences, no conversational text):
{
  "title": "Short catchy title in Turkish",
  "narrativeTr": "1-2 sentence dramatic narrative summary in Turkish explaining the core emotion and conflict",
  "narrativeMode": "${narrativeMode}",
  "totalDurationSeconds": 30,
  "visualMood": "${moodKey}",
  "aspectRatio": "${ratio}",
  "musicSpec": {
    "moodTr": "Duygu tanımı (Türkçe)",
    "instrumentationTr": "Enstrümanlar (Türkçe)",
    "musicPromptEn": "Instrumental music generation prompt for Google Vids Audio in English, no vocals"
  },
  "characterAnchor": {
    "name": "Concept-appropriate protagonist name (e.g. Mimar Selim, Şef Murat, Dr. Leyla, Genç Mucit Can)",
    "archetypeTr": "Karakterin rolü, kıyafeti ve mesleki kimliği (Türkçe)",
    "masterVisualPromptEn": "Character reference sheet of [Character Name]: left side front-face portrait close-up with head and shoulders fully in frame; right side 3 equal-height full-body views (front, 90-degree profile, back) in neutral A-pose. Isolated on pure white background, soft uniform studio light. Complete edges, zero props.",
    "fixedTraitsEn": "Exact visual traits: [gender/age impression], [exact face/eyes/hair cut and color], [exact clothing pieces, fabric and colors], [distinctive accessories]"
  },
  "visualAnchors": {
    "person": {
      "name": "Protagonist Name",
      "descriptionTr": "Karakterin görünümü ve rolü (Türkçe)",
      "visualPromptEn": "Character reference sheet of [Character Name]: left side front-face portrait close-up; right side 3 equal-height full-body views (front, 90-degree profile, back) in neutral A-pose. Isolated on pure white background, soft uniform studio light. Zero props, zero dynamic action."
    },
    "location": {
      "name": "Concept-appropriate primary setting name (e.g. Modern Araştırma Laboratuvarı, Taş Fırın Mutfak)",
      "descriptionTr": "Mekanın 3 katmanlı mimarisi ve atmosferi (Türkçe, kesinlikle insansız)",
      "visualPromptEn": "Fixed-camera wide-angle establishing shot of [Setting]. Three-layer spatial composition: 1) foreground framing elements, 2) midground primary functional space with key fixtures, 3) background spatial depth with windows and walls. Defined entrances/exits. Strictly empty scene, 100% zero people."
    },
    "object": {
      "name": "Concept-appropriate hero prop / tool / item (e.g. Biyosensör Cihazı, El Yapımı Seramik Bardak)",
      "descriptionTr": "Öne çıkan eşyanın özellikleri (Türkçe)",
      "visualPromptEn": "Single-item commercial product photography shot of [Item]. Standard 3/4 perspective, centered and fully in frame with generous margins, isolated on pure white background, zero hands holding it, zero environment clutter, soft studio light, high micro-detail."
    }
  },
  "scenes": [
    {
      "sceneIndex": 1,
      "shotType": "establishing",
      "durationSeconds": 10,
      "actionType": "new_scene",
      "cameraSetup": "Wide angle 35mm, slow steady tracking",
      "lightingSetup": "Warm sunset backlight with natural dust haze",
      "summaryTr": "Sahne 1 Türkçe kısa özeti",
      "onScreenTextTr": "Ekranda büyük ve net görünecek Türkçe kanca veya adım metni (örn: Adım 1: Gövdeyi Kes)",
      "voiceoverTr": "Etkili, akıcı ve hikayeyi anlatan Türkçe dış ses metni (diy_asmr veya silent_captions modunda boş bırakın)",
      "dialogueTr": "Varsa karakterin Türkçe repliği veya boş string",
      "audioCueEn": "Audio: flowing mountain creek, wind through weeping willows",
      "sfxCueEn": "SFX: (frantic water splashing at 2s)",
      "promptEn": "English dense physical prompt referencing @person_tag, @object_tag on @location_tag (e.g. @zanaatkar_usta assembling @kalpli_bardak on @ahsap_atolye_tezgahi), followed by Audio, Says and SFX blocks..."
    }
  ]
}

CRITICAL: Return valid JSON ONLY. No markdown backticks, no markdown code block wrapping, no conversational prefix or suffix.`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.65,
    maxTokens: 2500,
  });

  const parsed = parseJsonResponse<StoryboardResponse>(content);

  // Validate or apply fallback if parsed result is incomplete
  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    const isDiy = moodKey === "diy_craft_macro";
    const defaultDurs = targetDur === "3s" ? [3] : targetDur === "10s" ? [5, 5] : targetDur === "15s" ? [5, 5, 5] : targetDur === "60s" ? [8, 8, 8, 9, 9, 9, 9] : [6, 6, 6, 6, 6];
    const fallbackDuration = defaultDurs.reduce((a, b) => a + b, 0);
    const fallbackAnchors: VisualAnchorsSpec = {
      person: {
        name: isDiy ? "Genç Zanaatkâr" : "Ana Karakter",
        descriptionTr: "Hikayenin merkezindeki karakter veya anlatıcı",
        visualPromptEn: `Character reference sheet of protagonist for ${input.topic}: left side front-face portrait close-up with head and shoulders fully in frame; right side three equal-height full-body views (front, 90-degree profile, back) in neutral A-pose. Isolated on pure white background, soft uniform studio light. Complete edges, zero props.`,
      },
      location: {
        name: isDiy ? "Zanaat Atölyesi" : "Ana Mekan",
        descriptionTr: "Hikayenin geçtiği 3 katmanlı mekan atmosferi (insansız)",
        visualPromptEn: `Fixed-camera wide-angle establishing shot of primary setting for ${input.topic}. Three-layer spatial composition with foreground framing, functional midground space, and background depth. Architectural entrances clearly visible. Strictly empty scene, zero people.`,
      },
      object: {
        name: isDiy ? "Zanaat Düzeneği" : "Merkezi Öğe",
        descriptionTr: "Öne çıkan araç, ürün veya obje",
        visualPromptEn: `Single-item commercial product photography shot of the key item in ${input.topic.slice(0, 40)}. Standard 3/4 perspective, centered and fully in frame with generous margins, isolated on pure white background, zero hands holding it, zero environment clutter, soft studio light, high micro-detail.`,
      },
    };
    const fallbackChips = resolveVisualAnchorChips(fallbackAnchors);

    return {
      title: input.topic.slice(0, 40),
      narrativeTr: "Doğal sinematik akış ve sahne devamlılığı.",
      narrativeMode,
      totalDurationSeconds: fallbackDuration,
      visualMood: moodKey,
      aspectRatio: ratio,
      visualAnchors: fallbackAnchors,
      scenes: defaultDurs.map((dur, i) => {
        const rawPrompt = isDiy
          ? `Three-shot dynamic sequence with rapid jump cuts for ${input.topic}. Shot 1: 45-degree top-down desk view of artisan hands measuring and aligning parts on green cutting mat. Rapid jump cut to Shot 2: extreme macro close-up of precision craft shears trimming cardboard edge with clean precision. Dynamic cut to Shot 3: low-angle side profile showing smooth axle rotation and mechanical engagement. ${mood.lensInstruction}, ${mood.lightingInstruction}, ${mood.colorGrading}. Strict physical realism: rigid body mechanics, zero liquid spillage on dry surfaces, all forces transfer through direct solid-to-solid contact, downward Newtonian gravity, no floating or phantom parts, complete spatial object permanence. Audio: tactile craft workshop sounds, soft cardboard creasing. SFX: (mechanical snap at 2s).`
          : `A focused scene ${i + 1} of ${input.topic}, ${mood.lensInstruction}, ${mood.lightingInstruction}, smooth cinematic camera movement, ${mood.colorGrading}.`;
        return {
          sceneIndex: i + 1,
          shotType: i === 0 ? "establishing" : i === defaultDurs.length - 1 ? "resolution_climax" : "action_development",
          durationSeconds: dur,
          actionType: "new_scene",
          cameraSetup: isDiy
            ? "3-shot dynamic jump cuts: 45° overhead desk -> macro tight focus -> low-angle motion profile"
            : mood.lensInstruction,
          lightingSetup: mood.lightingInstruction,
          summaryTr: isDiy ? `Sahne ${i + 1}: 2 olaylı çok açılı montaj ve test adımı` : `Sahne ${i + 1} gelişimi`,
          voiceoverTr: `Etkili kısa anlatım cümlesi sahne ${i + 1}.`,
          referenceChips: fallbackChips,
          promptEn: bindReferenceChipsToPrompt(rawPrompt, fallbackChips),
        };
      }),
    };
  }

  // Ensure valid dynamic duration (min: 3s, max: 10s) and enforce new_scene (no extend)
  parsed.scenes = parsed.scenes.map((sc, i) => {
    const rawDur = Number(sc.durationSeconds);
    const validDur = Number.isFinite(rawDur) ? Math.max(3, Math.min(10, Math.round(rawDur))) : (moodKey === "diy_craft_macro" ? 4 : 6);
    return {
      ...sc,
      sceneIndex: i + 1,
      durationSeconds: validDur,
      actionType: "new_scene" as const,
    };
  });
  parsed.totalDurationSeconds = parsed.scenes.reduce((sum, sc) => sum + sc.durationSeconds, 0);

  // Sync 3-way visualAnchors and legacy characterAnchor
  if (!parsed.visualAnchors) {
    parsed.visualAnchors = {};
  }
  if (parsed.characterAnchor && !parsed.visualAnchors.person) {
    parsed.visualAnchors.person = {
      name: parsed.characterAnchor.name,
      descriptionTr: parsed.characterAnchor.archetypeTr,
      visualPromptEn: parsed.characterAnchor.masterVisualPromptEn || parsed.characterAnchor.fixedTraitsEn,
    };
  } else if (parsed.visualAnchors.person && !parsed.characterAnchor) {
    parsed.characterAnchor = {
      name: parsed.visualAnchors.person.name,
      archetypeTr: parsed.visualAnchors.person.descriptionTr,
      masterVisualPromptEn: parsed.visualAnchors.person.visualPromptEn,
      fixedTraitsEn: parsed.visualAnchors.person.visualPromptEn,
    };
  }

  // Bind reference chips to all scenes and enforce programmatic cross-scene continuity
  const anchorChips = resolveVisualAnchorChips(parsed.visualAnchors, parsed.characterAnchor);
  const personName = parsed.visualAnchors?.person?.name || parsed.characterAnchor?.name;
  const personFixedTraits = parsed.characterAnchor?.fixedTraitsEn || parsed.visualAnchors?.person?.descriptionTr;
  const locationName = parsed.visualAnchors?.location?.name;

  parsed.scenes = parsed.scenes.map((sc) => {
    let prompt = bindReferenceChipsToPrompt(sc.promptEn, anchorChips);
    if (locationName && !prompt.toLowerCase().includes(locationName.toLowerCase()) && !prompt.toLowerCase().startsWith("set at") && !prompt.toLowerCase().startsWith("set in")) {
      prompt = `Set in ${locationName}, ` + prompt;
    }
    if (personFixedTraits && personName && (prompt.toLowerCase().includes(personName.toLowerCase()) || prompt.toLowerCase().includes("character") || prompt.toLowerCase().includes("protagonist"))) {
      const traitsSnippet = personFixedTraits.slice(0, 40).trim();
      if (traitsSnippet && !prompt.toLowerCase().includes(traitsSnippet.toLowerCase())) {
        prompt = prompt.replace(new RegExp(`\\b${personName}\\b`, "i"), `${personName} (${personFixedTraits})`);
      }
    }
    return {
      ...sc,
      referenceChips: sc.referenceChips && sc.referenceChips.length ? sc.referenceChips : anchorChips,
      promptEn: prompt,
    };
  });

  return parsed;
}

/**
 * Re-rolls a single scene in an existing storyboard according to visual-skills dramaturgy rules.
 */
export async function rerollSingleScene(input: {
  topic: string;
  sceneIndex: number;
  currentStoryboard: StoryboardResponse;
  userInstruction?: string;
  visualMood?: CinematicVisualMood;
}): Promise<ScriptScenePlan> {
  const sb = input.currentStoryboard;
  const targetScene = sb.scenes.find((s) => s.sceneIndex === input.sceneIndex);
  if (!targetScene) {
    throw new Error(`Sahne ${input.sceneIndex} senaryoda bulunamadı.`);
  }

  const moodKey = input.visualMood || sb.visualMood || "cinematic_photoreal";
  const mood = CINEMATIC_VISUAL_MOODS[moodKey] || CINEMATIC_VISUAL_MOODS.cinematic_photoreal;
  const isDiyCraft = moodKey === "diy_craft_macro";

  const systemPrompt = `You are a world-class AI Film Director operating under the 'smixs/visual-skills' framework.
Your task is to RE-ROLL / RE-DIRECT exactly ONE SCENE (Scene ${input.sceneIndex}) inside an existing multi-scene sequence.

RULES:
1. Preserve continuity: Retain the existing character anchor traits (${sb.characterAnchor?.fixedTraitsEn || "consistent subject"}), narrative mode (${sb.narrativeMode || "hybrid"}), overall visual mood, and surrounding scene progression.
2. The Three-Detail Rule: Ensure the scene has concrete environmental pressure, body micro-actions, and sound/motif anchors.
3. "Google Vids Omni Scene Independence & Dynamic Voiceover Pace Limit":
   - EXTEND (UZAT) IS FORBIDDEN: Scene actionType MUST be "new_scene" and durationSeconds: ${targetScene.durationSeconds || 5} (min: 3, max: 10).
   - VOICEOVER WORD LIMIT: 'voiceoverTr' word count MUST NOT EXCEED: (${targetScene.durationSeconds || 5} - 1) * 2 words! Never overflow the scene duration.
4. Audio/Dialogue Syntax: Use Veo official format: [Physical visual action/camera/light] + Audio: ... + Says: ... + SFX: ...
5. Follow Narrative Mode:
   - If 'voiceover_only', omit 'Says:' and focus on 'voiceoverTr'.
   - If 'dialogue_only', omit 'voiceoverTr' and focus on 'Says:' and 'dialogueTr'.
   - If 'hybrid', provide both.
6. BANNED LAZY WORDS: Never output "cinematic", "photorealistic", "8k", "masterpiece".
7. "MULTI-SHOT / SINGLE-TAKE DIRECTION":
${isDiyCraft ? `   - SPECIAL MULTI-SHOT & MULTI-ACTION DIRECTIVE (ACTIVE FOR diy_craft_macro):
     * Scene ${input.sceneIndex} MUST feature TWO distinct micro-events (actions) and THREE dynamic camera angles (Shot 1: 45° overhead desk angle -> Shot 2: rapid jump cut to extreme macro -> Shot 3: dynamic cut to low-angle action profile) with fluid jump cuts to hide AI visual artifacts and keep high viral retention.
     * 'cameraSetup': Specify "3-shot dynamic jump cuts: 45° overhead desk -> macro tight focus -> low-angle motion profile".
     * 'promptEn': Explicitly structure as a 3-shot sequence: "Three-shot dynamic sequence with rapid jump cuts: [Shot 1: 45-degree top-down desk angle...] -> [Rapid jump cut to Shot 2: extreme macro close-up...] -> [Dynamic cut to Shot 3: low-angle action profile...]. Strict physical realism... Audio: ... SFX: ..."` : `   - SINGLE TAKE CONTINUITY:
     * For visual mood "${mood.label}", maintain standard cinematic single-camera take with motivated camera movement. DO NOT use multi-cut jump-cuts.`}
8. Return ONLY a valid JSON object matching the single ScriptScenePlan schema (no markdown, no array wrapping).`;

  const userPrompt = `ORIGINAL STORY TOPIC: "${input.topic}"
EXISTING NARRATIVE ARC: "${sb.narrativeTr}"
CHARACTER ANCHOR: ${JSON.stringify(sb.characterAnchor || {})}
CURRENT SCENE TO RE-ROLL: ${JSON.stringify(targetScene)}
ALL SCENES IN STORYBOARD (FOR CONTEXT): ${JSON.stringify(sb.scenes)}
USER SPECIFIC RE-ROLL INSTRUCTION: "${input.userInstruction || "Make this scene more dynamic and dramatic while preserving continuity."}"

Return valid JSON matching this schema:
{
  "sceneIndex": ${targetScene.sceneIndex},
  "shotType": "${targetScene.shotType}",
  "durationSeconds": ${targetScene.durationSeconds},
  "actionType": "${targetScene.actionType}",
  "cameraSetup": "Updated camera lens & motivated movement",
  "lightingSetup": "Updated physical lighting & contrast",
  "summaryTr": "Yeni Türkçe sahne özeti",
  "voiceoverTr": "Etkili Türkçe dış ses metni",
  "dialogueTr": "Varsa karakterin Türkçe repliği veya boş string",
  "audioCueEn": "Audio: sound description",
  "sfxCueEn": "SFX: sound effect",
  "promptEn": "Updated physical prompt with character traits and audio cues..."
}`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 1200,
  });

  const parsed = parseJsonResponse<ScriptScenePlan>(content);
  if (!parsed || !parsed.promptEn) {
    throw new Error("Yenilenen sahne verisi geçerli bir formatta üretilemedi.");
  }

  const anchorChips = resolveVisualAnchorChips(sb.visualAnchors, sb.characterAnchor);
  const promptEn = bindReferenceChipsToPrompt(parsed.promptEn, anchorChips);

  return {
    ...targetScene,
    ...parsed,
    sceneIndex: targetScene.sceneIndex,
    durationSeconds: targetScene.durationSeconds || 10,
    actionType: "new_scene",
    referenceChips: anchorChips,
    promptEn,
  };
}
