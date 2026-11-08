import { NextResponse } from "next/server";
import {
  getCanvaAccountWithToken,
  updateCanvaAccount,
  getAccountAuthInfo,
  refreshAccountTokenIfNeeded,
} from "@/lib/server/canva-account-pool";
import { fetchCanvaAccountDetails } from "@/lib/canva-oauth";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let account = getCanvaAccountWithToken(id);

    if (!account) {
      return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 404 });
    }

    // 1. Silent token refresh first if needed
    try {
      await refreshAccountTokenIfNeeded(id);
      account = getCanvaAccountWithToken(id) || account;
    } catch {}

    const auth = getAccountAuthInfo(account.tokenJson);
    if (auth.authStatus === "no_token") {
      updateCanvaAccount(id, { quotaStatus: "auth_required" as any });
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Hesapta geçerli bir Canva belirteci bulunmuyor. Lütfen hesabı bağlayın.",
      });
    }

    let tokenData: { access_token?: string; refresh_token?: string } = {};
    try {
      tokenData = JSON.parse(account.tokenJson);
    } catch {
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Belirteç JSON verisi ayrıştırılamadı.",
      });
    }

    if (!tokenData.access_token) {
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Erişim belirteci (access_token) eksik.",
      });
    }

    // 2. Direct zero-load Canva MCP session test
    try {
      const details = await fetchCanvaAccountDetails(tokenData.access_token);
      updateCanvaAccount(id, {
        quotaStatus: "available",
      });

      return NextResponse.json({
        ok: true,
        accountStatus: "available",
        message: `Canva hesabı aktif ve doğrulandı! (${details.name || "Oturum Açık"})`,
        details: {
          name: details.name,
          teamId: details.teamId,
          userId: details.id,
        },
      });
    } catch (apiErr: unknown) {
      const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      const isAuthErr =
        errMsg.includes("401") ||
        errMsg.includes("unauthorized") ||
        errMsg.includes("invalid_grant") ||
        errMsg.includes("invalid_access_token");

      if (isAuthErr) {
        updateCanvaAccount(id, { quotaStatus: "auth_required" as any });
        return NextResponse.json({
          ok: false,
          accountStatus: "auth_required",
          message: "Canva oturumu kapandı veya belirteç geçersiz. Lütfen 'Yeniden Bağla' butonunu kullanın.",
          error: errMsg,
        });
      }

      return NextResponse.json({
        ok: false,
        accountStatus: account.quotaStatus,
        message: `Canva API doğrulama hatası: ${errMsg}`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap test edilemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
