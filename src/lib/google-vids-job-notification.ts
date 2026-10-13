export function googleVidsFailureNotification(jobs: { id: string; status: string; error?: string; prompt?: string }[]) {
  const failed = jobs.find(job => job.status === "failed" && job.error);
  return failed ? { id: failed.id, error: failed.error!, title: failed.prompt || "Google Vids" } : null;
}
