import type { CityPoint, DistrictBuilding, DistrictDefinition, DistrictRoad, TravelMode } from './DistrictDefinition';

export interface DistrictRoute {
  reachable: boolean; points: CityPoint[]; distance: number; roads: string[];
  reason?: 'unreachable'; maneuver?: boolean;
}
interface Segment {
  a: string; b: string; start: CityPoint; end: CityPoint; width: number; road: DistrictRoad;
  splits: {t: number; key: string; point: CityPoint}[];
}
interface Edge { a: string; b: string; start: CityPoint; end: CityPoint; width: number; roadId: string; length: number }
interface Graph { positions: Map<string,CityPoint>; edges: Edge[]; adjacent: Map<string,Edge[]> }
const graphs = new WeakMap<DistrictDefinition,Map<TravelMode,{signature: string; graph: Graph}>>();
const collisionGrids = new WeakMap<DistrictDefinition,Map<string,DistrictBuilding[]>>();
export const pointDistance = (a: CityPoint,b: CityPoint) => Math.hypot(a.x-b.x,a.z-b.z);

export function projectPoint(point: CityPoint,a: CityPoint,b: CityPoint) {
  const dx=b.x-a.x, dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz || 1)));
  const position={x:a.x+dx*t,z:a.z+dz*t};
  return {position,t,distance:pointDistance(point,position)};
}

export function insidePolygon(point: CityPoint,polygon: CityPoint[]): boolean {
  let inside=false;
  for (let index=0,previous=polygon.length-1;index<polygon.length;previous=index++) {
    const a=polygon[index], b=polygon[previous];
    if ((a.z>point.z)!==(b.z>point.z) && point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x) inside=!inside;
  }
  return inside;
}

export function localPoint(origin: CityPoint,yaw: number,x: number,z: number): CityPoint {
  const angle=yaw*Math.PI/180;
  return {x:origin.x+x*Math.cos(angle)+z*Math.sin(angle),z:origin.z-x*Math.sin(angle)+z*Math.cos(angle)};
}

export function roomPoint(origin: CityPoint,yaw: number,point: CityPoint): CityPoint {
  const angle=yaw*Math.PI/180, x=point.x-origin.x, z=point.z-origin.z;
  return {x:x*Math.cos(angle)-z*Math.sin(angle),z:x*Math.sin(angle)+z*Math.cos(angle)};
}

function segments(district: DistrictDefinition,mode: TravelMode): Segment[] {
  const result: Segment[]=[];
  for (const road of district.roads) {
    if (!road[mode]) continue;
    for (let index=1;index<road.points.length;index++) {
      const start=road.points[index-1], end=road.points[index];
      if (pointDistance(start,end)<.01) continue;
      const a=index===1 ? road.from : road.id+':'+(index-1);
      const b=index===road.points.length-1 ? road.to : road.id+':'+index;
      result.push({a,b,start,end,width:road.width+(mode==='foot'?8:0),road,
        splits:[{t:0,key:a,point:start},{t:1,key:b,point:end}]});
    }
  }
  return result;
}

