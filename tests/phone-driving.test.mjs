import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleController } from '../game/assets/scripts/VehicleController.ts';

test('city acceleration builds progressively and stays within the delivery speed budget',()=>{
  const car=new VehicleController();
  for(let i=0;i<60;i++) car.update(1/60,1,0,false,()=>true);
  assert.ok(car.speed>1 && car.speed<2.5);
  for(let i=0;i<1800;i++) car.update(1/60,1,0,false,()=>true);
  assert.ok(car.speed<=9.5);
  car.update(.1,-1,0,false,()=>true);
  assert.ok(car.speed>0,'opposite gear first brakes forward momentum');
});
test('high-speed full steering is limited while low-speed manoeuvres remain available',()=>{
  const car=new VehicleController();car.speed=9;
  car.update(.1,0,1,false,()=>true);
  assert.ok(car.yaw>0 && car.yaw<.08);
  for(let i=0;i<60;i++) car.update(1/60,0,0,false,()=>true);
  assert.ok(Math.abs(car.steering)<.01);
});
test('a grazing road edge keeps tangential progress and reverse can leave the contact',()=>{
  const car=new VehicleController();Object.assign(car,{x:1.99,z:10,yaw:-.5,speed:4});
  const road=x=>x<=2;
  car.update(.05,0,0,false,road);
  assert.ok(car.z<9.9,'glancing contact continues along the edge');
  assert.ok(car.x<=2);
  for(let i=0;i<240;i++)car.update(1/60,-1,0,false,road);
  assert.ok(car.x<1.7,'reverse backs away from the edge without resetting');
});
test('swept motion stops before a thin barrier and cannot rotate a pinned car in place',()=>{
  const car=new VehicleController();Object.assign(car,{x:0,z:0,yaw:-Math.PI/2,speed:9});
  car.update(.5,1,0,false,x=>x<.1 || x>.3);
  assert.ok(car.x<.1);
  const yaw=car.yaw;
  for(let i=0;i<60;i++)car.update(1/60,1,1,false,()=>false);
  assert.equal(car.yaw,yaw);
});
test('driving results remain close across supported frame steps and reset clears steering',()=>{
  const cars=[new VehicleController(),new VehicleController()];
  for(const [index,dt]of[1/30,1/120].entries())for(let i=0;i<4/dt;i++)cars[index].update(dt,.7,.2,false,()=>true);
  assert.ok(Math.hypot(cars[0].x-cars[1].x,cars[0].z-cars[1].z)<.2);
  cars[0].reset();assert.equal(cars[0].steering,0);
});
