export async function requestWithAcknowledgementTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const requestPromise = fetch(url, init);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      requestPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new DOMException("Dispatch acknowledgement timeout", "TimeoutError")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
