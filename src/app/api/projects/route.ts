import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
type ProjectRecord = { id: string; name: string; createdAt: string; brand: Record<string, unknown>; brandConcept?: Record<string, unknown> };

export async function GET() {
  const rows = getDatabase().prepare("SELECT id, name, created_at, brand_json, brand_concept_json FROM projects ORDER BY created_at DESC").all() as { id: string; name: string; created_at: string; brand_json: string; brand_concept_json: string }[];
  return Response.json(rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, brand: JSON.parse(row.brand_json), brandConcept: JSON.parse(row.brand_concept_json || "{}") })));
}

export async function PUT(request: Request) {
  const input = await request.json() as { projects?: ProjectRecord[] };
  if (!Array.isArray(input.projects)) return Response.json({ ok: false, message: "Geçersiz proje verisi." }, { status: 400 });
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const incomingIds = input.projects.map((project) => project.id);
    if (incomingIds.length) {
      const placeholders = incomingIds.map(() => "?").join(",");
      database.prepare(`DELETE FROM projects WHERE id NOT IN (${placeholders})`).run(...incomingIds);
    } else database.prepare("DELETE FROM projects").run();
    const statement = database.prepare(`INSERT INTO projects (id, name, created_at, brand_json, brand_concept_json) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, created_at=excluded.created_at, brand_json=excluded.brand_json, brand_concept_json=excluded.brand_concept_json`);
    for (const project of input.projects) {
      if (!project.id || !project.name || !project.createdAt || !project.brand) throw new Error("Eksik proje alanı");
      statement.run(project.id, project.name, project.createdAt, JSON.stringify(project.brand), JSON.stringify(project.brandConcept || {}));
    }
    database.exec("COMMIT");
    return Response.json({ ok: true, count: input.projects.length });
  } catch {
    database.exec("ROLLBACK");
    return Response.json({ ok: false, message: "Projeler kaydedilemedi." }, { status: 500 });
  }
}
