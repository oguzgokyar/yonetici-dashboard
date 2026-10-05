import { getDatabase } from "@/lib/server/database";
import {
  fetchPostizPosts,
  deletePostizPost,
  fetchPostizIntegrations,
} from "@/lib/server/postiz-client";

export const runtime = "nodejs";

const COOLIFY_API_URL = process.env.COOLIFY_API_URL || "http://43.131.47.253:8000";
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN || "3|IaWLaaMX3Xc2osALRQdb8ok80fbD3p4gDfrQgrGw854f86f8";
const POSTIZ_SERVICE_UUID = "e1k5a86lpapxf1hjjsqervzi";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: "sync" | "purge_stuck" | "restart_service" | "health_details";
    projectId?: string;
  };

  const action = body.action || "sync";
  const database = getDatabase();

  // -------------------------------------------------------------
  // 1. SYNC ACTION
  // -------------------------------------------------------------
  if (action === "sync") {
    try {
      const postizPosts = await fetchPostizPosts();
      const localPosts = database
        .prepare(
          "SELECT id, status, postiz_post_id, release_url, error_message FROM content_posts WHERE postiz_post_id IS NOT NULL"
        )
        .all() as Array<{
        id: string;
        status: string;
        postiz_post_id: string;
        release_url?: string;
        error_message?: string;
      }>;

      const postizMap = new Map<string, (typeof postizPosts)[0]>();
      for (const p of postizPosts) {
        postizMap.set(p.id, p);
      }

      let updatedCount = 0;
      const now = new Date().toISOString();
      const updateStmt = database.prepare(`
        UPDATE content_posts
        SET status = ?, release_url = COALESCE(?, release_url), error_message = ?, updated_at = ?
        WHERE id = ?
      `);

      for (const local of localPosts) {
        const remote = postizMap.get(local.postiz_post_id);
        if (!remote) continue;

        let newStatus = local.status;
        let newReleaseUrl = local.release_url || null;
        let newErrorMessage = local.error_message || null;

        if (remote.state === "PUBLISHED") {
          newStatus = "published";
          if (remote.releaseURL) newReleaseUrl = remote.releaseURL;
        } else if (remote.state === "ERROR") {
          newStatus = "failed";
          if (remote.error) newErrorMessage = remote.error;
        } else if (remote.state === "QUEUE") {
          newStatus = "scheduled";
        } else if (remote.state === "DRAFT") {
          newStatus = "draft";
        }

        if (
          newStatus !== local.status ||
          (newReleaseUrl && newReleaseUrl !== local.release_url)
        ) {
          updateStmt.run(newStatus, newReleaseUrl, newErrorMessage, now, local.id);
          updatedCount++;
        }
      }

      return Response.json({
        ok: true,
        action: "sync",
        updatedCount,
        message: `${updatedCount} adet gönderi Postiz ile güncellendi.`,
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // -------------------------------------------------------------
  // 2. PURGE STUCK QUEUE (Takılmış / Zamanı Geçmiş Kayıtları Temizleme)
  // -------------------------------------------------------------
  if (action === "purge_stuck") {
    try {
      // Find posts where scheduled_at is more than 3 hours in the past and still 'scheduled'
      const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const stuckPosts = database
        .prepare(`
          SELECT id, title, postiz_post_id, scheduled_at
          FROM content_posts
          WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
        `)
        .all(cutoff) as Array<{
        id: string;
        title: string;
        postiz_post_id?: string;
        scheduled_at: string;
      }>;

      let purgedCount = 0;
      const now = new Date().toISOString();

      const failStmt = database.prepare(`
        UPDATE content_posts
        SET status = 'failed', error_message = 'Zaman aşımı: Gönderi planlanan saatte dağıtılamadı ve kuyruktan temizlendi.', updated_at = ?
        WHERE id = ?
      `);

      for (const p of stuckPosts) {
        if (p.postiz_post_id) {
          await deletePostizPost(p.postiz_post_id).catch(() => undefined);
        }
        failStmt.run(now, p.id);
        purgedCount++;
      }

      return Response.json({
        ok: true,
        action: "purge_stuck",
        purgedCount,
        message: `${purgedCount} adet takılmış gönderi temizlendi ve hata durumuna alındı.`,
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // -------------------------------------------------------------
  // 3. RESTART POSTIZ SERVICE (Coolify Restart)
  // -------------------------------------------------------------
  if (action === "restart_service") {
    try {
      const url = `${COOLIFY_API_URL}/api/v1/services/${POSTIZ_SERVICE_UUID}/restart`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${COOLIFY_TOKEN}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return Response.json(
          { ok: false, message: `Coolify restart hatası (${response.status}): ${text}` },
          { status: 502 }
        );
      }

      return Response.json({
        ok: true,
        action: "restart_service",
        message: "Postiz dağıtım servisi ve orkestratör yeniden başlatma komutu verildi. 15-30 sn içinde aktif olacaktır.",
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // -------------------------------------------------------------
  // 4. HEALTH DETAILS (Kanal Oturum & Yetki Kontrolü)
  // -------------------------------------------------------------
  if (action === "health_details") {
    try {
      const integrations = await fetchPostizIntegrations().catch(() => []);
      const channelAlerts: Array<{ id: string; name: string; alert: string }> = [];

      for (const int of integrations) {
        if (int.disabled) {
          channelAlerts.push({
            id: int.id,
            name: `${int.name} (${int.identifier})`,
            alert: "Hesap devre dışı bırakılmış.",
          });
        }
      }

      return Response.json({
        ok: true,
        integrations,
        channelAlerts,
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  return Response.json({ ok: false, message: "Geçersiz aksiyon." }, { status: 400 });
}

export async function GET() {
  return POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "health_details" }) }));
}
