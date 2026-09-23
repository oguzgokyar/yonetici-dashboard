import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { getAllFolderIdsUnderRoot, listDriveFolders, listDriveVideos } from "@/lib/server/google-drive";

export const runtime = "nodejs";
export const maxDuration = 300;

type StockVideoRow = {
  id: string;
  project_id: string;
  drive_file_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  width: number;
  height: number;
  local_path: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type DriveConfigRow = {
  project_id: string;
  account_id?: string;
  folder_id: string;
  folder_name: string;
  root_folder_id?: string;
  root_folder_name?: string;
  include_subfolders?: number;
  last_synced_at: string | null;
  sync_status: string;
  error_message: string | null;
  updated_at: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 200);

  // Get drive config
  const config = db
    .prepare("SELECT * FROM stock_drive_configs WHERE project_id = ?")
    .get(projectId) as unknown as DriveConfigRow | undefined;

  let query = "SELECT * FROM stock_videos WHERE project_id = ?";
  const params: (string | number)[] = [projectId];

  if (search) {
    query += " AND name LIKE ?";
    params.push(`%${search}%`);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(query).all(...params) as unknown as StockVideoRow[];

  const countRow = db
    .prepare("SELECT COUNT(*) as total FROM stock_videos WHERE project_id = ?")
    .get(projectId) as { total: number } | undefined;

  return Response.json({
    ok: true,
    total: countRow?.total || 0,
    config: config
      ? {
          accountId: config.account_id || "",
          folderId: config.folder_id,
          folderName: config.folder_name,
          rootFolderId: config.root_folder_id || config.folder_id,
          rootFolderName: config.root_folder_name || config.folder_name,
          includeSubfolders: config.include_subfolders !== 0,
          lastSyncedAt: config.last_synced_at,
          syncStatus: config.sync_status,
        }
      : null,
    videos: rows.map((r) => ({
      id: r.id,
      driveFileId: r.drive_file_id,
      name: r.name,
      sizeBytes: r.size_bytes,
      mimeType: r.mime_type,
      thumbnailUrl: r.thumbnail_url || undefined,
      durationSeconds: r.duration_seconds || 0,
      width: r.width || 0,
      height: r.height || 0,
      hasCache: Boolean(r.local_path),
      streamUrl: `/api/projects/${projectId}/stock-videos/${r.id}`,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    folderId?: string;
    folderName?: string;
    rootFolderId?: string;
    rootFolderName?: string;
    includeSubfolders?: boolean;
  };

  const action = body.action || "sync";

  if (action === "list_folders") {
    try {
      const folders = await listDriveFolders(projectId);
      return Response.json({ ok: true, folders });
    } catch (err) {
      return Response.json(
        { ok: false, message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  if (action === "set_folder") {
    const folderId = body.folderId?.trim() || body.rootFolderId?.trim() || "";
    const folderName = body.folderName?.trim() || body.rootFolderName?.trim() || "";
    const rootFolderId = body.rootFolderId?.trim() || folderId;
    const rootFolderName = body.rootFolderName?.trim() || folderName;
    const includeSubfolders = body.includeSubfolders !== false ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stock_drive_configs (
        project_id, folder_id, folder_name, root_folder_id, root_folder_name, include_subfolders, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        folder_id = excluded.folder_id,
        folder_name = excluded.folder_name,
        root_folder_id = excluded.root_folder_id,
        root_folder_name = excluded.root_folder_name,
        include_subfolders = excluded.include_subfolders,
        updated_at = excluded.updated_at
    `).run(projectId, folderId, folderName, rootFolderId, rootFolderName, includeSubfolders, now);

    return Response.json({ ok: true, folderId, folderName, rootFolderId, rootFolderName });
  }

  if (action === "sync") {
    const config = db
      .prepare("SELECT * FROM stock_drive_configs WHERE project_id = ?")
      .get(projectId) as unknown as DriveConfigRow | undefined;

    const targetRootId = body.rootFolderId?.trim() || config?.root_folder_id || body.folderId?.trim() || config?.folder_id || "";
    const includeSubfolders = config?.include_subfolders !== 0;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, folder_id, folder_name, root_folder_id, root_folder_name, sync_status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'syncing', ?)
      ON CONFLICT(project_id) DO UPDATE SET
        sync_status = 'syncing',
        updated_at = excluded.updated_at
    `).run(
      projectId,
      targetRootId,
      config?.folder_name || "",
      targetRootId,
      config?.root_folder_name || config?.folder_name || "",
      now
    );

    try {
      let targetFolderIds: string[] | undefined;

      // If a root folder is selected, collect its tree if includeSubfolders is on
      if (targetRootId) {
        if (includeSubfolders) {
          targetFolderIds = await getAllFolderIdsUnderRoot(projectId, targetRootId);
        } else {
          targetFolderIds = [targetRootId];
        }
      }

      // List videos from Drive
      const { files } = await listDriveVideos({
        projectId,
        folderIds: targetFolderIds,
        pageSize: 100,
      });

      let addedCount = 0;
      let updatedCount = 0;

      const insertStmt = db.prepare(`
        INSERT INTO stock_videos (
          id, project_id, drive_file_id, name, size_bytes, mime_type,
          thumbnail_url, duration_seconds, width, height, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, drive_file_id) DO UPDATE SET
          name = excluded.name,
          size_bytes = excluded.size_bytes,
          thumbnail_url = excluded.thumbnail_url,
          duration_seconds = excluded.duration_seconds,
          width = excluded.width,
          height = excluded.height,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `);

      for (const file of files) {
        const id = crypto.randomUUID();
        const res = insertStmt.run(
          id,
          projectId,
          file.id,
          file.name,
          file.size || 0,
          file.mimeType,
          file.thumbnailLink || "",
          file.durationSeconds || 0,
          file.width || 0,
          file.height || 0,
          JSON.stringify({ parents: file.parents || [] }),
          now,
          now
        );
        if (res.changes > 0) {
          addedCount++;
        } else {
          updatedCount++;
        }
      }

      // Mark sync status completed
      db.prepare(`
        UPDATE stock_drive_configs
        SET sync_status = 'idle',
            last_synced_at = ?,
            error_message = NULL,
            updated_at = ?
        WHERE project_id = ?
      `).run(now, now, projectId);

      return Response.json({
        ok: true,
        message: `${files.length} video senkronize edildi (${addedCount} yeni / güncellendi).`,
        totalScanned: files.length,
        addedCount,
        updatedCount,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      db.prepare(`
        UPDATE stock_drive_configs
        SET sync_status = 'error',
            error_message = ?,
            updated_at = ?
        WHERE project_id = ?
      `).run(errorMsg.slice(0, 500), new Date().toISOString(), projectId);

      return Response.json({ ok: false, message: `Senkronizasyon hatası: ${errorMsg}` }, { status: 500 });
    }
  }

  return Response.json({ ok: false, message: "Geçersiz aksiyon." }, { status: 400 });
}