function graphFor(district: DistrictDefinition,mode: TravelMode): Graph {
  let cached=graphs.get(district);
  if (!cached) { cached=new Map(); graphs.set(district,cached); }
  const signature=district.roads.filter(road=>road[mode]).map(road=>road.id).join('|');
  const existing=cached.get(mode);
  if (existing?.signature===signature) return existing.graph;
  const graph: Graph={positions:new Map(),edges:[],adjacent:new Map()};
  const list=segments(district,mode);
  const accesses: {key: string; points: CityPoint[]; id: string; width: number}[]=[];
  if (mode==='foot') {
    for (const place of [...district.restaurants,...district.deliveries]) {
      if (place.walkway.length<2) continue;
      const nearest=list.map(segment=>({segment,...projectPoint(place.walkway[0],segment.start,segment.end)}))
        .sort((a,b)=>a.distance-b.distance)[0];
      if (!nearest || nearest.distance>.2) continue;
      const key=nearest.t<.00001 ? nearest.segment.a : nearest.t>.99999 ? nearest.segment.b : 'access:'+place.id;
      nearest.segment.splits.push({t:nearest.t,key,point:nearest.position});
      accesses.push({key,points:[nearest.position,...place.walkway.slice(1)],id:place.id,
        width:'width' in place ? Number(place.width)-.5 : 3});
    }
  }
  const add=(a: string,b: string,start: CityPoint,end: CityPoint,width: number,roadId: string) => {
    graph.positions.set(a,start); graph.positions.set(b,end);
    const edge={a,b,start,end,width,roadId,length:pointDistance(start,end)};
    graph.edges.push(edge);
    if (!graph.adjacent.has(a)) graph.adjacent.set(a,[]);
    graph.adjacent.get(a)!.push(edge);
  };
  for (const segment of list) {
    const parts=segment.splits.sort((a,b)=>a.t-b.t);
    for (let index=1;index<parts.length;index++) {
      const a=parts[index-1], b=parts[index];
      if (a.key===b.key) continue;
      if (mode==='foot' || segment.road.direction==='FT' || segment.road.direction==='TW') {
        add(a.key,b.key,a.point,b.point,segment.width,segment.road.id);
      }
      if (mode==='foot' || segment.road.direction==='TF' || segment.road.direction==='TW') {
        add(b.key,a.key,b.point,a.point,segment.width,segment.road.id);
      }
    }
  }
  for (const access of accesses) {
    let a=access.key;
    for (let index=1;index<access.points.length;index++) {
      const b='place:'+access.id+':'+index;
      add(a,b,access.points[index-1],access.points[index],access.width,'walk:'+access.id);
      add(b,a,access.points[index],access.points[index-1],access.width,'walk:'+access.id);
      a=b;
    }
  }
  cached.set(mode,{signature,graph});
  return graph;
}

function nearbyBuildings(district: DistrictDefinition,point: CityPoint,radius: number): DistrictBuilding[] {
  let grid=collisionGrids.get(district);
  if (!grid) {
    grid=new Map();
    for (const building of district.buildings) {
      const xs=building.footprint.map(p=>p.x), zs=building.footprint.map(p=>p.z);
      for (let x=Math.floor(Math.min(...xs)/64);x<=Math.floor(Math.max(...xs)/64);x++) {
        for (let z=Math.floor(Math.min(...zs)/64);z<=Math.floor(Math.max(...zs)/64);z++) {
          const key=x+','+z;
          if (!grid.has(key)) grid.set(key,[]);
          grid.get(key)!.push(building);
        }
      }
    }
    collisionGrids.set(district,grid);
  }
  const found=new Set<DistrictBuilding>();
  for (let x=Math.floor((point.x-radius)/64);x<=Math.floor((point.x+radius)/64);x++) {
    for (let z=Math.floor((point.z-radius)/64);z<=Math.floor((point.z+radius)/64);z++) {
      for (const building of grid.get(x+','+z) || []) found.add(building);
    }
  }
  return Array.from(found);
}

export function isAccessible(district: DistrictDefinition,point: CityPoint,mode: TravelMode,radius=0): boolean {
  const bounds=district.bounds;
  if (point.x<bounds.minX || point.x>bounds.maxX || point.z<bounds.minZ || point.z>bounds.maxZ) return false;
  const room=(mode==='foot' ? [...district.restaurants,...district.deliveries] : []).find(shop=>{
    if (!shop.width || !shop.depth) return false;
    const p=roomPoint(shop.entry,shop.yaw,point);
    return Math.abs(p.x)<shop.width/2-radius && p.z>=-3 && p.z<shop.depth-radius
      && (Math.abs(p.z)>radius+.05 || Math.abs(p.x)<1.1-radius);
  });
  const onSurface=graphFor(district,mode).edges.some(edge=>
    projectPoint(point,edge.start,edge.end).distance<=edge.width/2-radius+.01);
  if (!onSurface && !(mode==='foot' && room)) return false;
  for (const building of nearbyBuildings(district,point,radius)) {
    const blocked=insidePolygon(point,building.footprint) || radius>0 && building.footprint.some((a,index)=>
      projectPoint(point,a,building.footprint[(index+1)%building.footprint.length]).distance<radius);
    if (blocked && !(mode==='foot' && room?.buildingId===building.id)) return false;
  }
  return true;
}

