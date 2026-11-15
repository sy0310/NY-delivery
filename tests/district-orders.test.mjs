import test from 'node:test';
import assert from 'node:assert/strict';
import { createDistrictOrder, canSwitchDistrict } from '../game/assets/scripts/DistrictOrders.ts';
import { OrderState } from '../game/assets/scripts/OrderState.ts';

const district={id:'flushing',orderPrefix:'FL',restaurants:[
  {id:'noodles',name:'Willow Noodles',menu:'Noodles',counter:{x:1,z:2},parking:{x:3,z:4}},
  {id:'dumplings',name:'Lantern Dumplings',menu:'Dumplings',counter:{x:11,z:12},parking:{x:13,z:14}},
],deliveries:[0,1,2].map(i=>({id:'door-'+i,name:'Door '+i,target:{x:20+i,z:30},parking:{x:25+i,z:30}}))};

test('orders reference district and place IDs while reusing the existing code and bag lifecycle',()=>{
  const first=createDistrictOrder(district,0), second=createDistrictOrder(district,1);
  assert.equal(first.restaurantId,'noodles');
  assert.equal(second.restaurantId,'dumplings');
  assert.equal(first.districtId,'flushing');
  assert.equal(first.code,'4826');
  assert.equal(second.code,'1937');
  assert.deepEqual(second.pickup,district.restaurants[1].counter);
  assert.equal(second.items,'Dumplings');
  assert.equal(new Set([0,1,2].map(i=>createDistrictOrder(district,i).deliveryPointId)).size,3);
  assert.equal(createDistrictOrder(district,2).bagCount,2);
});
test('unfinished orders prevent area replacement and completed earnings survive an explicit area selection',()=>{
  const state=new OrderState(createDistrictOrder(district,0));
  state.accept();
  assert.equal(canSwitchDistrict(state.stage,true),false);
  assert.equal(state.selectArea(createDistrictOrder(district,1)),false);
  state.joinQueue();state.tick(40,true);state.take(state.data.code);state.stow();state.retrieve();state.deliver();
  assert.equal(canSwitchDistrict(state.stage,true),false);
  assert.equal(canSwitchDistrict(state.stage,false),true);
  assert.equal(state.selectArea(createDistrictOrder(district,1)),true);
  assert.equal(state.stage,'idle');
  assert.equal(state.totalEarnings,9.75);
  assert.equal(state.completedOrders,1);
  assert.equal(state.selectArea(createDistrictOrder(district,0)),false);
});
