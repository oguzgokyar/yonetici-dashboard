import { getDatabase } from "@/lib/server/database";
import {
  researchAndPlanRssStoryboard,
  scrapeArticleFromUrl,
} from "@/lib/server/rss-feed-research";
import type {
  RssAspectRatio,
  RssNarrativeStyleKey,
  RssStoryboard,
  RssTargetDuration,
  RssVisualMoodKey,
} from "@/features/generation/rss-video/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      sourceMode?: "rss" | "url" | "prompt";
      topicOrText?: string;
      sourceUrl?: string;
      narrativeStyle?: RssNarrativeStyleKey;
      visualMood?: RssVisualMoodKey;
      targetDuration?: RssTargetDuration;
      aspectRatio?: RssAspectRatio;
      revisionFeedback?: string;
      currentStoryboard?: RssStoryboard | null;
    };

    const db = getDatabase();
    const project = db
      .prepare("SELECT name, brand_json FROM projects WHERE id = ?")
      .get(projectId) as { name?: string; brand_json?: string } | undefined;

    if (!project) {
      return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
    }

    let brandName = project.name || "";
    let brandPrimaryColor = "#6d5dfc";
    try {
      const brand = JSON.parse(project.brand_json || "{}") as {
        brandName?: string;
        primaryColor?: string;
      };
      if (brand.brandName) brandName = brand.brandName;
      if (brand.primaryColor) brandPrimaryColor = brand.primaryColor;
    } catch {}

    const sourceMode = body.sourceMode || "prompt";
    let topicOrText = (body.topicOrText || "").trim();
    const sourceUrl =
      sourceMode === "prompt" ? undefined : (body.sourceUrl || "").trim() || undefined;
    let scrapedArticle: { title: string; text: string; url: string } | undefined;

    // Yalnızca kullanıcı bir konu/metin girmediyse ve URL/RSS modunda bir URL varsa makaleyi çek
    if (
      (sourceMode === "url" || sourceMode === "rss") &&
      sourceUrl &&
      !topicOrText
    ) {
      try {
        scrapedArticle = await scrapeArticleFromUrl(sourceUrl);
        topicOrText = `${scrapedArticle.title}\n\n${scrapedArticle.text}`;
      } catch (scrapeErr) {
        if (!topicOrText) {
          throw scrapeErr;
        }
      }
    }

    if (!topicOrText && !body.currentStoryboard) {
      return Response.json(
        {
          ok: false,
          message: "Lütfen araştırılacak bir konu, RSS haberi veya makale bağlantısı girin.",
        },
        { status: 400 }
      );
    }

    const storyboard = await researchAndPlanRssStoryboard({
      sourceMode,
      topicOrText: topicOrText || body.currentStoryboard?.title || "",
      sourceUrl,
      narrativeStyle: body.narrativeStyle || "news_bulletin",
      visualMood: body.visualMood || "cinematic_photoreal",
      targetDuration: body.targetDuration || "30s",
      aspectRatio: body.aspectRatio || "9:16",
      brandName,
      brandPrimaryColor,
      revisionFeedback: body.revisionFeedback,
      currentStoryboard: body.currentStoryboard,
    });

    return Response.json({
      ok: true,
      storyboard,
      scrapedArticle,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Senaryo araştırılırken bir hata oluştu.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
