import crypto from "node:crypto";

export const GOOGLE_DRIVE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildGoogleAuthorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
  });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function isSafeProjectReturnPath(returnTo: string, projectId: string): boolean {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  return returnTo.startsWith(`/projects/${encodeURIComponent(projectId)}/stock-videos`);
}

export function resolveGoogleOAuthRedirectUri(requestUrl?: string): string {
  const configured = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (!requestUrl) throw new Error("GOOGLE_DRIVE_OAUTH_REDIRECT_URI yapılandırılmadı.");
  const request = new URL(requestUrl);
  return `${request.origin}/api/integrations/google-drive/oauth/callback`;
}

export function getGoogleOAuthClientConfig() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth istemcisi yapılandırılmadı. GOOGLE_DRIVE_OAUTH_CLIENT_ID ve GOOGLE_DRIVE_OAUTH_CLIENT_SECRET gerekli.");
  }
  return { clientId, clientSecret };
}
