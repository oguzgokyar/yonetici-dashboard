import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getDatabase } from "@/lib/server/database";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets";
import { buildDirectChildFolderQuery, chunkFolderIds } from "@/lib/stock-drive-architecture";

const CACHE_DIR = path.join(process.cwd(), ".data", "stock-cache");

export type TokenData = {
  access_token: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  token_type?: string;
  expiry_date?: number;
};

export type DriveUserProfile = {
  email: string;
  displayName: string;
  photoLink?: string;
};

export type DriveFolder = {
  id: string;
  name: string;
  parents?: string[];
};

export type DriveVideoFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  thumbnailLink?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  parents?: string[];
};

// Fallback to system token files if project has no custom account
function readSystemTokenData(): TokenData {
  if (process.env.GOOGLE_TOKEN_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_TOKEN_BASE64.trim(), "base64").toString("utf8");
      if (decoded.startsWith("{")) {
        return JSON.parse(decoded) as TokenData;
      }
    } catch {
      // continue
    }
  }

  const tokenJsonStr = process.env.GOOGLE_TOKEN_JSON;
  if (tokenJsonStr && tokenJsonStr.trim().startsWith("{")) {
    return JSON.parse(tokenJsonStr) as TokenData;
  }

  const candidatePaths = [
    process.env.GOOGLE_TOKEN_PATH,
    "/opt/data/google_token.json",
    path.join(process.cwd(), ".data", "google_token.json"),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ p, "utf8")) as TokenData;
    }
  }

  throw new Error(`Google token dosyası bulunamadı. Aranan konumlar: ${candidatePaths.join(", ")}`);
}

function writeSystemTokenData(data: TokenData) {
  const candidatePaths = [
    process.env.GOOGLE_TOKEN_PATH,
    "/opt/data/google_token.json",
    path.join(process.cwd(), ".data", "google_token.json"),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      try {
        fs.writeFileSync(/*turbopackIgnore: true*/ p, JSON.stringify(data, null, 2), "utf8");
        return;
      } catch {
        // continue to next path
      }
    }
  }

  try {
    const dataDir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "google_token.json"), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // ignore
  }
}

/**
 * Fetch Google User Info with a given access token
 */
export async function getGoogleUserProfile(accessToken: string): Promise<DriveUserProfile> {
  const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google kullanıcı bilgisi alınamadı (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    user?: { emailAddress?: string; displayName?: string; photoLink?: string };
  };
  return {
    email: data.user?.emailAddress || "",
    displayName: data.user?.displayName || "",
    photoLink: data.user?.photoLink || "",
  };
}

/**
 * Refresh an OAuth access token using refresh_token
 */
async function refreshGoogleAccessToken(tokenData: TokenData): Promise<{ tokenData: TokenData; accessToken: string }> {
  if (!tokenData.refresh_token || !tokenData.client_id || !tokenData.client_secret) {
    throw new Error("Google access token geçersiz ve yenileme (refresh_token) bilgisi eksik.");
  }

  const refreshParams = new URLSearchParams({
    client_id: tokenData.client_id,
    client_secret: tokenData.client_secret,
    refresh_token: tokenData.refresh_token,
    grant_type: "refresh_token",
  });

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });

  if (!refreshRes.ok) {
    const errorBody = await refreshRes.text();
    throw new Error(`Google access token yenilenemedi (${refreshRes.status}): ${errorBody}`);
  }

  const refreshData = (await refreshRes.json()) as { access_token: string; expires_in?: number };
  const updatedToken: TokenData = {
    ...tokenData,
    access_token: refreshData.access_token,
    expiry_date: refreshData.expires_in ? Date.now() + refreshData.expires_in * 1000 : undefined,
  };
  return { tokenData: updatedToken, accessToken: refreshData.access_token };
}

/**
 * Get valid access token for a project or globally
 */
export async function getValidAccessToken(projectId?: string): Promise<string> {
  const db = getDatabase();

  // 1. If projectId provided, resolve the project's selected global Drive account
  if (projectId) {
    const accountRow = db
      .prepare(`
        SELECT a.id, a.encrypted_token_json
        FROM stock_drive_configs c
        JOIN drive_accounts a ON a.id = c.account_id
        WHERE c.project_id = ? AND c.account_id <> ''
      `)
      .get(projectId) as { id: string; encrypted_token_json: string } | undefined;

    if (accountRow?.encrypted_token_json) {
      try {
        const decryptedStr = decryptSecret(accountRow.encrypted_token_json);
        const tokenData = JSON.parse(decryptedStr) as TokenData;
        let accessToken = tokenData.access_token;

        // Test if current access token is valid
        const testRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null);

        if (testRes && testRes.ok) {
          return accessToken;
        }

        // Try refreshing token
        const refreshed = await refreshGoogleAccessToken(tokenData);
        accessToken = refreshed.accessToken;

        // Save back encrypted
        const newEncrypted = encryptSecret(JSON.stringify(refreshed.tokenData));
        db.prepare(
          "UPDATE project_drive_accounts SET encrypted_token_json = ?, updated_at = ? WHERE id = ?"
        ).run(newEncrypted, new Date().toISOString(), accountRow.id);

        return accessToken;
      } catch (err) {
        console.warn(`[GoogleDrive] Proje (${projectId}) özel token yenileme hatası, sistem tokenına geçiliyor:`, err);
      }
    }
  }

  // 2. Fallback to System Token
  const tokenData = readSystemTokenData();
  const accessToken = tokenData.access_token;

  const testRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);

  if (testRes && testRes.ok) {
    return accessToken;
  }

  const refreshed = await refreshGoogleAccessToken(tokenData);
  writeSystemTokenData(refreshed.tokenData);
  return refreshed.accessToken;
}

