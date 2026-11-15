import test from 'node:test';
import assert from 'node:assert/strict';
import { FLUSHING_DISTRICT as map } from '../game/assets/scripts/FlushingDistrict.ts';
import { routeWalking, outsideParkedCar } from '../game/assets/scripts/WalkingRoute.ts';
import { isAccessible } from '../game/assets/scripts/DistrictNavigation.ts';
test('the walking route from the driver door goes around the parked car to the noodle counter',()=>{
 const shop=map.restaurants[0],car={...shop.parking,yaw:24.7*Math.PI/180};
 const from={x:car.x-Math.cos(car.yaw)*1.9,z:car.z+Math.sin(car.yaw)*1.9};
 const route=routeWalking(map,from,shop.counter,car);
 assert.equal(route.reachable,true);
 const points=[from,...route.points];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2);
  for(let j=0;j<=count;j++){
   const p={x:a.x+(b.x-a.x)*j/count,z:a.z+(b.z-a.z)*j/count};
   assert.equal(outsideParkedCar(p,car),true);assert.equal(isAccessible(map,p,'foot',.35),true);
  }
 }
});
test('rerouting at the Union lobby car-detour corner keeps forward progress toward the doorway',()=>{
 const lobby=map.deliveries[1],car={...lobby.parking,yaw:148.9*Math.PI/180};
 const from={x:284.94,z:-130.36};
 const route=routeWalking(map,from,lobby.target,car);
 assert.equal(route.reachable,true);assert.ok(route.distance<13,'avoid returning to the road-centre junction after rounding the car');
});
test('a physically valid position next to the Union parked car remains a valid navigation start',()=>{
 const lobby=map.deliveries[1],car={x:284.83,z:-127.29,yaw:148.9*Math.PI/180};
 const from={x:282.71,z:-126.54};
 assert.equal(routeWalking(map,from,map.restaurants[0].counter,car).reachable,true);
});
