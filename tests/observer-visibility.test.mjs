import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as presentation from '../game/assets/scripts/DistrictPresentation.ts';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';
import { CHINATOWN_DISTRICT } from '../game/assets/scripts/ChinatownDistrict.ts';

for (const district of [FLUSHING_DISTRICT, CHINATOWN_DISTRICT]) {
  for (const quality of ['low', 'standard']) {
    test(`${district.id} ${quality} close-ups follow the walker while the car stays at spawn`, () => {
      assert.equal(typeof presentation.updateDistrictVisibility, 'function');
      const restaurant = district.restaurants[0];
      const doorway = district.deliveries[0];
      const detail = { node: {active:false}, position:restaurant.entry };
      const entrance = { node: {active:false}, position:doorway.entry };
      const chunk = { node: {active:false}, bounds:{minX:restaurant.entry.x-2,maxX:restaurant.entry.x+2,minZ:restaurant.entry.z-2,maxZ:restaurant.entry.z+2} };
      presentation.updateDistrictVisibility([chunk], [detail, entrance], district.spawn, quality);
      assert.equal(detail.node.active, false);
      presentation.updateDistrictVisibility([chunk], [detail, entrance], restaurant.entry, quality);
      assert.equal(detail.node.active, true);
      assert.equal(chunk.node.active, true);
      presentation.updateDistrictVisibility([chunk], [detail, entrance], doorway.entry, quality);
      assert.equal(entrance.node.active, true);
      presentation.updateDistrictVisibility([chunk], [detail, entrance], district.spawn, quality);
      assert.equal(detail.node.active, false);
    });
  }
}

test('the frame passes the current observer separately from vehicle telemetry', () => {
  const demo = readFileSync(new URL('../game/assets/scripts/DeliveryDemo.ts', import.meta.url), 'utf8');
  const world = readFileSync(new URL('../game/assets/scripts/World.ts', import.meta.url), 'utf8');
  assert.match(demo, /position:\s*this\.inCar\s*\?\s*this\.vehicle\s*:\s*this\.walker/);
  assert.match(world, /updateDistrictVisibility\(this\.chunks,\s*this\.details,\s*view\.position,\s*this\.quality\)/);
  assert.match(demo, /x:\s*this\.vehicle\.x,\s*z:\s*this\.vehicle\.z/);
});
