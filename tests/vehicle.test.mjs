import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleController } from '../game/assets/scripts/VehicleController.ts';

test('car accelerates brakes and stops against an obstacle', () => {
  const car = new VehicleController();
  for (let step = 0; step < 40; step++) car.update(.05, 1, 0, false, () => true);
  assert.ok(car.speed > 0);
  assert.ok(car.z < 23);
  assert.equal(car.exitPosition(() => true), null);
  for (let step = 0; step < 40; step++) car.update(.05, 0, 0, true, () => true);
  assert.equal(car.speed, 0);
  assert.notEqual(car.exitPosition(() => true), null);
  const before = car.z;
  car.update(.05, 1, 0, false, () => false);
  assert.equal(car.z, before);
  assert.equal(car.speed, 0);
});

test('blocked driver side uses a safe passenger-side exit, or refuses both sides', () => {
  const car = new VehicleController();
  assert.equal(car.exitPosition(() => false), null);
  const exit = car.exitPosition(x => x > car.x);
  assert.ok(exit.x > car.x);
  car.update(.05, 1, 1, false, () => true);
  assert.ok(car.yaw > 0);
  assert.ok(car.distance > 0);
  car.reset();
  assert.deepEqual([car.x, car.z, car.yaw, car.speed], [-2.5, 23, 0, 0]);
});
