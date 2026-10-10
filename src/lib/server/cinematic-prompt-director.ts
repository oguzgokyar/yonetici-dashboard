import "server-only";

import { completeText, parseJsonResponse } from "@/lib/server/cliproxy-text";

export type CinematicVisualMood =
  | "cinematic_photoreal"
  | "golden_hour"
  | "moody_chiaroscuro"
  | "documentary_nature"
  | "retro_vintage_80s"
  | "minimal_commercial"
  | "stylized_3d";

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
    colorGrading: "Kodak 2383 print film emulation, rich deep blacks, natural skin tones, balanced saturation.",
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
};

export type TargetDurationRange = "15s" | "30s" | "60s";

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
  durationSeconds: number; // 10 veya 20
  actionType: "new_scene" | "extend"; // Google Vids'te yeni sahne mi yoksa uzatma (Extend) mi?
  cameraSetup: string; // örn: "35mm anamorphic, slow push-in"
  lightingSetup: string; // örn: "Low-angle golden hour rim light"
  summaryTr: string; // Kullanıcının arayüzde Türkçe göreceği özet
  promptEn: string; // Google Vids Omni'ye gönderilecek katı İngilizce prompt (Veo/Vids resmi Audio/Says/SFX sentaksı)
  voiceoverTr?: string; // Google Vids yerleşik Voiceover paneline girilecek Türkçe dış ses anlatımı
  dialogueTr?: string; // Sahne içinde karakterlerin konuşmaları / replikleri (Türkçe)
  audioCueEn?: string; // Veo/Vids Audio katmanı (örn: "Audio: rustling leaves, distant creek stream")
  sfxCueEn?: string; // Veo/Vids SFX katmanı (örn: "SFX: (water splash at 2s)")
}

export type NarrativeMode = "voiceover_only" | "dialogue_only" | "hybrid";

export interface MusicMoodSpec {
  moodTr: string; // örn: "Nüktedan ve Neşeli Halk Müziği"
  instrumentationTr: string; // örn: "Akustik kanun, ney ve hafif ritmik perküsyon"
  musicPromptEn: string; // Google Vids Audio için: "Playful Anatolian folklore acoustic track, light rhythmic qanun and wooden flute, gentle comedic cadence, no vocals"
  tempoBpm?: number;
}

export interface StoryboardResponse {
  title: string;
  narrativeTr: string;
  narrativeMode?: NarrativeMode;
  totalDurationSeconds: number;
  visualMood: CinematicVisualMood;
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec; // Hikayede sabit kalması gereken ana karakter/obje
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

