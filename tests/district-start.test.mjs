import test from 'node:test';
import assert from 'node:assert/strict';
import {FLUSHING_DISTRICT} from '../game/assets/scripts/FlushingDistrict.ts';
import {CHINATOWN_DISTRICT} from '../game/assets/scripts/ChinatownDistrict.ts';
import {routeInDistrict} from '../game/assets/scripts/DistrictNavigation.ts';
test('each work-area start faces the first legal pickup route',()=>{
 for(const district of [FLUSHING_DISTRICT,CHINATOWN_DISTRICT]){
  const point=routeInDistrict(district,district.spawn,district.restaurants[0].parking,'car').points.find(p=>Math.hypot(p.x-district.spawn.x,p.z-district.spawn.z)>5);
  const direction=Math.atan2(district.spawn.x-point.x,district.spawn.z-point.z);
  const difference=direction-district.spawn.yaw*Math.PI/180;
  assert.ok(Math.abs(Math.atan2(Math.sin(difference),Math.cos(difference)))<Math.PI/4,district.id);
 }
});
