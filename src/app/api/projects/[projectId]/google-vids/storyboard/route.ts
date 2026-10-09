import { getDatabase } from "@/lib/server/database";
import {
  planCinematicStoryboard,
  type CinematicVisualMood,
  type TargetDurationRange,
  type StoryboardResponse,
} from "@/lib/server/cinematic-prompt-director";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      visualMood?: CinematicVisualMood;
      targetDuration?: TargetDurationRange;
      aspectRatio?: "9:16" | "16:9" | "1:1";
      revisionFeedback?: string;
      currentStoryboard?: StoryboardResponse;
    };

    const topic = (body.topic || "").trim();
    if (!topic) {
      return Response.json(
        { ok: false, message: "Lütfen bir video konusu veya fikri girin." },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const project = db
      .prepare("SELECT name, brand_json FROM projects WHERE id = ?")
      .get(projectId) as { name?: string; brand_json?: string } | undefined;

    if (!project) {
      return Response.json(
        { ok: false, message: "Proje bulunamadı." },
        { status: 404 }
      );
    }

    let brandName = project.name || "";
    try {
      const brand = JSON.parse(project.brand_json || "{}") as { brandName?: string };
      if (brand.brandName) brandName = brand.brandName;
    } catch {
      // ignore
    }

    const storyboard = await planCinematicStoryboard({
      topic,
      visualMood: body.visualMood,
      targetDuration: body.targetDuration,
      aspectRatio: body.aspectRatio,
      brandName,
      revisionFeedback: body.revisionFeedback,
      currentStoryboard: body.currentStoryboard,
    });

    return Response.json({
      ok: true,
      storyboard,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Senaryo oluşturulurken hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
