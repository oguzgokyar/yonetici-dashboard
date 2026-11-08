import crypto from "node:crypto";

export const CANVA_CIMD_CLIENT_METADATA_URL =
  "https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json";
export const CANVA_DEFAULT_CALLBACK_URI = "http://127.0.0.1:27890/callback";

export interface CanvaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number; // Unix timestamp in seconds
  refresh_token: string;
  scope?: string;
}

export interface CanvaAccountDetails {
  id: string;
  name: string;
  teamId?: string;
  email?: string;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createCanvaPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildCanvaAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
  redirectUri?: string;
  loginHint?: string;
}): string {
  const customClientId = process.env.CANVA_CLIENT_ID?.trim();
  const clientId = customClientId || CANVA_CIMD_CLIENT_METADATA_URL;
  const callbackUri = options.redirectUri || CANVA_DEFAULT_CALLBACK_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUri,
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
  });

  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }

  // If custom developer app, target standard Canva OAuth endpoint
  if (customClientId) {
    params.set(
      "scope",
      "profile:read design:meta:read design:content:write design:content:read folder:read folder:write asset:read asset:write brandtemplate:content:read"
    );
    return `https://www.canva.com/api/oauth/authorize?${params.toString()}`;
  }

  return `https://mcp.canva.com/authorize?${params.toString()}`;
}

export async function exchangeCanvaAuthCode(options: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}): Promise<CanvaTokenResponse> {
  const customClientId = process.env.CANVA_CLIENT_ID?.trim();
  const customClientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  const clientId = customClientId || CANVA_CIMD_CLIENT_METADATA_URL;
  const callbackUri = options.redirectUri || CANVA_DEFAULT_CALLBACK_URI;

  const tokenEndpoint = customClientId
    ? "https://api.canva.com/rest/v1/oauth/token"
    : "https://mcp.canva.com/token";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    code_verifier: options.codeVerifier,
    redirect_uri: callbackUri,
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (customClientId && customClientSecret) {
    const creds = Buffer.from(`${customClientId}:${customClientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${creds}`;
  }

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error_description || errJson.error || errJson.message || errorMsg;
    } catch {}
    throw new Error(`Canva yetkilendirme kodu doğrulanamadı: ${errorMsg}`);
  }

  const data = await res.json();
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 14400;

  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    expires_in: expiresIn,
    expires_at: nowSec + expiresIn,
    refresh_token: data.refresh_token || "",
    scope: data.scope,
  };
}

export async function refreshCanvaAccessToken(
  refreshToken: string
): Promise<CanvaTokenResponse> {
  if (!refreshToken) {
    throw new Error("Yenileme belirteci (refresh_token) bulunmuyor.");
  }

  const customClientId = process.env.CANVA_CLIENT_ID?.trim();
  const customClientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  const clientId = customClientId || CANVA_CIMD_CLIENT_METADATA_URL;

  const tokenEndpoint = customClientId
    ? "https://api.canva.com/rest/v1/oauth/token"
    : "https://mcp.canva.com/token";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (customClientId && customClientSecret) {
    const creds = Buffer.from(`${customClientId}:${customClientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${creds}`;
  }

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error_description || errJson.error || errJson.message || errorMsg;
    } catch {}
    throw new Error(`Canva belirteci yenilenemedi: ${errorMsg}`);
  }

  const data = await res.json();
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 14400;

  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    expires_in: expiresIn,
    expires_at: nowSec + expiresIn,
    refresh_token: data.refresh_token || refreshToken,
    scope: data.scope,
  };
}

export async function fetchCanvaAccountDetails(
  accessToken: string
): Promise<CanvaAccountDetails> {
  const customClientId = process.env.CANVA_CLIENT_ID?.trim();

  // If custom developer app, use standard Canva REST API
  if (customClientId) {
    const res = await fetch("https://api.canva.com/rest/v1/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data?.user?.id || "canva_user",
        name: data?.user?.display_name || "Canva Kullanıcısı",
        email: data?.user?.email,
      };
    }
  }

  // Streamable HTTP MCP server call
  const res = await fetch("https://mcp.canva.com/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get-logged-in-account-details",
        arguments: {},
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Canva hesap bilgisi alınamadı (HTTP ${res.status})`);
  }

  const data = await res.json();
  const structured = data?.result?.structuredContent;
  if (structured && structured.name) {
    return {
      id: structured.id,
      name: structured.name,
      teamId: structured.team_id,
    };
  }

  const contentText = data?.result?.content?.[0]?.text;
  if (contentText) {
    try {
      const parsed = JSON.parse(contentText);
      return {
        id: parsed.id,
        name: parsed.name,
        teamId: parsed.team_id,
      };
    } catch {}
  }

  return {
    id: "canva_" + Date.now().toString(36),
    name: "Canva Hesabı",
  };
}
