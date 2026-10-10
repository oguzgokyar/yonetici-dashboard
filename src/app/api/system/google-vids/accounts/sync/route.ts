import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type DiscoveredAccount = {
  email: string;
  displayName?: string;
  authuserIndex: number;
  profileDirectory?: string;
};

export async function POST() {
  try {
    // Connect to internal browser discovery bridge on :8080
    // (runs where Chromium and Local State live)
    const bridgeUrls = [
      "http://10.0.1.1:8080/api/internal/google-vids/browser-accounts",
      "http://127.0.0.1:8080/api/internal/google-vids/browser-accounts",
      "http://10.0.1.8:8080/api/internal/google-vids/browser-accounts",
    ];

    let discoveredAccounts: DiscoveredAccount[] | null = null;

    for (const url of bridgeUrls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; accounts?: DiscoveredAccount[] };
          if (data.ok && Array.isArray(data.accounts)) {
            discoveredAccounts = data.accounts;
            break;
          }
        }
      } catch {
        // try next
      }
    }

    if (!discoveredAccounts || discoveredAccounts.length === 0) {
      return Response.json(
        {
          ok: false,
          message:
            "Chromium tarayıcısından hesaplar okunamadı. Tarayıcıda açık bir Google sekmesi olduğundan emin olun.",
        },
        { status: 503 }
      );
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    let syncedCount = 0;

    for (const acc of discoveredAccounts) {
      if (!acc.email || !acc.email.includes("@")) continue;
      const cleanEmail = acc.email.trim();
      const profDir = acc.profileDirectory || "Default";
      const accountId = `gva_${profDir.toLowerCase().replace(/\s+/g, "_")}_${acc.authuserIndex}`;
      const dName = acc.displayName || cleanEmail.split("@")[0];

      db.prepare(`
        INSERT INTO google_vids_accounts (
          id, email, authuser_index, profile_directory, display_name, quota_status, total_videos_rendered, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'available', 0, 1, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          authuser_index = excluded.authuser_index,
          profile_directory = excluded.profile_directory,
          display_name = excluded.display_name,
          is_active = 1,
          updated_at = excluded.updated_at
      `).run(accountId, cleanEmail, acc.authuserIndex, profDir, dName, now, now);
      syncedCount++;
    }

    return Response.json({
      ok: true,
      syncedCount,
      accounts: discoveredAccounts,
      message: `${syncedCount} adet Google hesabı (bbombermann, koraymasal632 vb.) tarayıcıdan başarıyla senkronize edildi.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Hesaplar senkronize edilemedi.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
