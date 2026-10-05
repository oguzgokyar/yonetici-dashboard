import { getDatabase } from "@/lib/server/database";
import { normalizeHashtagList, type SocialPlatform } from "@/lib/social/hashtag-policy";

type Context = { params: Promise<{ projectId: string; setId: string }> };
const PLATFORMS = new Set<SocialPlatform>(["instagram", "youtube", "tiktok", "facebook", "twitter"]);

function serialize(row: Record<string, unknown>) {
  return {
    id: String(row.id), projectId: String(row.project_id), platform: String(row.platform),
    name: String(row.name), hashtags: JSON.parse(String(row.hashtags_json || "[]")),
    enabled: Boolean(row.enabled), isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export async function PATCH(request: Request, context: Context) {
  const { projectId, setId } = await context.params;
  const input = await request.json().catch(() => ({})) as {
    platform?: SocialPlatform; name?: string; hashtags?: string[] | string;
    enabled?: boolean; isDefault?: boolean;
  };
  const database = getDatabase();
  const existing = database.prepare("SELECT * FROM project_hashtag_sets WHERE id = ? AND project_id = ?")
    .get(setId, projectId) as Record<string, unknown> | undefined;
  if (!existing) return Response.json({ ok: false, message: "Etiket kümesi bulunamadı." }, { status: 404 });

  const platform = input.platform || String(existing.platform) as SocialPlatform;
  const name = input.name?.trim() || String(existing.name);
  if (!PLATFORMS.has(platform) || !name) return Response.json({ ok: false, message: "Geçersiz platform veya ad." }, { status: 400 });
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
    database.prepare(`UPDATE project_hashtag_sets SET platform=?, name=?, hashtags_json=?, enabled=?, is_default=?, updated_at=? WHERE id=? AND project_id=?`)
      .run(platform, name, JSON.stringify(hashtags), enabled, isDefault, now, setId, projectId);
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
