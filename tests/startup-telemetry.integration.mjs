import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// This input is exported through the visible performance panel of a real Creator build.
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(report.startup.hudMs>0);
assert.ok(report.startup.sceneReadyMs>=report.startup.hudMs);
assert.equal(report.startup.frames.length,180);
assert.ok(report.startup.frames.every(frame=>frame.milliseconds>0 && frame.textureBytes>=0 && frame.bufferBytes>=0));
assert.equal(report.startup.scope,'First page scene, browser process already running. Cocos texture/buffer estimates and optional JS heap.');
console.log('Actual startup telemetry passed — HUD, scene readiness and the first 180 rendered-frame observations are present');
