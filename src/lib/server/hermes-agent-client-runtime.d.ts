export function requestWithAcknowledgementTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response>;
