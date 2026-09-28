import { getCanvaConfig, redactSensitiveText } from "./canva-config";
import { requestWithAcknowledgementTimeout } from "./hermes-agent-client-runtime";

export interface HermesHealthResult {
  ok: boolean;
  status?: string;
  platform?: string;
  version?: string;
  error?: string;
}

export async function checkHermesAgentHealth(options?: {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<HermesHealthResult> {
  const config = getCanvaConfig();
  const baseUrl = (options?.baseUrl || config.baseUrl).replace(/\/+$/, "");
  const timeoutMs = options?.timeoutMs ?? 5000;
  const apiKey = options?.apiKey ?? config.apiKey;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Hermes sağlık kontrolü başarısız oldu (HTTP ${response.status})`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      platform?: string;
      version?: string;
    };

    return {
      ok: data.status === "ok" || response.ok,
      status: data.status,
      platform: data.platform,
      version: data.version,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: redactSensitiveText(`Hermes sunucusuna bağlanılamadı: ${rawMsg}`, [
        apiKey,
      ]),
    };
  }
}

export interface HermesDispatchResult {
  dispatched: boolean;
  timedOut?: boolean;
  status?: number;
  runId?: string;
  error?: string;
}

export async function dispatchHermesCanvaTask(options: {
  taskPrompt: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  endpoint?: string;
}): Promise<HermesDispatchResult> {
  const config = getCanvaConfig();
  const baseUrl = (options.baseUrl || config.baseUrl).replace(/\/+$/, "");
  const apiKey = options.apiKey ?? config.apiKey;
  const timeoutMs = options.timeoutMs ?? 8000;
  const endpoint = options.endpoint || "/v1/runs";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const payload =
    endpoint === "/v1/runs"
      ? {
          model: "hermes-agent",
          input: options.taskPrompt,
        }
      : {
          model: "hermes-agent",
          messages: [
            {
              role: "user",
              content: options.taskPrompt,
            },
          ],
        };

  try {
    const response = await requestWithAcknowledgementTimeout(
      `${baseUrl}${endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    if (response.ok || response.status === 202) {
      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        run_id?: string;
      };
      return {
        dispatched: true,
        status: response.status,
        runId: data.run_id || data.id,
      };
    }

    const errText = await response.text().catch(() => "");
    return {
      dispatched: false,
      status: response.status,
      error: redactSensitiveText(
        `Hermes dispatch hatası (${response.status}): ${errText}`,
        [apiKey]
      ),
    };
  } catch (err: unknown) {
    const isTimeout =
      (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
      (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "TimeoutError");

    if (isTimeout) {
      // Do not abort the accepted request: Hermes may still complete and call back.
      // A timeout only means the synchronous acknowledgement did not arrive in time.
      return {
        dispatched: true,
        timedOut: true,
        status: 202,
      };
    }

    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      dispatched: false,
      error: redactSensitiveText(`Hermes dispatch bağlantı hatası: ${rawMsg}`, [
        apiKey,
      ]),
    };
  }
}
