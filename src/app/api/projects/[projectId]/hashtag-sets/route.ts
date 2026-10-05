import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { normalizeHashtagList, type SocialPlatform } from "@/lib/social/hashtag-policy";

type Context = { params: Promise<{ projectId: string }> };
const PLATFORMS = new Set<SocialPlatform>(["instagram", "youtube", "tiktok", "facebook", "twitter"]);

function serialize(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    platform: String(row.platform),
    name: String(row.name),
    hashtags: JSON.parse(String(row.hashtags_json || "[]")),
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
    ORDER BY platform, is_default DESC, name COLLATE NOCASE
  `).all(projectId) as Record<string, unknown>[];
  return Response.json({ ok: true, sets: rows.map(serialize) });
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const input = await request.json().catch(() => ({})) as {
    platform?: SocialPlatform;
    name?: string;
    hashtags?: string[] | string;
    enabled?: boolean;
    isDefault?: boolean;
  };
  const platform = input.platform;
  const name = input.name?.trim() || "";
  if (!platform || !PLATFORMS.has(platform) || !name) {
    return Response.json({ ok: false, message: "Geçerli platform ve küme adı zorunludur." }, { status: 400 });
  }
  const hashtags = normalizeHashtagList(input.hashtags || []);
  if (!hashtags.length) {
    return Response.json({ ok: false, message: "Kümede en az bir geçerli etiket olmalıdır." }, { status: 400 });
  }

  const database = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    database.exec("BEGIN IMMEDIATE");
    if (input.isDefault) {
      database.prepare("UPDATE project_hashtag_sets SET is_default = 0, updated_at = ? WHERE project_id = ? AND platform = ?")
        .run(now, projectId, platform);
    }
    database.prepare(`
      INSERT INTO project_hashtag_sets
      (id, project_id, platform, name, hashtags_json, enabled, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, platform, name, JSON.stringify(hashtags), input.enabled === false ? 0 : 1, input.isDefault ? 1 : 0, now, now);
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
