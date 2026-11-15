import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => {
  const text = await readFile(path, 'utf8');
  const values = text.match(/x ([-\d.]+)\s+z ([-\d.]+)\s+yaw ([-\d.]+)/);
  assert.ok(values, 'Real editor F3 coordinates must be present');
  assert.match(text, /ON FOOT/);
  assert.match(text, /Walk eye 0.0000 m/);
  return values.slice(1).map(Number);
};
const before = await read(process.argv[2]);
const after = await read(process.argv[3]);
assert.deepEqual(after.slice(0, 2), before.slice(0, 2), 'looking must preserve walking position');
assert.ok(Math.abs(after[2] - before[2]) > 10, 'independent look input in Creator must rotate the walking view');
console.log('Creator look keys rotate the view while preserving player position');
