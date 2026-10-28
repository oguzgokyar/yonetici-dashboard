import "server-only";

import { getDatabase } from "./database";
import { encryptSecret, decryptSecret } from "./secrets";

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "atolye2026";

export function getAdminPassword(): string {
  try {
    const db = getDatabase();
    const row = db
      .prepare("SELECT encrypted_api_key FROM integration_configs WHERE service = 'access_gate'")
      .get() as { encrypted_api_key?: string } | undefined;

    if (row?.encrypted_api_key) {
      return decryptSecret(row.encrypted_api_key);
    }
  } catch (e) {
    console.warn("[Auth] Failed to load password from DB, using fallback:", e);
  }
  return DEFAULT_ADMIN_PASSWORD;
}

export function validateAdminPassword(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const expected = getAdminPassword();
  return input.trim() === expected.trim();
}

export function updateAdminPassword(
  currentPass: string,
  newPass: string
): { ok: boolean; message: string } {
  if (!validateAdminPassword(currentPass)) {
    return { ok: false, message: "Mevcut şifre hatalı." };
  }
  if (!newPass || newPass.trim().length < 4) {
    return { ok: false, message: "Yeni şifre en az 4 karakter olmalıdır." };
  }

  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const encrypted = encryptSecret(newPass.trim());

    db.prepare(`
      INSERT INTO integration_configs (service, enabled, base_url, encrypted_api_key, settings_json, updated_at)
      VALUES ('access_gate', 1, '', ?, '{}', ?)
      ON CONFLICT(service) DO UPDATE SET
        encrypted_api_key = excluded.encrypted_api_key,
        updated_at = excluded.updated_at
    `).run(encrypted, now);

    return { ok: true, message: "Giriş şifresi başarıyla güncellendi." };
  } catch (e: any) {
    console.error("[Auth] Update password error:", e);
    return { ok: false, message: e.message || "Şifre güncellenemedi." };
  }
}
