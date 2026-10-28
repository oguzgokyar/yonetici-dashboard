import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  brand: Record<string, unknown>;
  brandConcept?: Record<string, unknown>;
};

export async function GET() {
  const rows = getDatabase()
    .prepare(
      "SELECT id, name, created_at, brand_json, brand_concept_json FROM projects ORDER BY created_at DESC"
    )
    .all() as {
    id: string;
    name: string;
    created_at: string;
    brand_json: string;
    brand_concept_json: string;
  }[];

  return Response.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      brand: JSON.parse(row.brand_json || "{}"),
      brandConcept: JSON.parse(row.brand_concept_json || "{}"),
    }))
  );
}

function upsertProject(database: any, project: ProjectRecord) {
  if (!project.id || !project.name) {
    throw new Error("Eksik proje alanı: id ve name zorunludur.");
  }
  const createdAt = project.createdAt || new Date().toISOString();
  const statement = database.prepare(`
    INSERT INTO projects (id, name, created_at, brand_json, brand_concept_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      created_at = excluded.created_at,
      brand_json = excluded.brand_json,
      brand_concept_json = excluded.brand_concept_json
  `);
  statement.run(
    project.id,
    project.name,
    createdAt,
    JSON.stringify(project.brand || {}),
    JSON.stringify(project.brandConcept || {})
  );
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      project?: ProjectRecord;
      projects?: ProjectRecord[];
    };
    const database = getDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      if (input.project) {
        upsertProject(database, input.project);
      } else if (Array.isArray(input.projects)) {
        for (const proj of input.projects) {
          upsertProject(database, proj);
        }
      } else {
        database.exec("ROLLBACK");
        return Response.json(
          { ok: false, message: "Geçersiz proje verisi." },
          { status: 400 }
        );
      }

      database.exec("COMMIT");
      return Response.json({ ok: true });
    } catch (err: any) {
      database.exec("ROLLBACK");
      return Response.json(
        { ok: false, message: err.message || "Proje kaydedilemedi." },
        { status: 500 }
      );
    }
  } catch {
    return Response.json(
      { ok: false, message: "Geçersiz istek gövdesi." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as {
      project?: ProjectRecord;
      projects?: ProjectRecord[];
    };
    const database = getDatabase();
    database.exec("BEGIN IMMEDIATE");

    try {
      if (input.project) {
        upsertProject(database, input.project);
      } else if (Array.isArray(input.projects)) {
        for (const project of input.projects) {
          upsertProject(database, project);
        }
      } else {
        database.exec("ROLLBACK");
        return Response.json(
          { ok: false, message: "Geçersiz proje verisi." },
          { status: 400 }
        );
      }

      database.exec("COMMIT");
      return Response.json({
        ok: true,
        count: Array.isArray(input.projects) ? input.projects.length : 1,
      });
    } catch (err: any) {
      database.exec("ROLLBACK");
      return Response.json(
        { ok: false, message: err.message || "Projeler kaydedilemedi." },
        { status: 500 }
      );
    }
  } catch {
    return Response.json(
      { ok: false, message: "Geçersiz istek gövdesi." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get("id");

    if (!id) {
      try {
        const body = (await request.json()) as { id?: string };
        id = body?.id || null;
      } catch {}
    }

    if (!id) {
      return Response.json(
        { ok: false, message: "Silinecek proje ID belirtilmedi." },
        { status: 400 }
      );
    }

    const database = getDatabase();
    database.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return Response.json({ ok: true, deletedId: id });
  } catch (err: any) {
    return Response.json(
      { ok: false, message: err.message || "Proje silinemedi." },
      { status: 500 }
    );
  }
}
