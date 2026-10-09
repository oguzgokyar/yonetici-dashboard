type Config = { url: string; token: string; pollMs?: number };
function configuration(): Config {
  return {url: (process.env.HEAVY_JOB_COORDINATOR_URL || '').replace(/\/+$/, ''), token: process.env.HEAVY_JOB_COORDINATOR_TOKEN || ''};
}
async function request(action: 'acquire' | 'release', jobId: string, claimId: string, config: Config) {
  if (!config.url || !config.token) throw new Error('Heavy-job coordinator must be configured (URL and token)');
  const response = await fetch(`${config.url}/v1/${action}`, {
    method: 'POST', headers: {'Authorization': `Bearer ${config.token}`, 'Content-Type':'application/json'},
    body: JSON.stringify({job_id:jobId, claim_id:claimId}), signal: AbortSignal.timeout(10000),
  });
  if (action === 'acquire' && response.status === 409) return false;
  if (!response.ok) throw new Error(`Heavy-job coordinator ${action} failed: HTTP ${response.status}`);
  const result = await response.json();
  if (result[action === 'acquire' ? 'acquired' : 'released'] !== true) throw new Error('Coordinator did not acknowledge claim');
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
