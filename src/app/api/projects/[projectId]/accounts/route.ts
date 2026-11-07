import crypto from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import {
  getActivePublisherService,
  PublisherService,
} from "@/lib/server/social-publisher";
import {
  fetchOpenPostAccounts,
  getOpenPostStoredConfig,
  OpenPostAccount,
} from "@/lib/server/openpost-client";
import {
  fetchPostizIntegrations,
  getPostizStoredConfig,
  PostizIntegration,
} from "@/lib/server/postiz-client";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const database = getDatabase();

  const connectedRows = database
    .prepare(`
      SELECT id, project_id, service, integration_id, name, identifier, profile, picture, disabled, tiktok_method, created_at
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
      tiktok_method?: string;
      created_at: string;
    }[];

  const publisherState = getActivePublisherService();
  const openPostConfig = getOpenPostStoredConfig();
  const postizConfig = getPostizStoredConfig();

  let availableIntegrations: Array<{
    id: string;
    name: string;
    identifier: string;
    profile?: string;
    picture?: string;
    disabled?: boolean;
    service: PublisherService;
  }> = [];

  let publisherError = "";

  if (publisherState.activeService === "openpost") {
    if (openPostConfig.hasApiKey) {
      try {
        const opAccounts = await fetchOpenPostAccounts();
        availableIntegrations = opAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          identifier: a.identifier,
          profile: a.profile,
          picture: a.picture,
          disabled: a.disabled,
          service: "openpost" as PublisherService,
        }));
      } catch (error) {
        publisherError = error instanceof Error ? error.message : String(error);
      }
    }
  } else {
    if (postizConfig.hasApiKey) {
      try {
        const pIntegrations = await fetchPostizIntegrations();
        availableIntegrations = pIntegrations.map((p) => ({
          id: p.id,
          name: p.name,
          identifier: p.identifier,
          profile: p.profile,
          picture: p.picture,
          disabled: p.disabled,
          service: "postiz" as PublisherService,
        }));
      } catch (error) {
        publisherError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return Response.json({
    ok: true,
    activePublisher: publisherState.activeService,
    connected: connectedRows.map((row) => ({
      id: row.id,
      service: row.service || "postiz",
      integrationId: row.integration_id,
      name: row.name,
      identifier: row.identifier,
      profile: row.profile,
      picture: row.picture,
      disabled: Boolean(row.disabled),
      tiktokMethod: (row.tiktok_method as "browser" | "postiz") || "browser",
      createdAt: row.created_at,
    })),
    available: availableIntegrations,
    publisherConfigured:
      publisherState.activeService === "openpost"
        ? publisherState.isOpenPostConfigured
        : publisherState.isPostizConfigured,
    publisherError: publisherError || undefined,
    openPostConfigured: publisherState.isOpenPostConfigured,
    openPostWebUrl: publisherState.openPostWebUrl,
    postizConfigured: publisherState.isPostizConfigured,
    postizWebUrl: publisherState.postizWebUrl,
  });
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    integrationId?: string;
    service?: PublisherService;
  };

  if (!body.integrationId?.trim()) {
    return Response.json({ ok: false, message: "integrationId zorunludur." }, { status: 400 });
  }

  const integrationId = body.integrationId.trim();
  const publisherState = getActivePublisherService();
  const service = body.service || publisherState.activeService;

  let targetAccount: {
    id: string;
    name: string;
    identifier: string;
    profile?: string;
    picture?: string;
    disabled?: boolean;
  } | undefined;

  if (service === "openpost") {
    const openPostConfig = getOpenPostStoredConfig();
    if (!openPostConfig.hasApiKey) {
      return Response.json({ ok: false, message: "OpenPost API token yapılandırılmamış." }, { status: 400 });
    }
    try {
      const all = await fetchOpenPostAccounts();
      targetAccount = all.find((a) => a.id === integrationId);
    } catch (error) {
      return Response.json({ ok: false, message: `OpenPost API hatası: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
  } else {
    const postizConfig = getPostizStoredConfig();
    if (!postizConfig.hasApiKey) {
      return Response.json({ ok: false, message: "Postiz API anahtarı yapılandırılmamış." }, { status: 400 });
    }
    try {
      const all = await fetchPostizIntegrations();
      targetAccount = all.find((i) => i.id === integrationId);
    } catch (error) {
      return Response.json({ ok: false, message: `Postiz API hatası: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
    }
  }

  if (!targetAccount) {
    return Response.json({ ok: false, message: `Seçilen ${service === "openpost" ? "OpenPost" : "Postiz"} hesabı bulunamadı.` }, { status: 404 });
  }

  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  database
    .prepare(`
      INSERT INTO project_social_accounts (
        id, project_id, service, integration_id, name, identifier, profile, picture, disabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, integration_id) DO UPDATE SET
        service = excluded.service,
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
      service,
      targetAccount.id,
      targetAccount.name || "",
      targetAccount.identifier || "",
      targetAccount.profile || "",
      targetAccount.picture || "",
      targetAccount.disabled ? 1 : 0,
      now,
      now
    );

  return Response.json({
    ok: true,
    message: "Hesap projeye başarıyla bağlandı.",
    account: {
      id,
      projectId,
      service,
      integrationId: targetAccount.id,
      name: targetAccount.name,
      identifier: targetAccount.identifier,
      profile: targetAccount.profile,
      picture: targetAccount.picture,
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

export async function PATCH(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    tiktokMethod?: "browser" | "postiz";
    integrationId?: string;
  };

  if (body.tiktokMethod !== "browser" && body.tiktokMethod !== "postiz") {
    return Response.json({ ok: false, message: "Geçersiz TikTok yükleme yöntemi." }, { status: 400 });
  }

  const database = getDatabase();
  const now = new Date().toISOString();

  if (body.integrationId) {
    database
      .prepare(`
        UPDATE project_social_accounts
        SET tiktok_method = ?, updated_at = ?
        WHERE project_id = ? AND integration_id = ?
      `)
      .run(body.tiktokMethod, now, projectId, body.integrationId);
  } else {
    database
      .prepare(`
        UPDATE project_social_accounts
        SET tiktok_method = ?, updated_at = ?
        WHERE project_id = ? AND identifier LIKE '%tiktok%'
      `)
      .run(body.tiktokMethod, now, projectId);
  }

  return Response.json({
    ok: true,
    tiktokMethod: body.tiktokMethod,
    message:
      body.tiktokMethod === "browser"
        ? "TikTok yayın motoru 'Tarayıcı (TikTok Studio Doğrudan)' olarak kaydedildi."
        : "TikTok yayın motoru 'API (Gelen Kutusu / Taslak)' olarak kaydedildi.",
  });
}
