import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Check F3 telemetry captured from an actual Cocos driving session.
const telemetryPath = process.argv[2];
assert.ok(telemetryPath, 'Provide a text file captured from the actual F3 diagnostics');
const telemetry = readFileSync(telemetryPath, 'utf8');
const position = telemetry.match(/Seat drift ([\d.]+) m \(peak ([\d.]+) m\)/);
const rotation = telemetry.match(/Seat yaw ([\d.]+) deg \(peak ([\d.]+) deg\)/);
assert.ok(position && rotation, 'Actual driver camera telemetry must be present');
assert.ok(Number(position[1]) <= .002,
  `Driver camera is ${position[1]} m away from its fixed seat position`);
assert.ok(Number(position[2]) <= .002,
  `Driver camera moved ${position[2]} m relative to its seat`);
assert.ok(Number(rotation[2]) <= .002,
  `Driver camera rotated ${rotation[2]} degrees relative to its seat`);
console.log('Driver camera stayed fixed to its seat throughout the captured session');
