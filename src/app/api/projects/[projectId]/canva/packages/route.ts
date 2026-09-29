import { isCanvaStudioEnabled } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

type PackageRow = {
  id: string;
  project_id: string;
  generation_job_id: string;
  source: string;
  package_type: string;
  title: string;
  cover_asset_id: string;
  item_count: number;
  canva_design_id: string;
  canva_edit_url: string;
  metadata_json: string;
  video_asset_id?: string | null;
  video_url?: string | null;
  video_duration?: number | null;
  created_at: string;
  updated_at: string;
  items_json?: string;
};

export async function GET(_request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const database = getDatabase();

  const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const rows = database
    .prepare(`
      SELECT p.*,
        g.prompt as job_prompt,
        (
          SELECT json_group_array(
            json_object(
              'id', i.id,
              'assetId', i.asset_id,
              'position', i.position,
              'mimeType', i.mime_type,
              'width', i.width,
              'height', i.height,
              'url', '/api/assets/' || i.asset_id
            )
          )
          FROM media_package_items i
          WHERE i.package_id = p.id
          ORDER BY i.position ASC
        ) as items_json
      FROM media_packages p
      LEFT JOIN generation_jobs g ON g.id = p.generation_job_id
      WHERE p.project_id = ?
      ORDER BY p.created_at DESC
      LIMIT 100
    `)
    .all(projectId) as unknown as (PackageRow & { job_prompt?: string })[];

  const packages = rows.map((row) => {
    let items = [];
    try {
      items = JSON.parse(row.items_json || "[]");
    } catch {
      // ignore
    }

    return {
      id: row.id,
      projectId: row.project_id,
      generationJobId: row.generation_job_id,
      source: row.source,
      packageType: row.package_type,
      title: row.title,
      prompt: row.job_prompt || "",
      coverAssetId: row.cover_asset_id,
      coverUrl: row.cover_asset_id ? `/api/assets/${row.cover_asset_id}` : "",
      itemCount: row.item_count,
      canvaDesignId: row.canva_design_id,
      canvaEditUrl: row.canva_edit_url,
      videoAssetId: row.video_asset_id || null,
      videoUrl: row.video_url || null,
      videoDuration: row.video_duration || null,
      createdAt: row.created_at,
      items,
    };
  });

  return Response.json({ ok: true, packages });
}
