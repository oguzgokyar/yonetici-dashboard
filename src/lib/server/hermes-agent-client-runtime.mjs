export async function requestWithAcknowledgementTimeout(url, init, timeoutMs) {
  const requestPromise = fetch(url, init);
  let timeoutHandle;
  try {
    return await Promise.race([
      requestPromise,
      new Promise((_, reject) => {
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
