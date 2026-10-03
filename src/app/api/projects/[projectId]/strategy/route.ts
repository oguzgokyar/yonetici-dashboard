import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  generateFullStrategyAndIdeas,
  ColumnType,
  StrategyIdea,
} from "@/lib/server/strategy-generator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const db = getDatabase()!;

  const strategyRow = db
    .prepare("SELECT * FROM project_brand_strategies WHERE project_id = ?")
    .get(projectId) as any;

  const ideasRows = db
    .prepare(
      "SELECT * FROM project_strategy_ideas WHERE project_id = ? ORDER BY created_at DESC"
    )
    .all(projectId) as any[];

  const columns: Record<ColumnType, { suggested: StrategyIdea[]; hidden: StrategyIdea[] }> = {
    vertical_video: { suggested: [], hidden: [] },
    carousel: { suggested: [], hidden: [] },
    single_post: { suggested: [], hidden: [] },
    engagement: { suggested: [], hidden: [] },
  };

  for (const row of ideasRows) {
    const colType = row.column_type as ColumnType;
    if (columns[colType]) {
      const idea: StrategyIdea = {
        id: row.id,
        columnType: colType,
        title: row.title,
        hook: row.hook,
        description: row.description,
        structure: JSON.parse(row.structure_json || "[]"),
        targetChannel: row.target_channel,
        skillSource: row.skill_source || "outlier-post-finder",
        status: row.status,
        createdAt: row.created_at,
      };
      if (row.status === "hidden") {
        columns[colType].hidden.push(idea);
      } else {
        columns[colType].suggested.push(idea);
      }
    }
  }

  if (!strategyRow) {
    // If not created yet, return project default info if exists
    const proj = db.prepare("SELECT name, brand_json FROM projects WHERE id = ?").get(projectId) as any;
    let brandDesc = "";
    if (proj?.brand_json) {
      try {
        const b = JSON.parse(proj.brand_json);
        brandDesc = b.description || b.concept || "";
      } catch {}
    }
    return NextResponse.json({
      success: true,
      hasStrategy: false,
      initialData: {
        brandName: proj?.name || "",
        brandDescription: brandDesc,
        socialChannels: ["Instagram", "TikTok", "YouTube"],
        competitors: [],
      },
      columns,
    });
  }

  return NextResponse.json({
    success: true,
    hasStrategy: true,
    strategy: {
      brandName: strategyRow.brand_name,
      brandDescription: strategyRow.brand_description,
      socialChannels: JSON.parse(strategyRow.social_channels_json || "[]"),
      competitors: JSON.parse(strategyRow.competitors_json || "[]"),
      brandIdentity: JSON.parse(strategyRow.brand_identity_json || "{}"),
      competitorAnalysis: JSON.parse(strategyRow.competitor_analysis_json || "{}"),
      audienceVoc: JSON.parse(strategyRow.audience_voc_json || "{}"),
      growthStrategy: JSON.parse(strategyRow.growth_strategy_json || "{}"),
      generationStatus: strategyRow.generation_status || "idle",
      currentRunId: strategyRow.current_run_id || "",
      engineType: strategyRow.engine_type || "Hermes Agent",
      skillsUsed: JSON.parse(strategyRow.skills_used_json || "[]"),
      updatedAt: strategyRow.updated_at,
    },
    columns,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const brandName = (body.brandName || "").trim();
  const brandDescription = (body.brandDescription || "").trim();
  const socialChannels = Array.isArray(body.socialChannels) ? body.socialChannels : ["Instagram", "TikTok", "YouTube"];
  const competitors = Array.isArray(body.competitors) ? body.competitors : [];

  const db = getDatabase()!;
  const now = new Date().toISOString();

  // 1. Update brand strategy inputs
  db.prepare(`
    INSERT INTO project_brand_strategies (
      project_id, brand_name, brand_description, social_channels_json, competitors_json,
      brand_identity_json, competitor_analysis_json, audience_voc_json, growth_strategy_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, '{}', '{}', '{}', '{}', ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      brand_name = excluded.brand_name,
      brand_description = excluded.brand_description,
      social_channels_json = excluded.social_channels_json,
      competitors_json = excluded.competitors_json,
      updated_at = excluded.updated_at
  `).run(
    projectId,
    brandName,
    brandDescription,
    JSON.stringify(socialChannels),
    JSON.stringify(competitors),
    now,
    now
  );

  // 2. Also update projects table brand_json so this project-wide context persists
  try {
    const proj = db.prepare("SELECT brand_json FROM projects WHERE id = ?").get(projectId) as any;
    if (proj?.brand_json) {
      const brandObj = JSON.parse(proj.brand_json || "{}");
      if (brandName) brandObj.brandName = brandName;
      brandObj.description = brandDescription;
      db.prepare("UPDATE projects SET brand_json = ? WHERE id = ?").run(JSON.stringify(brandObj), projectId);
    }
  } catch (e) {
    console.error("[Save Project Brand JSON Error]", e);
  }

  return NextResponse.json({
    success: true,
    message: "Marka ve niş bilgileri başarıyla kaydedildi.",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const db = getDatabase()!;

  // Concurrency Guard: Check if another generation is currently in-flight
  const existing = db
    .prepare("SELECT generation_status FROM project_brand_strategies WHERE project_id = ?")
    .get(projectId) as { generation_status?: string } | undefined;

  if (existing?.generation_status === "generating") {
    return NextResponse.json(
      { success: false, error: "Strateji üretimi şu anda devam ediyor. Lütfen tamamlanmasını bekleyin." },
      { status: 409 }
    );
  }

  const body = await request.json();
  const brandName = (body.brandName || "").trim();
  const brandDescription = (body.brandDescription || "").trim();
  const socialChannels = Array.isArray(body.socialChannels) ? body.socialChannels : ["Instagram", "TikTok", "YouTube"];
  const competitors = Array.isArray(body.competitors) ? body.competitors : [];

  if (!brandName) {
    return NextResponse.json({ success: false, error: "Marka adı zorunludur." }, { status: 400 });
  }

  // Set status to generating immediately so refresh/concurrency is blocked
  const lockTime = new Date().toISOString();
  db.prepare(`
    INSERT INTO project_brand_strategies (
      project_id, brand_name, brand_description, social_channels_json, competitors_json,
      generation_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'generating', ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      generation_status = 'generating',
      updated_at = excluded.updated_at
  `).run(projectId, brandName, brandDescription, JSON.stringify(socialChannels), JSON.stringify(competitors), lockTime, lockTime);

  try {
    const fullResult = await generateFullStrategyAndIdeas({
      brandName,
      brandDescription,
      socialChannels,
      competitors,
    });

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE project_brand_strategies SET
        brand_name = ?,
        brand_description = ?,
        social_channels_json = ?,
        competitors_json = ?,
        brand_identity_json = ?,
        competitor_analysis_json = ?,
        audience_voc_json = ?,
        growth_strategy_json = ?,
        generation_status = 'completed',
        current_run_id = ?,
        engine_type = ?,
        skills_used_json = ?,
        updated_at = ?
      WHERE project_id = ?
    `).run(
      brandName,
      brandDescription,
      JSON.stringify(socialChannels),
      JSON.stringify(competitors),
      JSON.stringify(fullResult.overview.brandIdentity),
      JSON.stringify(fullResult.overview.competitorAnalysis),
      JSON.stringify(fullResult.overview.audienceVoc),
      JSON.stringify(fullResult.overview.growthStrategy),
      fullResult.runId,
      fullResult.engineType,
      JSON.stringify(fullResult.skillsUsed),
      now,
      projectId
    );

    // Also update project's brand_json so the new brandDescription & valueProposition persist globally
    try {
      const proj = db.prepare("SELECT brand_json FROM projects WHERE id = ?").get(projectId) as any;
      if (proj?.brand_json) {
        const brandObj = JSON.parse(proj.brand_json || "{}");
        brandObj.brandName = brandName;
        brandObj.description = brandDescription;
        db.prepare("UPDATE projects SET brand_json = ? WHERE id = ?").run(JSON.stringify(brandObj), projectId);
      }
    } catch (e) {
      console.error("[Update Project Brand JSON Error]", e);
    }

    // Insert ideas
    const insertIdeaStmt = db.prepare(`
      INSERT INTO project_strategy_ideas (
        id, project_id, column_type, title, hook, description, structure_json, target_channel, skill_source, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outlier-post-finder', 'suggested', ?, ?)
    `);

    for (const [colType, items] of Object.entries(fullResult.ideas)) {
      for (const item of items) {
        insertIdeaStmt.run(
          crypto.randomUUID(),
          projectId,
          colType,
          item.title,
          item.hook || "",
          item.description || "",
          JSON.stringify(item.structure || []),
          item.targetChannel || "",
          now,
          now
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Strateji ve içerik fikirleri başarıyla oluşturuldu.",
      overview: fullResult.overview,
      engineType: fullResult.engineType,
      runId: fullResult.runId,
      skillsUsed: fullResult.skillsUsed,
    });
  } catch (error: any) {
    console.error("[Generate Strategy Error]", error);
    db.prepare("UPDATE project_brand_strategies SET generation_status = 'failed', updated_at = ? WHERE project_id = ?")
      .run(new Date().toISOString(), projectId);
    return NextResponse.json({ success: false, error: error.message || "Strateji üretilemedi." }, { status: 500 });
  }
}

// DELETE: Stratejiyi ve fikirleri tamamen sıfırla
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const db = getDatabase()!;

  // 1. Delete all ideas
  db.prepare("DELETE FROM project_strategy_ideas WHERE project_id = ?").run(projectId);

  // 2. Reset strategy fields
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE project_brand_strategies SET
      brand_identity_json = '{}',
      competitor_analysis_json = '{}',
      audience_voc_json = '{}',
      growth_strategy_json = '{}',
      generation_status = 'idle',
      current_run_id = '',
      skills_used_json = '[]',
      updated_at = ?
    WHERE project_id = ?
  `).run(now, projectId);

  return NextResponse.json({
    success: true,
    message: "Strateji ve içerik fikirleri başarıyla sıfırlandı.",
  });
}
