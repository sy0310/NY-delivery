import test from 'node:test';
import assert from 'node:assert/strict';
import { Playlist } from '../game/assets/scripts/Playlist.ts';
const track = (id, local = true) => ({id, name:id, url:(local ? 'blob:' : '/') + id, local, recordable:!local});
const radio = queue => queue.registerRadio([track('radio-a', false), track('radio-b', false)]);

test('append, replace, select and remove retain selection and playback intent', () => {
  const queue = new Playlist(); radio(queue);
  queue.append([track('a'), track('b')]); queue.setSource('local'); queue.select('b');
  queue.wantsPlayback = true; queue.append([track('c')]);
  assert.equal(queue.current.id, 'b'); assert.equal(queue.wantsPlayback, true);
  queue.wantsPlayback = false; queue.next(); assert.equal(queue.current.id, 'c');
  assert.equal(queue.wantsPlayback, false);
  queue.remove('c'); assert.equal(queue.current.id, 'a');
  queue.replace([track('d')]); assert.equal(queue.current.id, 'd');
  queue.remove('d'); assert.equal(queue.current, undefined);
});

test('ended advances a list, repeats one, and stops once or all failed tracks', () => {
  const queue = new Playlist(); radio(queue); queue.wantsPlayback = true;
  queue.ended(); assert.equal(queue.current.id, 'radio-b');
  queue.ended(); assert.equal(queue.current.id, 'radio-a');
  queue.repeat = 'one'; queue.ended(); assert.equal(queue.current.id, 'radio-a');
  queue.repeat = 'once'; queue.ended(); queue.ended(); assert.equal(queue.wantsPlayback, false);
  queue.wantsPlayback = true; queue.failCurrent(); queue.failCurrent();
  assert.equal(queue.wantsPlayback, false); assert.equal(queue.tracks.every(t => t.failed), true);
});

test('recording mode cannot route local tracks and restores library with latest pause intent', () => {
  const queue = new Playlist(); radio(queue); radio(queue);
  assert.equal(queue.tracks.length, 2);
  queue.append([track('private')]); queue.setSource('local'); queue.wantsPlayback = true;
  queue.setRecording(true); assert.equal(queue.current.recordable, true);
  assert.equal(queue.setSource('local'), false); queue.next();
  assert.equal(queue.current.local, false);
  queue.wantsPlayback = false; queue.setRecording(false);
  assert.equal(queue.source, 'local'); assert.equal(queue.current.id, 'private');
  assert.equal(queue.wantsPlayback, false);
  queue.setSource('external'); assert.equal(queue.current, undefined);
  assert.equal(queue.wantsPlayback, false);
});

test('removal and replacement report only URLs absent from all retained tracks', () => {
  const queue = new Playlist(); const a = track('a');
  queue.append([a, {...track('b'), url:a.url}]);
  assert.deepEqual(queue.remove('a'), []);
  assert.deepEqual(queue.replace([track('c')]), [a.url]);
  assert.deepEqual(queue.replace([]), ['blob:c']);
});
