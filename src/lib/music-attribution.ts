/** Preserve the authoritative license credit verbatim in the caption/description. */
export function appendMusicAttribution(caption: string, attribution: string): string {
  const text = caption.trim();
  const credit = attribution.trim();
  if (!credit || text.includes(credit)) return text;
  return text ? `${text}\n\n${credit}` : credit;
}

type AttributionDatabase = {
  prepare(sql: string): { get(...params: string[]): unknown };
};

/** Resolve license evidence from server-owned render metadata, not the request. */
export function resolveMusicAttribution(
  database: AttributionDatabase,
  projectId: string,
  media: { assetId?: string; mediaUrl?: string },
): string {
  let id = media.assetId?.trim();
  if (!id && media.mediaUrl) {
    const pathname = new URL(media.mediaUrl, "https://local.invalid").pathname;
    id = pathname.match(/^\/api\/videos\/([^/]+)\/?$/)?.[1];
  }
  if (!id) return "";
  const row = database.prepare(
    "SELECT response_json FROM generation_jobs WHERE project_id = ? AND id = ? AND type = 'video' AND status = 'complete'",
  ).get(projectId, id) as { response_json?: string } | undefined;
  if (!row?.response_json) return "";
  try {
    const credit = JSON.parse(row.response_json)?.metadata?.music?.attribution;
    return typeof credit === "string" ? credit.trim() : "";
  } catch {
    return "";
  }
}
