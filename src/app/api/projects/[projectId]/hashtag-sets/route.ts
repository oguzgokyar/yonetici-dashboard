import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  DEFAULT_HASHTAG_TEMPLATES,
  normalizeHashtagList,
  type HashtagCategory,
  type HashtagSetPlatform,
} from "@/lib/social/hashtag-policy";

type Context = { params: Promise<{ projectId: string }> };
const PLATFORMS = new Set<HashtagSetPlatform>(["all", "instagram", "youtube", "tiktok", "facebook", "twitter"]);
const CATEGORIES = new Set<HashtagCategory>(["brand", "topic", "trend"]);

function serialize(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    platform: String(row.platform) as HashtagSetPlatform,
    name: String(row.name),
    hashtags: JSON.parse(String(row.hashtags_json || "[]")),
    category: (String(row.category || "topic") as HashtagCategory),
    rotationCount: Number(row.rotation_count || 0),
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const rows = getDatabase().prepare(`
    SELECT * FROM project_hashtag_sets
    WHERE project_id = ?
    ORDER BY (CASE platform WHEN 'all' THEN 0 ELSE 1 END), platform, is_default DESC, name COLLATE NOCASE
  `).all(projectId) as Record<string, unknown>[];
  return Response.json({ ok: true, sets: rows.map(serialize) });
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const input = await request.json().catch(() => ({})) as {
    action?: string;
    platform?: HashtagSetPlatform;
    name?: string;
    hashtags?: string[] | string;
    category?: HashtagCategory;
    rotationCount?: number;
    enabled?: boolean;
    isDefault?: boolean;
  };

  const database = getDatabase();
  const now = new Date().toISOString();

  // Tek tıkla hazır şablonları yükleme aksiyonu
  if (input.action === "seed_templates") {
    const created: Record<string, unknown>[] = [];
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const tpl of DEFAULT_HASHTAG_TEMPLATES) {
        const existing = database.prepare("SELECT id FROM project_hashtag_sets WHERE project_id = ? AND platform = ? AND name = ?")
          .get(projectId, tpl.platform, tpl.name);
        if (existing) continue;
        const id = crypto.randomUUID();
        database.prepare(`
          INSERT INTO project_hashtag_sets
          (id, project_id, platform, name, hashtags_json, category, rotation_count, enabled, is_default, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(id, projectId, tpl.platform, tpl.name, JSON.stringify(tpl.hashtags), tpl.category, tpl.rotationCount, tpl.isDefault ? 1 : 0, now, now);
        const row = database.prepare("SELECT * FROM project_hashtag_sets WHERE id = ?").get(id) as Record<string, unknown>;
        created.push(serialize(row));
      }
      database.exec("COMMIT");
      const allRows = database.prepare("SELECT * FROM project_hashtag_sets WHERE project_id = ? ORDER BY (CASE platform WHEN 'all' THEN 0 ELSE 1 END), platform, is_default DESC, name COLLATE NOCASE").all(projectId) as Record<string, unknown>[];
      return Response.json({ ok: true, createdCount: created.length, sets: allRows.map(serialize) });
    } catch (e) {
      try { database.exec("ROLLBACK"); } catch {}
      return Response.json({ ok: false, message: e instanceof Error ? e.message : "Şablonlar yüklenemedi." }, { status: 500 });
    }
  }

  const platform = input.platform;
  const name = input.name?.trim() || "";
  if (!platform || !PLATFORMS.has(platform) || !name) {
    return Response.json({ ok: false, message: "Geçerli platform ve küme adı zorunludur." }, { status: 400 });
  }
  const category: HashtagCategory = input.category && CATEGORIES.has(input.category) ? input.category : "topic";
  const rotationCount = Math.max(0, Number(input.rotationCount || 0));

  const hashtags = normalizeHashtagList(input.hashtags || []);
  if (!hashtags.length) {
    return Response.json({ ok: false, message: "Kümede en az bir geçerli etiket olmalıdır." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  try {
    database.exec("BEGIN IMMEDIATE");
    if (input.isDefault) {
      database.prepare("UPDATE project_hashtag_sets SET is_default = 0, updated_at = ? WHERE project_id = ? AND platform = ?")
        .run(now, projectId, platform);
    }
    database.prepare(`
      INSERT INTO project_hashtag_sets
      (id, project_id, platform, name, hashtags_json, category, rotation_count, enabled, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, platform, name, JSON.stringify(hashtags), category, rotationCount, input.enabled === false ? 0 : 1, input.isDefault ? 1 : 0, now, now);
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    const message = error instanceof Error && error.message.includes("UNIQUE")
      ? "Bu platformda aynı adlı bir etiket kümesi zaten var."
      : error instanceof Error ? error.message : "Etiket kümesi oluşturulamadı.";
    return Response.json({ ok: false, message }, { status: 409 });
  }

  const row = database.prepare("SELECT * FROM project_hashtag_sets WHERE id = ?").get(id) as Record<string, unknown>;
  return Response.json({ ok: true, set: serialize(row) }, { status: 201 });
}
