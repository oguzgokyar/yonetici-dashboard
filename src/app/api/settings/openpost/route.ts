import { getOpenPostStoredConfig, saveOpenPostStoredConfig } from "@/lib/server/openpost-client";

export const runtime = "nodejs";

export async function GET() {
  const config = getOpenPostStoredConfig();
  return Response.json({
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    hasApiKey: config.hasApiKey,
    maskedKey: config.maskedKey,
    defaultWorkspaceId: config.defaultWorkspaceId,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
    defaultWorkspaceId?: string;
  };

  const updated = saveOpenPostStoredConfig(body);
  return Response.json({
    ok: true,
    enabled: updated.enabled,
    baseUrl: updated.baseUrl,
    hasApiKey: updated.hasApiKey,
    maskedKey: updated.maskedKey,
    defaultWorkspaceId: updated.defaultWorkspaceId,
  });
}