  const systemPrompt = `You are a world-class AI Film Director, Screenwriter and Dramaturge operating strictly under the 'smixs/visual-skills' framework (references: dramaturgy.md, universal-rules.md, veo.md).
Your specialty is directing Google Vids Omni / Veo cinematic video generators.

MANDATORY LAWS FROM THE VISUAL-SKILLS REPOSITORY:
1. "Dramaturgy first, details intensify emotion, syntax serves story":
   - BANNED LAZY ADJECTIVES: Never output words like "cinematic", "photorealistic", "ultra realistic", "8k", "masterpiece", "stunning", "epic", "amazing", "beautiful lighting", "dynamic camera".
   - Replace abstract feelings ("he is sad/happy") with concrete physical facts: bodily micro-actions, tight jaw, posture shift, observable breath.
   - GOOGLE SAFETY POLICY STRICT GUARDRAIL (CRITICAL):
     * NEVER mention numerical or spelled-out child/minor ages (e.g. NEVER write "8-year-old girl", "10-year-old boy", "young child", "toddler"). Google Vids triggers automatic Generative AI Prohibited Use policy violations on age-defined minors. Instead, use generic stylized persona titles like "Artisan apprentice Maya", "Young craftsman Leo", "Apprentice companion".
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
5. "NARRATIVE MODE LAWS (CRITICAL)":
   - Current mode is: "${narrativeMode.toUpperCase()}"
   - If 'voiceover_only': Sシーン MUST NOT have character speech or 'dialogueTr'. Focus 100% on rich, literary, storytelling Turkish narrator voiceover ('voiceoverTr'). Omit 'Says:' lines from 'promptEn'.
   - If 'dialogue_only': Scenes MUST NOT have narrator voiceover ('voiceoverTr' MUST BE EMPTY OR OMITTED). Every scene is driven directly by in-scene character dialogue ('dialogueTr') with full character names and Veo 'Says: [Character] says [tone]: "[line]"' syntax.
   - If 'hybrid': Balance narrator storytelling with punchy character dialogue.

6. "VISUAL-SKILLS MUSIC DIRECTION (camera-lighting-vocabulary.md §8)":
   - If includeMusic is active, analyze the core emotional spine of the story and design 'musicSpec'.
   - Provide evocative Turkish 'moodTr' and 'instrumentationTr'.
   - Provide an English instrumental music generation prompt 'musicPromptEn' tailored for Google Vids Audio (e.g. "Playful Anatolian folklore acoustic track, light rhythmic qanun and wooden flute, gentle comedic cadence, no vocals").

7. "Character Anchor Law (universal-rules.md U7 - Nasreddin Hodja Principle & Visual Style Harmony)":
   - If the narrative features a central or recurring figure/character (e.g. Nasreddin Hodja, a distinctive boy, a hero), define it once in 'characterAnchor'.
   - STYLE HARMONY MANDATE: The characterAnchor's 'masterVisualPromptEn' and 'fixedTraitsEn' MUST strictly match the selected visual mood ("${mood.label}")!
     * If 'stylized_3d': The character MUST be designed as a 3D animated character (Pixar / Unreal Engine 3D stylized character render, non-photorealistic stylized proportions), NEVER a live-action photo!
     * If 'retro_vintage_80s': 1980s retro vintage film aesthetic with warm analog halation and vintage wardrobe.
     * If 'moody_chiaroscuro': High-contrast chiaroscuro lighting, deep noir shadows and dramatic character framing.
     * If 'documentary_nature': Raw authentic environmental lighting and authentic candid textures.
     * If 'minimal_commercial': Ultra-clean modern commercial look, crisp studio lighting.
     * If 'cinematic_photoreal' or 'golden_hour': Photorealistic cinematic human portrait with organic film grain and natural light.
   - Detail 'fixedTraitsEn' (exact headwear/turban, clothing/robe color and fabric, beard type/hair, facial structure, footwear, accessories).
   - In EVERY scene prompt ('promptEn'), begin the character reference with these EXACT fixed traits so the AI cannot drift the character's face, clothing, or appearance between clips.

8. "Google Vids Omni Scene Independence & Voiceover Duration Law (STRICT)":
   - EXTEND (UZAT) IS FORBIDDEN: Every scene MUST have "actionType": "new_scene" and "durationSeconds": 10. Do NOT use "extend". Each clip will be generated independently and lined up onto the timeline sequentially.
   - VOICEOVER PACE LIMIT (CRITICAL): In Turkish natural speech, pacing is ~2.2 words/second. A 10-second scene CANNOT accommodate more than 18-20 words!
     * Each scene's 'voiceoverTr' MUST BE STRICTLY MAXIMUM 16-20 WORDS (~6-8 seconds spoken audio).
     * Leave 2 seconds buffer per scene for camera movement and breath, so voiceover NEVER overflows the 10-second clip!
   - Total video duration is scene_count * 10 seconds (~15s: 2 scenes [20s]; ~30s: 3 scenes [30s]; ~60s: 5-6 scenes [50-60s]).`;

