import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import { fetchPostizIntegrations, getPostizStoredConfig, PostizIntegration } from "@/lib/server/postiz-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const database = getDatabase();

  const connectedRows = database
    .prepare(`
      SELECT id, project_id, service, integration_id, name, identifier, profile, picture, disabled, created_at
      FROM project_social_accounts
      WHERE project_id = ?
      ORDER BY created_at DESC
    `)
    .all(projectId) as {
      id: string;
      project_id: string;
      service: string;
      integration_id: string;
      name: string;
      identifier: string;
      profile: string;
      picture: string;
      disabled: number;
      created_at: string;
    }[];

  const postizConfig = getPostizStoredConfig();
  let availableIntegrations: PostizIntegration[] = [];
  let postizError = "";

  if (postizConfig.hasApiKey) {
    try {
      availableIntegrations = await fetchPostizIntegrations();
    } catch (error) {
      postizError = error instanceof Error ? error.message : String(error);
    }
  }

  // Derive postiz web UI url
  let postizWebUrl = "https://sm.atolyehanem.com";
  if (postizConfig.baseUrl.includes("://") && !postizConfig.baseUrl.includes("10.0.1.1") && !postizConfig.baseUrl.includes("localhost")) {
    try {
      const parsed = new URL(postizConfig.baseUrl);
      postizWebUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      // fallback to default
    }
  }

  return Response.json({
    ok: true,
    connected: connectedRows.map((row) => ({
      id: row.id,
      service: row.service,
      integrationId: row.integration_id,
      name: row.name,
      identifier: row.identifier,
      profile: row.profile,
      picture: row.picture,
      disabled: Boolean(row.disabled),
      createdAt: row.created_at,
    })),
    available: availableIntegrations,
    postizConfigured: postizConfig.hasApiKey,
    postizError: postizError || undefined,
    postizWebUrl,
  });
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    integrationId?: string;
  };

  if (!body.integrationId?.trim()) {
    return Response.json({ ok: false, message: "integrationId zorunludur." }, { status: 400 });
  }

  const integrationId = body.integrationId.trim();
  const postizConfig = getPostizStoredConfig();
  if (!postizConfig.hasApiKey) {
    return Response.json({ ok: false, message: "Postiz API anahtarı yapılandırılmamış." }, { status: 400 });
  }

  // Fetch integration from Postiz to get up-to-date metadata
  let targetIntegration: PostizIntegration | undefined;
  try {
    const all = await fetchPostizIntegrations();
    targetIntegration = all.find((i) => i.id === integrationId);
  } catch (error) {
    return Response.json({ ok: false, message: `Postiz API hatası: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }

  if (!targetIntegration) {
    return Response.json({ ok: false, message: "Seçilen Postiz hesabı bulunamadı." }, { status: 404 });
  }

  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  database
    .prepare(`
      INSERT INTO project_social_accounts (
        id, project_id, service, integration_id, name, identifier, profile, picture, disabled, created_at, updated_at
      ) VALUES (?, ?, 'postiz', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, integration_id) DO UPDATE SET
        name = excluded.name,
        identifier = excluded.identifier,
        profile = excluded.profile,
        picture = excluded.picture,
        disabled = excluded.disabled,
        updated_at = excluded.updated_at
    `)
    .run(
      id,
      projectId,
      targetIntegration.id,
      targetIntegration.name || "",
      targetIntegration.identifier || "",
      targetIntegration.profile || "",
      targetIntegration.picture || "",
      targetIntegration.disabled ? 1 : 0,
      now,
      now
    );

  return Response.json({
    ok: true,
    message: "Hesap projeye başarıyla bağlandı.",
    account: {
      id,
      projectId,
      integrationId: targetIntegration.id,
      name: targetIntegration.name,
      identifier: targetIntegration.identifier,
      profile: targetIntegration.profile,
      picture: targetIntegration.picture,
    },
  });
}

export async function DELETE(request: Request, context: Context) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const accountId = url.searchParams.get("id");

  if (!accountId) {
    return Response.json({ ok: false, message: "Silinecek hesap id parametresi eksik." }, { status: 400 });
  }

  const database = getDatabase();
  database
    .prepare(`
      DELETE FROM project_social_accounts
      WHERE project_id = ? AND (id = ? OR integration_id = ?)
    `)
    .run(projectId, accountId, accountId);

  return Response.json({ ok: true, message: "Hesap bağlantısı kaldırıldı." });
}
