import type { CityPoint, DistrictDefinition } from './DistrictDefinition';

export interface MapView {
  player?: CityPoint & {yaw: number}; target?: CityPoint; route?: CityPoint[]; labels?: boolean;
  navigation?: boolean;
}

export function mapTransform(width:number,height:number,district:DistrictDefinition,view:MapView) {
  if (view.navigation && view.player) {
    const player=view.player,scale=Math.min(width/180,height/120);
    const cosine=Math.cos(player.yaw),sine=Math.sin(player.yaw);
    return {scale,x:(p:CityPoint)=>width/2+((p.x-player.x)*cosine-(p.z-player.z)*sine)*scale,
      y:(p:CityPoint)=>height*.72+((p.x-player.x)*sine+(p.z-player.z)*cosine)*scale};
  }
  const padding=view.labels?48:24;
  const {minX,minZ,maxX,maxZ}=district.bounds;
  const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxZ-minZ));
  const left=(width-(maxX-minX)*scale)/2,top=(height-(maxZ-minZ)*scale)/2;
  return {scale,x:(p:CityPoint)=>left+(p.x-minX)*scale,y:(p:CityPoint)=>top+(p.z-minZ)*scale};
}

export function navigationStep(player:CityPoint & {yaw?:number},route:CityPoint[]):{symbol:string;instruction:string;distance:number} {
  const points=[player,...route];
  const total=route.reduce((sum,point,index)=>sum+Math.hypot(point.x-points[index].x,point.z-points[index].z),0);
  if(total<12)return {symbol:'P',instruction:'靠边停车',distance:Math.round(total)};
  const forward=route.find(point=>Math.hypot(point.x-player.x,point.z-player.z)>8);
  if (forward && player.yaw!==undefined) {
    const difference=Math.atan2(-(forward.x-player.x),-(forward.z-player.z))-player.yaw;
    if (Math.abs(Math.atan2(Math.sin(difference),Math.cos(difference)))>1.9) return {symbol:'↶',instruction:'调整车头',distance:0};
  }
  let distance=0;
  let accumulated=0,turnStart=0;
  for(let index=1;index<points.length;index++) {
    const a=points[index-1],b=points[index],next=points[index+1];
    const length=Math.hypot(b.x-a.x,b.z-a.z);
    distance+=length;
    if (!next || index===1 && length<6 || Math.hypot(next.x-b.x,next.z-b.z)<.5) continue;
    const incoming=Math.atan2(-(b.x-a.x),-(b.z-a.z));
    const outgoing=Math.atan2(-(next.x-b.x),-(next.z-b.z));
    const turn=Math.atan2(Math.sin(outgoing-incoming),Math.cos(outgoing-incoming));
    if(Math.abs(turn)<.045){accumulated=0;continue;}
    if(length>18 || accumulated*turn<=0){accumulated=turn;turnStart=distance;}
    else accumulated+=turn;
    if(Math.abs(accumulated)>.4) return turnStart<160
      ?{symbol:accumulated>0?'←':'→',instruction:accumulated>0?'左转':'右转',distance:Math.round(turnStart)}
      :{symbol:'↑',instruction:'直行',distance:Math.round(turnStart)};
  }
  return {symbol:distance<12?'P':'↑',instruction:distance<12?'靠边停车':'直行',distance:Math.round(distance)};
}

/** Both cockpit and full map use the same geometry, access flags and place IDs. */
export function drawDistrictMap(c: CanvasRenderingContext2D,width: number,height: number,district: DistrictDefinition,view: MapView={}): void {
  c.fillStyle='#142b33'; c.fillRect(0,0,width,height);
  const {x,y,scale}=mapTransform(width,height,district,view);
  const line=(points: CityPoint[])=>{
    c.beginPath();
    points.forEach((point,index)=>index?c.lineTo(x(point),y(point)):c.moveTo(x(point),y(point)));
  };
  for (const building of district.buildings) {
    line(building.footprint); c.closePath();c.fillStyle='#29434a';c.fill();
  }
  c.lineCap='round'; c.lineJoin='round';
  for (const road of district.roads) {
    line(road.points); c.strokeStyle=road.car?'#6d878b':'#895f49';
    c.lineWidth=Math.max(2,road.width*scale);c.stroke();
    if ((view.labels || view.navigation) && road.car && road.direction!=='TW') {
      const a=road.points[0], b=road.points[road.points.length-1];
      const direction=road.direction==='TF'?-1:1;
      c.save();c.translate((x(a)+x(b))/2,(y(a)+y(b))/2);
      c.rotate(Math.atan2((y(b)-y(a))*direction,(x(b)-x(a))*direction));
      c.fillStyle='#25423e';c.beginPath();c.moveTo(5,0);c.lineTo(-4,-3);c.lineTo(-4,3);c.closePath();c.fill();c.restore();
    }
  }
  if (district.boundary.length) {
    line(district.boundary);c.closePath();c.setLineDash([6,5]);c.lineWidth=1;c.strokeStyle='#e4c789';c.stroke();c.setLineDash([]);
  }
  if (view.route?.length && view.player) {
    line([view.player,...view.route]);c.lineWidth=view.navigation?14:8;c.strokeStyle='#102e38';c.stroke();
    c.lineWidth=view.navigation?8:4;c.strokeStyle='#64e2ee';c.stroke();
  }
  if (view.labels || view.navigation) {
    const names=new Set<string>();
    const labels:{x:number;y:number}[]=[];
    const roads=district.roads.slice().sort((a,b)=>{
      const length=(points: CityPoint[])=>points.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0);
      return length(b.points)-length(a.points);
    });
    c.font=(view.navigation?'26':'12')+'px DM-Sans, sans-serif';c.textAlign='center';c.textBaseline='bottom';
    for (const road of roads) {
      if (names.has(road.name)) continue;
      const a=road.points[0],b=road.points[road.points.length-1];
      const labelX=(x(a)+x(b))/2,labelY=(y(a)+y(b))/2;
      if (labelX<35 || labelX>width-35 || labelY<22 || labelY>height-24
        || labels.some(label=>Math.abs(label.x-labelX)<(view.navigation?150:85) && Math.abs(label.y-labelY)<(view.navigation?36:23))) continue;
      names.add(road.name);labels.push({x:labelX,y:labelY});
      let angle=Math.atan2(y(b)-y(a),x(b)-x(a));
      if (angle>Math.PI/2 || angle<-Math.PI/2) angle+=Math.PI;
      c.save();c.translate(labelX,labelY);c.rotate(angle);
      c.lineWidth=3;c.strokeStyle='#193239';c.strokeText(road.name,0,-5);c.fillStyle='#f3ead5';c.fillText(road.name,0,-5);c.restore();
    }
  }
  if (view.labels) {
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
    c.save();c.translate(x(view.player),y(view.player));c.rotate(view.navigation?0:-view.player.yaw);
    c.fillStyle='#fff9e8';c.strokeStyle='#0b586b';c.lineWidth=3;
    const size=view.navigation?15:10;
    c.beginPath();c.moveTo(0,-size);c.lineTo(size*.7,size*.7);c.lineTo(0,size*.3);c.lineTo(-size*.7,size*.7);c.closePath();c.fill();c.stroke();c.restore();
  }
  if (view.navigation) {
    c.strokeStyle='#d7e4dc';c.lineWidth=2;c.beginPath();c.moveTo(16,height-16);c.lineTo(16+30*scale,height-16);c.stroke();
    c.fillStyle='#e5eee9';c.font='22px DM-Sans';c.textAlign='left';c.fillText('30 m',16,height-23);
  }
}