function clearSegment(district: DistrictDefinition,a: CityPoint,b: CityPoint,mode: TravelMode): boolean {
  const steps=Math.max(1,Math.ceil(pointDistance(a,b)/.75));
  for (let index=0;index<=steps;index++) {
    const t=index/steps;
    if (!isAccessible(district,{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},mode,mode==='car'?.8:.2)) return false;
  }
  return true;
}

function projections(district: DistrictDefinition,graph: Graph,point: CityPoint,mode: TravelMode) {
  return graph.edges.map(edge=>({edge,...projectPoint(point,edge.start,edge.end)}))
    .filter(item=>item.distance<=item.edge.width/2-(mode==='car'?.8:.2)+.01
      && clearSegment(district,point,item.position,mode))
    .sort((a,b)=>a.distance-b.distance).slice(0,8);
}

/** Directed topology comes from source endpoints. Crossing polylines never create junctions. */
export function routeInDistrict(district: DistrictDefinition,from: CityPoint,to: CityPoint,mode: TravelMode='car'): DistrictRoute {
  const unavailable: DistrictRoute={reachable:false,points:[],distance:Infinity,roads:[],reason:'unreachable'};
  if (!isAccessible(district,from,mode) || !isAccessible(district,to,mode)) return unavailable;
  const graph=graphFor(district,mode);
  const starts=projections(district,graph,from,mode), ends=projections(district,graph,to,mode);
  if (!starts.length || !ends.length) return unavailable;
  if (mode==='car' && starts[0].edge.roadId===ends[0].edge.roadId
    && district.parkingAreas.some(area=>insidePolygon(from,area) && insidePolygon(to,area))
    && clearSegment(district,from,to,mode)) {
    return {reachable:true,points:[to],distance:pointDistance(from,to),roads:[starts[0].edge.roadId],maneuver:true};
  }
  let best=Infinity;
  let points: CityPoint[]=[];
  let roads: string[]=[];
  for (const start of starts) for (const end of ends) {
    if (start.edge===end.edge && end.t>=start.t) {
      const cost=start.distance+(end.t-start.t)*start.edge.length+end.distance;
      if (cost<best) {best=cost;points=[start.position,end.position,to];roads=[start.edge.roadId];}
    }
  }
  const costs=new Map(Array.from(graph.positions.keys()).map(key=>[key,Infinity]));
  const previous=new Map<string,{from: string|null; point?: CityPoint; roadId?: string}>();
  const pending=new Set(graph.positions.keys());
  for (const start of starts) {
    const cost=start.distance+(1-start.t)*start.edge.length;
    if (cost<costs.get(start.edge.b)!) {
      costs.set(start.edge.b,cost);
      previous.set(start.edge.b,{from:null,point:start.position,roadId:start.edge.roadId});
    }
  }
  while (pending.size) {
    const current=Array.from(pending).sort((a,b)=>costs.get(a)!-costs.get(b)!)[0];
    pending.delete(current);
    if (!Number.isFinite(costs.get(current))) break;
    for (const edge of graph.adjacent.get(current) || []) {
      const cost=costs.get(current)!+edge.length;
      if (cost<costs.get(edge.b)!) {costs.set(edge.b,cost);previous.set(edge.b,{from:current,roadId:edge.roadId});}
    }
  }
  for (const end of ends) {
    const cost=costs.get(end.edge.a)!+end.t*end.edge.length+end.distance;
    if (cost>=best || !Number.isFinite(cost)) continue;
    const path: CityPoint[]=[end.position,to];
    const names: string[]=[end.edge.roadId];
    let key: string|null=end.edge.a;
    while (key!==null) {
      path.unshift(graph.positions.get(key)!);
      const link=previous.get(key);
      if (!link) break;
      if (link.roadId) names.unshift(link.roadId);
      if (link.from===null && link.point) path.unshift(link.point);
      key=link.from;
    }
    best=cost; points=path; roads=names;
  }
  if (!Number.isFinite(best)) return unavailable;
  points=points.filter((point,index)=>pointDistance(point,index?points[index-1]:from)>.03);
  return {reachable:true,points:points.length?points:[to],distance:best,roads};
}
