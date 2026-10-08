import { createJobCallbackToken, getCanvaConfig, isCanvaStudioEnabled } from "@/lib/server/canva-config";
import { getDatabase } from "@/lib/server/database";
import { triggerProductionWorker } from "@/lib/server/production-worker";
import {
  HERMES_CANVA_PIPELINE_VERSION,
  buildHermesCanvaTaskPrompt,
  validateCanvaJobInput,
} from "@/lib/server/hermes-canva-task";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

type JobRow = {
  id: string;
  model: string;
  prompt: string;
  status: string;
  request_json: string;
  response_json: string;
  progress_json: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export async function GET(_request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const database = getDatabase();

  const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const rows = database
    .prepare(`
      SELECT id, model, prompt, status, request_json, response_json, progress_json, error, created_at, completed_at
      FROM generation_jobs
      WHERE project_id=? AND type='canva'
      ORDER BY created_at DESC
      LIMIT 50
    `)
    .all(projectId) as unknown as JobRow[];

  const jobs = rows.map((row) => {
    let progress = {};
    let requestData = {};
    let responseData = {};
    try {
      progress = JSON.parse(row.progress_json || "{}");
    } catch {
      // ignore
    }
    try {
      requestData = JSON.parse(row.request_json || "{}");
    } catch {
      // ignore
    }
    try {
      responseData = JSON.parse(row.response_json || "{}");
    } catch {
      // ignore
    }

    return {
      id: row.id,
      model: row.model,
      prompt: row.prompt,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      progress,
      request: requestData,
      response: responseData,
    };
  });

  return Response.json({ ok: true, jobs });
}

export async function POST(request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const database = getDatabase();

  const projectRow = database
    .prepare("SELECT id, name, brand_json FROM projects WHERE id=?")
    .get(projectId) as { id: string; name: string; brand_json: string } | undefined;

  if (!projectRow) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  let validatedInput;
  try {
    const rawBody = await request.json().catch(() => ({}));
    validatedInput = validateCanvaJobInput(rawBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Geçersiz istek.";
    return Response.json({ ok: false, message: msg }, { status: 400 });
  }

  // Idempotency check if idempotencyKey is supplied
  if (validatedInput.idempotencyKey) {
    const existing = database
      .prepare(`
        SELECT id, status FROM generation_jobs
        WHERE project_id=? AND type='canva' AND status IN ('queued', 'dispatching', 'running')
        ORDER BY created_at DESC LIMIT 10
      `)
      .all(projectId) as unknown as Array<{ id: string; status: string; request_json?: string }>;

    for (const job of existing) {
      try {
        const row = database
          .prepare("SELECT request_json FROM generation_jobs WHERE id=?")
          .get(job.id) as { request_json: string };
        const req = JSON.parse(row.request_json || "{}");
        if (req.idempotencyKey === validatedInput.idempotencyKey) {
          return Response.json({ ok: true, jobId: job.id, existing: true }, { status: 200 });
        }
      } catch {
        // ignore
      }
    }
  }

  // Extract brand snapshot
  let brandSnapshot: {
    name: string;
    logo?: string;
    website?: string;
    phone?: string;
    email?: string;
    colors?: string[];
  } = { name: projectRow.name };
  try {
    const brand = JSON.parse(projectRow.brand_json || "{}");
    const allowedFields = new Set(validatedInput.selectedBrandFields || []);
    brandSnapshot = {
      name: brand.brandName || projectRow.name,
      logo: allowedFields.has("logo") ? (brand.logo || "") : undefined,
      website: allowedFields.has("website") ? (brand.website || "") : undefined,
      phone: allowedFields.has("phone") ? (brand.phone || "") : undefined,
      email: allowedFields.has("email") ? (brand.email || "") : undefined,
      ...(Array.isArray(brand.colors) ? { colors: brand.colors } : {}),
    };
  } catch {
    // ignore
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const canvaConfig = getCanvaConfig();
  if (!canvaConfig.apiKey || !canvaConfig.callbackToken) {
    return Response.json(
      { ok: false, message: "Hermes Agent API veya Canva callback secret yapılandırılmamış." },
      { status: 503 },
    );
  }

  const requestJson = JSON.stringify({
    ...validatedInput,
    brandSnapshot,
    pipelineVersion: HERMES_CANVA_PIPELINE_VERSION,
  });

  const progressJson = JSON.stringify({
    phase: "queued",
    percent: 0,
    completed: 0,
    total: validatedInput.slideCount,
    detail: "Kuyruğa alındı",
    updatedAt: now,
  });

  // Write job as queued in database
  database
    .prepare(`
      INSERT INTO generation_jobs (
        id, project_id, type, provider, model, status, prompt, request_json, progress_json, created_at
      ) VALUES (?, ?, 'canva', 'hermes-agent', 'hermes-agent', 'queued', ?, ?, ?, ?)
    `)
    .run(jobId, projectId, validatedInput.prompt, requestJson, progressJson, now);

  // Trigger FIFO background worker to process sequentially
  triggerProductionWorker();

  return Response.json({
    ok: true,
    jobId,
    message: "Canva üretim görevi sıraya alındı (FIFO).",
  }, { status: 202 });
}

export async function DELETE(request: Request, context: Context) {
  if (!isCanvaStudioEnabled()) {
    return Response.json({ ok: false, message: "Canva Studio devre dışı." }, { status: 404 });
  }

  const { projectId } = await context.params;
  const database = getDatabase();

  const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!project) {
    return Response.json({ ok: false, message: "Proje bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { jobId?: string };
  const jobId = body.jobId?.trim();

  if (jobId) {
    const job = database
      .prepare("SELECT id, status, type FROM generation_jobs WHERE id=? AND project_id=?")
      .get(jobId, projectId) as { id: string; status: string; type: string } | undefined;

    if (!job) {
      return Response.json({ ok: false, message: "İş bulunamadı." }, { status: 404 });
    }

    if (["complete", "failed"].includes(job.status)) {
      database.prepare("DELETE FROM generation_jobs WHERE id=? AND project_id=?").run(jobId, projectId);
      return Response.json({ ok: true, message: "Tamamlanmış veya başarısız iş kaydı silindi.", jobId });
    }

    const cancelProgress = JSON.stringify({
      phase: "failed",
      percent: 0,
      detail: "Kullanıcı tarafından iptal edildi.",
      updatedAt: new Date().toISOString(),
    });

    database
      .prepare(
        "UPDATE generation_jobs SET status='failed', error='Kullanıcı tarafından iptal edildi.', progress_json=?, completed_at=? WHERE id=?"
      )
      .run(cancelProgress, new Date().toISOString(), jobId);

    return Response.json({ ok: true, message: "İşlem iptal edildi.", jobId });
  }

  // If no jobId specified, cancel any active canva jobs for this project
  const cancelProgress = JSON.stringify({
    phase: "failed",
    percent: 0,
    detail: "Kullanıcı tarafından iptal edildi.",
    updatedAt: new Date().toISOString(),
  });

  const result = database
    .prepare(
      "UPDATE generation_jobs SET status='failed', error='Kullanıcı tarafından iptal edildi.', progress_json=?, completed_at=? WHERE project_id=? AND type='canva' AND status IN ('queued', 'dispatching', 'running', 'exporting', 'uploading')"
    )
    .run(cancelProgress, new Date().toISOString(), projectId);

  return Response.json({
    ok: true,
    message: `${result.changes} aktif işlem iptal edildi.`,
    cancelledCount: result.changes,
  });
}
