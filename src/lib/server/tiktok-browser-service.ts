import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = "/opt/data/scripts/tiktok_browser_uploader.py";
const PYTHON_PATH = "/opt/data/crawl4ai_test/.venv/bin/python";

export type TikTokBrowserUploadResult = {
  ok: boolean;
  status?: string;
  message?: string;
  need_login?: boolean;
  screenshot?: string;
  error?: string;
};

export async function checkTikTokBrowserSession(): Promise<{ ok: boolean; logged_in: boolean; error?: string }> {
  try {
    // 1. Host :8080 köprüsü üzerinden açık olan CDP oturumunu kontrol et
    const bridgeUrls = [
      "http://10.0.1.1:8080/api/internal/tiktok/session",
      "http://127.0.0.1:8080/api/internal/tiktok/session",
      "http://10.0.1.8:8080/api/internal/tiktok/session",
    ];

    for (const bUrl of bridgeUrls) {
      try {
        const res = await fetch(bUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; logged_in?: boolean };
          if (data.ok && typeof data.logged_in === "boolean") {
            return { ok: true, logged_in: data.logged_in };
          }
        }
      } catch {}
    }

    // 2. Fallback: Python scripti doğrudan çağır
    if (!fs.existsSync(SCRIPT_PATH)) {
      return { ok: false, logged_in: false, error: "TikTok yükleme scripti bulunamadı." };
    }

    const { stdout } = await execFileAsync(PYTHON_PATH, [SCRIPT_PATH, "--check-session"], {
      timeout: 15_000,
    });

    const parsed = JSON.parse(stdout.trim());
    return { ok: true, logged_in: Boolean(parsed.logged_in) };
  } catch (err) {
    return {
      ok: false,
      logged_in: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function uploadVideoViaTikTokBrowser(options: {
  videoPath: string;
  caption: string;
  visibility?: "PUBLIC" | "SELF_ONLY";
}): Promise<TikTokBrowserUploadResult> {
  try {
    if (!fs.existsSync(options.videoPath)) {
      return { ok: false, error: `Video dosyası bulunamadı: ${options.videoPath}` };
    }

    // 1. Host :8080 köprüsü üzerinden yükleme yapmayı dene (Konteyner içi izolasyon köprüsü)
    const bridgeUrls = [
      "http://10.0.1.1:8080/api/internal/tiktok/upload",
      "http://127.0.0.1:8080/api/internal/tiktok/upload",
      "http://10.0.1.8:8080/api/internal/tiktok/upload",
    ];

    for (const bUrl of bridgeUrls) {
      try {
        const fileData = fs.readFileSync(options.videoPath);
        const boundary = `----WebKitFormBoundary${Date.now()}`;
        const filename = path.basename(options.videoPath);

        const header = `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`;
        const capField = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${options.caption}`;
        const visField = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="visibility"\r\n\r\n${options.visibility || "PUBLIC"}\r\n--${boundary}--\r\n`;

        const body = Buffer.concat([
          Buffer.from(header, "utf-8"),
          fileData,
          Buffer.from(capField, "utf-8"),
          Buffer.from(visField, "utf-8"),
        ]);

        const res = await fetch(bUrl, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
          signal: AbortSignal.timeout(180_000),
        });

        if (res.ok) {
          const data = (await res.json()) as TikTokBrowserUploadResult;
          return data;
        }
      } catch {}
    }

    // 2. Fallback: Host üzerinde yerel python çalıştırma (host ortamındaysa)
    if (!fs.existsSync(SCRIPT_PATH)) {
      return { ok: false, error: "TikTok yükleyici scripti host köprüsüne bağlanamadı." };
    }

    const args = [
      SCRIPT_PATH,
      "--video",
      options.videoPath,
      "--caption",
      options.caption,
      "--visibility",
      options.visibility || "PUBLIC",
    ];

    const { stdout, stderr } = await execFileAsync(PYTHON_PATH, args, {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const raw = stdout.trim();
    if (!raw) {
      return { ok: false, error: `TikTok yükleyici boş yanıt döndü. ${stderr}` };
    }

    const parsed = JSON.parse(raw) as TikTokBrowserUploadResult;
    return parsed;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
