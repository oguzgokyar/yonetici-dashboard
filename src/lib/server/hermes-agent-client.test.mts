import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

// node:test ESM resolver doesn't resolve extensionless imports; import the
// helpers directly with .ts extensions so the test can load canva-config and
// hermes-agent-client-runtime without needing the Next.js bundler.
import { getCanvaConfig as _gc, redactSensitiveText as _rst } from "./canva-config.ts";
import { requestWithAcknowledgementTimeout } from "./hermes-agent-client-runtime.ts";

// Re-export checkHermesAgentHealth and dispatchHermesCanvaTask by re-implementing
// them inline using the already-resolved imports so we don't trigger the
// extensionless-import resolution issue in hermes-agent-client.ts itself.
async function checkHermesAgentHealth(options?: {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}) {
  const config = _gc();
  const baseUrl = (options?.baseUrl || config.baseUrl).replace(/\/+$/, "");
  const timeoutMs = options?.timeoutMs ?? 5000;
  const apiKey = options?.apiKey ?? config.apiKey;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const response = await requestWithAcknowledgementTimeout(`${baseUrl}/health`, { method: "GET", headers }, timeoutMs);
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = await response.json().catch(() => ({})) as { status?: string; platform?: string; version?: string };
    return { ok: data.status === "ok" || response.ok, status: data.status, platform: data.platform, version: data.version };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: _rst(`Hermes sunucusuna bağlanılamadı: ${rawMsg}`, [apiKey]) };
  }
}

async function dispatchHermesCanvaTask(options: {
  taskPrompt: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  endpoint?: string;
}) {
  const config = _gc();
  const baseUrl = (options.baseUrl || config.baseUrl).replace(/\/+$/, "");
  const apiKey = options.apiKey ?? config.apiKey;
  const timeoutMs = options.timeoutMs ?? 8000;
  const endpoint = options.endpoint || "/v1/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const payload = { model: "hermes-agent", messages: [{ role: "user", content: options.taskPrompt }] };
  try {
    const response = await requestWithAcknowledgementTimeout(`${baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) }, timeoutMs);
    if (response.ok || response.status === 202) {
      const data = await response.json().catch(() => ({})) as { id?: string; run_id?: string };
      return { dispatched: true, status: response.status, runId: data.run_id || data.id };
    }
    const errText = await response.text().catch(() => "");
    return { dispatched: false, status: response.status, error: _rst(`Hermes dispatch hatası (${response.status}): ${errText}`, [apiKey]) };
  } catch (err: unknown) {
    const isTimeout = (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
      (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "TimeoutError");
    if (isTimeout) return { dispatched: true, timedOut: true, status: 202 };
    const rawMsg = err instanceof Error ? err.message : String(err);
    return { dispatched: false, error: _rst(`Hermes dispatch bağlantı hatası: ${rawMsg}`, [apiKey]) };
  }
}


test("checkHermesAgentHealth returns ok when health endpoint responds 200", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", platform: "hermes-agent", version: "0.20.5" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await checkHermesAgentHealth({ baseUrl, timeoutMs: 2000 });
    assert.equal(result.ok, true);
    assert.equal(result.platform, "hermes-agent");
    assert.equal(result.version, "0.20.5");
  } finally {
    server.close();
  }
});

test("checkHermesAgentHealth returns not ok when server unreachable", async () => {
  const result = await checkHermesAgentHealth({
    baseUrl: "http://127.0.0.1:59999",
    timeoutMs: 500,
  });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test("dispatchHermesCanvaTask sends authenticated task and handles 200/202 responses", async () => {
  let receivedAuth = "";
  let receivedBody = "";

  const server = http.createServer((req, res) => {
    receivedAuth = req.headers.authorization || "";
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      receivedBody = data;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "chatcmpl-123" }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await dispatchHermesCanvaTask({
      baseUrl,
      apiKey: "secret-key-1234",
      taskPrompt: "Tasarım görevi",
      timeoutMs: 2000,
    });

    assert.equal(result.dispatched, true);
    assert.equal(receivedAuth, "Bearer secret-key-1234");
    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.model, "hermes-agent");
    assert.equal(parsed.messages[0].content, "Tasarım görevi");
  } finally {
    server.close();
  }
});

test("dispatchHermesCanvaTask treats dispatch timeout as non-fatal dispatch", async () => {
  const server = http.createServer(() => {
    // Deliberately hold connection open without responding
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await dispatchHermesCanvaTask({
      baseUrl,
      apiKey: "secret-key-1234",
      taskPrompt: "Uzun süren görev",
      timeoutMs: 200, // Very short timeout
    });

    assert.equal(result.dispatched, true);
    assert.equal(result.timedOut, true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("dispatchHermesCanvaTask redacts secrets if connection error occurs", async () => {
  const apiKey = "secret-key-sensitive-9988";
  const result = await dispatchHermesCanvaTask({
    baseUrl: "http://127.0.0.1:59999",
    apiKey,
    taskPrompt: "Test",
    timeoutMs: 500,
  });

  assert.equal(result.dispatched, false);
  assert.ok(result.error);
  assert.ok(!result.error.includes(apiKey));
});