  const userPrompt = `TOPIC / USER PROMPT: "${input.topic}"
BRAND: "${input.brandName || "General"}"
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
    "name": "Karakter adı (örn: Nasreddin Hoca veya Ana Karakter)",
    "archetypeTr": "Türkçe arketip (örn: Bilge halk filozofu, 60'lı yaşlar)",
    "masterVisualPromptEn": "Detailed character design prompt in English for generating the reference image",
    "fixedTraitsEn": "Exact recurring traits: white round turban, turquoise wool robe, full white beard, gentle smiling eyes"
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
      "voiceoverTr": "Etkili, akıcı ve hikayeyi anlatan Türkçe dış ses metni",
      "dialogueTr": "Varsa karakterin Türkçe repliği veya boş string",
      "audioCueEn": "Audio: flowing mountain creek, wind through weeping willows",
      "sfxCueEn": "SFX: (frantic water splashing at 2s)",
      "promptEn": "English dense physical prompt including fixedTraitsEn, followed by Audio, Says and SFX blocks..."
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
    const sceneCount = targetDur === "15s" ? 2 : targetDur === "60s" ? 5 : 3;
    const fallbackDuration = sceneCount * 10;
    return {
      title: input.topic.slice(0, 40),
      narrativeTr: "Doğal sinematik akış ve sahne devamlılığı.",
      narrativeMode,
      totalDurationSeconds: fallbackDuration,
      visualMood: moodKey,
      aspectRatio: ratio,
      scenes: Array.from({ length: sceneCount }).map((_, i) => ({
        sceneIndex: i + 1,
        shotType: i === 0 ? "establishing" : i === sceneCount - 1 ? "resolution_climax" : "action_development",
        durationSeconds: 10,
        actionType: "new_scene",
        cameraSetup: mood.lensInstruction,
        lightingSetup: mood.lightingInstruction,
        summaryTr: `Sahne ${i + 1} gelişimi`,
        voiceoverTr: `Etkili kısa anlatım cümlesi sahne ${i + 1}.`,
        promptEn: `A focused scene ${i + 1} of ${input.topic}, ${mood.lensInstruction}, ${mood.lightingInstruction}, smooth cinematic camera movement, ${mood.colorGrading}.`,
      })),
    };
  }

  // Ensure all scenes strictly enforce 10s and new_scene (no extend)
  parsed.scenes = parsed.scenes.map((sc, i) => ({
    ...sc,
    sceneIndex: i + 1,
    durationSeconds: 10,
    actionType: "new_scene",
  }));
  parsed.totalDurationSeconds = parsed.scenes.length * 10;

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

  const systemPrompt = `You are a world-class AI Film Director operating under the 'smixs/visual-skills' framework.
Your task is to RE-ROLL / RE-DIRECT exactly ONE SCENE (Scene ${input.sceneIndex}) inside an existing multi-scene sequence.

RULES:
1. Preserve continuity: Retain the existing character anchor traits (${sb.characterAnchor?.fixedTraitsEn || "consistent subject"}), narrative mode (${sb.narrativeMode || "hybrid"}), overall visual mood, and surrounding scene progression.
2. The Three-Detail Rule: Ensure the scene has concrete environmental pressure, body micro-actions, and sound/motif anchors.
3. "Google Vids Omni Scene Independence & Voiceover Pace Limit":
   - EXTEND (UZAT) IS FORBIDDEN: Scene actionType MUST be "new_scene" and durationSeconds: 10.
   - VOICEOVER WORD LIMIT: 'voiceoverTr' MUST BE MAXIMUM 16-20 WORDS (~6-8 seconds spoken audio). Never write more than 20 words per scene.
4. Audio/Dialogue Syntax: Use Veo official format: [Physical visual action/camera/light] + Audio: ... + Says: ... + SFX: ...
4. Follow Narrative Mode:
   - If 'voiceover_only', omit 'Says:' and focus on 'voiceoverTr'.
   - If 'dialogue_only', omit 'voiceoverTr' and focus on 'Says:' and 'dialogueTr'.
   - If 'hybrid', provide both.
5. BANNED LAZY WORDS: Never output "cinematic", "photorealistic", "8k", "masterpiece".
6. Return ONLY a valid JSON object matching the single ScriptScenePlan schema (no markdown, no array wrapping).`;

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

  return {
    ...targetScene,
    ...parsed,
    sceneIndex: targetScene.sceneIndex,
    durationSeconds: 10,
    actionType: "new_scene",
  };
}
