import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = () => readFileSync(new URL('../src/features/stock/music-discovery-modal.tsx', import.meta.url), 'utf8');

 test('modal uses one compact accessible row with guarded selection and optional focus tooltip', () => {
  const jsx = component();
  assert.match(jsx, /import "\.\/music-discovery-modal\.css"/);
  assert.match(jsx, /presentMusicTrack\(item\)/);
  assert.match(jsx, /className="music-track-title"/);
  assert.match(jsx, /disabled={!item.canEmbed}/);
  assert.match(jsx, /aria-describedby={presentation.unavailableReason/);
  assert.match(jsx, /role="tooltip"/);
  assert.match(jsx, /presentation.unavailableReason &&/);
  assert.match(jsx, /aria-label={`Kaynakta dinle:/);
  assert.match(jsx, /aria-label={`\$\{state.previewId/);
  assert.match(jsx, /musicSearchNotice\(state.provider, data\)/);
  assert.doesNotMatch(jsx, /setMessage\(data.message|music-discovery-note|selected.attribution|<p>{item.embedReason}/);
  assert.equal((jsx.match(/<audio\b/g) || []).length, 1);
  assert.match(jsx, /controller.signal.aborted/);
  assert.match(jsx, /controller.abort\(\)/);
  assert.match(jsx, /event.key === "Tab"/);
  assert.match(jsx, /event.key === "Escape"/);
  assert.match(jsx, /onSelect\({ track: selected, offsetSeconds: state.offsetSeconds }\)/);
  const css = readFileSync(new URL('../src/features/stock/music-discovery-modal.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns:\s*36px minmax\(0, 1fr\)/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /:focus-within/);
  assert.match(css, /min-height:\s*36px/);
});

const track = { provider: 'instagram', id: 'sb:calm', title: 'Calm', artist: 'Scott Buckley', durationSeconds: 153.76, canEmbed: true, embedReason: 'Long license explanation', sourceKind: 'licensed-alternative', isTrending: true };

test('row presentation identifies licensed alternatives without falsely claiming Instagram trends', async () => {
  const { presentMusicTrack } = await import('../src/lib/music-modal-presentation.ts');
  assert.deepEqual(presentMusicTrack(track), {
    title: 'Calm — Scott Buckley', duration: '2:34', sourceLabel: 'Scott', sourceName: 'Scott Buckley · Lisanslı alternatif', trending: false, unavailableReason: '',
  });
  const native = presentMusicTrack({ ...track, sourceKind: undefined, provider: 'youtube', canEmbed: false, durationSeconds: null });
  assert.equal(native.sourceLabel, 'YT');
  assert.equal(native.sourceName, 'YouTube');
  assert.equal(native.trending, true);
  assert.equal(native.unavailableReason, track.embedReason);
  assert.equal(native.duration, '—');
  assert.equal(presentMusicTrack({ ...track, durationSeconds: NaN }).duration, '—');
  assert.equal(presentMusicTrack({ ...track, sourceKind: undefined }).sourceName, 'Instagram');
});

test('structured native status stays visible during successful fallback without exposing raw messages', async () => {
  const { musicSearchNotice } = await import('../src/lib/music-modal-presentation.ts');
  assert.deepEqual(musicSearchNotice('instagram', { status: 'ok', nativeStatus: 'not-configured', message: 'SECRET ENV long note' }), { text: 'Instagram bağlı değil', settings: true });
  assert.deepEqual(musicSearchNotice('youtube', { status: 'ok', message: 'Long credit paragraph' }), { text: '', settings: false });
  assert.deepEqual(musicSearchNotice('youtube', { status: 'ok', nativeStatus: 'error' }), { text: 'YouTube araması başarısız', settings: true });
  assert.deepEqual(musicSearchNotice('instagram', { status: 'unsupported' }), { text: 'Instagram keşfi kullanılamıyor', settings: true });
  assert.deepEqual(musicSearchNotice('instagram', { status: 'empty' }), { text: '', settings: false });
});
