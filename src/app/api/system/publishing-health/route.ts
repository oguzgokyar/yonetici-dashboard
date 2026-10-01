import net from "node:net";
import { getPostizStoredConfig, fetchPostizIntegrations } from "@/lib/server/postiz-client";

export const runtime = "nodejs";

function checkTcpPort(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      settled = true;
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

export type ServiceHealthItem = {
  id: string;
  name: string;
  status: "healthy" | "warning" | "error";
  latencyMs: number;
  message: string;
};

export async function GET() {
  const startTime = Date.now();
  const checks: ServiceHealthItem[] = [];

  // 1. Postiz API & Accounts Check
  const postizStart = Date.now();
  try {
    const postizConfig = getPostizStoredConfig();
    if (!postizConfig.hasApiKey) {
      checks.push({
        id: "postiz-api",
        name: "Postiz API",
        status: "warning",
        latencyMs: Date.now() - postizStart,
        message: "API anahtarı yapılandırılmamış.",
      });
    } else {
      const integrations = await fetchPostizIntegrations();
      checks.push({
        id: "postiz-api",
        name: "Postiz API",
        status: "healthy",
        latencyMs: Date.now() - postizStart,
        message: `${integrations.length} bağlı hesap aktif.`,
      });
    }
  } catch (err) {
    checks.push({
      id: "postiz-api",
      name: "Postiz API",
      status: "error",
      latencyMs: Date.now() - postizStart,
      message: err instanceof Error ? err.message : "Bağlantı hatası",
    });
  }

  // 2. Postiz Web / App Container Check (Port 4007)
  const webStart = Date.now();
  const isPostizPortOpen = await checkTcpPort("10.0.1.1", 4007);
  checks.push({
    id: "postiz-server",
    name: "Postiz Dağıtım Sunucusu",
    status: isPostizPortOpen ? "healthy" : "error",
    latencyMs: Date.now() - webStart,
    message: isPostizPortOpen ? "Konteyner ve web servisi çalışıyor (:4007)" : "Konteyner yanıt vermiyor!",
  });

  // 3. Temporal Workflow Engine (Port 8088 / UI & Service)
  const temporalStart = Date.now();
  const isTemporalOpen = await checkTcpPort("10.0.1.1", 8088);
  checks.push({
    id: "temporal-engine",
    name: "Kuyruk & Dağıtım Motoru (Temporal)",
    status: isTemporalOpen ? "healthy" : "error",
    latencyMs: Date.now() - temporalStart,
    message: isTemporalOpen ? "Kuyruk dinleyicisi ve iş akışları devrede (:8088)" : "Temporal servisi çevrimdışı!",
  });

  // 4. AI Provider Proxy (CLIProxyAPI :8317)
  const aiStart = Date.now();
  const isAiProxyOpen = await checkTcpPort("10.0.1.1", 8317);
  checks.push({
    id: "ai-proxy",
    name: "AI Metin & Kreatif Motoru",
    status: isAiProxyOpen ? "healthy" : "warning",
    latencyMs: Date.now() - aiStart,
    message: isAiProxyOpen ? "CLIProxyAPI aktif (:8317)" : "AI proxy yanıt vermiyor",
  });

  const overallHealthy = checks.every((c) => c.status === "healthy");
  const hasError = checks.some((c) => c.status === "error");
  const systemStatus = hasError ? "error" : overallHealthy ? "healthy" : "warning";

  return Response.json({
    ok: true,
    status: systemStatus,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    services: checks,
  });
}
