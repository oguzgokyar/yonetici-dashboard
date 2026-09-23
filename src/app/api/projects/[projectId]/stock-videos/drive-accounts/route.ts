import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { getGoogleUserProfile, type TokenData } from "@/lib/server/google-drive";
import { encryptSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

type DriveAccountRow = {
  id: string;
  project_id: string;
  label: string;
  email: string;
  display_name: string;
  photo_link: string;
  encrypted_token_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();

  const rows = db
    .prepare(
      "SELECT id, label, email, display_name, photo_link, is_active, created_at, updated_at FROM project_drive_accounts WHERE project_id = ? ORDER BY is_active DESC, updated_at DESC"
    )
    .all(projectId) as unknown as Omit<DriveAccountRow, "encrypted_token_json" | "project_id">[];

  // Also check if fallback system account exists
  let systemAccount: { email: string; displayName: string; photoLink?: string } | null = null;
  try {
    const { getValidAccessToken } = await import("@/lib/server/google-drive");
    const sysToken = await getValidAccessToken(undefined);
    systemAccount = await getGoogleUserProfile(sysToken);
  } catch {
    // ignore
  }

  return Response.json({
    ok: true,
    accounts: rows.map((r) => ({
      ...r,
      isActive: Boolean(r.is_active),
    })),
    systemAccount,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const db = getDatabase();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "add" | "activate" | "delete" | "use_system";
    accountId?: string;
    label?: string;
    tokenJson?: string | Record<string, unknown>;
  };

  const action = body.action || "add";

  // 1. Add new account
  if (action === "add") {
    let tokenData: TokenData;
    try {
      if (typeof body.tokenJson === "string") {
        tokenData = JSON.parse(body.tokenJson.trim()) as TokenData;
      } else if (body.tokenJson && typeof body.tokenJson === "object") {
        tokenData = body.tokenJson as TokenData;
      } else {
        throw new Error("Token verisi geçersiz veya boş.");
      }
    } catch (e) {
      return Response.json(
        { ok: false, message: `Geçersiz JSON formatı: ${e instanceof Error ? e.message : String(e)}` },
        { status: 400 }
      );
    }

    if (!tokenData.access_token && !tokenData.refresh_token) {
      return Response.json(
        { ok: false, message: "Token verisi access_token veya refresh_token içermelidir." },
        { status: 400 }
      );
    }

    // Test token and fetch profile
    let profile: { email: string; displayName: string; photoLink?: string } = {
      email: "",
      displayName: "",
      photoLink: "",
    };
    try {
      let testAccess = tokenData.access_token;
      if (!testAccess && tokenData.refresh_token && tokenData.client_id && tokenData.client_secret) {
        const refreshParams = new URLSearchParams({
          client_id: tokenData.client_id,
          client_secret: tokenData.client_secret,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        });
        const refRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: refreshParams.toString(),
        });
        if (refRes.ok) {
          const refJson = (await refRes.json()) as { access_token: string };
          testAccess = refJson.access_token;
          tokenData.access_token = testAccess;
        }
      }
      profile = await getGoogleUserProfile(testAccess);
    } catch (e) {
      return Response.json(
        { ok: false, message: `Google Drive hesabına erişilemedi: ${e instanceof Error ? e.message : String(e)}` },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const encrypted = encryptSecret(JSON.stringify(tokenData));
    const label = (body.label || "").trim() || profile.displayName || profile.email || "Google Drive Hesabı";

    // Set other accounts inactive
    db.prepare("UPDATE project_drive_accounts SET is_active = 0, updated_at = ? WHERE project_id = ?").run(
      now,
      projectId
    );

    // Insert new active account
    db.prepare(`
      INSERT INTO project_drive_accounts (
        id, project_id, label, email, display_name, photo_link, encrypted_token_json, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, projectId, label, profile.email, profile.displayName, profile.photoLink || "", encrypted, now, now);

    // Update stock_drive_configs account_id
    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at
    `).run(projectId, id, now);

    return Response.json({
      ok: true,
      message: `Google Drive hesabı (${profile.email || label}) başarıyla bağlandı.`,
      account: {
        id,
        label,
        email: profile.email,
        displayName: profile.displayName,
        photoLink: profile.photoLink,
        isActive: true,
        createdAt: now,
      },
    });
  }

  // 2. Activate an existing account
  if (action === "activate") {
    if (!body.accountId) {
      return Response.json({ ok: false, message: "Hesap ID gerekli." }, { status: 400 });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE project_drive_accounts SET is_active = 0, updated_at = ? WHERE project_id = ?").run(
      now,
      projectId
    );
    db.prepare(
      "UPDATE project_drive_accounts SET is_active = 1, updated_at = ? WHERE id = ? AND project_id = ?"
    ).run(now, body.accountId, projectId);

    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at
    `).run(projectId, body.accountId, now);

    return Response.json({ ok: true, message: "Aktif hesap güncellendi." });
  }

  // 3. Revert to system account
  if (action === "use_system") {
    const now = new Date().toISOString();
    db.prepare("UPDATE project_drive_accounts SET is_active = 0, updated_at = ? WHERE project_id = ?").run(
      now,
      projectId
    );
    db.prepare(`
      INSERT INTO stock_drive_configs (project_id, account_id, updated_at)
      VALUES (?, '', ?)
      ON CONFLICT(project_id) DO UPDATE SET account_id = '', updated_at = excluded.updated_at
    `).run(projectId, now);

    return Response.json({ ok: true, message: "Sistem varsayılan Drive hesabına geçildi." });
  }

  // 4. Delete account
  if (action === "delete") {
    if (!body.accountId) {
      return Response.json({ ok: false, message: "Hesap ID gerekli." }, { status: 400 });
    }
    db.prepare("DELETE FROM project_drive_accounts WHERE id = ? AND project_id = ?").run(
      body.accountId,
      projectId
    );
    return Response.json({ ok: true, message: "Hesap silindi." });
  }

  return Response.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
}
