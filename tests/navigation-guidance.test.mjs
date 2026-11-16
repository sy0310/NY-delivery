import test from 'node:test';
import assert from 'node:assert/strict';
import * as maps from '../game/assets/scripts/DistrictMap.ts';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';

test('local navigation keeps the vehicle fixed and the road ahead above it at every heading',()=>{
  assert.equal(typeof maps.mapTransform,'function');
  for(const yaw of [0,.7,Math.PI/2,-Math.PI]) {
    const player={x:200,z:30,yaw};
    const transform=maps.mapTransform(400,240,FLUSHING_DISTRICT,{player,navigation:true});
    const ahead={x:player.x-Math.sin(yaw)*20,z:player.z-Math.cos(yaw)*20};
    assert.ok(Math.abs(transform.x(player)-200)<1e-6);
    assert.ok(Math.abs(transform.x(ahead)-200)<1e-6);
    assert.ok(transform.y(ahead)<transform.y(player)-20);
  }
});
test('turn guidance uses route bends and the remaining distance to the actual junction',()=>{
  const player={x:0,z:0,yaw:0};
  assert.deepEqual(maps.navigationStep(player,[{x:0,z:-40},{x:30,z:-40}]),{symbol:'→',instruction:'右转',distance:40});
  assert.deepEqual(maps.navigationStep(player,[{x:0,z:-30},{x:-30,z:-30}]),{symbol:'←',instruction:'左转',distance:30});
});
test('a short road-entry connector cannot produce a false turn and arrival stays explicit',()=>{
  const player={x:1,z:0,yaw:0};
  assert.deepEqual(maps.navigationStep(player,[{x:0,z:0},{x:0,z:-80}]),{symbol:'↑',instruction:'直行',distance:81});
  assert.deepEqual(maps.navigationStep({x:0,z:0,yaw:0},[{x:0,z:-4}]),{symbol:'P',instruction:'靠边停车',distance:4});
});
test('a car facing away from the legal route receives heading recovery before a junction cue',()=>{
  assert.deepEqual(maps.navigationStep({x:0,z:0,yaw:Math.PI},[{x:0,z:-40},{x:30,z:-40}]),
    {symbol:'↶',instruction:'调整车头',distance:0});
});
