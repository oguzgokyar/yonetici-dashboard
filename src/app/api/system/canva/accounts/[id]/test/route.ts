import { NextResponse } from "next/server";
import http from "node:http";
import { getDatabase } from "@/lib/server/database";
import {
  getCanvaAccountWithToken,
  markCanvaAccountExhausted,
  updateCanvaAccount,
  getAccountAuthInfo,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

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

    // Fast zero-load local validation first
    const auth = getAccountAuthInfo(account.tokenJson);
    if (auth.authStatus === "expired") {
      updateCanvaAccount(id, { quotaStatus: "auth_required" as any });
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Canva oturum süresi dolmuş. Lütfen 'Yeniden Bağla' butonunu kullanarak oturumu tazeleyin.",
      });
    }
    if (auth.authStatus === "no_token") {
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Hesapta geçerli bir Canva belirteci bulunmuyor. Lütfen hesabı bağlayın.",
      });
    }

    const db = getDatabase();
    // Test with the latest Canva design ID if available
    const pkg = db
      .prepare("SELECT canva_design_id FROM media_packages WHERE canva_design_id IS NOT NULL ORDER BY created_at DESC LIMIT 1")
      .get() as { canva_design_id?: string } | undefined;

    const designId = pkg?.canva_design_id || "DAHYYJoYb9g";

    // Call host bridge passing account token
    const payload = JSON.stringify({
      design_id: designId,
      format: { type: "png" },
      account_id: account.id,
      token_json: account.tokenJson,
    });

    const bridgeRes = await new Promise<{
      ok?: boolean;
      error?: string;
      is_quota_fallback?: boolean;
      fallback?: string;
    } | null>((resolve) => {
      const req = http.request(
        {
          hostname: "10.0.1.1",
          port: 8080,
          path: "/api/internal/canva/export",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            Connection: "close",
          },
          timeout: 20000,
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => {
            try { resolve(JSON.parse(body)); } catch { resolve(null); }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    });

    const isAuthError =
      bridgeRes?.error &&
      (bridgeRes.error.includes("invalid_grant") ||
       bridgeRes.error.includes("Token refresh failed") ||
       bridgeRes.error.includes("OAuthNonInteractiveError") ||
       bridgeRes.error.includes("401") ||
       bridgeRes.error.toLowerCase().includes("unauthorized"));

    if (isAuthError) {
      updateCanvaAccount(id, { quotaStatus: "auth_required" as any });
      return NextResponse.json({
        ok: false,
        accountStatus: "auth_required",
        message: "Canva oturumu kapandı veya yenileme belirteci geçersiz. Lütfen 'Yeniden Bağla' butonunu kullanın.",
        details: bridgeRes?.error,
      });
    }

    const isQuotaError =
      bridgeRes?.is_quota_fallback ||
      bridgeRes?.fallback === "thumbnails" ||
      (bridgeRes?.error &&
        (bridgeRes.error.includes("Too many daily export requests") || bridgeRes.error.includes("quota")));

    if (isQuotaError) {
      markCanvaAccountExhausted(id, bridgeRes?.error || "Too many daily export requests for user");
      return NextResponse.json({
        ok: true,
        accountStatus: "exhausted",
        message: "Hesap bağlandı ancak bugünkü export kotası dolmuş durumda (03:00 TSİ'de yenilenir).",
        details: bridgeRes?.error,
      });
    }

    if (bridgeRes && bridgeRes.ok) {
      updateCanvaAccount(id, { quotaStatus: "available" });
      return NextResponse.json({
        ok: true,
        accountStatus: "available",
        message: "Canva hesabı aktif, belirteç geçerli ve export kotası kullanılabilir!",
      });
    }

    return NextResponse.json({
      ok: false,
      accountStatus: account.quotaStatus,
      message: bridgeRes?.error || "Hesap test edilirken Canva API yanıt vermedi.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap test edilemedi.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
