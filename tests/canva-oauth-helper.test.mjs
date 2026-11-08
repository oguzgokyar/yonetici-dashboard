import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

function base64Url(buffer) {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createCanvaPkcePair() {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function buildCanvaAuthorizationUrl({ state, codeChallenge, redirectUri }) {
  const clientId = "https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json";
  const callbackUri = redirectUri || "http://127.0.0.1:27890/callback";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://mcp.canva.com/authorize?${params.toString()}`;
}

async function refreshCanvaAccessToken(refreshToken) {
  const clientId = "https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch("https://mcp.canva.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Canva token yenileme hatası (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    expires_in: data.expires_in || 14400,
    expires_at: nowSec + (data.expires_in || 14400),
    refresh_token: data.refresh_token || refreshToken,
    scope: data.scope,
  };
}

async function fetchCanvaAccountDetails(accessToken) {
  const res = await fetch("https://mcp.canva.com/mcp", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get-logged-in-account-details",
        arguments: {}
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Canva hesap bilgisi alınamadı (${res.status})`);
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

  throw new Error("Canva hesap detayları çözülemedi");
}

test("Canva PKCE pair generation is valid base64url", () => {
  const pkce = createCanvaPkcePair();
  assert.ok(pkce.verifier.length >= 43);
  assert.ok(pkce.challenge.length >= 43);
  assert.ok(!pkce.challenge.includes("+"));
  assert.ok(!pkce.challenge.includes("/"));
  assert.ok(!pkce.challenge.includes("="));
});

test("Canva Authorization URL matches client metadata", () => {
  const url = buildCanvaAuthorizationUrl({
    state: "test_state_123",
    codeChallenge: "challenge_abc",
  });
  assert.ok(url.startsWith("https://mcp.canva.com/authorize?"));
  assert.ok(url.includes("client_id=https%3A%2F%2Fnousresearch.github.io%2Fhermes-agent%2Fdocs%2Foauth%2Fclient-metadata.json"));
  assert.ok(url.includes("redirect_uri=http%3A%2F%2F127.0.0.1%3A27890%2Fcallback"));
  assert.ok(url.includes("state=test_state_123"));
});

test("Canva token refresh and account details live check", async () => {
  const tokenFile = "/opt/data/mcp-tokens/canva.json";
  if (!fs.existsSync(tokenFile)) return;
  const existing = JSON.parse(fs.readFileSync(tokenFile, "utf-8"));
  if (!existing.refresh_token) return;

  const refreshed = await refreshCanvaAccessToken(existing.refresh_token);
  assert.ok(refreshed.access_token);
  assert.ok(refreshed.expires_in > 0);
  assert.ok(refreshed.expires_at > Date.now() / 1000);

  const account = await fetchCanvaAccountDetails(refreshed.access_token);
  assert.ok(account.name);
  assert.ok(account.id);
  assert.equal(account.name, "Oğuz Gökyar");
});
