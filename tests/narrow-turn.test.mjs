import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleController } from '../game/assets/scripts/VehicleController.ts';
test('a delivery car can turn across a nine-metre at-grade junction without leaving its road surface',()=>{
 const car=new VehicleController();Object.assign(car,{x:0,z:6,yaw:0,speed:3});
 const allowed=(x,z,r)=>Math.abs(x)<4.5-r || Math.abs(z)<4.5-r;
 for(let i=0;i<900 && car.yaw<Math.PI/2;i++) car.update(1/120,.9,1,false,allowed);
 assert.ok(car.yaw>=Math.PI/2,'complete quarter turn');assert.ok(car.x<-5,'advance along outgoing street');
});
