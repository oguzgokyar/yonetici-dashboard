import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const CACHE_DIR = path.join(process.cwd(), ".data", "stock-cache");

type TokenData = {
  access_token: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  token_type?: string;
  expiry_date?: number;
};

export type DriveFolder = {
  id: string;
  name: string;
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

function readTokenData(): TokenData {
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

function writeTokenData(data: TokenData) {
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

  // fallback to write in .data if not found
  try {
    const dataDir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "google_token.json"), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export async function getValidAccessToken(): Promise<string> {
  const tokenData = readTokenData();
  let accessToken = tokenData.access_token;

  // Test token with a lightweight call
  const testRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);

  if (testRes && testRes.ok) {
    return accessToken;
  }

  // Token expired or invalid, refresh using refresh_token
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

  const refreshData = await refreshRes.json() as { access_token: string; expires_in?: number };
  accessToken = refreshData.access_token;
  tokenData.access_token = accessToken;
  writeTokenData(tokenData);

  return accessToken;
}

export async function listDriveFolders(): Promise<DriveFolder[]> {
  const accessToken = await getValidAccessToken();
  const q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=50&fields=files(id,name)&orderBy=name`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive klasörleri alınamadı (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as { files?: { id: string; name: string }[] };
  return data.files || [];
}

export async function listDriveVideos(folderId?: string, query?: string): Promise<{ files: DriveVideoFile[]; nextPageToken?: string }> {
  const accessToken = await getValidAccessToken();
  const clauses: string[] = ["mimeType contains 'video/'", "trashed = false"];

  if (folderId && folderId.trim()) {
    clauses.push(`'${folderId.trim()}' in parents`);
  }

  if (query && query.trim()) {
    const escaped = query.replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  const q = clauses.join(" and ");
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=100&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,videoMediaMetadata,parents)&orderBy=name`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive videoları listelenemedi (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as {
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

  const files: DriveVideoFile[] = (data.files || []).map((file) => {
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

  return { files, nextPageToken: data.nextPageToken };
}

export async function ensureCachedVideo(fileId: string): Promise<{ localPath: string; isNewDownload: boolean }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const localPath = path.join(CACHE_DIR, `${fileId}.mp4`);

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.size > 1000) {
      return { localPath, isNewDownload: false };
    }
  }

  const accessToken = await getValidAccessToken();
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

  // Convert Web ReadableStream to Node Readable
  // @ts-expect-error Node.js Readable from Web stream
  await pipeline(Readable.fromWeb(webStream), fileStream);
  fs.renameSync(tempPath, localPath);

  return { localPath, isNewDownload: true };
}
