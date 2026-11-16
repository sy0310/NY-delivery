import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = await readFile(process.argv[2], 'utf8');
const aspect = text.match(/View aspect ([\d.]+) canvas ([\d.]+)/);
assert.ok(aspect, 'F3 must expose real camera and displayed canvas aspect ratios');
assert.ok(Math.abs(Number(aspect[1]) / Number(aspect[2]) - 1) < .002,
  `Camera aspect ${aspect[1]} must match displayed canvas ${aspect[2]}`);
console.log('Real camera aspect matches the displayed canvas');
