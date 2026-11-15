export interface CityPoint { x: number; z: number }
export type TravelMode = 'car' | 'foot';
export interface DistrictRoad {
  id: string; name: string; from: string; to: string; points: CityPoint[];
  width: number; direction: 'FT' | 'TF' | 'TW' | 'NV'; car: boolean; foot: boolean;
  levelFrom?: number; levelTo?: number; restriction?: string;
}
export interface DistrictBuilding {
  id: string; footprint: CityPoint[]; height: number; fallback?: boolean; sourceHeight?: number;
  block: string; style: number;
}
export interface DistrictPlace {
  id: string; name: string; entry: CityPoint; parking: CityPoint; walkway: CityPoint[];
  yaw: number; buildingId?: string;
  width?: number; depth?: number; frontageEdge?: number;
}
export interface DistrictRestaurant extends DistrictPlace {
  counter: CityPoint; queue: CityPoint; menu: string; chineseName: string; width: number; depth: number;
}
export interface DistrictDelivery extends DistrictPlace { target: CityPoint; kind: string }
export interface DistrictDefinition {
  id: string; name: string; borough: string; orderPrefix: string; units: 'm';
  origin: {crs: string; coordinates: number[]};
  bounds: {minX: number; minZ: number; maxX: number; maxZ: number};
  boundary: CityPoint[];
  roads: DistrictRoad[]; buildings: DistrictBuilding[];
  restaurants: DistrictRestaurant[]; deliveries: DistrictDelivery[];
  parkingAreas: CityPoint[][]; spawn: CityPoint & {yaw: number};
  landmarks: {id: string; name: string; kind: string; position: CityPoint; yaw: number}[];
  sources: {url: string; retrieved: string; sha256: string; license: string}[];
  blocks?: {id: string; kind: string; asset: string; bounds: {minX: number;minZ: number;maxX: number;maxZ: number}; buildings: string[]}[];
}
