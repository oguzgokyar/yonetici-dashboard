import { rerollSingleScene, type CinematicVisualMood, type StoryboardResponse } from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      sceneIndex?: number;
      currentStoryboard?: StoryboardResponse;
      userInstruction?: string;
      visualMood?: CinematicVisualMood;
    };

    if (!body.currentStoryboard || typeof body.sceneIndex !== "number") {
      return Response.json(
        { ok: false, message: "Geçerli bir senaryo ve sahne numarası gerekli." },
        { status: 400 }
      );
    }

    const updatedScene = await rerollSingleScene({
      topic: (body.topic || "").trim() || body.currentStoryboard.title,
      sceneIndex: body.sceneIndex,
      currentStoryboard: body.currentStoryboard,
      userInstruction: body.userInstruction,
      visualMood: body.visualMood,
    });

    return Response.json({
      ok: true,
      scene: updatedScene,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sahne yenilenirken hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
