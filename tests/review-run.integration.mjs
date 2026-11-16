import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Inspect observations read from the visible F3 HUD during actual Cocos builds.
const { events } = JSON.parse(await readFile(process.argv[2], 'utf8'));
const event = name => {
  const observation = events.find(entry => entry.name === name);
  assert.ok(observation, `Missing runtime observation ${name}`);
  return observation;
};

const before = event('order2-before-continue');
const after = event('order2-start');
assert.deepEqual([after.x, after.z, after.yaw, after.mode],
  [before.x, before.z, before.yaw, before.mode]);
assert.equal(after.track, before.track);
assert.match(after.text, /Order NY-1043 · 1 completed · \$9\.75/);
assert.match(after.text, /Single player · playing/);
const audioSeconds = observation => Number(observation.text.match(/Audio ([\d.]+) s/)[1]);
assert.ok(audioSeconds(after) >= audioSeconds(before));
assert.ok(audioSeconds(after) - audioSeconds(before) < 2);

assert.match(event('order1-completed-calibration').text, /1 completed · \$9\.75/);
assert.match(event('order2-completed').text, /2 completed · \$20\.00/);
assert.match(event('order3-completed').text, /3 completed · \$31\.50/);
assert.match(event('order3-picked-up').text, /Order NY-1044/);
assert.match(event('order3-completed').text, /Single player · paused/);
assert.match(event('order3-completed').track, /外部播放器/);
const muted = event('all-muted-new-order');
assert.match(muted.text, /Order NY-1045/);
assert.match(muted.text, /Audio 0\.00 s  gain 0\.000/);
assert.match(muted.text, /Single player · paused/);

const car = event('order3-overlap-car');
const foot = event('order3-overlap-foot');
assert.ok(Math.hypot(car.x - foot.x, car.z - foot.z) < 3.4);
assert.ok(Math.hypot(9.4 - foot.x, -250 - foot.z) < 2.6);
assert.equal(foot.mode, 'ON FOOT');
assert.match(event('order3-completed').route, /订单完成/);

const ordinary = event('ordinary-completed');
const phases = JSON.parse(ordinary.text.match(/Phases (\{[^\n]+\})/)[1]);
assert.ok(phases.toDropoffDrive >= 90 && phases.toDropoffDrive <= 120);
assert.match(ordinary.text, /1 completed · \$9\.75/);
assert.match(ordinary.text, /Single player · playing/);
assert.ok(audioSeconds(event('ordinary-counter')) > audioSeconds(event('ordinary-pickup-parked')));
assert.match(event('ordinary-stowed').text, /Seat drift 0\.0000 m/);
console.log('Actual run passed — continuous orders, preserved music, doorway priority and a 90–120 second drive');
