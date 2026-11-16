import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rendering from '../game/assets/scripts/QualityPreset.ts';

const car = {x:0,z:0};
const view = (inCar, paused=false, x=20) => ({inCar,paused,position:{x,z:0}});
const schedule = () => {
  assert.equal(typeof rendering.CarDisplaySchedule, 'function');
  return new rendering.CarDisplaySchedule();
};
test('distant walking and pause freeze mirror and panel work, preserving their last images', () => {
  const display = schedule();
  display.update(.016,view(true),car,30);
  assert.equal(display.mirror,true);
  assert.equal(display.panels,true);
  const updates = [display.mirrorUpdates,display.panelUpdates];
  for (let frame=0; frame<120; frame++) display.update(1/60,view(false),car,30);
  assert.equal(display.mode,'frozen');
  assert.deepEqual([display.mirrorUpdates,display.panelUpdates],updates);
  display.update(10,view(true,true),car,30);
  assert.equal(display.mirror,false);
  assert.equal(display.panels,false);
  display.update(.001,view(true),car,30);
  assert.equal(display.mirror,true);
  assert.equal(display.panels,true);
});
test('nearby walking updates at five Hertz and entering the car restores immediately', () => {
  const display = schedule();
  display.update(.001,view(false,false,2),car,30);
  assert.equal(display.mode,'nearby');
  for(let frame=0;frame<60;frame++) display.update(1/60,view(false,false,2),car,30);
  assert.ok(display.mirrorUpdates>=5 && display.mirrorUpdates<=6);
  display.update(.001,view(true),car,30);
  assert.equal(display.mode,'driving');
  assert.equal(display.mirror,true);
  assert.equal(display.panels,true);
});
test('standard and low driving retain their mirror update budgets', () => {
  for (const fps of [15,30]) {
    const display = schedule();
    for(let frame=0;frame<600;frame++) display.update(1/60,view(true),car,fps);
    assert.ok(display.mirrorUpdates>=fps*10-2 && display.mirrorUpdates<=fps*10+1);
  }
});
test('the rear camera excludes the car layer while the main view retains it', () => {
  const carSource = readFileSync(new URL('../game/assets/scripts/CarModel.ts',import.meta.url),'utf8');
  const demo = readFileSync(new URL('../game/assets/scripts/DeliveryDemo.ts',import.meta.url),'utf8');
  assert.ok(carSource.includes('renderer.node.layer = VEHICLE_LAYER'),'car renderers need their own layer');
  assert.ok(carSource.includes('camera.visibility &= ~VEHICLE_LAYER'),'mirror must exclude the car interior');
  assert.ok(demo.includes('camera.visibility |= VEHICLE_LAYER'),'main camera must retain the car');
});
