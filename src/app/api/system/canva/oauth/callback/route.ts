import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import {
  exchangeCanvaAuthCode,
  fetchCanvaAccountDetails,
  CANVA_DEFAULT_CALLBACK_URI,
} from "@/lib/canva-oauth";
import fs from "node:fs";

export const runtime = "nodejs";

interface OAuthSession {
  state: string;
  account_id: string;
  display_name: string;
  code_verifier: string;
  redirect_uri: string;
  return_to: string;
  expires_at: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const state = url.searchParams.get("state")?.trim() || "";
  const error = url.searchParams.get("error") || "";

  return handleCallback(request, { code, state, error });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let code = (body.code || "").trim();
    let state = (body.state || "").trim();
    const pastedUrl = (body.url || body.redirectUrl || "").trim();
    const displayName = (body.displayName || "").trim();
    const email = (body.email || "").trim();

    if (pastedUrl) {
      try {
        const parsed = new URL(pastedUrl.startsWith("http") ? pastedUrl : `http://${pastedUrl}`);
        if (!code) code = parsed.searchParams.get("code") || "";
        if (!state) state = parsed.searchParams.get("state") || "";
      } catch {}
    }

    return handleCallback(request, { code, state, displayName, email, isApi: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geçersiz istek gövdesi.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

async function handleCallback(
  request: Request,
  params: {
    code?: string;
    state?: string;
    error?: string;
    displayName?: string;
    email?: string;
    isApi?: boolean;
  }
) {
  const { code, state, error, displayName: customName, email: customEmail, isApi } = params;

  if (error) {
    if (isApi) {
      return NextResponse.json({ ok: false, message: `Canva OAuth hatası: ${error}` }, { status: 400 });
    }
    return Response.redirect(
      new URL(`/settings?tab=canva&canvaOAuth=error&message=${encodeURIComponent(error)}`, request.url),
      302
    );
  }

  if (!code) {
    const msg = "Yetkilendirme kodu (code) eksik.";
    if (isApi) return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    return Response.redirect(
      new URL(`/settings?tab=canva&canvaOAuth=error&message=${encodeURIComponent(msg)}`, request.url),
      302
    );
  }

  const db = getDatabase();

  // Find session by state or latest valid session
  let session: OAuthSession | undefined;
  if (state) {
    session = db
      .prepare("SELECT * FROM canva_oauth_sessions WHERE state = ?")
      .get(state) as OAuthSession | undefined;
  }

  if (!session) {
    session = db
      .prepare("SELECT * FROM canva_oauth_sessions WHERE expires_at > ? ORDER BY created_at DESC LIMIT 1")
      .get(new Date().toISOString()) as OAuthSession | undefined;
  }

  if (!session) {
    const msg = "Yetkilendirme oturumu bulunamadı veya süresi dolmuş. Lütfen işlemi yeniden başlatın.";
    if (isApi) return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    return Response.redirect(
      new URL(`/settings?tab=canva&canvaOAuth=error&message=${encodeURIComponent(msg)}`, request.url),
      302
    );
  }

  // Delete used session
  try {
    db.prepare("DELETE FROM canva_oauth_sessions WHERE state = ?").run(session.state);
  } catch {}

  try {
    // 1. Exchange code for tokens
    const tokenResponse = await exchangeCanvaAuthCode({
      code,
      codeVerifier: session.code_verifier,
      redirectUri: session.redirect_uri || CANVA_DEFAULT_CALLBACK_URI,
    });

    // 2. Fetch account profile
    let email = customEmail || "";
    let accountName = customName || session.display_name;
    let externalId = "";
    try {
      const details = await fetchCanvaAccountDetails(tokenResponse.access_token);
      externalId = details.id;
      if (!email && details.email) {
        email = details.email;
      }
      if (!accountName && email) {
        accountName = email;
      } else if (!accountName && details.name) {
        accountName = details.name;
        if (details.teamId) accountName += ` (${details.teamId.slice(-4)})`;
      }
    } catch {}

    accountName = accountName || email || "Canva Hesabı";
    const accountId =
      session.account_id ||
      (externalId ? `canva_${externalId}` : `canva_${Date.now().toString(36)}`);

    const now = new Date().toISOString();
    const tokenJsonStr = JSON.stringify(tokenResponse);

    // 3. Upsert into canva_accounts
    const existing = db.prepare("SELECT id FROM canva_accounts WHERE id = ?").get(accountId);
    if (existing) {
      db.prepare(`
        UPDATE canva_accounts
        SET display_name = ?,
            email = COALESCE(NULLIF(?, ''), email),
            token_json = ?,
            quota_status = 'available',
            quota_exhausted_at = NULL,
            last_error = NULL,
            is_active = 1,
            updated_at = ?
        WHERE id = ?
      `).run(accountName, email, tokenJsonStr, now, accountId);
    } else {
      db.prepare(`
        INSERT INTO canva_accounts (
          id, email, display_name, token_json, quota_status,
          daily_exports_count, total_exports_count, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'available', 0, 0, 1, ?, ?)
      `).run(accountId, email, accountName, tokenJsonStr, now, now);
    }

    // 4. Update host cache file if writable
    try {
      const hostTokenFile = "/opt/data/mcp-tokens/canva.json";
      fs.mkdirSync("/opt/data/mcp-tokens", { recursive: true });
      fs.writeFileSync(hostTokenFile, JSON.stringify(tokenResponse, null, 2));
    } catch {}

    if (isApi) {
      return NextResponse.json({
        ok: true,
        accountId,
        displayName: accountName,
        message: "Canva hesabı başarıyla bağlandı ve havuza eklendi!",
      });
    }

    const returnTo = session.return_to || "/settings?tab=canva";
    const redirectUrl = new URL(
      returnTo.includes("?")
        ? `${returnTo}&canvaOAuth=success&account=${encodeURIComponent(accountName)}`
        : `${returnTo}?canvaOAuth=success&account=${encodeURIComponent(accountName)}`,
      request.url
    );

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canva hesabı bağlanırken hata oluştu.";
    if (isApi) return NextResponse.json({ ok: false, message }, { status: 500 });
    return Response.redirect(
      new URL(`/settings?tab=canva&canvaOAuth=error&message=${encodeURIComponent(message)}`, request.url),
      302
    );
  }
}
