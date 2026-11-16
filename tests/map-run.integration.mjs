import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

// Read the report exported through the visible panel of a real Creator build.
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
let frames = report.frames;
if (!frames && report.rawFrames) {
  const raw = await readFile(resolve(dirname(process.argv[2]), report.rawFrames));
  frames = JSON.parse(gunzipSync(raw).toString('utf8')).frames;
}
assert.equal(report.engine, '3.8.8');
assert.equal(report.completedOrders, 6);
assert.equal(new Set(report.deliveries.map(order => order.id)).size, 6);
for (const district of ['flushing', 'chinatown']) {
  const orders = report.deliveries.filter(order => order.district === district);
  assert.equal(orders.length, 3);
  assert.equal(new Set(orders.map(order => order.restaurant)).size, 2);
  assert.equal(new Set(orders.map(order => order.delivery)).size, 3);
  assert.ok(orders.every(order => order.distance > 0 && order.phases.toPickupDrive > 0 && order.phases.toDropoffWalk > 0));
}
assert.equal(report.deliveries.reduce((sum, order) => sum + order.earnings, 0), 63);
assert.ok(report.summary.active.seconds >= 900);
assert.ok(report.summary.active.frames > 0);
assert.ok(report.swaps >= 3);
assert.equal(report.switchEvents.length, report.swaps);
assert.ok(report.switchEvents.some(event => event.before.paused));
assert.ok(report.switchEvents.some(event => !event.before.paused));
for (const event of report.switchEvents) {
  for (const key of ['source', 'wantsPlayback', 'paused', 'track', 'queue', 'levels']) {
    assert.deepEqual(event.after[key], event.before[key]);
  }
  if (event.before.paused) assert.equal(event.after.time, event.before.time);
  else assert.ok(event.after.time >= event.before.time && event.after.time - event.before.time < 3);
}
assert.ok(report.resources.some(sample => sample.district === 'flushing'));
assert.ok(report.resources.some(sample => sample.district === 'chinatown'));
assert.ok(frames.length > 0 && frames.every(frame => frame[0] > 0));
console.log('Actual map run passed — six deliveries, all places, over 15 active minutes, repeated swaps and music intent preserved');
