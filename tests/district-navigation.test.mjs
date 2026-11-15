import test from 'node:test';
import assert from 'node:assert/strict';
import { routeInDistrict, isAccessible } from '../game/assets/scripts/DistrictNavigation.ts';
import { LEGACY_DISTRICT } from '../game/assets/scripts/LegacyDistrict.ts';

const point=(x,z)=>({x,z});
const road=(id,from,to,a,b,direction='FT',car=true)=>({id,name:id,from,to,points:[a,b],width:8,direction,car,foot:true});
const district=roads=>({id:'test',roads,buildings:[],restaurants:[],deliveries:[],parkingAreas:[],
  bounds:{minX:-20,minZ:-20,maxX:120,maxZ:120}});
const loop=()=>district([
  road('east','a','b',point(0,0),point(100,0)),road('south','b','c',point(100,0),point(100,100)),
  road('west','c','d',point(100,100),point(0,100)),road('north','d','a',point(0,100),point(0,0)),
]);

test('legacy map first runs through the shared directed district graph',()=>{
  const result=routeInDistrict(LEGACY_DISTRICT,{x:344.5,z:-71},{x:5.5,z:-350},'car');
  assert.equal(result.reachable,true);
  assert.ok(result.distance>1150 && result.distance<1300);
  assert.ok(result.points.some(p=>p.x===350 && p.z===200));
});
test('one-way progress follows a legal loop and a marked parking bay permits a small reverse maneuver',()=>{
  const map=loop();
  assert.ok(routeInDistrict(map,point(50,0),point(40,0),'car').distance>380);
  map.parkingAreas.push([point(68,-4),point(92,-4),point(92,4),point(68,4)]);
  const parking=routeInDistrict(map,point(85,0),point(80,0),'car');
  assert.equal(parking.maneuver,true);
  assert.equal(parking.distance,5);
});
test('close targets cannot jump a wall, disconnected street or pedestrian plaza',()=>{
  const map=district([road('one','a','b',point(0,0),point(100,0),'TW'),
    road('two','c','d',point(0,12),point(100,12),'TW')]);
  map.buildings.push({id:'wall',footprint:[point(44,3),point(56,3),point(56,9),point(44,9)],height:12});
  const result=routeInDistrict(map,point(50,0),point(50,12),'car');
  assert.equal(result.reachable,false);
  assert.deepEqual(result.points,[]);
  assert.equal(result.reason,'unreachable');
  map.roads[1].car=false;
  assert.equal(routeInDistrict(map,point(50,12),point(80,12),'foot').reachable,true);
  assert.equal(isAccessible(map,point(50,12),'car'),false);
});
test('diagonal driving surfaces match their polylines without joining geometric crossings',()=>{
  const map=district([road('diagonal','a','b',point(0,0),point(100,100),'TW'),
    road('overpass','upper-a','upper-b',point(0,100),point(100,0),'TW')]);
  assert.equal(isAccessible(map,point(25,25),'car',1),true);
  assert.equal(isAccessible(map,point(25,35),'car',1),false);
  assert.equal(routeInDistrict(map,point(10,10),point(90,10),'car').reachable,false);
});
test('collision broad phase skips distant polygon work within the same spatial cell',()=>{
 const surface=road('wide','a','b',point(0,0),point(100,0));surface.width=64;
 const map=district([surface]);let reads=0;
 const footprint=[point(20,20),point(30,20),point(30,30),point(20,30)];
 map.buildings=[{id:'far',height:10,block:'test',style:0,get footprint(){reads++;return footprint;}}];
 assert.equal(isAccessible(map,point(50,0),'car',.35),true);reads=0;
 for(let i=0;i<100;i++)assert.equal(isAccessible(map,point(50,0),'car',.35),true);
 assert.equal(reads,0,'bounding boxes avoid repeated polygon scans');
 assert.equal(isAccessible(map,point(25,25),'car',.35),false);
 assert.equal(isAccessible(map,point(25,19.8),'car',.35),false);
 assert.equal(isAccessible(map,point(25,19.5),'car',.35),true);
});
