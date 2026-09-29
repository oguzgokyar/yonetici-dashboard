import assert from "node:assert/strict";
import test from "node:test";
import {
  createJobCallbackToken,
  getCanvaConfig,
  isCanvaStudioEnabled,
  redactSensitiveText,
  verifyCallbackToken,
} from "./canva-config.ts";

test("isCanvaStudioEnabled returns false by default", () => {
  const original = process.env.CANVA_STUDIO_ENABLED;
  try {
    delete process.env.CANVA_STUDIO_ENABLED;
    assert.equal(isCanvaStudioEnabled(), false);

    process.env.CANVA_STUDIO_ENABLED = "0";
    assert.equal(isCanvaStudioEnabled(), false);

    process.env.CANVA_STUDIO_ENABLED = "false";
    assert.equal(isCanvaStudioEnabled(), false);
  } finally {
    if (original !== undefined) process.env.CANVA_STUDIO_ENABLED = original;
    else delete process.env.CANVA_STUDIO_ENABLED;
  }
});

test("isCanvaStudioEnabled returns true only when explicitly enabled", () => {
  const original = process.env.CANVA_STUDIO_ENABLED;
  try {
    process.env.CANVA_STUDIO_ENABLED = "true";
    assert.equal(isCanvaStudioEnabled(), true);

    process.env.CANVA_STUDIO_ENABLED = "TRUE";
    assert.equal(isCanvaStudioEnabled(), true);

    process.env.CANVA_STUDIO_ENABLED = "1";
    assert.equal(isCanvaStudioEnabled(), true);
  } finally {
    if (original !== undefined) process.env.CANVA_STUDIO_ENABLED = original;
    else delete process.env.CANVA_STUDIO_ENABLED;
  }
});

test("getCanvaConfig returns expected defaults and overrides", () => {
  const originalBase = process.env.HERMES_AGENT_BASE_URL;
  const originalKey = process.env.HERMES_AGENT_API_KEY;
  const originalToken = process.env.CANVA_CALLBACK_TOKEN;
  try {
    delete process.env.HERMES_AGENT_BASE_URL;
    delete process.env.HERMES_AGENT_API_KEY;
    delete process.env.CANVA_CALLBACK_TOKEN;

    const defaultConfig = getCanvaConfig();
    assert.equal(defaultConfig.baseUrl, "http://10.0.1.8:8645");
    assert.equal(defaultConfig.apiKey, "");
    assert.equal(defaultConfig.callbackToken, "");

    process.env.HERMES_AGENT_BASE_URL = "http://10.0.1.5:8643/";
    process.env.HERMES_AGENT_API_KEY = "test-agent-key";
    process.env.CANVA_CALLBACK_TOKEN = "test-callback-token";

    const customConfig = getCanvaConfig();
    assert.equal(customConfig.baseUrl, "http://10.0.1.5:8643");
    assert.equal(customConfig.apiKey, "test-agent-key");
    assert.equal(customConfig.callbackToken, "test-callback-token");
  } finally {
    if (originalBase !== undefined) process.env.HERMES_AGENT_BASE_URL = originalBase;
    else delete process.env.HERMES_AGENT_BASE_URL;
    if (originalKey !== undefined) process.env.HERMES_AGENT_API_KEY = originalKey;
    else delete process.env.HERMES_AGENT_API_KEY;
    if (originalToken !== undefined) process.env.CANVA_CALLBACK_TOKEN = originalToken;
    else delete process.env.CANVA_CALLBACK_TOKEN;
  }
});

test("verifyCallbackToken securely compares bearer tokens", () => {
  const secret = "secret_canva_token_1234567890";
  assert.equal(verifyCallbackToken(`Bearer ${secret}`, secret), true);
  assert.equal(verifyCallbackToken(secret, secret), true);
  assert.equal(verifyCallbackToken("Bearer wrong_token", secret), false);
  assert.equal(verifyCallbackToken("", secret), false);
  assert.equal(verifyCallbackToken(null, secret), false);
  assert.equal(verifyCallbackToken(undefined, secret), false);
  assert.equal(verifyCallbackToken(`Bearer ${secret}`, ""), false);
});

test("createJobCallbackToken scopes callback authorization to one job", () => {
  const first = createJobCallbackToken("global-secret", "job-1");
  const second = createJobCallbackToken("global-secret", "job-2");
  assert.notEqual(first, second);
  assert.equal(verifyCallbackToken(`Bearer ${first}`, createJobCallbackToken("global-secret", "job-1")), true);
  assert.equal(verifyCallbackToken(`Bearer ${first}`, createJobCallbackToken("global-secret", "job-2")), false);
  assert.equal(createJobCallbackToken("", "job-1"), "");
});

test("redactSensitiveText masks detected secrets", () => {
  const secret = "super-secret-api-key-9999";
  const text = `Error connecting with key: ${secret} to server`;
  const redacted = redactSensitiveText(text, [secret]);
  assert.ok(!redacted.includes(secret));
  assert.ok(redacted.includes("[REDACTED]"));
});
