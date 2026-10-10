import { getDatabase } from "@/lib/server/database";

export interface GoogleVidsAccountRecord {
  id: string;
  email: string;
  authuser_index: number;
  profile_directory: string;
  display_name: string;
  quota_status: "available" | "exhausted" | "cooldown";
  quota_exhausted_at: string | null;
  cooldown_until: string | null;
  total_videos_rendered: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const KNOWN_SEED_ACCOUNTS = [
  {
    id: "gva_seed_0",
    email: "ai.deneyleri@gmail.com",
    authuser_index: 0,
    profile_directory: "Default",
    display_name: "Test Hesabı (ai.deneyleri)",
  },
  {
    id: "gva_seed_1",
    email: "oguzgokyar@gmail.com",
    authuser_index: 1,
    profile_directory: "Default",
    display_name: "Oğuz Gökyar (oguzgokyar)",
  },
  {
    id: "gva_seed_2",
    email: "koraymasal632@gmail.com",
    authuser_index: 2,
    profile_directory: "Profile 1",
    display_name: "Oğuz (koraymasal632)",
  },
];

/**
 * Ensures seed accounts are present in database and refreshes expired cooldowns.
 */
export function ensureGoogleVidsAccountsSeed(): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  // 1. Seed known accounts if table is empty
  for (const seed of KNOWN_SEED_ACCOUNTS) {
    db.prepare(`
      INSERT INTO google_vids_accounts (
        id, email, authuser_index, profile_directory, display_name, quota_status, total_videos_rendered, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'available', 0, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        authuser_index = excluded.authuser_index,
        profile_directory = excluded.profile_directory,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `).run(seed.id, seed.email, seed.authuser_index, seed.profile_directory, seed.display_name, now, now);
  }

  // 2. Clear expired cooldowns (e.g. cooldown_until < now)
  db.prepare(`
    UPDATE google_vids_accounts
    SET quota_status = 'available',
        quota_exhausted_at = NULL,
        cooldown_until = NULL,
        updated_at = ?
    WHERE quota_status != 'available'
      AND cooldown_until IS NOT NULL
      AND cooldown_until <= ?
  `).run(now, now);
}

/**
 * Retrieves all accounts and their live pool status.
 */
export function listGoogleVidsAccounts(): GoogleVidsAccountRecord[] {
  ensureGoogleVidsAccountsSeed();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM google_vids_accounts
    WHERE is_active = 1
    ORDER BY authuser_index ASC
  `).all() as unknown as GoogleVidsAccountRecord[];
}

/**
 * Acquires the best available account index from the pool for video generation.
 * Prefers 'available' status with lowest render count.
 * If all accounts are exhausted, returns the one whose cooldown expires earliest.
 */
/**
 * Acquires the best available account from the pool for video generation.
 * Accepts either preferredAccountId or preferredAuthuser.
 */
export function acquireAvailableVidsAccount(preferredIdentifier?: string | number): {
  id: string;
  authuser: number;
  profileDirectory: string;
  email: string;
  isFallback: boolean;
  quotaWarning?: string;
} {
  ensureGoogleVidsAccountsSeed();
  const db = getDatabase();
  const accounts = listGoogleVidsAccounts();

  if (!accounts.length) {
    return { id: "default", authuser: 1, profileDirectory: "Default", email: "oguzgokyar@gmail.com", isFallback: false };
  }

  // 1. If user explicitly asked for an account (by ID, email or authuser)
  if (preferredIdentifier !== undefined && preferredIdentifier !== null) {
    const requested = accounts.find(
      (a) =>
        a.id === String(preferredIdentifier) ||
        a.email === String(preferredIdentifier) ||
        a.authuser_index === Number(preferredIdentifier)
    );
    if (requested && requested.quota_status === "available" && requested.is_active !== 0) {
      return {
        id: requested.id,
        authuser: requested.authuser_index,
        profileDirectory: requested.profile_directory || "Default",
        email: requested.email,
        isFallback: false,
      };
    }
  }

  // 2. Select first available account in pool
  const available = accounts.filter((a) => a.quota_status === "available" && a.is_active !== 0);
  if (available.length > 0) {
    // Sort by least renders today / total
    available.sort((a, b) => a.total_videos_rendered - b.total_videos_rendered);
    const chosen = available[0];
    return {
      id: chosen.id,
      authuser: chosen.authuser_index,
      profileDirectory: chosen.profile_directory || "Default",
      email: chosen.email,
      isFallback: false,
    };
  }

  // 3. All accounts exhausted -> pick the one with earliest cooldown_until
  accounts.sort((a, b) => {
    const timeA = a.cooldown_until ? new Date(a.cooldown_until).getTime() : 0;
    const timeB = b.cooldown_until ? new Date(b.cooldown_until).getTime() : 0;
    return timeA - timeB;
  });

  const soonest = accounts[0];
  return {
    id: soonest.id,
    authuser: soonest.authuser_index,
    profileDirectory: soonest.profile_directory || "Default",
    email: soonest.email,
    isFallback: true,
    quotaWarning: "Tüm Google hesaplarının günlük oluşturma kotası dolmuş görünüyor.",
  };
}

/**
 * Marks an account as exhausted and puts it into cooldown (default 3 hours).
 */
export function markVidsAccountQuotaExhausted(authuserIndex: number, cooldownHours = 3): {
  nextAvailableAuthuser: number | null;
  message: string;
} {
  const db = getDatabase();
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE google_vids_accounts
    SET quota_status = 'exhausted',
        quota_exhausted_at = ?,
        cooldown_until = ?,
        updated_at = ?
    WHERE authuser_index = ?
  `).run(now.toISOString(), cooldownUntil, now.toISOString(), authuserIndex);

  // Check if there is another available account
  const nextAccount = db.prepare(`
    SELECT authuser_index, email FROM google_vids_accounts
    WHERE is_active = 1 AND quota_status = 'available'
    ORDER BY total_videos_rendered ASC
    LIMIT 1
  `).get() as { authuser_index: number; email: string } | undefined;

  if (nextAccount) {
    return {
      nextAvailableAuthuser: nextAccount.authuser_index,
      message: `Hesap (authuser=${authuserIndex}) kotaya takıldı. Havuzdaki sıradaki hesaba (${nextAccount.email}) geçildi.`,
    };
  }

  return {
    nextAvailableAuthuser: null,
    message: `Tüm Google Vids hesaplarının kotası doldu. ${cooldownHours} saat sonra tekrar açılacak.`,
  };
}

/**
 * Increments successful video render count for the account.
 */
export function recordVidsAccountRenderSuccess(authuserIndex: number): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE google_vids_accounts
    SET total_videos_rendered = total_videos_rendered + 1,
        quota_status = 'available',
        updated_at = ?
    WHERE authuser_index = ?
  `).run(now, authuserIndex);
}
