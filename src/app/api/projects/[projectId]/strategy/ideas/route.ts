import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  generateNewIdeasForColumn,
  ColumnType,
} from "@/lib/server/strategy-generator";

export const runtime = "nodejs";

// PUT: Update status of an idea (suggested <-> hidden)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const ideaId = body.ideaId;
  const newStatus = body.status; // 'suggested' or 'hidden'

  if (!ideaId || !["suggested", "hidden"].includes(newStatus)) {
    return NextResponse.json({ success: false, error: "Geçersiz parametre." }, { status: 400 });
  }

  const db = getDatabase()!;
  db.prepare(`
    UPDATE project_strategy_ideas 
    SET status = ?, updated_at = ? 
    WHERE id = ? AND project_id = ?
  `).run(newStatus, new Date().toISOString(), ideaId, projectId);

  return NextResponse.json({ success: true, message: "Fikir durumu güncellendi." });
}

// POST: Generate NEW ideas for a specific column
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const columnType = body.columnType as ColumnType;

  if (!["vertical_video", "carousel", "single_post", "engagement"].includes(columnType)) {
    return NextResponse.json({ success: false, error: "Geçersiz kolon tipi." }, { status: 400 });
  }

  const db = getDatabase()!;
  const strategyRow = db.prepare("SELECT * FROM project_brand_strategies WHERE project_id = ?").get(projectId) as any;
  if (!strategyRow) {
    return NextResponse.json({ success: false, error: "Önce marka stratejisi oluşturulmalıdır." }, { status: 400 });
  }

  // Get existing titles for this column to avoid duplicates
  const existingRows = db.prepare(`
    SELECT title FROM project_strategy_ideas 
    WHERE project_id = ? AND column_type = ?
  `).all(projectId, columnType) as { title: string }[];
  const existingTitles = existingRows.map((r) => r.title);

  try {
    const newIdeas = await generateNewIdeasForColumn({
      brandName: strategyRow.brand_name,
      brandDescription: strategyRow.brand_description,
      columnType,
      existingTitles,
      strategyContext: {
        brandIdentity: JSON.parse(strategyRow.brand_identity_json || "{}"),
        competitorAnalysis: JSON.parse(strategyRow.competitor_analysis_json || "{}"),
        audienceVoc: JSON.parse(strategyRow.audience_voc_json || "{}"),
        growthStrategy: JSON.parse(strategyRow.growth_strategy_json || "{}"),
      },
    });

    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO project_strategy_ideas (
        id, project_id, column_type, title, hook, description, structure_json, target_channel, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)
    `);

    const insertedIdeas = [];
    for (const item of newIdeas) {
      const id = crypto.randomUUID();
      insertStmt.run(
        id,
        projectId,
        columnType,
        item.title,
        item.hook || "",
        item.description || "",
        JSON.stringify(item.structure || []),
        item.targetChannel || "",
        now,
        now
      );
      insertedIdeas.push({ ...item, id });
    }

    return NextResponse.json({
      success: true,
      message: `${newIdeas.length} yeni fikir eklendi.`,
      ideas: insertedIdeas,
    });
  } catch (error: any) {
    console.error("[Generate Column Ideas Error]", error);
    return NextResponse.json({ success: false, error: error.message || "Fikir üretilemedi." }, { status: 500 });
  }
}
