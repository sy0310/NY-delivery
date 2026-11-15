import type { DistrictDefinition } from './DistrictDefinition';
import { createOrder } from './OrderState';
import type { OrderStage, OrderData } from './OrderState';

export function createDistrictOrder(district: DistrictDefinition, sequence: number, scenario=sequence): Readonly<OrderData> {
  const base = createOrder(sequence);
  const restaurant = district.restaurants[scenario % district.restaurants.length];
  const delivery = district.deliveries[scenario % district.deliveries.length];
  return Object.freeze({...base,id:district.orderPrefix+'-'+(1042+sequence),
    districtId:district.id,restaurantId:restaurant.id,deliveryPointId:delivery.id,
    restaurant:restaurant.name,items:district.id==='legacy' ? base.items : restaurant.menu+(base.bagCount>1?' · 2 × Iced tea':''),address:delivery.name,
    pickup:restaurant.counter,pickupParking:restaurant.parking,dropoff:delivery.target,dropoffParking:delivery.parking});
}

export function canSwitchDistrict(stage: OrderStage, working: boolean): boolean {
  return stage === 'idle' || stage === 'delivered' && !working;
}
