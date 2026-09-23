import { getDatabase } from "@/lib/server/database";
import { listDriveFolders } from "@/lib/server/google-drive";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const parentFolderId = url.searchParams.get("parentId")?.trim() || undefined;

  try {
    const folders = await listDriveFolders(projectId, parentFolderId);
    return Response.json({ ok: true, folders });
  } catch (err) {
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const body = (await request.json().catch(() => ({}))) as {
    rootFolderId?: string;
    rootFolderName?: string;
    includeSubfolders?: boolean;
  };

  const rootFolderId = body.rootFolderId?.trim() || "";
  const rootFolderName = body.rootFolderName?.trim() || "";
  const includeSubfolders = body.includeSubfolders !== false ? 1 : 0;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO stock_drive_configs (
      project_id, root_folder_id, root_folder_name, folder_id, folder_name, include_subfolders, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      root_folder_id = excluded.root_folder_id,
      root_folder_name = excluded.root_folder_name,
      folder_id = excluded.root_folder_id,
      folder_name = excluded.root_folder_name,
      include_subfolders = excluded.include_subfolders,
      updated_at = excluded.updated_at
  `).run(projectId, rootFolderId, rootFolderName, rootFolderId, rootFolderName, includeSubfolders, now);

  return Response.json({
    ok: true,
    message: rootFolderName
      ? `Ana dizin '${rootFolderName}' olarak belirlendi.`
      : "Ana dizin sıfırlandı.",
    config: {
      rootFolderId,
      rootFolderName,
      includeSubfolders: Boolean(includeSubfolders),
    },
  });
}
