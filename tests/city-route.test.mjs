import test from 'node:test';
import assert from 'node:assert/strict';
import { planRoute, orderLocation, PICKUP_PARKING, roadAt } from '../game/assets/scripts/CityLayout.ts';
import { OrderTiming } from '../game/assets/scripts/OrderTiming.ts';

test('connected one-way blocks provide a long reachable delivery leg and a continuous return', () => {
  const first = orderLocation(0);
  const delivery = planRoute(PICKUP_PARKING, first.dropoffParking);
  assert.ok(delivery.distance > 950 && delivery.distance < 1150);
  assert.ok(delivery.points.some(point => point.x === 300 && point.z === 140));
  assert.ok(delivery.points.every(point => roadAt(point.x, point.z)));
  const next = planRoute(first.dropoffParking, PICKUP_PARKING);
  assert.ok(next.distance > 700 && next.distance < 900);
  assert.ok(next.points.every(point => roadAt(point.x, point.z)));
  assert.deepEqual(delivery.points.at(-1), first.dropoffParking);
});

test('moving through a junction advances the next target and near-goal route stays short', () => {
  assert.deepEqual(planRoute({x:2.5,z:23},PICKUP_PARKING).points[0], {x:0,z:-120});
  assert.deepEqual(planRoute({x:30,z:-120},PICKUP_PARKING).points[0], {x:300,z:-120});
  assert.ok(planRoute({x:294.5,z:-107},PICKUP_PARKING).distance < 15);
  assert.equal(new Set([0,1,2].map(i => orderLocation(i).address)).size, 3);
});

test('phase timing separates active driving, parking, walking, waiting and handoff', () => {
  const timing = new OrderTiming();
  timing.tick(10,'accepted',true,8,false,false);
  timing.tick(3,'accepted',true,0,false,false);
  timing.tick(5,'accepted',false,0,false,false);
  timing.tick(6,'accepted',false,0,true,true);
  timing.tick(4,'accepted',false,0,true,false);
  timing.tick(7,'carrying',false,0,true,false);
  timing.tick(20,'stowed',true,10,true,false);
  timing.tick(8,'delivering',false,0,true,false);
  timing.tick(99,'delivered',false,0,true,false);
  assert.equal(timing.driving,30); assert.equal(timing.total,63);
  assert.equal(timing.seconds.wait,6); assert.equal(timing.seconds.handoff,4);
  timing.reset(); assert.equal(timing.total,0);
});
