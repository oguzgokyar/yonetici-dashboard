export function googleVidsRunnerDecision(runStatus: string, jobStatus: string | undefined, elapsedMs: number, deadlineMs: number) {
  if (jobStatus === "complete") return "complete";
  if (!jobStatus || ["cancelled", "canceled", "failed"].includes(jobStatus) || elapsedMs >= deadlineMs) return "cancel";
  if (["failed", "cancelled", "canceled"].includes(runStatus)) return "failed";
  if (["completed", "complete"].includes(runStatus)) return "await_callback";
  return "wait";
}
