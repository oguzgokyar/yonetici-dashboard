import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('stock studio page size is set to 15 for both tabs', () => {
  const ui = readFileSync(new URL('../src/features/stock/stock-videos-studio.tsx', import.meta.url), 'utf8');
  assert.match(ui, /const PAGE_SIZE = 15;/, 'PAGE_SIZE must be exactly 15');
  assert.ok(ui.includes('paginatedVideos'), 'must have paginatedVideos');
  assert.ok(ui.includes('paginatedRenderedVideos'), 'rendered tab must also paginate 15 per page');
  assert.ok(ui.includes('totalRenderedPages > 1'), 'rendered tab must render pagination controls when exceeding 15');
});

test('stock studio excludes google vids from rendered tab', () => {
  const ui = readFileSync(new URL('../src/features/stock/stock-videos-studio.tsx', import.meta.url), 'utf8');
  assert.ok(ui.includes('!v.isGoogleVids'), 'must filter out isGoogleVids videos');
  assert.ok(ui.includes('!v.googleVidsUrl'), 'must filter out videos with googleVidsUrl');
  assert.ok(ui.includes('isGoogleVids?: boolean;'), 'RenderedItem must declare isGoogleVids');
});

test('stock studio sorts both stock and rendered videos newest first', () => {
  const ui = readFileSync(new URL('../src/features/stock/stock-videos-studio.tsx', import.meta.url), 'utf8');
  assert.ok(ui.includes('sortedRenderedVideos'), 'must have sortedRenderedVideos memo');
  assert.match(ui, /return timeB - timeA;/, 'must sort descending by timestamp');
});

test('google drive API requests createdTime and modifiedTime with newest-first ordering', () => {
  const gdrive = readFileSync(new URL('../src/lib/server/google-drive.ts', import.meta.url), 'utf8');
  assert.ok(gdrive.includes('orderBy=createdTime desc'), 'Drive API must order by createdTime desc');
  assert.ok(gdrive.includes('createdTime?: string;'), 'DriveVideoFile must declare createdTime');
  assert.ok(gdrive.includes('modifiedTime?: string;'), 'DriveVideoFile must declare modifiedTime');
});

test('stock videos route limits and persists Drive createdTime', () => {
  const route = readFileSync(new URL('../src/app/api/projects/[projectId]/stock-videos/route.ts', import.meta.url), 'utf8');
  assert.match(route, /limit.*300/, 'default limit must be expanded to 300');
  assert.ok(route.includes('file.createdTime || file.modifiedTime || now'), 'must prioritize Drive createdTime');
});

test('videos API recognizes stockVideoId and ffmpeg model as stock renders', () => {
  const videosRoute = readFileSync(new URL('../src/app/api/videos/route.ts', import.meta.url), 'utf8');
  assert.ok(videosRoute.includes('requestState.stockVideoId'), 'must detect stockVideoId in request');
  assert.ok(videosRoute.includes('row.model === "ffmpeg-frame-engine"'), 'must detect ffmpeg-frame-engine model');
});
