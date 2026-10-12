import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  generateNewIdeasForColumn,
  generateIdeasAcrossAllColumns,
  COLUMN_AGENCY_SPECS,
  ColumnType,
  IdeaType,
} from "@/lib/server/strategy-generator";

export const runtime = "nodejs";

// PUT / PATCH: Update status of an idea (suggested <-> hidden)
async function handleUpdateStatus(
  request: NextRequest,
  params: Promise<{ projectId: string }>
) {
  const { projectId } = await params;
  const body = await request.json();
  const ideaId = body.ideaId;

  if (!ideaId) {
    return NextResponse.json({ success: false, error: "ideaId gereklidir." }, { status: 400 });
  }

  const db = getDatabase()!;
  const row = db.prepare(
    "SELECT id, status FROM project_strategy_ideas WHERE id = ? AND project_id = ?"
  ).get(ideaId, projectId) as { id: string; status: string } | undefined;

  let nextStatus: string;
  if (body.action === "toggle_hide" || !body.status) {
    nextStatus = row?.status === "hidden" ? "suggested" : "hidden";
  } else if (["suggested", "hidden"].includes(body.status)) {
    nextStatus = body.status;
  } else {
    return NextResponse.json({ success: false, error: "Geçersiz durum değeri." }, { status: 400 });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE project_strategy_ideas 
    SET status = ?, updated_at = ? 
    WHERE id = ? AND project_id = ?
  `).run(nextStatus, now, ideaId, projectId);

  return NextResponse.json({
    success: true,
    status: nextStatus,
    message: `Fikir durumu '${nextStatus}' olarak güncellendi.`,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return handleUpdateStatus(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return handleUpdateStatus(request, params);
}

// POST: Generate NEW ideas for a specific column OR across ALL columns (Fikir Makinesi)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const scope = body.scope || "single_column"; // 'single_column' | 'all_columns'
  const columnType = (body.columnType || "vertical_video") as ColumnType;
  const focusTopic = (body.focusTopic || "").trim();
  const ideaType = (body.ideaType || "").trim() as IdeaType | "";

  if (scope === "single_column" && !["vertical_video", "carousel", "single_post", "engagement"].includes(columnType)) {
    return NextResponse.json({ success: false, error: "Geçersiz kolon tipi." }, { status: 400 });
  }

  const db = getDatabase()!;
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO project_strategy_ideas (
      id, project_id, column_type, title, hook, description, structure_json, target_channel, idea_type, skill_source, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)
  `);

  try {
    // SENARYO 0: ASİSTAN VEYA DOĞRUDAN TEKİL FİKİR EKLEME (insert_single_idea)
    if (scope === "insert_single_idea" && body.idea) {
      const item = body.idea;
      const targetCol = (item.columnType || "vertical_video") as ColumnType;
      const id = crypto.randomUUID();
      const skillSrc = item.skillSource || (COLUMN_AGENCY_SPECS[targetCol]?.agentSlug || "marketing-tiktok-strategist");
      insertStmt.run(
        id,
        projectId,
        targetCol,
        (item.title || "Yeni İçerik Fikri").trim(),
        item.hook || "",
        item.description || "",
        JSON.stringify(Array.isArray(item.structure) ? item.structure : []),
        item.targetChannel || "",
        item.ideaType || "problem_solution",
        skillSrc,
        now,
        now
      );
      return NextResponse.json({
        success: true,
        scope: "insert_single_idea",
        message: "Fikir strateji panosuna başarıyla eklendi.",
        idea: {
          id,
          columnType: targetCol,
          title: item.title,
          hook: item.hook,
          description: item.description,
          structure: Array.isArray(item.structure) ? item.structure : [],
          targetChannel: item.targetChannel,
          ideaType: item.ideaType || "problem_solution",
          skillSource: skillSrc,
          status: "suggested",
          createdAt: now,
        },
      });
    }

    const strategyRow = db.prepare("SELECT * FROM project_brand_strategies WHERE project_id = ?").get(projectId) as {
      brand_name: string;
      brand_description: string;
      brand_identity_json: string;
      competitor_analysis_json: string;
      audience_voc_json: string;
      growth_strategy_json: string;
    } | undefined;
    if (!strategyRow) {
      return NextResponse.json({ success: false, error: "Önce marka stratejisi oluşturulmalıdır." }, { status: 400 });
    }

    const strategyContext = {
      brandIdentity: JSON.parse(strategyRow.brand_identity_json || "{}"),
      competitorAnalysis: JSON.parse(strategyRow.competitor_analysis_json || "{}"),
      audienceVoc: JSON.parse(strategyRow.audience_voc_json || "{}"),
      growthStrategy: JSON.parse(strategyRow.growth_strategy_json || "{}"),
    };

    // SENARYO 1: TÜM KOLONLAR (FİKİR MAKİNESİ)
    if (scope === "all_columns") {
      const allNewIdeas = await generateIdeasAcrossAllColumns({
        brandName: strategyRow.brand_name,
        brandDescription: strategyRow.brand_description,
        focusTopic,
        ideaType,
        strategyContext,
      });

      const insertedMap: Record<ColumnType, any[]> = {
        vertical_video: [],
        carousel: [],
        single_post: [],
        engagement: [],
      };

      let totalCount = 0;
      for (const col of ["vertical_video", "carousel", "single_post", "engagement"] as ColumnType[]) {
        const items = allNewIdeas[col] || [];
        for (const item of items) {
          const id = crypto.randomUUID();
          const skillSrc = item.skillSource || (COLUMN_AGENCY_SPECS[col]?.agentSlug || "outlier-post-finder");
          insertStmt.run(
            id,
            projectId,
            col,
            item.title,
            item.hook || "",
            item.description || "",
            JSON.stringify(item.structure || []),
            item.targetChannel || "",
            item.ideaType || ideaType || "problem_solution",
            skillSrc,
            now,
            now
          );
          insertedMap[col].push({
            ...item,
            id,
            columnType: col,
            skillSource: skillSrc,
            ideaType: item.ideaType || ideaType || "problem_solution",
            status: "suggested",
          });
          totalCount++;
        }
      }

      return NextResponse.json({
        success: true,
        scope: "all_columns",
        message: `Fikir Makinesi: 4 kolona toplam ${totalCount} yeni fikir eklendi.`,
        ideasByColumn: insertedMap,
      });
    }

    // SENARYO 2: TEKİL KOLON (+ Yeni Fikir İste)
    // Get existing titles for this column to avoid duplicates
    const existingRows = db.prepare(`
      SELECT title FROM project_strategy_ideas 
      WHERE project_id = ? AND column_type = ?
    `).all(projectId, columnType) as { title: string }[];
    const existingTitles = existingRows.map((r) => r.title);

    const newIdeas = await generateNewIdeasForColumn({
      brandName: strategyRow.brand_name,
      brandDescription: strategyRow.brand_description,
      columnType,
      existingTitles,
      focusTopic,
      ideaType,
      strategyContext,
    });

    const insertedIdeas = [];
    for (const item of newIdeas) {
      const id = crypto.randomUUID();
      const skillSrc = item.skillSource || (COLUMN_AGENCY_SPECS[columnType]?.agentSlug || "outlier-post-finder");
      insertStmt.run(
        id,
        projectId,
        columnType,
        item.title,
        item.hook || "",
        item.description || "",
        JSON.stringify(item.structure || []),
        item.targetChannel || "",
        item.ideaType || ideaType || "problem_solution",
        skillSrc,
        now,
        now
      );
      insertedIdeas.push({
        ...item,
        id,
        columnType,
        skillSource: skillSrc,
        ideaType: item.ideaType || ideaType || "problem_solution",
        status: "suggested" as const,
      });
    }

    return NextResponse.json({
      success: true,
      scope: "single_column",
      message: `${newIdeas.length} yeni fikir eklendi.`,
      ideas: insertedIdeas,
      columnType,
    });
  } catch (error: unknown) {
    console.error("[Generate Column Ideas Error]", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Fikir üretilemedi." }, { status: 500 });
  }
}
