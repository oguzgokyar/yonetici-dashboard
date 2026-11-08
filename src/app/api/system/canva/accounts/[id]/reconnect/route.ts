import { NextResponse } from "next/server";
import {
  getCanvaAccountWithToken,
  updateCanvaAccount,
  getAccountAuthInfo,
  refreshAccountTokenIfNeeded,
} from "@/lib/server/canva-account-pool";
import fs from "node:fs";

export const runtime = "nodejs";
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

    // Direct Marka Motoru OAuth start URL with accountId target
    const connectUrl = `/api/system/canva/oauth/start?accountId=${encodeURIComponent(id)}&displayName=${encodeURIComponent(account.displayName)}`;

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
    let account = getCanvaAccountWithToken(id);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 404 });
    }

    // Attempt token refresh first if needed
    await refreshAccountTokenIfNeeded(id).catch(() => {});
    account = getCanvaAccountWithToken(id) || account;

    let isConnected = false;
    let authInfo = getAccountAuthInfo(account.tokenJson);

    if (authInfo.authStatus === "active") {
      isConnected = true;
    } else if (fs.existsSync(TOKEN_FILE)) {
      try {
        const raw = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
        const diskAuth = getAccountAuthInfo(raw);
        if (diskAuth.authStatus === "active") {
          isConnected = true;
          authInfo = diskAuth;
          updateCanvaAccount(id, { tokenJson: raw, quotaStatus: "available" });
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      connected: isConnected,
      authStatus: authInfo.authStatus,
      expiresAt: authInfo.expiresAt,
      message: isConnected ? "Canva hesabı aktif ve bağlı!" : "Yetkilendirme henüz tamamlanmadı.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bağlantı durumu kontrol edilemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
