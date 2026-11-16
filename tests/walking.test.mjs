import test from 'node:test';
import assert from 'node:assert/strict';
import { WalkingController } from '../game/assets/scripts/WalkingController.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('sideways walking responds immediately while the view keeps its heading', () => {
  const walker = new WalkingController();
  walker.place({ x: 0, z: 0 }, 0);
  walker.update(.05, 0, -1, () => true);
  close(walker.x, -.165);
  close(walker.z, 0);
  close(walker.yaw, 0);
  walker.update(.05, 0, 0, () => true);
  close(walker.x, -.165);
});

test('movement follows the viewed heading and normalizes diagonals while preserving analog input', () => {
  const walker = new WalkingController();
  walker.place({ x: 0, z: 0 }, Math.PI / 2);
  walker.update(1, 1, 0, () => true);
  close(walker.x, -3.3);
  close(walker.z, 0);
  walker.place({ x: 0, z: 0 }, 0);
  walker.update(1, 1, 1, () => true);
  close(Math.hypot(walker.x, walker.z), 3.3);
  assert.ok(walker.x > 0 && walker.z < 0);
  walker.place({ x: 0, z: 0 }, 0);
  walker.update(1, .25, 0, () => true);
  close(walker.z, -.825);
});

test('walking slides along walls and blocked movement preserves position', () => {
  const walker = new WalkingController();
  walker.update(1, 1, 1, x => x <= 0);
  close(walker.x, 0);
  assert.ok(walker.z < 0);
  const before = walker.z;
  walker.update(1, 1, -1, () => false);
  close(walker.x, 0);
  close(walker.z, before);
});
