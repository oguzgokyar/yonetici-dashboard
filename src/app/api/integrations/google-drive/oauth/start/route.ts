import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  buildGoogleAuthorizationUrl,
  createPkcePair,
  getGoogleOAuthClientConfig,
  isSafeProjectReturnPath,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/google-drive-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  const accountId = url.searchParams.get("accountId")?.trim() || "";
  const requestedReturnTo = url.searchParams.get("returnTo")?.trim() || "";

  if (!projectId || !/^[a-z0-9-]+$/i.test(projectId)) {
    return Response.json({ ok: false, message: "Geçerli proje ID gerekli." }, { status: 400 });
  }

  try {
    const { clientId } = getGoogleOAuthClientConfig();
    const redirectUri = resolveGoogleOAuthRedirectUri(request.url);
    const state = crypto.randomBytes(32).toString("base64url");
    const pkce = createPkcePair();
    const returnTo = isSafeProjectReturnPath(requestedReturnTo, projectId)
      ? requestedReturnTo
      : `/projects/${encodeURIComponent(projectId)}/stock-videos`;
    const db = getDatabase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM google_oauth_sessions WHERE expires_at < ?").run(now.toISOString());

    let loginHint = "";
    if (accountId) {
      const account = db.prepare("SELECT email FROM drive_accounts WHERE id = ?").get(accountId) as { email?: string } | undefined;
      loginHint = account?.email || "";
    }

    db.prepare(`
      INSERT INTO google_oauth_sessions (
        state, project_id, account_id, code_verifier, redirect_uri, return_to, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(state, projectId, accountId, pkce.verifier, redirectUri, returnTo, expiresAt, now.toISOString());

    const authorizationUrl = buildGoogleAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
      loginHint,
    });
    return Response.redirect(authorizationUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth başlatılamadı.";
    const returnTo = `/projects/${encodeURIComponent(projectId)}/stock-videos?driveOAuth=error&message=${encodeURIComponent(message)}`;
    const requestUrl = new URL(request.url);
    const publicOrigin = request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : requestUrl.origin;
    return Response.redirect(new URL(returnTo, publicOrigin), 302);
  }
}
