import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { getGoogleOAuthClientConfig } from "@/lib/google-drive-oauth";
import { getGoogleUserProfile, type TokenData } from "@/lib/server/google-drive";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

type OAuthSession = {
  state: string;
  project_id: string;
  account_id: string;
  code_verifier: string;
  redirect_uri: string;
  return_to: string;
  expires_at: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function redirectResult(requestUrl: string, returnTo: string, result: "success" | "error", message: string) {
  const target = new URL(returnTo, requestUrl);
  target.searchParams.set("driveOAuth", result);
  target.searchParams.set("message", message);
  return Response.redirect(target, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const oauthError = url.searchParams.get("error") || "";
  const db = getDatabase();
  const session = state
    ? db.prepare("SELECT * FROM google_oauth_sessions WHERE state = ?").get(state) as OAuthSession | undefined
    : undefined;

  if (!session) {
    return redirectResult(request.url, "/projects", "error", "Google bağlantı oturumu bulunamadı veya daha önce kullanıldı.");
  }
  db.prepare("DELETE FROM google_oauth_sessions WHERE state = ?").run(state);

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return redirectResult(request.url, session.return_to, "error", "Google bağlantı oturumunun süresi doldu. Tekrar deneyin.");
  }
  if (oauthError) {
    return redirectResult(request.url, session.return_to, "error", oauthError === "access_denied" ? "Google Drive erişimi reddedildi." : `Google OAuth hatası: ${oauthError}`);
  }
  if (!code) {
    return redirectResult(request.url, session.return_to, "error", "Google yetkilendirme kodu döndürmedi.");
  }

  try {
    const { clientId, clientSecret } = getGoogleOAuthClientConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: session.code_verifier,
        redirect_uri: session.redirect_uri,
        grant_type: "authorization_code",
      }),
    });
    const tokenResult = await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !tokenResult.access_token) {
      throw new Error(tokenResult.error_description || tokenResult.error || "Google token değişimi başarısız.");
    }

    const profile = await getGoogleUserProfile(tokenResult.access_token);
    const normalizedEmail = profile.email.trim().toLocaleLowerCase("en-US");
    const existing = session.account_id
      ? db.prepare("SELECT id, encrypted_token_json, label FROM drive_accounts WHERE id = ?").get(session.account_id) as { id: string; encrypted_token_json: string; label: string } | undefined
      : db.prepare("SELECT id, encrypted_token_json, label FROM drive_accounts WHERE email = ?").get(normalizedEmail) as { id: string; encrypted_token_json: string; label: string } | undefined;

    let previousRefreshToken = "";
    if (existing?.encrypted_token_json) {
      try {
        previousRefreshToken = (JSON.parse(decryptSecret(existing.encrypted_token_json)) as TokenData).refresh_token || "";
      } catch {
        // Invalid old token must not block reconnecting the account.
      }
    }

    const accountId = existing?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = tokenResult.expires_in ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString() : null;
    const tokenData: TokenData = {
      access_token: tokenResult.access_token,
      refresh_token: tokenResult.refresh_token || previousRefreshToken || undefined,
      client_id: clientId,
      client_secret: clientSecret,
      token_type: tokenResult.token_type || "Bearer",
      expiry_date: tokenResult.expires_in ? Date.now() + tokenResult.expires_in * 1000 : undefined,
    };
    const encryptedToken = encryptSecret(JSON.stringify(tokenData));
    const scopes = (tokenResult.scope || "").split(/\s+/).filter(Boolean);
    const label = existing?.label || profile.displayName || normalizedEmail || "Google Drive";

    db.prepare(`
      INSERT INTO drive_accounts (
        id, label, email, display_name, photo_link, encrypted_token_json,
        status, scopes_json, token_expires_at, last_validated_at, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        photo_link = excluded.photo_link,
        encrypted_token_json = excluded.encrypted_token_json,
        status = 'active',
        scopes_json = excluded.scopes_json,
        token_expires_at = excluded.token_expires_at,
        last_validated_at = excluded.last_validated_at,
        last_error = NULL,
        updated_at = excluded.updated_at
    `).run(accountId, label, normalizedEmail, profile.displayName, profile.photoLink || "", encryptedToken, JSON.stringify(scopes), expiresAt, now, now, now);

    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at
    `).run(session.project_id, accountId, now);

    return redirectResult(request.url, session.return_to, "success", `${profile.displayName || normalizedEmail} hesabı bağlandı.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive hesabı bağlanamadı.";
    if (session.account_id) {
      db.prepare("UPDATE drive_accounts SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?")
        .run(message.slice(0, 500), new Date().toISOString(), session.account_id);
    }
    return redirectResult(request.url, session.return_to, "error", message);
  }
}
