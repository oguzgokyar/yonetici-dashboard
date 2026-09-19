import { getPostizStoredConfig, savePostizStoredConfig } from "@/lib/server/postiz-client";

export const runtime = "nodejs";

export async function GET() {
  const config = getPostizStoredConfig();
  return Response.json({
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    hasApiKey: config.hasApiKey,
    maskedKey: config.maskedKey,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    enabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
  };

  const updated = savePostizStoredConfig(body);
  return Response.json({
    ok: true,
    enabled: updated.enabled,
    baseUrl: updated.baseUrl,
    hasApiKey: updated.hasApiKey,
    maskedKey: updated.maskedKey,
  });
}
