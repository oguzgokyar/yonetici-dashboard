import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const timelineUrl = new URL('../src/lib/stock-timeline.ts', import.meta.url);
async function timeline(options) {
  assert.ok(existsSync(timelineUrl), 'shared stock timeline must exist');
  const { getStockTimeline } = await import(timelineUrl.href);
  return getStockTimeline(options);
}

test('fractional trims are frame-aligned and clamp to leave one real source frame', async () => {
  const result = await timeline({ sourceDurationSeconds: 2.19, fps: 30, trimStartSeconds: 0.51, trimEndSeconds: 0.27 });
  assert.equal(result.sourceDurationInFrames, 65);
  assert.equal(result.trimStartFrames, 15);
  assert.equal(result.trimEndFrames, 8);
  assert.equal(result.mainDurationInFrames, 42);
  assert.equal(result.trimStartSeconds, 0.5);
  assert.equal(result.trimEndSeconds, 8 / 30);
  const clamped = await timeline({ sourceDurationSeconds: 0.2, fps: 30, trimStartSeconds: 100, trimEndSeconds: 100 });
  assert.equal(clamped.mainDurationInFrames, 1);
  assert.equal(clamped.trimStartFrames, 5);
  assert.equal(clamped.trimEndFrames, 0);
});

test('outro uses its measured duration and blocks while unknown', async () => {
  assert.equal(await timeline({ sourceDurationSeconds: 10, hasOutro: true }), null);
  const result = await timeline({ sourceDurationSeconds: 10, hasOutro: true, outroDurationSeconds: 1.27 });
  assert.equal(result.outroDurationInFrames, 38);
  assert.equal(result.durationInFrames, 338);
  assert.equal((await timeline({ sourceDurationSeconds: 240.2 })).durationInFrames, 7206);
  assert.equal((await timeline({ sourceDurationSeconds: 0.2 })).durationInFrames, 6);
});

test('studio selection, loading, metadata and composition share guarded timeline paths', () => {
  const ui = readFileSync(new URL('../src/features/stock/stock-videos-studio.tsx', import.meta.url), 'utf8');
  const composition = readFileSync(new URL('../src/remotion/StockFramedVideo.tsx', import.meta.url), 'utf8');
  assert.ok(!ui.includes('[projectId, selectedVideoId]'), 'selection must not refetch settings');
  assert.ok(ui.includes('hydrateSettings') && ui.includes('loadRequestRef'), 'refresh and late responses must not overwrite settings');
  assert.ok(ui.includes('onClick={() => selectVideo(item.id)}'));
  assert.ok(ui.includes('selectVideo(item.id);'));
  assert.ok(ui.includes('document.createElement("video")') && ui.includes('video.preload = "metadata"'));
  assert.ok(ui.includes('if (!active) return;'), 'metadata responses need a cancellation guard');
  assert.ok(ui.includes('disabled={rendering || !timeline}'));
  assert.ok(ui.includes('durationInFrames={timeline.durationInFrames}'));
  assert.ok(ui.includes('loading="lazy"') && ui.includes('onError='));
  assert.ok(!ui.includes('durationSeconds || 30'));
  assert.ok(composition.includes('getStockTimeline') && !composition.includes('outroSrc ? 90'));
});

test('unknown source durations never fabricate a playable timeline', async () => {
  for (const sourceDurationSeconds of [undefined, 0, -1, NaN, Infinity]) {
    assert.equal(await timeline({ sourceDurationSeconds, fps: 30 }), null);
  }
});
