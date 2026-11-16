import { LEGACY_DISTRICT, LEGACY_RESTAURANT_ORIGIN } from './LegacyDistrict';
import { routeInDistrict, isAccessible, pointDistance } from './DistrictNavigation';
import type { CityPoint, DistrictDefinition, TravelMode } from './DistrictDefinition';
export type { CityPoint } from './DistrictDefinition';

// Compatibility exports for the original procedural scene. Current districts pass their definition explicitly.
const positions=LEGACY_DISTRICT.roads.flatMap(road=>road.points);
export const EAST_AVENUE=Math.max(...positions.map(point=>point.x));
export const NORTH_STREET=Math.min(...positions.map(point=>point.z));
export const SOUTH_STREET=Math.max(...positions.map(point=>point.z));
export const AVENUES=[0,EAST_AVENUE];
export const CROSS_STREETS=Array.from(new Set(positions.map(point=>point.z))).sort((a,b)=>a-b);
export const RESTAURANT_ORIGIN=LEGACY_RESTAURANT_ORIGIN;
export const COUNTER=LEGACY_DISTRICT.restaurants[0].counter;
export const PICKUP_PARKING=LEGACY_DISTRICT.restaurants[0].parking;
export const SPAWN=LEGACY_DISTRICT.spawn;

export function orderLocation(sequence: number) {
  const destination=LEGACY_DISTRICT.deliveries[sequence%LEGACY_DISTRICT.deliveries.length];
  return {pickup:COUNTER,pickupParking:PICKUP_PARKING,
    dropoff:destination.target,dropoffParking:destination.parking,address:destination.name};
}

export function roadAt(x: number,z: number): boolean {
  return isAccessible(LEGACY_DISTRICT,{x,z},'car');
}

export function planRoute(from: CityPoint,to: CityPoint,district: DistrictDefinition=LEGACY_DISTRICT,mode: TravelMode='car') {
  const route=routeInDistrict(district,from,to,mode);
  if (district.id==='legacy' && mode==='car') {
    if (route.points.length>1 && pointDistance(from,route.points[0])<12) route.points.shift();
    const last=route.points.length-1;
    if (last>0 && pointDistance(route.points[last],route.points[last-1])<12) route.points.splice(last-1,1);
    if (route.reachable) route.distance=route.points.reduce((sum,point,index)=>sum+pointDistance(index?route.points[index-1]:from,point),0);
  }
  return route;
}
