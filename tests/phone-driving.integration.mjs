import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAccessible } from '../game/assets/scripts/DistrictNavigation.ts';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';
import { CHINATOWN_DISTRICT } from '../game/assets/scripts/ChinatownDistrict.ts';

const report=JSON.parse(await readFile(process.argv[2],'utf8'));
const observation=name=>{
  const item=report.observations.find(item=>item.name===name);
  assert.ok(item,name);
  const pose=item.hud.match(/x ([\d.-]+)  z ([\d.-]+)/);
  return {...item,x:Number(pose[1]),z:Number(pose[2])};
};
for(const district of [FLUSHING_DISTRICT,CHINATOWN_DISTRICT]) {
  const edge=observation(`final-${district.id}-edge`),reverse=observation(`final-${district.id}-reverse`);
  assert.equal(Number(edge.mph),0);
  assert.ok(edge.navigation.includes('路缘接触'));
  assert.ok(Number(reverse.mph)>0);
  assert.ok(Math.hypot(reverse.x-edge.x,reverse.z-edge.z)>3);
  assert.ok(isAccessible(district,reverse,'car',1.25));
  assert.ok(!reverse.navigation.includes('路缘接触'));
  for(const item of [edge,reverse]) {
    assert.ok(item.hud.includes('Seat drift 0.0000 m'));
    assert.ok(item.hud.includes('Touch throttle 0 brake 0 horizontal 0.00'));
  }
}
const acceleration=observation('final-acceleration-3s');
assert.ok(Number(acceleration.mph)>=8 && Number(acceleration.mph)<=14);
console.log('Actual final driving passed — progressive acceleration and legal reverse escape in both districts');
