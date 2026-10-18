import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";

export interface CanvaAccount {
  id: string;
  displayName: string;
  email: string;
  quotaStatus: "available" | "exhausted" | "cooldown";
  dailyExportsCount: number;
  totalExportsCount: number;
  lastUsedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  hasToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CanvaAccountWithToken extends CanvaAccount {
  tokenJson: string;
}

export interface CanvaPoolSummary {
  totalAccounts: number;
  activeAccounts: number;
  availableAccounts: number;
  totalDailyCapacity: number;
  usedToday: number;
  remainingToday: number;
  resetsAt: string;
  resetTimeFormatted: string;
  hoursUntilReset: number;
  minutesUntilReset: number;
  status: "available" | "partially_exhausted" | "all_exhausted";
}

interface DbCanvaAccountRow {
  id: string;
  email: string | null;
  display_name: string;
  token_json: string;
  quota_status: string;
  quota_exhausted_at: string | null;
  daily_exports_count: number;
  total_exports_count: number;
  last_used_at: string | null;
  last_error: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Checks if 00:00 UTC (03:00 TSİ) has passed since last reset,
 * and resets daily counts and exhausted quotas.
 */
function autoResetQuotasIfNeeded() {
  const db = getDatabase();
  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const todayIso = todayStartUtc.toISOString();

  try {
    // Reset any account whose updated_at or quota_exhausted_at was before today's 00:00 UTC
    db.prepare(`
      UPDATE canva_accounts
      SET daily_exports_count = 0,
          quota_status = 'available',
          quota_exhausted_at = NULL,
          updated_at = ?
      WHERE quota_status = 'exhausted'
        AND (quota_exhausted_at IS NULL OR quota_exhausted_at < ?)
    `).run(now.toISOString(), todayIso);
  } catch {}
}

export function listCanvaAccounts(): CanvaAccount[] {
  autoResetQuotasIfNeeded();
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, email, display_name, token_json, quota_status, quota_exhausted_at,
           daily_exports_count, total_exports_count, last_used_at, last_error,
           is_active, created_at, updated_at
    FROM canva_accounts
    ORDER BY created_at ASC
  `).all() as unknown as DbCanvaAccountRow[];

  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email || "",
    quotaStatus: (r.quota_status as "available" | "exhausted" | "cooldown") || "available",
    dailyExportsCount: r.daily_exports_count || 0,
    totalExportsCount: r.total_exports_count || 0,
    lastUsedAt: r.last_used_at,
    lastError: r.last_error,
    isActive: r.is_active === 1,
    hasToken: Boolean(r.token_json && r.token_json !== "{}"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getCanvaAccountWithToken(id: string): CanvaAccountWithToken | null {
  autoResetQuotasIfNeeded();
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, email, display_name, token_json, quota_status, quota_exhausted_at,
           daily_exports_count, total_exports_count, last_used_at, last_error,
           is_active, created_at, updated_at
    FROM canva_accounts
    WHERE id = ?
  `).get(id) as DbCanvaAccountRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email || "",
    quotaStatus: (row.quota_status as "available" | "exhausted" | "cooldown") || "available",
    dailyExportsCount: row.daily_exports_count || 0,
    totalExportsCount: row.total_exports_count || 0,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    isActive: row.is_active === 1,
    hasToken: Boolean(row.token_json && row.token_json !== "{}"),
    tokenJson: row.token_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Selects the next available Canva account in the pool (Round-robin / least recently used).
 */
export function getNextAvailableCanvaAccount(): CanvaAccountWithToken | null {
  autoResetQuotasIfNeeded();
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, email, display_name, token_json, quota_status, quota_exhausted_at,
           daily_exports_count, total_exports_count, last_used_at, last_error,
           is_active, created_at, updated_at
    FROM canva_accounts
    WHERE is_active = 1 AND quota_status = 'available'
    ORDER BY last_used_at ASC NULLS FIRST, daily_exports_count ASC
    LIMIT 1
  `).get() as DbCanvaAccountRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email || "",
    quotaStatus: "available",
    dailyExportsCount: row.daily_exports_count || 0,
    totalExportsCount: row.total_exports_count || 0,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    isActive: true,
    hasToken: Boolean(row.token_json && row.token_json !== "{}"),
    tokenJson: row.token_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function markCanvaAccountExhausted(id: string, error?: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE canva_accounts
    SET quota_status = 'exhausted',
        quota_exhausted_at = ?,
        last_error = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, error || "Too many daily export requests for user", now, id);
}

export function recordCanvaAccountSuccess(id: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE canva_accounts
    SET daily_exports_count = daily_exports_count + 1,
        total_exports_count = total_exports_count + 1,
        last_used_at = ?,
        last_error = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
}

export function addCanvaAccount(params: {
  displayName: string;
  email?: string;
  tokenJson: string;
}): CanvaAccount {
  const db = getDatabase();
  const id = `canva_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO canva_accounts (
      id, email, display_name, token_json, quota_status,
      daily_exports_count, total_exports_count, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'available', 0, 0, 1, ?, ?)
  `).run(id, params.email?.trim() || null, params.displayName.trim(), params.tokenJson.trim(), now, now);

  return {
    id,
    displayName: params.displayName.trim(),
    email: params.email?.trim() || "",
    quotaStatus: "available",
    dailyExportsCount: 0,
    totalExportsCount: 0,
    lastUsedAt: null,
    lastError: null,
    isActive: true,
    hasToken: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCanvaAccount(
  id: string,
  params: {
    displayName?: string;
    email?: string;
    isActive?: boolean;
    quotaStatus?: "available" | "exhausted" | "cooldown";
    tokenJson?: string;
  }
): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const args: unknown[] = [now];

  if (typeof params.displayName === "string") {
    updates.push("display_name = ?");
    args.push(params.displayName.trim());
  }
  if (typeof params.email === "string") {
    updates.push("email = ?");
    args.push(params.email.trim());
  }
  if (typeof params.isActive === "boolean") {
    updates.push("is_active = ?");
    args.push(params.isActive ? 1 : 0);
  }
  if (params.quotaStatus) {
    updates.push("quota_status = ?");
    args.push(params.quotaStatus);
    if (params.quotaStatus === "available") {
      updates.push("quota_exhausted_at = NULL");
      updates.push("last_error = NULL");
    }
  }
  if (params.tokenJson) {
    updates.push("token_json = ?");
    args.push(params.tokenJson.trim());
  }

  args.push(id);
  const result = db.prepare(`UPDATE canva_accounts SET ${updates.join(", ")} WHERE id = ?`).run(...args);
  return result.changes > 0;
}

export function deleteCanvaAccount(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM canva_accounts WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getCanvaPoolSummary(): CanvaPoolSummary {
  autoResetQuotasIfNeeded();
  const accounts = listCanvaAccounts();
  const now = new Date();
  const nextResetUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffMs = Math.max(0, nextResetUtc.getTime() - now.getTime());
  const hoursUntilReset = Math.floor(diffMs / (1000 * 60 * 60));
  const minutesUntilReset = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const activeAccounts = accounts.filter((a) => a.isActive);
  const availableAccounts = activeAccounts.filter((a) => a.quotaStatus === "available");
  const totalDailyCapacity = activeAccounts.length * 500;
  const usedToday = accounts.reduce((acc, a) => acc + a.dailyExportsCount, 0);
  const remainingToday = Math.max(0, availableAccounts.length * 500 - usedToday);

  let status: "available" | "partially_exhausted" | "all_exhausted" = "available";
  if (availableAccounts.length === 0) {
    status = "all_exhausted";
  } else if (availableAccounts.length < activeAccounts.length) {
    status = "partially_exhausted";
  }

  return {
    totalAccounts: accounts.length,
    activeAccounts: activeAccounts.length,
    availableAccounts: availableAccounts.length,
    totalDailyCapacity,
    usedToday,
    remainingToday,
    resetsAt: nextResetUtc.toISOString(),
    resetTimeFormatted: "03:00 TSİ",
    hoursUntilReset,
    minutesUntilReset,
    status,
  };
}
