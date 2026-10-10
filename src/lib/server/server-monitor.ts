import "server-only";
import { readFile, readdir } from "node:fs/promises";

export type Metrics = {
  scope: "local-proc" | "host"; sampledAt: string; cpuPercent: number | null;
  memory: { totalBytes: number; usedBytes: number };
  swap: { totalBytes: number; usedBytes: number; inBytesPerSecond: number | null; outBytesPerSecond: number | null };
  processes: { pid: number; category: string; rssBytes: number }[];
};
export function sanitizeHostMetrics(input: unknown): Metrics {
  const data = input as Metrics;
  const number = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) throw new Error("Invalid metrics");
    return value;
  };
  if (!data || !["host", "local-proc"].includes(data.scope) || typeof data.sampledAt !== "string" || !Number.isFinite(Date.parse(data.sampledAt)) || Date.parse(data.sampledAt) > Date.now() + 5000 || !Array.isArray(data.processes)) throw new Error("Invalid scope");
  const nullable = (value: unknown, max?: number) => value === null ? null : number(value, max);
  const memory = { totalBytes: number(data.memory?.totalBytes), usedBytes: number(data.memory?.usedBytes) };
  const swap = { totalBytes: number(data.swap?.totalBytes), usedBytes: number(data.swap?.usedBytes), inBytesPerSecond: nullable(data.swap?.inBytesPerSecond), outBytesPerSecond: nullable(data.swap?.outBytesPerSecond) };
  if (memory.usedBytes > memory.totalBytes || swap.usedBytes > swap.totalBytes) throw new Error("Invalid memory");
  return { scope: data.scope, sampledAt: new Date(data.sampledAt).toISOString(), cpuPercent: nullable(data.cpuPercent, 100), memory, swap, processes: data.processes.slice(0, 12).map(p => ({ pid: number(p.pid), category: categories.includes(p.category) ? p.category : "other", rssBytes: number(p.rssBytes) })) };
}
export type HostMonitorJob = { id: string; service: "seo" | "canva" | "other"; status: string; createdAt: string | null; startedAt: string | null; finishedAt: string | null; heartbeat: string | null; progressPercent: number | null };
function sanitizeHostJobs(input: unknown): HostMonitorJob[] {
  if (!Array.isArray(input)) return [];
  const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  return input.slice(0, 100).flatMap(row => {
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9:_./-]{1,160}$/.test(row.id) || !["queued", "starting", "running", "complete", "failed", "released"].includes(row.status)) return [];
    return [{ id: row.id, service: ["seo", "canva"].includes(row.service) ? row.service : "other", status: row.status, createdAt: timestamp(row.createdAt), startedAt: timestamp(row.startedAt), finishedAt: timestamp(row.finishedAt), heartbeat: timestamp(row.heartbeat), progressPercent: typeof row.progressPercent === "number" && Number.isFinite(row.progressPercent) ? Math.max(0, Math.min(100, row.progressPercent)) : null }];
  });
}
export async function collectHostMetrics(): Promise<{ state: "unconfigured" | "unavailable" | "ready" | "stale"; metrics: Metrics | null; jobs: HostMonitorJob[]; jobsAvailable: boolean }> {
  const endpoint = process.env.SERVER_MONITOR_HOST_URL;
  const token = process.env.SERVER_MONITOR_HOST_TOKEN;
  if (!endpoint || !token) return { state: "unconfigured", metrics: null, jobs: [], jobsAvailable: false };
  try {
    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error();
    // Bound remote body consumption, including chunked responses.
    const reader = response.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength; if (size > 65536) throw new Error(); chunks.push(result.value); } } finally { await reader.cancel().catch(() => {}); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const metrics = sanitizeHostMetrics(data);
    return { state: Date.now() - Date.parse(metrics.sampledAt) > 15000 ? "stale" : "ready", metrics, jobs: sanitizeHostJobs(data.jobs), jobsAvailable: Array.isArray(data.jobs) };
  } catch { return { state: "unavailable", metrics: null, jobs: [], jobsAvailable: false }; }
}

