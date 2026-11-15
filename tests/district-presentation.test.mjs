import test from 'node:test';
import assert from 'node:assert/strict';
import { roadSegments, placePose, distanceToBounds } from '../game/assets/scripts/DistrictPresentation.ts';
test('slanted real street segments retain metre lengths and renderer headings',()=>{
 const [segment]=roadSegments([{x:4,z:2},{x:7,z:6}]);
 assert.equal(segment.length,5);assert.deepEqual(segment.center,{x:5.5,z:4});
 assert.ok(Math.abs(Math.sin(segment.yaw*Math.PI/180)*5-3)<1e-9);
});
test('shop-local detail follows the source frontage and block distance includes its entire bounds',()=>{
 const pose=placePose({entry:{x:10,z:20},yaw:90},2,4);
 assert.ok(Math.abs(pose.x-14)<1e-9);assert.ok(Math.abs(pose.z-18)<1e-9);
 assert.equal(distanceToBounds({x:4,z:4},{minX:0,maxX:10,minZ:0,maxZ:10}),0);
 assert.equal(distanceToBounds({x:13,z:14},{minX:0,maxX:10,minZ:0,maxZ:10}),5);
});
