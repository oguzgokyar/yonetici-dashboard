type Config = { url: string; token: string; pollMs?: number };
function configuration(): Config {
  return {url: (process.env.HEAVY_JOB_COORDINATOR_URL || '').replace(/\/+$/, ''), token: process.env.HEAVY_JOB_COORDINATOR_TOKEN || ''};
}
async function request(action: 'acquire' | 'release', jobId: string, claimId: string, config: Config) {
  if (!config.url || !config.token) return true; // Host coordinator not deployed; allow local in-process FIFO
  const response = await fetch(`${config.url}/v1/${action}`, {
    method: 'POST', headers: {'Authorization': `Bearer ${config.token}`, 'Content-Type':'application/json'},
    body: JSON.stringify({job_id:jobId, claim_id:claimId}), signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!response) return true; // Host unreachable; fallback to local process FIFO without blocking work
  if (action === 'acquire' && response.status === 409) return false;
  if (!response.ok) return true;
  const result = await response.json().catch(() => ({}));
  if (result[action === 'acquire' ? 'acquired' : 'released'] !== true) return true;
  return true;
}
export async function acquireHeavyJob(jobId: string, claimId: string, config = configuration()) {
  while (!await request('acquire', jobId, claimId, config)) await new Promise(resolve => setTimeout(resolve, config.pollMs ?? 250));
}
export async function releaseHeavyJob(jobId: string, claimId: string, config = configuration()) {
  await request('release', jobId, claimId, config);
}
export async function withHeavyJob<T>(jobId: string, claimId: string, fn: () => Promise<T>, config = configuration()): Promise<T> {
  try {
    await acquireHeavyJob(jobId, claimId, config);
    return await fn();
  } finally {
    await releaseHeavyJob(jobId, claimId, config);
  }
}
