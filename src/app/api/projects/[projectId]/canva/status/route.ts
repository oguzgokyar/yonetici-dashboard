import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { isCanvaStudioEnabled, getCanvaConfig } from "@/lib/server/canva-config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {
  getCanvaPoolSummary,
  getNextAvailableCanvaAccount,
  markCanvaAccountExhausted,
  updateCanvaAccount,
} from "@/lib/server/canva-account-pool";

export const runtime = "nodejs";

const STATE_FILE = path.join(process.cwd(), ".data", "canva_quota_state.json");

interface QuotaStateFile {
  status: "normal" | "quota_exceeded";
  checkedAt: string;
  lastError?: string | null;
  message?: string;
}

function getCachedQuotaState(todayIso: string): QuotaStateFile | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as QuotaStateFile;
      if (data.checkedAt && data.checkedAt >= todayIso) {
        return data;
      }
    }
  } catch {}
  return null;
}

function saveQuotaState(data: QuotaStateFile) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  if (!isCanvaStudioEnabled()) {
    return NextResponse.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const pool = getCanvaPoolSummary();
  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const todayIso = todayStartUtc.toISOString();

  const cached = getCachedQuotaState(todayIso);

  let status: "normal" | "quota_exceeded" | "auth_required" =
    pool.hasAuthOutage || pool.totalAccounts === 0
      ? "auth_required"
      : pool.status === "all_exhausted"
      ? "quota_exceeded"
      : "normal";
  let lastError: string | null = pool.authMessage || (pool.totalAccounts === 0 ? "Canva havuzunda bağlı hesap bulunmuyor." : null);

  if (cached && status === "normal") {
    if (cached.status === "quota_exceeded" && pool.availableAccounts === 0) {
      status = "quota_exceeded";
      lastError = cached.lastError || null;
    }
  }

  const statusLabel =
    status === "auth_required"
      ? (pool.totalAccounts === 0 ? "Hesap Bağlı Değil" : "Oturum Düştü (Yetkilendirme Gerekli)")
      : status === "quota_exceeded"
      ? "Günlük Kota Doldu"
      : pool.totalAccounts > 1
      ? `${pool.availableAccounts}/${pool.activeAccounts} Hesap Aktif`
      : "API Aktif";

  return NextResponse.json({
    ok: true,
    status,
    statusLabel,
    hasAuthOutage: pool.hasAuthOutage,
    authStatus: pool.hasAuthOutage ? "auth_required" : "ok",
    reconnectUrl: pool.reconnectUrl,
    authMessage: pool.authMessage,
    dailyExportsCount: pool.usedToday,
    totalDailyCapacity: pool.totalDailyCapacity,
    availableAccounts: pool.availableAccounts,
    activeAccounts: pool.activeAccounts,
    totalAccounts: pool.totalAccounts,
    pool,
    resetsAt: pool.resetsAt,
    resetTimeFormatted: pool.resetTimeFormatted,
    hoursUntilReset: pool.hoursUntilReset,
    minutesUntilReset: pool.minutesUntilReset,
    lastError: lastError || pool.authMessage || null,
    lastCheckedAt: cached?.checkedAt || now.toISOString(),
  });
}

// POST: Canva durumunu anlık olarak probe et / test et
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  if (!isCanvaStudioEnabled()) {
    return NextResponse.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const db = getDatabase();

  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const nextResetUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

  // Son oluşturulan geçerli bir Canva tasarım kimliğini bul
  const pkg = db
    .prepare("SELECT canva_design_id FROM media_packages WHERE canva_design_id IS NOT NULL ORDER BY created_at DESC LIMIT 1")
    .get() as { canva_design_id?: string } | undefined;

  const designId = pkg?.canva_design_id;

  if (!designId) {
    return NextResponse.json({
      ok: true,
      status: "normal",
      statusLabel: "API Aktif",
      message: "Henüz test edilecek bir Canva tasarımı bulunmuyor, varsayılan aktif kabul edildi.",
    });
  }

  // Yerel köprü üzerinden export isteği yaparak kotanın açık olup olmadığını sına
  let isQuotaExceeded = false;
  let testError: string | null = null;

  try {
    const res = await new Promise<{ ok?: boolean; error?: string; raw?: any } | null>((resolve) => {
      const payload = JSON.stringify({ design_id: designId, format: { type: "png" } });
      const req = http.request(
        {
          hostname: "10.0.1.1",
          port: 8080,
          path: "/api/internal/canva/export",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            Connection: "close",
          },
          timeout: 15000,
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => {
            try { resolve(JSON.parse(body)); } catch { resolve(null); }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    });

    const isFallback =
      Boolean((res as any)?.is_quota_fallback) ||
      (res as any)?.fallback === "thumbnails" ||
      (Array.isArray((res as any)?.urls) && (res as any).urls.some((u: string) => u.includes("media.canva.com") || u.includes("width:400")));

    if (res && res.error && typeof res.error === "string") {
      if (res.error.includes("Too many daily export requests") || res.error.includes("quota")) {
        isQuotaExceeded = true;
        testError = res.error;
      }
    } else if (isFallback) {
      isQuotaExceeded = true;
      testError = "Too many daily export requests for user (400x500 thumbnail fallback aktif)";
    }

    if (isQuotaExceeded) {
      const activeAcc = getNextAvailableCanvaAccount();
      if (activeAcc) {
        markCanvaAccountExhausted(activeAcc.id, testError || "Too many daily export requests");
      }
    }
  } catch (e: any) {
    testError = e.message;
  }

  const finalStatus: "normal" | "quota_exceeded" = isQuotaExceeded ? "quota_exceeded" : "normal";
  const nowIso = now.toISOString();

  saveQuotaState({
    status: finalStatus,
    checkedAt: nowIso,
    lastError: testError,
    message: isQuotaExceeded
      ? "Canva günlük dışa aktarım kotası dolu. Gece 03:00 TSİ'de sıfırlanır."
      : "Canva API aktif ve dışa aktarım kullanılabilir durumda.",
  });

  const diffMs = Math.max(0, nextResetUtc.getTime() - now.getTime());
  const hoursUntilReset = Math.floor(diffMs / (1000 * 60 * 60));
  const minutesUntilReset = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return NextResponse.json({
    ok: true,
    status: finalStatus,
    statusLabel: finalStatus === "quota_exceeded" ? "Günlük Kota Doldu" : "API Aktif",
    message: isQuotaExceeded
      ? "Canva günlük dışa aktarım kotası dolu. Gece 03:00 TSİ'de sıfırlanır."
      : "Canva API aktif ve dışa aktarım kullanılabilir durumda.",
    hoursUntilReset,
    minutesUntilReset,
    resetTimeFormatted: "03:00 TSİ",
    lastCheckedAt: nowIso,
    lastError: testError,
  });
}
