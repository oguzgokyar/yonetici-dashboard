import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import {
  DEFAULT_CANVA_RECONNECT_URL,
  getCanvaAccountWithToken,
  updateCanvaAccount,
  getAccountAuthInfo,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const PYTHON_PATH = "/opt/hermes/.venv/bin/python";
const TOKEN_FILE = "/opt/data/mcp-tokens/canva.json";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const account = getCanvaAccountWithToken(id);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 404 });
    }

    // Attempt to generate a live connect_url via Hermes
    let connectUrl = DEFAULT_CANVA_RECONNECT_URL;
    try {
      const script = `
import sys, json
sys.path.insert(0, "/opt/hermes")
from tools.connectors import manage_connections
res = manage_connections({"action": "reconnect", "connectors": ["canva_mcp"]})
print(res)
`;
      const { stdout } = await execFileAsync(PYTHON_PATH, ["-c", script], { timeout: 10000 });
      const parsed = JSON.parse(stdout.trim());
      const targets = parsed?.targets || [];
      const liveUrl = targets[0]?.connect_url;
      if (liveUrl && typeof liveUrl === "string") {
        connectUrl = liveUrl;
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      connectUrl,
      accountId: id,
      accountName: account.displayName,
      message: "Canva yetkilendirme bağlantısı oluşturuldu.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Yeniden bağlama başlatılamadı.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const account = getCanvaAccountWithToken(id);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 404 });
    }

    // Check if token file has been updated with a valid, non-expired token
    let isConnected = false;
    let authInfo: { authStatus: string; expiresAt: string | null } = { authStatus: "no_token", expiresAt: null };

    if (fs.existsSync(TOKEN_FILE)) {
      try {
        const raw = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
        authInfo = getAccountAuthInfo(raw);
        if (authInfo.authStatus === "active") {
          isConnected = true;
          // Update DB row with the new active token
          updateCanvaAccount(id, { tokenJson: raw, quotaStatus: "available" });
        }
      } catch {}
    }

    // Also check via Hermes manage_connections
    if (!isConnected) {
      try {
        const script = `
import sys, json
sys.path.insert(0, "/opt/hermes")
from tools.connectors import manage_connections
res = manage_connections({"action": "status", "connectors": ["canva_mcp"]})
print(res)
`;
        const { stdout } = await execFileAsync(PYTHON_PATH, ["-c", script], { timeout: 10000 });
        const parsed = JSON.parse(stdout.trim());
        const connectors = parsed?.connectors || [];
        const canva = connectors.find((c: { connector: string }) => c.connector === "canva_mcp");
        if (canva && canva.connected) {
          isConnected = true;
          updateCanvaAccount(id, { quotaStatus: "available" });
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      connected: isConnected,
      authStatus: authInfo.authStatus,
      expiresAt: authInfo.expiresAt,
      message: isConnected ? "Canva hesabı başarıyla bağlandı!" : "Yetkilendirme henüz tamamlanmadı.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bağlantı durumu kontrol edilemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
