import type { CityPoint, DistrictPlace } from './DistrictDefinition';
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
