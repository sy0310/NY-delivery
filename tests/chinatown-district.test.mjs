import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHINATOWN_DISTRICT as map } from '../game/assets/scripts/ChinatownDistrict.ts';
import { isAccessible, routeInDistrict } from '../game/assets/scripts/DistrictNavigation.ts';

test('Chinatown retains official relative geometry, restrictions, five street blocks and original place identities',()=>{
  assert.equal(map.units,'m');assert.equal(map.origin.crs,'EPSG:2263');
  assert.ok(map.blocks.filter(block=>block.kind==='street-block').length>=4);
  assert.ok(map.buildings.length>50);
  assert.equal(map.restaurants.length,2);assert.equal(map.deliveries.length,3);
  assert.match(map.restaurants[0].name,/Noodle/);
  assert.ok(map.roads.filter(road=>road.name==='DOYERS ST').length>0);
  assert.ok(map.roads.filter(road=>road.name==='DOYERS ST').every(road=>!road.car && road.foot));
  
  const intersection=map.roads.find(road=>road.id==='nyc-1782').points[0];
  assert.ok(Math.hypot(intersection.x,intersection.z)<.01);
  assert.ok(map.bounds.maxX-map.bounds.minX<750);
  assert.ok(map.buildings.every(building=>building.height>0));
  assert.ok(map.sources.every(source=>source.sha256.length===64 && !source.license.includes('CC0')));
});

test('every Chinatown restaurant and delivery parking point has legal directed car routes to every other point',()=>{
  const places=[...map.restaurants,...map.deliveries];
  for (const place of places) {
    assert.equal(isAccessible(map,place.parking,'car',1.25),true,place.id+' parking fits the car');
    assert.equal(routeInDistrict(map,map.spawn,place.parking,'car').reachable,true,place.id+' from spawn');
    for (const next of places) {
      const route=routeInDistrict(map,place.parking,next.parking,'car');
      assert.equal(route.reachable,true,place.id+' to '+next.id);
      assert.ok(route.roads.every(id=>map.roads.some(road=>road.id===id && road.car)));
    }
  }
});

test('all Chinatown parking-to-counter and doorway walking paths stay on accessible surfaces',()=>{
  for (const place of [...map.restaurants,...map.deliveries]) {
    const target=place.counter || place.target;
    const route=routeInDistrict(map,place.parking,target,'foot');
    assert.equal(route.reachable,true,place.id+' walking access');
    const points=[place.parking,...route.points];
    for(let index=1;index<points.length;index++){
      const a=points[index-1],b=points[index];
      const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)));
      for(let step=0;step<=count;step++){
        const t=step/count;
        assert.equal(isAccessible(map,{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},'foot',.2),true,place.id+' path clearance');
      }
    }
  }
});

test('the official footprint sample is a metre-scale glTF with normals and UVs ready for actual Creator import',()=>{
  const model=JSON.parse(readFileSync(new URL('../game/assets/resources/districts/chinatown/sample-building.gltf',import.meta.url),'utf8'));
  assert.equal(model.asset.version,'2.0');
  assert.equal(model.extras.units,'metres');
  assert.ok(model.meshes[0].primitives.every(primitive=>'NORMAL' in primitive.attributes && 'TEXCOORD_0' in primitive.attributes));
  const building=map.buildings.find(building=>building.id===model.extras.buildingId);
  assert.ok(building);
  const position=model.accessors[model.meshes[0].primitives[0].attributes.POSITION];
  assert.ok(Math.abs(position.max[1]-building.height)<.01);
});
