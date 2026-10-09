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

export interface ScriptScenePlan {
  sceneIndex: number;
  shotType: "establishing" | "action_development" | "resolution_climax";
  durationSeconds: number; // 10 veya 20
  actionType: "new_scene" | "extend"; // Google Vids'te yeni sahne mi yoksa uzatma (Extend) mi?
  cameraSetup: string; // örn: "35mm anamorphic, slow push-in"
  lightingSetup: string; // örn: "Low-angle golden hour rim light"
  summaryTr: string; // Kullanıcının arayüzde Türkçe göreceği özet
  promptEn: string; // Google Vids Omni'ye gönderilecek katı İngilizce prompt
}

export interface StoryboardResponse {
  title: string;
  narrativeTr: string;
  totalDurationSeconds: number;
  visualMood: CinematicVisualMood;
  aspectRatio: "9:16" | "16:9" | "1:1";
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

  const systemPrompt = `You are a world-class AI Film Director and Dramaturge operating under the 'smixs/visual-skills' framework.
Your specialty is directing Google Vids Omni / Veo cinematic video generators.

CORE LAWS YOU MUST ENFORCE:
1. "Dramaturgy first, syntax second":
   - BANNED LAZY ADJECTIVES: Never output words like "cinematic", "photorealistic", "ultra realistic", "8k", "masterpiece", "stunning", "epic".
   - Instead, translate emotion into physical body micro-actions, motivated camera movement, exact focal lengths, and environmental pressure.
2. "The Three-Detail Rule per Shot":
   - Environmental pressure (e.g. rain reflecting neon, cold blue light, golden dust motes in wind).
   - Physical micro-action / body choreography (e.g. paws gripping soft soil, jaw locks, subtle breath).
   - Spatial geometry and camera motivation (e.g. 50mm lens push-in, low-angle tracking).
3. "Google Vids Omni Physical Realities":
   - Base clip duration is 10 seconds. An initial clip can be extended with "+ Uzat (Extend)" into 20 seconds.
   - For ~15s video: Deliver 1 or 2 scenes totaling 15-20s.
   - For ~30s video: Deliver either 2 scenes (10s Scene 1 + 20s Extended Scene 2) or 3 scenes (10s + 10s + 10s) totaling 30s.
   - For ~60s video: Deliver 3 to 4 scenes totaling 45-60s.
   - For each scene, specify actionType: 'new_scene' (creates a fresh scene on timeline) or 'extend' (extends previous clip seamlessly).
4. Language Requirement:
   - 'summaryTr' and 'narrativeTr' must be in natural, evocative Turkish.
   - 'promptEn' MUST be strictly in English, concise (40-90 words), dense with physical facts, optical lens terms, lighting and subject blocking.`;

  const userPrompt = `TOPIC / USER PROMPT: "${input.topic}"
BRAND: "${input.brandName || "General"}"
TARGET DURATION: ${targetDur} (Approximate desired length)
ASPECT RATIO: ${ratio}
SELECTED VISUAL STYLE: ${mood.label}
- Lighting Style: ${mood.lightingInstruction}
- Lens / Camera Style: ${mood.lensInstruction}
- Color Grading: ${mood.colorGrading}

${input.revisionFeedback ? `USER REVISION FEEDBACK: "${input.revisionFeedback}"\nPlease revise the previous storyboard while preserving the overall continuity and fixing the requested points.` : ""}
${input.currentStoryboard ? `EXISTING STORYBOARD TO REFINE: ${JSON.stringify(input.currentStoryboard)}` : ""}

TASK:
Determine the optimal scene count, timing rhythm (10s vs 20s extend), and write the exact physical English prompt for Google Vids Omni.

Return ONLY a valid JSON object matching this schema (no markdown fences, no conversational text):
{
  "title": "Short catchy title in Turkish",
  "narrativeTr": "1-2 sentence dramatic narrative summary in Turkish explaining the core emotion and conflict",
  "totalDurationSeconds": 30,
  "visualMood": "${moodKey}",
  "aspectRatio": "${ratio}",
  "scenes": [
    {
      "sceneIndex": 1,
      "shotType": "establishing",
      "durationSeconds": 10,
      "actionType": "new_scene",
      "cameraSetup": "Wide angle 35mm, slow steady tracking",
      "lightingSetup": "Warm sunset backlight with natural dust haze",
      "summaryTr": "Sahne 1 Türkçe kısa özeti",
      "promptEn": "English dense physical prompt without filler adjectives..."
    }
  ]
}`;

  const { content } = await completeText(systemPrompt, userPrompt, {
    temperature: 0.65,
    maxTokens: 2500,
  });

  const parsed = parseJsonResponse<StoryboardResponse>(content);

  // Validate or apply fallback if parsed result is incomplete
  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    const fallbackDuration = targetDur === "15s" ? 15 : targetDur === "60s" ? 60 : 30;
    return {
      title: input.topic.slice(0, 40),
      narrativeTr: "Doğal sinematik akış ve sahne devamlılığı.",
      totalDurationSeconds: fallbackDuration,
      visualMood: moodKey,
      aspectRatio: ratio,
      scenes: [
        {
          sceneIndex: 1,
          shotType: "establishing",
          durationSeconds: 10,
          actionType: "new_scene",
          cameraSetup: mood.lensInstruction,
          lightingSetup: mood.lightingInstruction,
          summaryTr: "Açılış ve ana konunun kadraja girişi",
          promptEn: `A focused scene of ${input.topic}, ${mood.lensInstruction}, ${mood.lightingInstruction}, smooth cinematic camera movement, ${mood.colorGrading}.`,
        },
        {
          sceneIndex: 2,
          shotType: "resolution_climax",
          durationSeconds: fallbackDuration > 10 ? fallbackDuration - 10 : 10,
          actionType: fallbackDuration > 20 ? "new_scene" : "extend",
          cameraSetup: mood.lensInstruction,
          lightingSetup: mood.lightingInstruction,
          summaryTr: "Gelişme ve hikaye finali",
          promptEn: `Continuation of ${input.topic}, showing the decisive movement and resolution, ${mood.lensInstruction}, ${mood.lightingInstruction}, steady camera holding on final composition.`,
        },
      ],
    };
  }

  return parsed;
}
