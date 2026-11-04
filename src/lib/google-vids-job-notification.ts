export function googleVidsFailureNotification(jobs: {
  id: string;
  status: string;
  error?: string | null;
  prompt?: string;
  created_at?: string;
  createdAt?: string;
}[]) {
  const latestCompleteJob = jobs.find((j) => j.status === "complete");
  const failed = jobs.find((job) => job.status === "failed" && job.error);
  if (!failed) return null;

  const completeDateStr = latestCompleteJob?.createdAt || latestCompleteJob?.created_at;
  const failedDateStr = failed.createdAt || failed.created_at;

  // Yeni tamamlanan bir video varsa geçmiş başarısızlık bildirimini gösterme
  if (completeDateStr && failedDateStr) {
    if (new Date(completeDateStr).getTime() >= new Date(failedDateStr).getTime()) {
      return null;
    }
  }

  return { id: failed.id, error: failed.error!, title: failed.prompt || "Google Vids" };
}
