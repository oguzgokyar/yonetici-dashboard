export type StockTimelineOptions = {
  sourceDurationSeconds?: number;
  fps?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  hasOutro?: boolean;
  outroDurationSeconds?: number;
};

/** Whole frames only: never extend a source, always retain at least one frame. */
export function getStockTimeline(options: StockTimelineOptions) {
  const duration = options.sourceDurationSeconds;
  const fps = options.fps ?? 30;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0) return null;
  const sourceDurationInFrames = Math.floor(duration * fps + 1e-7);
  if (sourceDurationInFrames < 1) return null;
  const trimFrames = (seconds = 0) => Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * fps)) : 0;
  const trimStartFrames = Math.min(sourceDurationInFrames - 1, trimFrames(options.trimStartSeconds));
  const trimEndFrames = Math.min(sourceDurationInFrames - trimStartFrames - 1, trimFrames(options.trimEndSeconds));
  const mainDurationInFrames = sourceDurationInFrames - trimStartFrames - trimEndFrames;
  const outro = options.outroDurationSeconds;
  if (options.hasOutro && (typeof outro !== "number" || !Number.isFinite(outro) || outro <= 0)) return null;
  const outroDurationInFrames = options.hasOutro ? Math.floor(outro! * fps + 1e-7) : 0;
  if (options.hasOutro && outroDurationInFrames < 1) return null;
  return {
    outroDurationInFrames,
    fps, sourceDurationInFrames, trimStartFrames, trimEndFrames,
    trimStartSeconds: trimStartFrames / fps,
    trimEndSeconds: trimEndFrames / fps,
    mainDurationInFrames,
    mainDurationSeconds: mainDurationInFrames / fps,
    durationInFrames: mainDurationInFrames + outroDurationInFrames,
  };
}
