import { getFlowConfig, saveFlowConfig, type FlowVideoModel } from "@/lib/server/flow-video-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = getFlowConfig();
    return Response.json({
      ok: true,
      enabled: config.enabled,
      baseUrl: config.baseUrl,
      hasApiKey: config.hasApiKey,
      maskedKey: config.maskedKey,
      defaultModel: config.defaultModel,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, enabled, baseUrl, apiKey, defaultModel } = body;

    // Test connection action
    if (action === "test") {
      const config = getFlowConfig();
      const testApiKey = apiKey?.trim() || config.apiKey;
      const testBaseUrl = (baseUrl?.trim() || config.baseUrl).replace(/\/+$/, "");

      if (!testApiKey) {
        return Response.json(
          { ok: false, message: "Test için bir API anahtarı girilmiş olmalıdır." },
          { status: 400 }
        );
      }

      try {
        const isStandard = testBaseUrl.includes("/api/v1");
        const pingUrl = isStandard ? `${testBaseUrl}/projects` : `${testBaseUrl}/videos`;
        const testRes = await fetch(pingUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (testRes.status === 401 || testRes.status === 403) {
          return Response.json(
            { ok: false, message: "Bağlantı reddedildi: API anahtarı geçersiz veya yetkisiz." },
            { status: 401 }
          );
        }

        return Response.json({
          ok: true,
          message: "Flow REST API bağlantısı başarılı.",
          status: testRes.status,
        });
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : String(err);
        return Response.json(
          { ok: false, message: `Flow REST API uç noktasına erişilemedi: ${errText}` },
          { status: 502 }
        );
      }
    }

    // Save configuration
    const updated = saveFlowConfig({
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      baseUrl: typeof baseUrl === "string" ? baseUrl : undefined,
      apiKey: typeof apiKey === "string" ? apiKey : undefined,
      defaultModel: defaultModel as FlowVideoModel | undefined,
    });

    return Response.json({
      ok: true,
      message: "Flow API ayarları başarıyla kaydedildi.",
      config: {
        enabled: updated.enabled,
        baseUrl: updated.baseUrl,
        hasApiKey: updated.hasApiKey,
        maskedKey: updated.maskedKey,
        defaultModel: updated.defaultModel,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
