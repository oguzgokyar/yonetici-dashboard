import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "@/lib/server/database";
import { uploadVideoViaTikTokBrowser } from "@/lib/server/tiktok-browser-service";

type GlobalSchedulerState = {
  timers: Map<string, NodeJS.Timeout>;
  executionChain: Promise<void>;
  rehydrated: boolean;
};

const globalForScheduler = globalThis as unknown as {
  __tiktokExactScheduler?: GlobalSchedulerState;
};

function getSchedulerState(): GlobalSchedulerState {
  if (!globalForScheduler.__tiktokExactScheduler) {
    globalForScheduler.__tiktokExactScheduler = {
      timers: new Map(),
      executionChain: Promise.resolve(),
      rehydrated: false,
    };
  }
  return globalForScheduler.__tiktokExactScheduler;
}

export function getTikTokQueueDir(): string {
  const dir = path.join(process.cwd(), ".data", "tiktok-queue");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Enqueues a TikTok browser upload into a strict sequential FIFO promise chain
 * so two videos scheduled at the same timestamp never collide on the Chrome profile.
 */
function enqueueTikTokExecution(task: () => Promise<void>): Promise<void> {
  const state = getSchedulerState();
  const next = state.executionChain.then(task).catch((err) => {
    console.error("[TikTok Exact Scheduler] Queue execution error:", err);
  });
  state.executionChain = next;
  return next;
}

/**
 * Executes the actual TikTok direct upload when the exact scheduled timestamp arrives.
 */
export async function executeDueTikTokPost(postId: string): Promise<void> {
  const state = getSchedulerState();
  state.timers.delete(postId);

  return enqueueTikTokExecution(async () => {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT id, project_id, title, caption, hashtags, status, local_path, media_url
         FROM content_posts
         WHERE id = ?`
      )
      .get(postId) as
      | {
          id: string;
          project_id: string;
          title: string;
          caption: string;
          hashtags: string;
          status: string;
          local_path?: string;
          media_url?: string;
        }
      | undefined;

    // Gönderi silinmişse veya zaten yayınlanmışsa çık
    if (!row || row.status !== "scheduled") {
      return;
    }

    const nowIso = new Date().toISOString();
    // Atomik kilit: durumu 'publishing' yap
    const lockRes = db
      .prepare("UPDATE content_posts SET status = 'publishing', updated_at = ? WHERE id = ? AND status = 'scheduled'")
      .run(nowIso, postId);

    if (!lockRes.changes) {
      return;
    }

    console.log(`[TikTok Exact Scheduler] ⏰ Zamanı geldi, TikTok'a yükleniyor: "${row.title}" (${postId})`);

    let videoPath = row.local_path && fs.existsSync(/*turbopackIgnore: true*/ row.local_path) ? row.local_path : "";
    let tempCleanupPath = "";

    try {
      // Eğer local_path yoksa media_url üzerinden çözmeyi dene
      if (!videoPath && row.media_url) {
        const dataDir = path.join(process.cwd(), ".data");
        if (row.media_url.startsWith("/")) {
          const cand1 = path.join(process.cwd(), "public", row.media_url.replace(/^\//, ""));
          const cand2 = path.join(dataDir, row.media_url.replace(/^\//, ""));
          if (fs.existsSync(/*turbopackIgnore: true*/ cand1)) videoPath = cand1;
          else if (fs.existsSync(/*turbopackIgnore: true*/ cand2)) videoPath = cand2;
        } else if (row.media_url.startsWith("http")) {
          const res = await fetch(row.media_url);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            tempCleanupPath = path.join(getTikTokQueueDir(), `tmp_${postId}.mp4`);
            fs.writeFileSync(tempCleanupPath, buf);
            videoPath = tempCleanupPath;
          }
        }
      }

      if (!videoPath || !fs.existsSync(/*turbopackIgnore: true*/ videoPath)) {
        throw new Error("Kuyruktaki video dosyası bulunamadı.");
      }

      let fullCaption = (row.caption || "").trim();
      if (row.hashtags && row.hashtags.trim()) {
        const formattedTags = row.hashtags
          .trim()
          .split(/[\s,]+/)
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ");
        fullCaption = `${fullCaption}\n\n${formattedTags}`.trim();
      }

      // DOĞRUDAN ŞİMDİ PAYLAŞ (scheduleTime parametresi gönderilmez!)
      const browserRes = await uploadVideoViaTikTokBrowser({
        videoPath,
        caption: fullCaption,
        visibility: "PUBLIC",
      });

      if (!browserRes.ok) {
        throw new Error(browserRes.error || "TikTok tarayıcı yüklemesi başarısız oldu.");
      }

      const doneIso = new Date().toISOString();
      db.prepare(
        `UPDATE content_posts
         SET status = 'published',
             postiz_post_id = ?,
             error_message = NULL,
             updated_at = ?
         WHERE id = ?`
      ).run(`tiktok_browser_${postId.slice(0, 8)}`, doneIso, postId);

      console.log(`[TikTok Exact Scheduler] ✅ Başarıyla TikTok'ta yayınlandı: "${row.title}" (${postId})`);

      // Başarılı yayın sonrası kuyruk kopyasını temizle
      if (row.local_path && row.local_path.includes("tiktok-queue") && fs.existsSync(/*turbopackIgnore: true*/ row.local_path)) {
        try {
          fs.unlinkSync(row.local_path);
        } catch {}
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[TikTok Exact Scheduler] ❌ Yayın hatası (${postId}):`, errMsg);
      db.prepare(
        `UPDATE content_posts
         SET status = 'failed',
             error_message = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(errMsg, new Date().toISOString(), postId);
    } finally {
      if (tempCleanupPath && fs.existsSync(/*turbopackIgnore: true*/ tempCleanupPath)) {
        try {
          fs.unlinkSync(tempCleanupPath);
        } catch {}
      }
    }
  });
}

/**
 * Sets an exact-time alarm (setTimeout) for the given post ID and target timestamp.
 * Zero polling overhead: sleeps until the exact millisecond of `scheduledAt`.
 */
export function scheduleExactTikTokPost(postId: string, scheduledAt: string): void {
  const state = getSchedulerState();

  // Varsa eski zamanlayıcıyı iptal et
  cancelExactTikTokPost(postId);

  const targetMs = new Date(scheduledAt).getTime();
  if (isNaN(targetMs)) {
    console.warn(`[TikTok Exact Scheduler] Geçersiz tarih formatı (${postId}): ${scheduledAt}`);
    return;
  }

  const nowMs = Date.now();
  const delayMs = targetMs - nowMs;

  if (delayMs <= 1000) {
    // Zamanı zaten gelmiş veya geçmişse hemen sıraya al
    console.log(`[TikTok Exact Scheduler] ⚡ Zamanı gelmiş gönderi hemen başlatılıyor (${postId})`);
    const immediateTimer = setTimeout(() => {
      void executeDueTikTokPost(postId);
    }, 500);
    state.timers.set(postId, immediateTimer);
    return;
  }

  // Node.js maksimum setTimeout sınırı (24.8 gün = 2147483647 ms)
  const MAX_TIMEOUT_MS = 2_147_483_647;
  if (delayMs > MAX_TIMEOUT_MS) {
    const intermediateTimer = setTimeout(() => {
      scheduleExactTikTokPost(postId, scheduledAt);
    }, MAX_TIMEOUT_MS);
    state.timers.set(postId, intermediateTimer);
    return;
  }

  const minutesLeft = Math.round(delayMs / 60000);
  console.log(
    `[TikTok Exact Scheduler] 📅 Gönderi alarmı kuruldu (${postId}) -> Hedef: ${scheduledAt} (${minutesLeft} dk sonra)`
  );

  const timer = setTimeout(() => {
    void executeDueTikTokPost(postId);
  }, delayMs);

  state.timers.set(postId, timer);
}

/**
 * Cancels an active timer if the post is deleted or rescheduled.
 */
export function cancelExactTikTokPost(postId: string): void {
  const state = getSchedulerState();
  const existing = state.timers.get(postId);
  if (existing) {
    clearTimeout(existing);
    state.timers.delete(postId);
  }
}

/**
 * Rehydrates all pending scheduled TikTok posts on server startup (runs once).
 */
export function ensureTikTokSchedulersRehydrated(): void {
  const state = getSchedulerState();
  if (state.rehydrated) return;
  state.rehydrated = true;

  try {
    const db = getDatabase();
    // Yarım kalmış 'publishing' durumundaki gönderileri tekrar 'scheduled' yap
    db.prepare(
      `UPDATE content_posts
       SET status = 'scheduled'
       WHERE status = 'publishing'
         AND integration_id IN (
           SELECT integration_id FROM project_social_accounts WHERE identifier LIKE '%tiktok%'
         )`
    ).run();

    const pendingRows = db
      .prepare(
        `SELECT id, scheduled_at, title
         FROM content_posts
         WHERE status = 'scheduled'
           AND scheduled_at IS NOT NULL
           AND integration_id IN (
             SELECT integration_id FROM project_social_accounts WHERE identifier LIKE '%tiktok%'
           )
         ORDER BY scheduled_at ASC`
      )
      .all() as Array<{ id: string; scheduled_at: string; title: string }>;

    if (pendingRows.length > 0) {
      console.log(`[TikTok Exact Scheduler] 🔄 Başlangıçta ${pendingRows.length} bekleyen TikTok gönderisi yeniden kuruldu.`);
      for (const row of pendingRows) {
        scheduleExactTikTokPost(row.id, row.scheduled_at);
      }
    }
  } catch (err) {
    console.warn("[TikTok Exact Scheduler] Rehydration uyarısı:", err);
  }
}
