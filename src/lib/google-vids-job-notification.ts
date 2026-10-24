export function googleVidsFailureNotification(jobs: {
  id: string;
  status: string;
  error?: string | null;
  prompt?: string;
  created_at?: string;
}[]) {
  const latestCompleteJob = jobs.find((j) => j.status === "complete");
  const failed = jobs.find((job) => job.status === "failed" && job.error);
  if (!failed) return null;

  // Yeni tamamlanan bir video varsa geçmiş başarısızlık bildirimini gösterme
  if (latestCompleteJob?.created_at && failed.created_at) {
    if (new Date(latestCompleteJob.created_at).getTime() >= new Date(failed.created_at).getTime()) {
      return null;
    }
  }

  return { id: failed.id, error: failed.error!, title: failed.prompt || "Google Vids" };
}
