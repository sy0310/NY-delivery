import type { CityPoint, DistrictPlace, DistrictDefinition } from './DistrictDefinition';
import { localPoint } from './DistrictNavigation';
import { QUALITY_PRESETS } from './QualityPreset';

export interface SceneView {
  position: CityPoint;
  inCar: boolean;
  paused: boolean;
}

export function updateDistrictVisibility(
  chunks: {node:{active:boolean};bounds:{minX:number;maxX:number;minZ:number;maxZ:number}}[],
  details: {node:{active:boolean};position:CityPoint}[],
  observer: CityPoint,
  quality: 'low'|'standard',
): void {
  const preset = QUALITY_PRESETS[quality];
  for (const chunk of chunks) chunk.node.active = distanceToBounds(observer,chunk.bounds) < preset.blockDistance;
  for (const detail of details) detail.node.active = Math.hypot(observer.x-detail.position.x,observer.z-detail.position.z) < preset.detailDistance;
}
export function roadSegments(points: CityPoint[]): {center:CityPoint;length:number;yaw:number}[] {
  return points.slice(1).map((end,index)=>{
    const start=points[index], dx=end.x-start.x, dz=end.z-start.z;
    return {center:{x:(start.x+end.x)/2,z:(start.z+end.z)/2},length:Math.hypot(dx,dz),yaw:Math.atan2(dx,dz)*180/Math.PI};
  });
}
export function placePose(place: Pick<DistrictPlace,'entry'|'yaw'>,x:number,z:number):CityPoint {
  return localPoint(place.entry,place.yaw,x,z);
}
export function distanceToBounds(point:CityPoint,bounds:{minX:number;maxX:number;minZ:number;maxZ:number}):number {
  return Math.hypot(Math.max(bounds.minX-point.x,0,point.x-bounds.maxX),Math.max(bounds.minZ-point.z,0,point.z-bounds.maxZ));
}

export const STREET_BRANDS=[
  {name:'WILLOW NOODLES',caption:'槐香面馆',icon:'bowl',color:'#365b48',accent:'#e8c782'},
  {name:'LANTERN DUMPLINGS',caption:'灯笼饺子',icon:'steam',color:'#8d493e',accent:'#f1ce89'},
  {name:'BORO LEAF',caption:'茶饮 · TEA',icon:'leaf',color:'#486856',accent:'#ced8a2'},
  {name:'HEARTH CRUMB',caption:'街坊烘焙',icon:'bread',color:'#a06a42',accent:'#f1d6a4'},
  {name:'UNION BASKET',caption:'鲜果 · GROCER',icon:'basket',color:'#496b69',accent:'#dfc983'},
  {name:'LOTUS PASTRY',caption:'莲香点心',icon:'flower',color:'#886463',accent:'#f2d9b8'},
  {name:'PEARL ALLEY',caption:'珍巷面馆',icon:'bowl',color:'#85513e',accent:'#eace95'},
  {name:'MOTT STEAM',caption:'莫街蒸馆',icon:'steam',color:'#476c60',accent:'#ecd291'},
  {name:'SIX FOLD',caption:'WASH & FOLD',icon:'wash',color:'#517489',accent:'#deebdb'},
  {name:'CORNER KETTLE',caption:'街角茶食',icon:'cup',color:'#775b43',accent:'#f0d3a1'},
  {name:'CEDAR PROVISIONS',caption:'杂货 · DELI',icon:'basket',color:'#46564b',accent:'#e5d6af'},
  {name:'CANAL CUP',caption:'COFFEE & BREAD',icon:'cup',color:'#8a5549',accent:'#efe0bd'},
];

export function frontageVariant(id:string) {
  let seed=0;
  for(const letter of id)seed=(seed*31+letter.charCodeAt(0))>>>0;
  return {brand:seed%4,awning:seed%3,curtain:seed%2,poster:seed%3===0,crate:seed%4===0,aircon:seed%3===1};
}

/** Decorative city context has no navigation edges or collision surfaces. */
export function backdropBuildings(district:DistrictDefinition) {
  const result:{x:number;z:number;width:number;depth:number;height:number;band:number;shade:number}[]=[];
  const b=district.bounds;
  let seed=district.id==='flushing'?4127:1043;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const [band,distance]of[70,165,280].entries()) {
    for(const side of [-1,1]) {
      for(let x=b.minX-40;x<b.maxX+65;x+=40) result.push({x:x+random()*8,z:(side<0?b.minZ:b.maxZ)+side*distance,
        width:28+random()*14,depth:24+random()*12,height:16+band*10+random()*(district.id==='chinatown'?35:22),band,shade:band});
      for(let z=b.minZ-30;z<b.maxZ+55;z+=40) result.push({x:(side<0?b.minX:b.maxX)+side*distance,z:z+random()*8,
        width:24+random()*12,depth:28+random()*14,height:16+band*10+random()*(district.id==='chinatown'?35:22),band,shade:band});
    }
  }
  return result;
}
