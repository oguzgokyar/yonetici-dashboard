import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { getGoogleUserProfile, type TokenData } from "@/lib/server/google-drive";
import { encryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

type DriveAccountRow = {
  id: string;
  label: string;
  email: string;
  display_name: string;
  photo_link: string;
  created_at: string;
  updated_at: string;
  used_by_project_count: number;
  status: string;
  last_validated_at: string | null;
  last_error: string | null;
};

function mapAccount(row: DriveAccountRow, selectedAccountId: string) {
  return {
    id: row.id,
    label: row.label,
    email: row.email,
    displayName: row.display_name,
    photoLink: row.photo_link,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usedByProjectCount: row.used_by_project_count,
    status: row.status,
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
    selectedForProject: row.id === selectedAccountId,
    isActive: row.id === selectedAccountId,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const config = db.prepare("SELECT account_id FROM stock_drive_configs WHERE project_id = ?")
    .get(projectId) as { account_id?: string } | undefined;
  const selectedAccountId = config?.account_id || "";
  const rows = db.prepare(`
    SELECT a.id, a.label, a.email, a.display_name, a.photo_link, a.created_at, a.updated_at,
           a.status, a.last_validated_at, a.last_error,
           (SELECT COUNT(*) FROM stock_drive_configs c WHERE c.account_id = a.id) AS used_by_project_count
    FROM drive_accounts a
    ORDER BY a.updated_at DESC, a.label COLLATE NOCASE
  `).all() as unknown as DriveAccountRow[];

  let systemAccount: { email: string; displayName: string; photoLink?: string } | null = null;
  try {
    const { getValidAccessToken } = await import("@/lib/server/google-drive");
    systemAccount = await getGoogleUserProfile(await getValidAccessToken());
  } catch {
    // The system fallback account is optional.
  }

  return Response.json({
    ok: true,
    oauthConfigured: Boolean(
      process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim()
    ),
    selectedAccountId,
    accounts: rows.map((row) => mapAccount(row, selectedAccountId)),
    systemAccount: systemAccount ? { ...systemAccount, selectedForProject: !selectedAccountId } : null,
  });
}

async function normalizeToken(bodyToken: string | Record<string, unknown> | undefined) {
  let tokenData: TokenData;
  if (typeof bodyToken === "string") tokenData = JSON.parse(bodyToken.trim()) as TokenData;
  else if (bodyToken && typeof bodyToken === "object") tokenData = bodyToken as TokenData;
  else throw new Error("Google kimlik dosyası boş veya geçersiz.");

  if (!tokenData.access_token && tokenData.refresh_token && tokenData.client_id && tokenData.client_secret) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: tokenData.client_id,
        client_secret: tokenData.client_secret,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) throw new Error("Google erişim anahtarı yenilenemedi.");
    const data = await response.json() as { access_token: string; expires_in?: number };
    tokenData.access_token = data.access_token;
    if (data.expires_in) tokenData.expiry_date = Date.now() + data.expires_in * 1000;
  }
  if (!tokenData.access_token) throw new Error("Kimlik dosyası kullanılabilir access_token içermiyor.");
  return tokenData;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const body = await request.json().catch(() => ({})) as {
    action?: "add" | "select" | "activate" | "delete" | "use_system" | "rename" | "detach";
    accountId?: string;
    label?: string;
    tokenJson?: string | Record<string, unknown>;
  };
  const action = body.action || "add";
  const now = new Date().toISOString();

  if (action === "add") {
    try {
      const tokenData = await normalizeToken(body.tokenJson);
      const profile = await getGoogleUserProfile(tokenData.access_token);
      const normalizedEmail = profile.email.trim().toLocaleLowerCase("en-US");
      const existing = normalizedEmail
        ? db.prepare("SELECT id FROM drive_accounts WHERE email = ?").get(normalizedEmail) as { id: string } | undefined
        : undefined;
      const accountId = existing?.id || crypto.randomUUID();
      const label = body.label?.trim() || profile.displayName || normalizedEmail || "Google Drive";
      const encryptedToken = encryptSecret(JSON.stringify(tokenData));
      const scopes = tokenData.scope?.split(/\s+/).filter(Boolean) || [];
      const expiresAt = tokenData.expiry_date ? new Date(tokenData.expiry_date).toISOString() : null;

      if (existing) {
        db.prepare(`
          UPDATE drive_accounts
          SET label = ?, display_name = ?, photo_link = ?, encrypted_token_json = ?,
              status = 'active', scopes_json = ?, token_expires_at = ?, last_validated_at = ?, last_error = NULL, updated_at = ?
          WHERE id = ?
        `).run(label, profile.displayName, profile.photoLink || "", encryptedToken, JSON.stringify(scopes), expiresAt, now, now, accountId);
      } else {
        db.prepare(`
          INSERT INTO drive_accounts (
            id, label, email, display_name, photo_link, encrypted_token_json,
            status, scopes_json, token_expires_at, last_validated_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
        `).run(accountId, label, normalizedEmail, profile.displayName, profile.photoLink || "", encryptedToken, JSON.stringify(scopes), expiresAt, now, now, now);
      }

      db.prepare(`
        INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at
      `).run(projectId, accountId, now);

      return Response.json({ ok: true, message: `${label} bağlandı ve bu proje için seçildi.`, accountId });
    } catch (error) {
      return Response.json({
        ok: false,
        message: error instanceof Error ? error.message : "Google Drive hesabı bağlanamadı.",
      }, { status: 400 });
    }
  }

  if (action === "select" || action === "activate") {
    if (!body.accountId) return Response.json({ ok: false, message: "Hesap seçilmedi." }, { status: 400 });
    const account = db.prepare("SELECT id FROM drive_accounts WHERE id = ?").get(body.accountId);
    if (!account) return Response.json({ ok: false, message: "Drive hesabı bulunamadı." }, { status: 404 });
    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at
    `).run(projectId, body.accountId, now);
    return Response.json({ ok: true, message: "Drive hesabı bu proje için seçildi." });
  }

  if (action === "use_system") {
    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, '', ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = '', updated_at = excluded.updated_at
    `).run(projectId, now);
    return Response.json({ ok: true, message: "Bu proje sistem Drive hesabını kullanacak." });
  }

  if (action === "detach") {
    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, '', ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = '', updated_at = excluded.updated_at
    `).run(projectId, now);
    return Response.json({ ok: true, message: "Drive hesabı bu projeden ayrıldı." });
  }

  if (action === "rename") {
    if (!body.accountId || !body.label?.trim()) {
      return Response.json({ ok: false, message: "Hesap ve yeni etiket gerekli." }, { status: 400 });
    }
    const result = db.prepare("UPDATE drive_accounts SET label = ?, updated_at = ? WHERE id = ?")
      .run(body.label.trim(), now, body.accountId);
    if (!result.changes) return Response.json({ ok: false, message: "Drive hesabı bulunamadı." }, { status: 404 });
    return Response.json({ ok: true, message: "Hesap etiketi güncellendi." });
  }

  if (action === "delete") {
    if (!body.accountId) return Response.json({ ok: false, message: "Hesap seçilmedi." }, { status: 400 });
    const usage = db.prepare("SELECT COUNT(*) AS total FROM stock_drive_configs WHERE account_id = ?")
      .get(body.accountId) as { total: number };
    if (usage.total > 0) {
      return Response.json({ ok: false, message: `Bu hesap ${usage.total} projede kullanılıyor. Önce projelerde başka hesap seçin.` }, { status: 409 });
    }
    db.prepare("DELETE FROM drive_accounts WHERE id = ?").run(body.accountId);
    return Response.json({ ok: true, message: "Drive hesabı kaldırıldı." });
  }

  return Response.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
}