const categories = ["browser", "node", "python", "ffmpeg", "other"];
function category(name: string) {
  if (/^(chrome|chromium|firefox)/i.test(name)) return "browser";
  if (/^node/i.test(name)) return "node";
  if (/^python/i.test(name)) return "python";
  if (/^ffmpeg$/i.test(name)) return "ffmpeg";
  return "other";
}
async function counters() {
  const [stat, vm] = await Promise.all([readFile("/proc/stat", "utf8"), readFile("/proc/vmstat", "utf8")]);
  const ticks = stat.split("\n")[0].trim().split(/\s+/).slice(1, 9).map(Number);
  const value = (key: string) => Number(vm.match(new RegExp(`^${key} (\\d+)$`, "m"))?.[1] || 0);
  return { total: ticks.reduce((a, b) => a + b, 0), idle: ticks[3] + ticks[4], input: value("pswpin"), output: value("pswpout"), at: Date.now() };
}
// Deduplicated bounded sampling: no shell commands, /proc command lines or per-process smaps scans.
let localCache: { at: number; value: Metrics } | undefined;
let pending: Promise<Metrics> | undefined;
export async function collectLocalMetrics(): Promise<Metrics> {
  if (localCache && Date.now() - localCache.at < 4000) return localCache.value;
  if (pending) return pending;
  pending = (async () => {
    const first = await counters();
    const mem = await readFile("/proc/meminfo", "utf8");
    const bytes = (key: string) => Number(mem.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"))?.[1] || 0) * 1024;
    const entries = (await readdir("/proc")).filter(n => /^\d+$/.test(n));
    const processes: Metrics["processes"] = [];
    // Sequential reads keep collector concurrency and file-descriptor use small.
    for (const id of entries) {
      try {
        const status = await readFile(`/proc/${id}/status`, "utf8");
        processes.push({ pid: Number(id), category: category(status.match(/^Name:\s+(.+)$/m)?.[1] || ""), rssBytes: Number(status.match(/^VmRSS:\s+(\d+) kB/m)?.[1] || 0) * 1024 });
      } catch { /* Process exited or visibility denied. */ }
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    const second = await counters();
    const total = second.total - first.total;
    // Kernel swap counters are pages; Linux page size is read from the process ELF aux vector.
    let pageSize: number | null = null;
    try {
      const aux = await readFile("/proc/self/auxv");
      if (["x64", "arm64"].includes(process.arch)) for (let i = 0; i + 16 <= aux.length; i += 16) if (aux.readBigUInt64LE(i) === BigInt(6)) pageSize = Number(aux.readBigUInt64LE(i + 8));
    } catch { /* Unknown page size: rates stay unavailable. */ }
    const seconds = (second.at - first.at) / 1000;
    const value: Metrics = { scope: "local-proc", sampledAt: new Date().toISOString(), cpuPercent: total > 0 ? Math.max(0, Math.min(100, 100 * (1 - (second.idle - first.idle) / total))) : null,
      memory: { totalBytes: bytes("MemTotal"), usedBytes: Math.max(0, bytes("MemTotal") - bytes("MemAvailable")) },
      swap: { totalBytes: bytes("SwapTotal"), usedBytes: Math.max(0, bytes("SwapTotal") - bytes("SwapFree")), inBytesPerSecond: pageSize ? Math.max(0, second.input - first.input) * pageSize / seconds : null, outBytesPerSecond: pageSize ? Math.max(0, second.output - first.output) * pageSize / seconds : null },
      processes: processes.sort((a, b) => b.rssBytes - a.rssBytes).slice(0, 12) };
    localCache = { at: Date.now(), value }; return value;
  })();
  try { return await pending; } finally { pending = undefined; }
}
