import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  listGoogleVidsAccounts,
  ensureGoogleVidsAccountsSeed,
} from "@/lib/server/google-vids-account-pool";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = listGoogleVidsAccounts();
    const availableCount = accounts.filter((a) => a.quota_status === "available" && a.is_active === 1).length;

    return Response.json({
      ok: true,
      accounts,
      availableCount,
      totalCount: accounts.length,
      estimatedVideoCapacity: availableCount * 8, // ortalama 7-8 video/hesap
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap havuzu okunamadı.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      authuserIndex?: number;
      displayName?: string;
    };

    if (!body.email || typeof body.authuserIndex !== "number") {
      return Response.json({ ok: false, message: "E-posta ve authuser indexi gereklidir." }, { status: 400 });
    }

    ensureGoogleVidsAccountsSeed();
    const db = getDatabase();
    const now = new Date().toISOString();
    const accountId = `gva_${crypto.randomUUID().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO google_vids_accounts (
        id, email, authuser_index, display_name, quota_status, total_videos_rendered, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'available', 0, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        authuser_index = excluded.authuser_index,
        display_name = excluded.display_name,
        is_active = 1,
        updated_at = excluded.updated_at
    `).run(accountId, body.email.trim(), body.authuserIndex, (body.displayName || body.email).trim(), now, now);

    return Response.json({ ok: true, message: "Hesap başarıyla havuza eklendi." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap eklenemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      quotaStatus?: "available" | "exhausted" | "cooldown";
      isActive?: boolean;
    };

    if (!body.id) {
      return Response.json({ ok: false, message: "Hesap ID gereklidir." }, { status: 400 });
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    if (body.quotaStatus) {
      db.prepare(`
        UPDATE google_vids_accounts
        SET quota_status = ?,
            cooldown_until = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(body.quotaStatus, now, body.id);
    }

    if (typeof body.isActive === "boolean") {
      db.prepare(`
        UPDATE google_vids_accounts
        SET is_active = ?,
            updated_at = ?
        WHERE id = ?
      `).run(body.isActive ? 1 : 0, now, body.id);
    }

    return Response.json({ ok: true, message: "Hesap güncellendi." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap güncellenemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ ok: false, message: "Silinecek hesap ID'si gereklidir." }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare("DELETE FROM google_vids_accounts WHERE id = ?").run(id);

    return Response.json({ ok: true, message: "Hesap başarıyla havuzdan kaldırıldı." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesap silinemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
