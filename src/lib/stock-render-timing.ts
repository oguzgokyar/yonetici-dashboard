type Probe = { streams?: Array<{ codec_type?: string; duration?: string | number }>; format?: { duration?: string | number } };

/** ffprobe JSON: video length wins over container length (which may include longer audio). */
export function parseStockVideoProbe(probe: Probe) {
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("No video stream in probe.");
  const positive = (value: unknown) => {
    const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
    return Number.isFinite(number) && number > 0 ? number : undefined;
  };
  const durationSeconds = positive(video.duration) ?? positive(probe.format?.duration);
  if (!durationSeconds) throw new Error("Video duration could not be determined.");
  return { durationSeconds, hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === "audio")) };
}
