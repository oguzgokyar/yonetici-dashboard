import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicPickerState, reduceMusicPicker } from '../src/lib/music-picker-state.ts';
import { validateMusicSelection } from '../src/lib/music-discovery.ts';

test('music selection requires finite nonnegative offset and a supported source identity', () => {
  for (const offsetSeconds of [-1, Infinity, NaN, '2']) assert.throws(() => validateMusicSelection({track:{provider:'instagram',id:'sb:piano'},offsetSeconds}));
  assert.throws(() => validateMusicSelection({track:{provider:'bad',id:'x'},offsetSeconds:0}));
  assert.doesNotThrow(() => validateMusicSelection({track:{provider:'youtube',id:'sb:piano'},offsetSeconds:1.5}));
});

test('switching providers clears query, results, draft and playback', () => {
  const state = { ...createMusicPickerState(), query: 'dekorasyon', items: [{ id: 'a' }], selectedId: 'a', previewId: 'a', offsetSeconds: 8 };
  const next = reduceMusicPicker(state, { type: 'provider', provider: 'youtube' });
  assert.equal(next.provider, 'youtube');
  assert.equal(next.query, '');
  assert.deepEqual(next.items, []);
  assert.equal(next.selectedId, '');
  assert.equal(next.previewId, '');
  assert.equal(next.offsetSeconds, 0);
});

test('a late response cannot repopulate another provider or query', () => {
  const state = reduceMusicPicker(createMusicPickerState(), { type: 'provider', provider: 'youtube' });
  const next = reduceMusicPicker(state, { type: 'results', provider: 'instagram', query: '', items: [{ id: 'late' }] });
  assert.deepEqual(next.items, []);
});

test('changing the query stops preview and rejects the old query response', () => {
  const state = reduceMusicPicker({ ...createMusicPickerState(), previewId: 'a', selectedId: 'a', offsetSeconds: 5 }, { type: 'query', query: 'sakin' });
  assert.equal(state.previewId, '');
  assert.equal(state.selectedId, '');
  assert.equal(state.offsetSeconds, 0);
  assert.deepEqual(reduceMusicPicker(state, { type: 'results', provider: 'instagram', query: 'enerjik', items: [{ id: 'a' }] }).items, []);
});

test('matching search results populate and music offsets remain finite/nonnegative', () => {
  const state = reduceMusicPicker(createMusicPickerState(), { type: 'results', provider: 'instagram', query: '', items: [{ id: 'a' }] });
  assert.equal(state.items[0].id, 'a');
  for (const seconds of [NaN, Infinity, -2]) assert.equal(reduceMusicPicker(state, { type: 'offset', seconds }).offsetSeconds, 0);
  assert.equal(reduceMusicPicker(state, { type: 'offset', seconds: 2.5 }).offsetSeconds, 2.5);
  assert.equal(reduceMusicPicker({ ...state, offsetSeconds: 8 }, { type: 'select', id: 'a' }).offsetSeconds, 0);
});
