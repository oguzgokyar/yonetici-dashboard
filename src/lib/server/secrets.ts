import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function getEncryptionKey() {
  const configured = process.env.APP_ENCRYPTION_KEY;
  if (configured) return crypto.createHash("sha256").update(configured).digest();

  const keyPath = path.join(process.cwd(), ".data", "encryption.key");
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32), { mode: 0o600 });
  return crypto.createHash("sha256").update(fs.readFileSync(keyPath)).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
  if (value.length < 8) return "••••••••";
  return `${value.slice(0, 3)}••••••••${value.slice(-4)}`;
}
