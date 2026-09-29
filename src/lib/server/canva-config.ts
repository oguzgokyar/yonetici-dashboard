import crypto from "node:crypto";

export interface CanvaConfig {
  baseUrl: string;
  apiKey: string;
  callbackToken: string;
  enabled: boolean;
}

export function isCanvaStudioEnabled(): boolean {
  const value = (process.env.CANVA_STUDIO_ENABLED || "").trim().toLowerCase();
  return value === "true" || value === "1";
}

export function getCanvaConfig(): CanvaConfig {
  const rawBaseUrl = process.env.HERMES_AGENT_BASE_URL || "http://10.0.1.1:8643";
  const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
  const apiKey = (process.env.HERMES_AGENT_API_KEY || "").trim();
  const callbackToken = (process.env.CANVA_CALLBACK_TOKEN || "").trim();

  return {
    baseUrl,
    apiKey,
    callbackToken,
    enabled: isCanvaStudioEnabled(),
  };
}

export function verifyCallbackToken(
  authHeader: string | null | undefined,
  expectedToken: string
): boolean {
  if (!expectedToken || !authHeader) return false;

  const trimmedExpected = expectedToken.trim();
  if (!trimmedExpected) return false;

  let provided = authHeader.trim();
  if (provided.toLowerCase().startsWith("bearer ")) {
    provided = provided.slice(7).trim();
  }
  if (!provided) return false;

  const expectedBuffer = Buffer.from(trimmedExpected, "utf-8");
  const providedBuffer = Buffer.from(provided, "utf-8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function createJobCallbackToken(secret: string, jobId: string): string {
  if (!secret.trim() || !jobId.trim()) return "";
  return crypto.createHmac("sha256", secret.trim()).update(jobId.trim()).digest("base64url");
}

export function redactSensitiveText(
  text: string,
  secretsToRedact: (string | undefined | null)[] = []
): string {
  if (!text) return "";
  let result = text;

  const activeSecrets = secretsToRedact
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  for (const secret of activeSecrets) {
    if (secret.length >= 4) {
      result = result.split(secret).join("[REDACTED]");
    }
  }

  return result;
}
