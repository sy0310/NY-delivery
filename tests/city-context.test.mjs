import test from 'node:test';
import assert from 'node:assert/strict';
import * as presentation from '../game/assets/scripts/DistrictPresentation.ts';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';
import { CHINATOWN_DISTRICT } from '../game/assets/scripts/ChinatownDistrict.ts';

test('three deterministic backdrop layers surround both districts without entering the playable slice',()=>{
  assert.equal(typeof presentation.backdropBuildings,'function');
  for(const district of [FLUSHING_DISTRICT,CHINATOWN_DISTRICT]) {
    const buildings=presentation.backdropBuildings(district),bounds=district.bounds;
    assert.deepEqual(buildings,presentation.backdropBuildings(district));
    assert.deepEqual([...new Set(buildings.map(item=>item.band))],[0,1,2]);
    assert.ok(buildings.length>90 && buildings.length<240);
    for(const item of buildings) {
      assert.ok(item.x+item.width/2<bounds.minX || item.x-item.width/2>bounds.maxX
        || item.z+item.depth/2<bounds.minZ || item.z-item.depth/2>bounds.maxZ);
    }
    const center={x:(bounds.minX+bounds.maxX)/2,z:(bounds.minZ+bounds.maxZ)/2};
    for(let index=0;index<8;index++) {
      const angle=index*Math.PI/4;
      assert.ok(buildings.some(item=>Math.abs(Math.atan2(Math.sin(Math.atan2(item.z-center.z,item.x-center.x)-angle),
        Math.cos(Math.atan2(item.z-center.z,item.x-center.x)-angle)))<.25));
    }
  }
});
test('twelve original shared storefront identities retain district-specific types and reproducible variants',()=>{
  assert.equal(presentation.STREET_BRANDS?.length,12);
  assert.equal(new Set(presentation.STREET_BRANDS.map(brand=>brand.name)).size,12);
  assert.ok(presentation.STREET_BRANDS.every(brand=>brand.icon && brand.color && brand.caption));
  assert.deepEqual(presentation.frontageVariant('bin-4112293'),presentation.frontageVariant('bin-4112293'));
  assert.notDeepEqual(presentation.frontageVariant('bin-4112293'),presentation.frontageVariant('bin-4112294'));
});
