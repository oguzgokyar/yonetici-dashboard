type Environment = { isVisible: () => boolean; subscribe: (fn: () => void) => () => void; schedule: (fn: () => void) => number; cancel: (id: number) => void };
export function startVisiblePolling(task: (signal: AbortSignal) => Promise<void>, env: Environment) {
  let stopped = false, timer: number | undefined, controller: AbortController | undefined;
  const clear = () => { if (timer !== undefined) env.cancel(timer); timer = undefined; };
  const poll = async () => {
    if (stopped || !env.isVisible() || controller) return;
    const current = new AbortController(); controller = current;
    try { await task(current.signal); } catch { /* Caller owns visible errors. */ }
    finally { if (controller === current) controller = undefined; if (!stopped && env.isVisible()) { clear(); timer = env.schedule(() => { timer = undefined; void poll(); }); } }
  };
  const unsubscribe = env.subscribe(() => { clear(); if (!env.isVisible()) controller?.abort(); else void poll(); });
  void poll();
  return () => { stopped = true; clear(); controller?.abort(); unsubscribe(); };
}
