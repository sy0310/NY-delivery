import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Structured records come from the actual Cocos HUD, performance panel and screenshots.
const path = process.argv[2] ?? 'docs/media/review-5923195143/summary.json';
const evidence = JSON.parse(await readFile(path, 'utf8'));
const run = evidence.runs.release;
assert.equal(run.source, '51cb5fc');
assert.equal(run.engine, '3.8.8');
assert.equal(run.completedOrders, 2);
assert.deepEqual(run.deliveries.map(order => order.district), ['flushing', 'chinatown']);
assert.equal(new Set(run.deliveries.map(order => order.id)).size, 2);
assert.equal(run.deliveries.reduce((sum, order) => sum + order.earnings, 0), 20);
for (const order of run.deliveries) {
  assert.ok(Math.abs(Object.values(order.phases).reduce((sum, seconds) => sum + seconds, 0) - order.elapsed) < .01);
  assert.ok(order.phases.toPickupDrive > 30 && order.phases.toDropoffDrive > 30);
  assert.ok(order.phases.toPickupWalk > 0 && order.phases.toDropoffWalk > 0);
}
assert.ok(run.summary.active.seconds > 900);
assert.ok(run.unsampledOrderSeconds > 28 && run.unsampledOrderSeconds < 30);
assert.ok(evidence.runs.collisionBuild.unsampledOrderSeconds < .01);
assert.ok(evidence.runs.collisionBuild.summary.active.seconds > 1300);

const event = name => {
  const item = evidence.cases.find(record => record.name === name);
  assert.ok(item, name);
  assert.equal(item.source, '51cb5fc');
  return item;
};
assert.ok(event('release-flushing-main-realigned').x > 0);
assert.ok(event('release-flushing-prince-before').x < 0);
const before38 = event('release-flushing-main38-before');
const forward38 = event('release-flushing-main38-forward');
const reverse38 = event('release-flushing-main38-reverse');
assert.ok(before38.x < -51 && forward38.x > -49);
assert.ok(Math.hypot(forward38.x - reverse38.x, forward38.z - reverse38.z) > 3);
const before39 = event('extra-flushing-main39-before-reached');
const after39 = event('extra-flushing-main39-crossed');
const reverse39 = event('extra-flushing-main39-reverse');
assert.ok(before39.x < -29 && after39.x > -18);
assert.ok(Math.hypot(after39.x - reverse39.x, after39.z - reverse39.z) > 3);
assert.ok(event('release-chinatown-doyers-restricted').z < 3);
assert.ok(event('release-chinatown-mott-turn-retry').clearance > 1);
assert.ok(event('release-chinatown-delivered-actual').musicPlaying);

for (const district of ['flushing', 'chinatown']) {
  for (const quality of ['standard', 'low']) {
    const views = evidence.panorama.release.filter(view => view.district === district && view.quality === quality);
    assert.equal(views.length, 8);
    assert.ok(views.every(view => view.source === '51cb5fc' && view.width === 1512 && view.height === 777));
    assert.ok(Math.abs(Math.abs(views[7].yaw - views[0].yaw) - 315) < 1);
  }
  const before = evidence.frontages.before.find(view => view.district === district);
  const after = evidence.frontages.after.find(view => view.district === district);
  assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .05);
  assert.ok(Math.abs((before.yaw - after.yaw) % 360) < .2);
  assert.equal(before.dpr, after.dpr);
}
console.log('Actual Review 5923195143 records passed — two districts, three Main crossings, reverse exits, music and panorama provenance');
