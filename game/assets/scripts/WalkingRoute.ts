import type { CityPoint, DistrictDefinition } from './DistrictDefinition';
import { routeInDistrict, isAccessible, roomPoint, localPoint, pointDistance } from './DistrictNavigation';
import type { DistrictRoute } from './DistrictNavigation';
interface ParkedCar extends CityPoint {yaw:number}

export function outsideParkedCar(point:CityPoint,car:ParkedCar):boolean {
  const p=roomPoint(car,car.yaw*180/Math.PI,point);
  return Math.abs(p.x)>=1.45 || Math.abs(p.z)>=2.55;
}

/** Retain the district route, adding a local pedestrian detour around the physical parked car. */
export function routeWalking(district:DistrictDefinition,from:CityPoint,to:CityPoint,car:ParkedCar):DistrictRoute {
  const base=routeInDistrict(district,from,to,'foot');
  if(!base.reachable)return base;
  const clear=(a:CityPoint,b:CityPoint)=>{
    const count=Math.max(1,Math.ceil(pointDistance(a,b)/.2));
    for(let i=0;i<=count;i++) {
      const p={x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count};
      if(!outsideParkedCar(p,car) || !isAccessible(district,p,'foot',.35))return false;
    }
    return true;
  };
  const corners=[[-1.55,-2.65],[1.55,-2.65],[1.55,2.65],[-1.55,2.65]]
    .map(([x,z])=>localPoint(car,car.yaw*180/Math.PI,x,z));
  const points:CityPoint[]=[];
  let start=from;
  for(const end of base.points.filter(point=>outsideParkedCar(point,car))) {
    if(clear(start,end)){points.push(end);start=end;continue;}
    const nodes=[start,...corners,end],costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1);
    const pending=new Set(nodes.map((_,index)=>index));costs[0]=0;
    while(pending.size) {
      const current=Array.from(pending).sort((a,b)=>costs[a]-costs[b])[0];pending.delete(current);
      if(!Number.isFinite(costs[current]))break;
      for(const next of Array.from(pending)) {
        const cost=costs[current]+pointDistance(nodes[current],nodes[next]);
        if(cost<costs[next] && clear(nodes[current],nodes[next])){costs[next]=cost;previous[next]=current;}
      }
    }
    if(!Number.isFinite(costs[5]))return {reachable:false,points:[],distance:Infinity,roads:base.roads,reason:'unreachable'};
    const detour:CityPoint[]=[];
    for(let index=5;index>0;index=previous[index])detour.unshift(nodes[index]);
    points.push(...detour);start=end;
  }
  const simplified:CityPoint[]=[];
  let anchor=from,index=0;
  while(index<points.length) {
    let next=points.length-1;
    while(next>index && !clear(anchor,points[next]))next--;
    simplified.push(points[next]);anchor=points[next];index=next+1;
  }
  const distance=simplified.reduce((sum,point,index)=>sum+pointDistance(index?simplified[index-1]:from,point),0);
  return {...base,points:simplified,distance};
}