/**
 * List folders in Drive.
 * If parentFolderId is supplied, lists direct child folders of that parent.
 * Otherwise lists top folders or all accessible folders.
 */
export async function listDriveFolders(projectId?: string, parentFolderId = "root"): Promise<DriveFolder[]> {
  const accessToken = await getValidAccessToken(projectId);
  const q = buildDirectChildFolderQuery(parentFolderId);
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&pageSize=100&fields=files(id,name,parents)&orderBy=name`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive klasörleri alınamadı (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { files?: DriveFolder[] };
  return data.files || [];
}

/**
 * Recursive Discovery: Find all subfolder IDs under a given root folder
 */
export async function getAllFolderIdsUnderRoot(
  projectId: string | undefined,
  rootFolderId: string
): Promise<string[]> {
  const accessToken = await getValidAccessToken(projectId);
  const collectedIds = new Set<string>([rootFolderId]);
  const queue = [rootFolderId];

  // Fetch children level by level (breadth-first)
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    try {
      const q = `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&pageSize=100&fields=files(id,name)`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = (await res.json()) as { files?: { id: string; name: string }[] };
        for (const child of data.files || []) {
          if (!collectedIds.has(child.id)) {
            collectedIds.add(child.id);
            queue.push(child.id);
          }
        }
      }
    } catch {
      // Continue with remaining
    }
  }

  return Array.from(collectedIds);
}

/**
 * List videos in Drive.
 * Supports:
 * - Specific folderId (single folder)
 * - Array of folderIds (root + recursive subfolders)
 * - query search
 */
export async function listDriveVideos(
  options: {
    projectId?: string;
    folderId?: string;
    folderIds?: string[];
    query?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<{ files: DriveVideoFile[]; nextPageToken?: string }> {
  const { projectId, folderId, folderIds, query, pageSize = 100, pageToken } = options;
  const accessToken = await getValidAccessToken(projectId);

  const baseClauses: string[] = ["mimeType contains 'video/'", "trashed = false"];

  if (query && query.trim()) {
    const escaped = query.replace(/'/g, "\\'");
    baseClauses.push(`name contains '${escaped}'`);
  }

  const targetFolderIds = folderIds?.length
    ? folderIds
    : folderId?.trim()
      ? [folderId.trim()]
      : [];
  const folderBatches = targetFolderIds.length ? chunkFolderIds(targetFolderIds, 20) : [[]];
  const filesById = new Map<string, {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      thumbnailLink?: string;
      videoMediaMetadata?: {
        width?: number;
        height?: number;
        durationMillis?: string;
      };
      parents?: string[];
    }>();
  let finalNextPageToken: string | undefined;

  for (const folderBatch of folderBatches) {
    let currentPageToken = pageToken;
    do {
      let finalQuery = baseClauses.join(" and ");
      if (folderBatch.length === 1) {
        finalQuery += ` and '${folderBatch[0]}' in parents`;
      } else if (folderBatch.length > 1) {
        const parentClauses = folderBatch.map((id) => `'${id}' in parents`).join(" or ");
        finalQuery += ` and (${parentClauses})`;
      }

      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        finalQuery
      )}&pageSize=${pageSize}&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,videoMediaMetadata,parents)&orderBy=name`;
      if (currentPageToken) url += `&pageToken=${encodeURIComponent(currentPageToken)}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        throw new Error(`Google Drive videoları listelenemedi (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as {
        nextPageToken?: string;
        files?: Array<{
          id: string;
          name: string;
          mimeType: string;
          size?: string;
          thumbnailLink?: string;
          videoMediaMetadata?: {
            width?: number;
            height?: number;
            durationMillis?: string;
          };
          parents?: string[];
        }>;
      };
      for (const file of data.files || []) filesById.set(file.id, file);
      currentPageToken = data.nextPageToken;
      finalNextPageToken = currentPageToken;
    } while (currentPageToken);
  }

  const files: DriveVideoFile[] = Array.from(filesById.values()).map((file) => {
    let durationSeconds: number | undefined;
    if (file.videoMediaMetadata?.durationMillis) {
      durationSeconds = Math.round(Number.parseInt(file.videoMediaMetadata.durationMillis, 10) / 1000);
    }

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? Number.parseInt(file.size, 10) : undefined,
      thumbnailLink: file.thumbnailLink,
      durationSeconds,
      width: file.videoMediaMetadata?.width,
      height: file.videoMediaMetadata?.height,
      parents: file.parents,
    };
  });

  return { files, nextPageToken: finalNextPageToken };
}

/**
 * Ensure video file is downloaded and cached locally on server disk
 */
export async function ensureCachedVideo(
  fileId: string,
  projectId?: string
): Promise<{ localPath: string; isNewDownload: boolean }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const localPath = path.join(CACHE_DIR, `${fileId}.mp4`);

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.size > 1000) {
      return { localPath, isNewDownload: false };
    }
  }

  const accessToken = await getValidAccessToken(projectId);
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok || !res.body) {
    throw new Error(`Drive videosu indirilemedi (${res.status}): ${await res.text()}`);
  }

  const tempPath = `${localPath}.downloading`;
  const fileStream = fs.createWriteStream(tempPath);
  const webStream = res.body;

  // @ts-expect-error Node.js Readable from Web stream
  await pipeline(Readable.fromWeb(webStream), fileStream);
  fs.renameSync(tempPath, localPath);

  return { localPath, isNewDownload: true };
}
