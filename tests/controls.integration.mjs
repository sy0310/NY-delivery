import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Feed this checker visible F3 snapshots captured from the real published game.
const states = JSON.parse(await readFile(process.argv[2], 'utf8'));
const read = name => {
  const state = states.find(entry => entry.name === name);
  assert.ok(state, `Missing real runtime snapshot ${name}`);
  const values = state.text.match(/x ([-\d.]+)\s+z ([-\d.]+)\s+yaw ([-\d.]+)/);
  assert.ok(values, 'F3 coordinates must be present');
  assert.match(state.text, /Touch throttle 0 brake 0 horizontal 0.00/, 'released pointers must be neutral');
  return { x: Number(values[1]), z: Number(values[2]), yaw: Number(values[3]), mph: state.mph, text: state.text };
};
const start = read('start');
const gas = read('gas');
const brake = read('brake');
const reverse = read('reverse');
assert.ok(gas.z < start.z - 1, 'holding gas must move the actual car forward');
assert.ok(gas.mph > 0, 'gas must produce a nonzero actual speed');
assert.equal(brake.mph, 0, 'holding the brake must stop the actual car');
assert.ok(brake.z < gas.z, 'the car must advance during braking');
assert.ok(reverse.mph > 0, 'reverse must produce a nonzero actual speed');
assert.ok(reverse.z > brake.z + 1, 'reverse gear and gas must move the actual car backward');
for (const state of [start, gas, brake, reverse]) {
  assert.match(state.text, /Seat drift 0.0000 m/);
  assert.match(state.text, /Seat yaw 0.0000 deg/);
}
const foot = read('walk-start-focused');
const stick = read('walk-stick-focused');
const look = read('look');
assert.ok(stick.x < foot.x - .05, 'left joystick must actually strafe left');
assert.equal(stick.z, foot.z);
assert.equal(stick.yaw, foot.yaw, 'strafing must preserve the view heading');
assert.equal(look.x, stick.x, 'look drag must preserve player position');
assert.equal(look.z, stick.z);
assert.ok(Math.abs(look.yaw - stick.yaw) > 10, 'right drag must turn the view');
for (const state of [foot, stick, look]) assert.match(state.text, /Walk eye 0.0000 m/);
console.log('Published controls passed — gas, brake, reverse, strafe, independent look and released pointers');
