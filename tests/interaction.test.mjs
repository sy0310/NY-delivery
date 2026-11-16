import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInteraction, directionTo } from '../game/assets/scripts/Interaction.ts';

const context = overrides => ({
  stage: 'accepted', inCar: false, speed: 0, queueJoined: false, ready: false,
  pickup: { distance: 20, angle: 0 }, dropoff: { distance: 20, angle: 0 },
  carDistance: 20, ...overrides,
});

test('task delivery wins when the doorway and car ranges overlap', () => {
  const action = resolveInteraction(context({ stage: 'delivering',
    dropoff: { distance: 1, angle: 0 }, carDistance: 2 }));
  assert.equal(action.kind, 'deliver');
  assert.equal(action.enabled, true);
});

test('counter interaction and execution share an eligible task target before the car', () => {
  assert.equal(resolveInteraction(context({ pickup: { distance: 1, angle: 0 }, carDistance: 2 })).kind, 'queue');
  assert.equal(resolveInteraction(context({ pickup: { distance: 1, angle: 0 }, carDistance: 2,
    queueJoined: true, ready: true })).kind, 'pickup');
  assert.equal(resolveInteraction(context({ pickup: { distance: 1, angle: 0 }, queueJoined: true })).kind, 'wait');
});

test('state, distance and facing make contextual actions deterministic', () => {
  assert.equal(resolveInteraction(context({ stage: 'idle', inCar: true })).kind, 'accept');
  assert.equal(resolveInteraction(context({ stage: 'delivered' })).kind, 'continue');
  assert.equal(resolveInteraction(context({ inCar: true, speed: 1 })).enabled, false);
  assert.equal(resolveInteraction(context({ inCar: true })).kind, 'exit');
  assert.equal(resolveInteraction(context({ stage: 'carrying', carDistance: 2 })).kind, 'stow-enter');
  assert.equal(resolveInteraction(context({ stage: 'stowed', carDistance: 2 })).kind, 'enter');
  assert.equal(resolveInteraction(context({ pickup: { distance: 2, angle: Math.PI }, carDistance: 2 })).kind, 'enter');
  assert.equal(resolveInteraction(context({ pickup: { distance: 10, angle: 0 } })).kind, 'none');
});

test('navigation derives its direction from position and current heading', () => {
  assert.equal(directionTo({x:0,z:0,yaw:0}, {x:0,z:-10}).turn, 'straight');
  assert.equal(directionTo({x:0,z:0,yaw:0}, {x:-10,z:0}).turn, 'left');
  assert.equal(directionTo({x:0,z:0,yaw:0}, {x:10,z:0}).turn, 'right');
  assert.equal(directionTo({x:0,z:0,yaw:Math.PI}, {x:0,z:10}).turn, 'straight');
  assert.equal(directionTo({x:0,z:0,yaw:0}, {x:0,z:10}).turn, 'back');
});
