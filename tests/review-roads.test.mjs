import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleController } from '../game/assets/scripts/VehicleController.ts';
import { FLUSHING_DISTRICT } from '../game/assets/scripts/FlushingDistrict.ts';
import { CHINATOWN_DISTRICT } from '../game/assets/scripts/ChinatownDistrict.ts';
import * as navigation from '../game/assets/scripts/DistrictNavigation.ts';

test('medium-speed steering responds within a city junction and braking recentres promptly',()=>{
  const car=new VehicleController();
  for(let i=0;i<42;i++){car.speed=6.7;car.update(1/120,0,1,false,()=>true);}
  assert.ok(car.yaw>.2,'15mph steering reaches a useful angle within 350ms');
  car.update(.15,0,0,true,()=>true);
  assert.ok(Math.abs(car.steering)<.02,'braking releases wheel input promptly');
});

test('vehicle movement supplies its proposed heading to the normal collision callback',()=>{
  const headings=[];const car=new VehicleController();
  car.update(.1,1,1,false,(x,z,radius,yaw)=>{headings.push(yaw);return true;});
  assert.ok(headings.length>0 && headings.every(Number.isFinite));
});
test('the first HUD render can query road diagnostics before district loading finishes',()=>{
  assert.equal(navigation.probeRoad(undefined,{x:0,z:0}).reason,'loading');
});

for(const district of [FLUSHING_DISTRICT,CHINATOWN_DISTRICT]) {
  test(district.id+' road meshes and collision share clipped non-overlapping surface polygons',()=>{
    assert.ok(district.surfaces?.length>=3);
    const lane=district.surfaces.find(surface=>surface.kind==='car');
    assert.ok(lane.polygons.length && lane.triangles.length);
    for(let i=0;i<lane.triangles.length;i+=6) {
      const p={x:(lane.triangles[i]+lane.triangles[i+2]+lane.triangles[i+4])/3,
        z:(lane.triangles[i+1]+lane.triangles[i+3]+lane.triangles[i+5])/3};
      assert.ok(navigation.isAccessible(district,p,'car'));
      assert.ok(!district.buildings.some(building=>navigation.insidePolygon(p,building.footprint)));
    }
    const changes=district.roads.filter(road=>road.sourceWidth!==undefined);
    assert.ok(changes.length>0 && changes.length<district.roads.length/2);
    assert.ok(changes.every(road=>road.car && road.width-road.sourceWidth<=2.001));
  });
  test(district.id+' spawn fits the full sedan and diagnostics explain the nearest road',()=>{
    assert.equal(typeof navigation.vehicleAccessible,'function');
    assert.ok(navigation.vehicleAccessible(district,district.spawn,district.spawn.yaw*Math.PI/180));
    const probe=navigation.probeRoad(district,district.spawn,1.02);
    assert.ok(probe.roadId && probe.access==='car' && Number.isFinite(probe.clearance));
  });
}

test('the sedan nose is rejected before it enters a blocked surface and pedestrian streets stay restricted',()=>{
  assert.equal(typeof navigation.vehicleAccessible,'function');
  const district={id:'barrier',bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},roads:[
    {id:'lane',name:'lane',from:'a',to:'b',points:[{x:0,z:0},{x:0,z:40}],width:8,car:true,foot:true,direction:'TW'},
  ],buildings:[],restaurants:[],deliveries:[]};
  assert.ok(navigation.isAccessible(district,{x:0,z:-2},'car',1.25));
  assert.equal(navigation.vehicleAccessible(district,{x:0,z:-2},0),false);
  for(const map of [FLUSHING_DISTRICT,CHINATOWN_DISTRICT]) {
    const point=map.id==='flushing'?{x:186.169,z:-100.031}:{x:12.746,z:57.731};
    assert.ok(navigation.isAccessible(map,point,'foot',.35));
    assert.equal(navigation.isAccessible(map,point,'car',1.02),false);
  }
});
