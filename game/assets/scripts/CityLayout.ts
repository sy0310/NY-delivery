export interface CityPoint { x: number; z: number }
export const AVENUES = [0, 300];
export const CROSS_STREETS = [-480, -120, 140];
export const COUNTER = {x:285.7, z:-120};
export const PICKUP_PARKING = {x:294.5, z:-106};
export const SPAWN = {x:2.5, z:23};
const nodes: CityPoint[] = [{x:0,z:140},{x:0,z:-120},{x:0,z:-480},
  {x:300,z:-480},{x:300,z:-120},{x:300,z:140}];
// Orchard northbound, Mercer southbound, Juniper eastbound, River westbound.
const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,4]];
const distance = (a: CityPoint, b: CityPoint) => Math.hypot(a.x-b.x,a.z-b.z);

export function orderLocation(sequence: number) {
  const destinations = [{z:-360,address:'18 Orchard Walk'}, {z:60,address:'42 Orchard Walk'},
    {z:-250,address:'76 Orchard Walk · Lobby'}];
  const destination = destinations[sequence % destinations.length];
  return {pickup:COUNTER, pickupParking:PICKUP_PARKING,
    dropoff:{x:9.4,z:destination.z}, dropoffParking:{x:5.5,z:destination.z+10}, address:destination.address};
}

export function roadAt(x: number, z: number): boolean {
  return AVENUES.some(center => Math.abs(x-center) <= 6.8 && z >= -486.8 && z <= 146.8)
    || CROSS_STREETS.some(center => Math.abs(z-center) <= 6.8 && x >= -6.8 && x <= 306.8);
}

function project(point: CityPoint, a: CityPoint, b: CityPoint) {
  const length = distance(a,b);
  const progress = Math.max(0,Math.min(1,((point.x-a.x)*(b.x-a.x)+(point.z-a.z)*(b.z-a.z))/(length*length)));
  const position = {x:a.x+(b.x-a.x)*progress,z:a.z+(b.z-a.z)*progress};
  return {position,progress,length,distance:distance(point,position)};
}
function nearest(point: CityPoint) {
  return edges.map(([a,b]) => ({a,b,...project(point,nodes[a],nodes[b])}))
    .sort((a,b) => a.distance-b.distance)[0];
}

/** Project onto the directed road graph, then find the shortest connected route. */
export function planRoute(from: CityPoint, to: CityPoint): {points: CityPoint[]; distance:number} {
  const start = nearest(from);
  const end = nearest(to);
  if (start.a === end.a && start.b === end.b && end.progress >= start.progress) {
    return {points:[to],distance:distance(from,to)};
  }
  const costs = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const pending = new Set(nodes.map((_,index) => index));
  costs[start.b] = 0;
  while (pending.size) {
    const current = Array.from(pending).sort((a,b) => costs[a]-costs[b])[0];
    pending.delete(current);
    if (current === end.a) break;
    for (const [a,b] of edges.filter(([a]) => a === current)) {
      const cost = costs[a]+distance(nodes[a],nodes[b]);
      if (cost < costs[b]) { costs[b]=cost; previous[b]=a; }
    }
  }
  const path = [end.a];
  while (path[0] !== start.b && previous[path[0]] >= 0) path.unshift(previous[path[0]]);
  const points = path.map(index => ({...nodes[index]}));
  points.push({...to});
  // Junction guidance switches before the center so the driver has room to turn.
  while (points.length > 1 && distance(from,points[0]) < 12) points.shift();
  return {points,distance:points.reduce((sum,point,index) => sum+distance(index ? points[index-1] : from,point),0)};
}
