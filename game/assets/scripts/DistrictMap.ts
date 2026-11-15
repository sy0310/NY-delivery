import type { CityPoint, DistrictDefinition } from './DistrictDefinition';

export interface MapView {
  player?: CityPoint & {yaw: number}; target?: CityPoint; route?: CityPoint[]; labels?: boolean;
}

/** Both cockpit and full map use the same geometry, access flags and place IDs. */
export function drawDistrictMap(c: CanvasRenderingContext2D,width: number,height: number,district: DistrictDefinition,view: MapView={}): void {
  c.fillStyle='#193239'; c.fillRect(0,0,width,height);
  const padding=view.labels?48:24;
  const {minX,minZ,maxX,maxZ}=district.bounds;
  const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxZ-minZ));
  const left=(width-(maxX-minX)*scale)/2, top=(height-(maxZ-minZ)*scale)/2;
  const x=(p: CityPoint)=>left+(p.x-minX)*scale;
  const y=(p: CityPoint)=>top+(p.z-minZ)*scale;
  const line=(points: CityPoint[])=>{
    c.beginPath();
    points.forEach((point,index)=>index?c.lineTo(x(point),y(point)):c.moveTo(x(point),y(point)));
  };
  for (const building of district.buildings) {
    line(building.footprint); c.closePath();c.fillStyle='#41504f';c.fill();
  }
  c.lineCap='round'; c.lineJoin='round';
  for (const road of district.roads) {
    line(road.points); c.strokeStyle=road.car?'#9bb0a8':'#9c6b59';
    c.lineWidth=Math.max(2,road.width*scale);c.stroke();
    if (view.labels && road.car && road.direction!=='TW') {
      const a=road.points[0], b=road.points[road.points.length-1];
      const direction=road.direction==='TF'?-1:1;
      c.save();c.translate((x(a)+x(b))/2,(y(a)+y(b))/2);
      c.rotate(Math.atan2((b.z-a.z)*direction,(b.x-a.x)*direction));
      c.fillStyle='#25423e';c.beginPath();c.moveTo(5,0);c.lineTo(-4,-3);c.lineTo(-4,3);c.closePath();c.fill();c.restore();
    }
  }
  if (district.boundary.length) {
    line(district.boundary);c.closePath();c.setLineDash([6,5]);c.lineWidth=1;c.strokeStyle='#e4c789';c.stroke();c.setLineDash([]);
  }
  if (view.route?.length && view.player) {
    line([view.player,...view.route]);c.lineWidth=view.labels?4:5;c.strokeStyle='#f5d182';c.stroke();
  }
  if (view.labels) {
    const names=new Set<string>();
    const roads=district.roads.slice().sort((a,b)=>{
      const length=(points: CityPoint[])=>points.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0);
      return length(b.points)-length(a.points);
    });
    c.font='12px DM-Sans, sans-serif';c.textAlign='center';c.textBaseline='bottom';
    for (const road of roads) {
      if (names.has(road.name)) continue;
      names.add(road.name);
      const a=road.points[0],b=road.points[road.points.length-1];
      let angle=Math.atan2(b.z-a.z,b.x-a.x);
      if (angle>Math.PI/2 || angle<-Math.PI/2) angle+=Math.PI;
      c.save();c.translate((x(a)+x(b))/2,(y(a)+y(b))/2);c.rotate(angle);
      c.lineWidth=3;c.strokeStyle='#193239';c.strokeText(road.name,0,-5);c.fillStyle='#f3ead5';c.fillText(road.name,0,-5);c.restore();
    }
    c.font='12px DM-Sans, NYDistrictSans, sans-serif';
    for (const [index,place] of [...district.restaurants,...district.deliveries].entries()) {
      c.fillStyle=index<district.restaurants.length?'#edbd77':'#9cd1b7';
      c.beginPath();c.arc(x(place.entry),y(place.entry),5,0,Math.PI*2);c.fill();
      c.textAlign='left';c.fillText(place.name,x(place.entry)+8,y(place.entry)-5);
      c.strokeStyle='#e5d5aa';c.lineWidth=1.5;c.strokeRect(x(place.parking)-4,y(place.parking)-4,8,8);
    }
    for(const landmark of district.landmarks) {
      c.fillStyle=landmark.kind==='subway'?'#b6bce3':'#a0c8df';
      c.fillRect(x(landmark.position)-3,y(landmark.position)-3,6,6);
    }
    c.textAlign='left';c.textBaseline='top';c.font='18px DM-Sans, NYDistrictSans, sans-serif';c.fillStyle='#f4e6cc';
    c.fillText(district.name+' · '+district.borough,20,14);
    c.font='11px DM-Sans, NYDistrictSans, sans-serif';c.fillText('N ↑  ·  metres  ·  P parking  ·  amber pedestrian / busway  ·  NYC / MTA data',20,height-22);
  }
  if (view.target) {c.fillStyle='#f6cd83';c.beginPath();c.arc(x(view.target),y(view.target),view.labels?6:5,0,Math.PI*2);c.fill();}
  if (view.player) {
    c.save();c.translate(x(view.player),y(view.player));c.rotate(-view.player.yaw);
    c.fillStyle='#fff2c9';c.beginPath();c.moveTo(0,-9);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fill();c.restore();
  }
}
