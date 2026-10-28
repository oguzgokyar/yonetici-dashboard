export const AUTH_COOKIE_NAME = "mm_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function getAuthSecret(): string {
  return (
    process.env.APP_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "marka-motoru-auth-secret-key-2026"
  );
}

export async function createSessionToken(secret: string = getAuthSecret()): Promise<string> {
  const timestamp = Date.now().toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp));
  const sig = Buffer.from(sigBuffer).toString("base64url");
  return `${timestamp}.${sig}`;
}

export async function verifySessionToken(
  token: string | null | undefined,
  secret: string = getAuthSecret()
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestampStr, sig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Date.now();
  // Within 30 days and not more than 5 minutes into the future
  if (timestamp > now + 300000 || now - timestamp > SESSION_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Buffer.from(sig, "base64url");
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(timestampStr));
  } catch {
    return false;
  }
}
