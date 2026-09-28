import path from "node:path";
import { isCanvaStudioEnabled } from "@/lib/server/canva-config";
import { deletePackageWithAssets } from "@/lib/server/canva-package-service";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; packageId: string }> };

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
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  asset_id: string;
  position: number;
  mime_type: string;
  width: number;
  height: number;
};

export async function GET(_request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();

  const pkg = database
    .prepare("SELECT * FROM media_packages WHERE id=? AND project_id=?")
    .get(packageId, projectId) as PackageRow | undefined;

  if (!pkg) {
    return Response.json({ ok: false, message: "Paket bulunamadı." }, { status: 404 });
  }

  const items = database
    .prepare(
      "SELECT id, asset_id, position, mime_type, width, height FROM media_package_items WHERE package_id=? ORDER BY position ASC"
    )
    .all(packageId) as unknown as ItemRow[];

  return Response.json({
    ok: true,
    package: {
      id: pkg.id,
      projectId: pkg.project_id,
      generationJobId: pkg.generation_job_id,
      source: pkg.source,
      packageType: pkg.package_type,
      title: pkg.title,
      coverAssetId: pkg.cover_asset_id,
      coverUrl: pkg.cover_asset_id ? `/api/assets/${pkg.cover_asset_id}` : "",
      itemCount: pkg.item_count,
      canvaDesignId: pkg.canva_design_id,
      canvaEditUrl: pkg.canva_edit_url,
      createdAt: pkg.created_at,
      items: items.map((i) => ({
        id: i.id,
        assetId: i.asset_id,
        position: i.position,
        mimeType: i.mime_type,
        width: i.width,
        height: i.height,
        url: `/api/assets/${i.asset_id}`,
      })),
    },
  });
}

export async function DELETE(_request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId, packageId } = await context.params;
  const database = getDatabase();
  const assetsDir = path.join(process.cwd(), ".data", "assets");

  const success = deletePackageWithAssets({
    database,
    packageId,
    projectId,
    assetsDir,
  });

  if (!success) {
    return Response.json({ ok: false, message: "Paket bulunamadı veya silinemedi." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
