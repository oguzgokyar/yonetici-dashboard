import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function POST() {
  try {
    // 1. Query CDP tabs to find an open page to evaluate ListAccounts
    const listRes = await fetch("http://127.0.0.1:9222/json/list", {
      signal: AbortSignal.timeout(3500),
    }).catch(() => null);

    if (!listRes || !listRes.ok) {
      return Response.json(
        { ok: false, message: "Chromium CDP servisine bağlanılamadı. Tarayıcı açık olmayabilir." },
        { status: 503 }
      );
    }

    const tabs = (await listRes.json().catch(() => [])) as Array<{
      id: string;
      webSocketDebuggerUrl?: string;
    }>;

    if (!tabs.length || !tabs[0].webSocketDebuggerUrl) {
      return Response.json(
        { ok: false, message: "Açık Chromium sekmesi bulunamadı." },
        { status: 503 }
      );
    }

    // 2. We use python script to evaluate against Chromium CDP cleanly
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const pyCode = `
import asyncio, websockets, json, urllib.request, re

async def get_accounts():
    with urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=3) as r:
        tabs = json.load(r)
    ws_url = tabs[0]["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url) as ws:
        code = """(async () => {
            try {
                const res = await fetch('https://accounts.google.com/ListAccounts?source=ogb', { credentials: 'include' });
                const text = await res.text();
                return { ok: true, text };
            } catch (e) {
                return { ok: false, error: String(e) };
            }
        })()"""
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": code, "awaitPromise": True, "returnByValue": True}}))
        res = json.loads(await ws.recv())
        val = res.get("result", {}).get("result", {}).get("value", {})
        return val

val = asyncio.run(get_accounts())
print(json.dumps(val))
`;

    const { stdout } = await execFileAsync("/opt/hermes/.venv/bin/python", ["-c", pyCode]);
    const parsedRes = JSON.parse(stdout || "{}") as { ok?: boolean; text?: string; error?: string };

    if (!parsedRes.ok || !parsedRes.text) {
      return Response.json(
        { ok: false, message: `Google hesapları okunamadı: ${parsedRes.error || "Bilinmeyen hata"}` },
        { status: 500 }
      );
    }

    // 3. Extract accounts from Local State profiles & Google's response
    const text = parsedRes.text;
    const db = getDatabase();
    const now = new Date().toISOString();

    const emailMatches = Array.from(text.matchAll(/([a-zA-Z0-9._%+-]+@gmail\.com)/g)).map((m) => m[1]);
    
    // Also read Local State profiles if present
    try {
      const fs = await import("node:fs");
      const localStatePath = "/opt/data/chrome_profile_canva/Local State";
      if (fs.existsSync(localStatePath)) {
        const lsData = JSON.parse(fs.readFileSync(localStatePath, "utf-8"));
        const infoCache = lsData?.profile?.info_cache || {};
        for (const [profDir, pData] of Object.entries(infoCache) as Array<[string, { user_name?: string; name?: string }]>) {
          if (pData?.user_name && pData.user_name.includes("@gmail.com")) {
            emailMatches.push(pData.user_name);
            db.prepare(`
              INSERT INTO google_vids_accounts (
                id, email, authuser_index, profile_directory, display_name, quota_status, total_videos_rendered, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, 'available', 0, 1, ?, ?)
              ON CONFLICT(email) DO UPDATE SET
                profile_directory = excluded.profile_directory,
                display_name = excluded.display_name,
                is_active = 1,
                updated_at = excluded.updated_at
            `).run(`gva_${profDir.toLowerCase()}`, pData.user_name, profDir === "Default" ? 0 : 0, profDir, pData.name || pData.user_name, now, now);
          }
        }
      }
    } catch {}

    const uniqueEmails = Array.from(new Set(emailMatches));

    let syncedCount = 0;
    uniqueEmails.forEach((email, idx) => {
      const accountId = `gva_sync_${idx}`;
      db.prepare(`
        INSERT INTO google_vids_accounts (
          id, email, authuser_index, display_name, quota_status, total_videos_rendered, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'available', 0, 1, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          authuser_index = excluded.authuser_index,
          is_active = 1,
          updated_at = excluded.updated_at
      `).run(accountId, email, idx, email.split("@")[0], now, now);
      syncedCount++;
    });

    return Response.json({
      ok: true,
      syncedCount,
      emails: uniqueEmails,
      message: `${syncedCount} adet Google hesabı tarayıcıdan başarıyla senkronize edildi.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesaplar senkronize edilemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
