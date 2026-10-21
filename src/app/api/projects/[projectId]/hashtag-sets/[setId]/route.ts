import { getDatabase } from "@/lib/server/database";
import {
  normalizeHashtagList,
  type HashtagCategory,
  type HashtagSetPlatform,
} from "@/lib/social/hashtag-policy";

type Context = { params: Promise<{ projectId: string; setId: string }> };
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

export async function PATCH(request: Request, context: Context) {
  const { projectId, setId } = await context.params;
  const input = await request.json().catch(() => ({})) as {
    platform?: HashtagSetPlatform;
    name?: string;
    hashtags?: string[] | string;
    category?: HashtagCategory;
    rotationCount?: number;
    enabled?: boolean;
    isDefault?: boolean;
  };
  const database = getDatabase();
  const existing = database.prepare("SELECT * FROM project_hashtag_sets WHERE id = ? AND project_id = ?")
    .get(setId, projectId) as Record<string, unknown> | undefined;
  if (!existing) return Response.json({ ok: false, message: "Etiket kümesi bulunamadı." }, { status: 404 });

  const platform = input.platform || String(existing.platform) as HashtagSetPlatform;
  const name = input.name?.trim() || String(existing.name);
  if (!PLATFORMS.has(platform) || !name) return Response.json({ ok: false, message: "Geçersiz platform veya ad." }, { status: 400 });

  const category: HashtagCategory = input.category && CATEGORIES.has(input.category)
    ? input.category
    : (String(existing.category || "topic") as HashtagCategory);

  const rotationCount = input.rotationCount !== undefined
    ? Math.max(0, Number(input.rotationCount))
    : Number(existing.rotation_count || 0);

  const hashtags = input.hashtags === undefined
    ? JSON.parse(String(existing.hashtags_json || "[]"))
    : normalizeHashtagList(input.hashtags);
  if (!hashtags.length) return Response.json({ ok: false, message: "En az bir geçerli etiket gereklidir." }, { status: 400 });
  const enabled = input.enabled === undefined ? Number(existing.enabled) : input.enabled ? 1 : 0;
  const isDefault = input.isDefault === undefined ? Number(existing.is_default) : input.isDefault ? 1 : 0;
  const now = new Date().toISOString();

  try {
    database.exec("BEGIN IMMEDIATE");
    if (isDefault) database.prepare("UPDATE project_hashtag_sets SET is_default=0, updated_at=? WHERE project_id=? AND platform=? AND id<>?")
      .run(now, projectId, platform, setId);
    database.prepare(`UPDATE project_hashtag_sets SET platform=?, name=?, hashtags_json=?, category=?, rotation_count=?, enabled=?, is_default=?, updated_at=? WHERE id=? AND project_id=?`)
      .run(platform, name, JSON.stringify(hashtags), category, rotationCount, enabled, isDefault, now, setId, projectId);
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Küme güncellenemedi." }, { status: 409 });
  }
  const row = database.prepare("SELECT * FROM project_hashtag_sets WHERE id = ?").get(setId) as Record<string, unknown>;
  return Response.json({ ok: true, set: serialize(row) });
}

export async function DELETE(_request: Request, context: Context) {
  const { projectId, setId } = await context.params;
  const result = getDatabase().prepare("DELETE FROM project_hashtag_sets WHERE id = ? AND project_id = ?").run(setId, projectId);
  if (!result.changes) return Response.json({ ok: false, message: "Etiket kümesi bulunamadı." }, { status: 404 });
  return Response.json({ ok: true });
}
