import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchInput } from '../game/assets/scripts/TouchInput.ts';

test('joystick preserves analog strength, caps diagonals, and ignores a second finger', () => {
  const input = new TouchInput();
  assert.equal(input.beginStick(1), true);
  assert.equal(input.beginStick(2), false);
  input.moveStick(2, 1, 1);
  assert.equal(input.horizontal, 0);
  input.moveStick(1, .25, -.5);
  assert.equal(input.horizontal, .25);
  assert.equal(input.forward, .5);
  input.moveStick(1, 1, -1);
  assert.ok(Math.abs(Math.hypot(input.horizontal, input.forward) - 1) < 1e-9);
});

test('steering and pedals can be held independently and cancellation releases only its finger', () => {
  const input = new TouchInput();
  input.beginStick(1);
  input.moveStick(1, -.8, 0);
  input.pressPedal(2, 'gas');
  assert.equal(input.throttle, 1);
  assert.equal(input.horizontal, -.8);
  input.pressPedal(3, 'brake');
  assert.equal(input.braking, true);
  input.release(3);
  assert.equal(input.braking, false);
  assert.equal(input.throttle, 1);
  input.release(2);
  assert.equal(input.throttle, 0);
  assert.equal(input.horizontal, -.8);
  input.release(1);
  assert.equal(input.horizontal, 0);
  assert.equal(input.forward, 0);
});

test('lost focus clears every held input and reverse responds independently', () => {
  const input = new TouchInput();
  input.pressPedal(7, 'reverse');
  assert.equal(input.throttle, -1);
  input.beginStick(8);
  input.moveStick(8, 1, 1);
  input.clear();
  assert.equal(input.throttle, 0);
  assert.equal(input.braking, false);
  assert.equal(input.horizontal, 0);
  assert.equal(input.beginStick(9), true);
});
