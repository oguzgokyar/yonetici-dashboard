import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import {
  createCanvaPkcePair,
  buildCanvaAuthorizationUrl,
  CANVA_DEFAULT_CALLBACK_URI,
} from "@/lib/canva-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || "";
  const displayName = url.searchParams.get("displayName")?.trim() || "";
  const requestedReturnTo = url.searchParams.get("returnTo")?.trim() || "/settings?tab=canva";
  const customRedirectUri = url.searchParams.get("redirectUri")?.trim() || "";

  try {
    const db = getDatabase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 min TTL

    // Cleanup expired sessions
    try {
      db.prepare("DELETE FROM canva_oauth_sessions WHERE expires_at < ?").run(now.toISOString());
    } catch {}

    const state = crypto.randomBytes(32).toString("base64url");
    const pkce = createCanvaPkcePair();

    const redirectUri = customRedirectUri || CANVA_DEFAULT_CALLBACK_URI;

    // Save session
    db.prepare(`
      INSERT INTO canva_oauth_sessions (
        state, account_id, display_name, code_verifier, redirect_uri, return_to, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      state,
      accountId,
      displayName,
      pkce.verifier,
      redirectUri,
      requestedReturnTo,
      expiresAt,
      now.toISOString()
    );

    const authorizationUrl = buildCanvaAuthorizationUrl({
      state,
      codeChallenge: pkce.challenge,
      redirectUri,
    });

    const acceptHeader = request.headers.get("accept") || "";
    const wantsJson = acceptHeader.includes("application/json") || url.searchParams.has("json");

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        authorizationUrl,
        state,
        redirectUri,
        returnTo: requestedReturnTo,
      });
    }

    return Response.redirect(authorizationUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canva OAuth başlatılamadı.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
