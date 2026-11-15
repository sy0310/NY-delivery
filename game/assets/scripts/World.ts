import { Node, Material, Color, DirectionalLight, Vec3, Prefab, resources, instantiate, MeshRenderer, view, SphereLight } from 'cc';
import { ModelGeometry } from './ModelGeometry';
import type { PaintedPanel } from './ModelGeometry';
import { CarModel, CarTelemetry } from './CarModel';
import type { OrderData, BagLabel, OrderStage } from './OrderState';
import { Person } from './Person';
import type { DistrictDefinition, DistrictPlace, DistrictRestaurant, CityPoint } from './DistrictDefinition';
import { isAccessible, roomPoint, projectPoint, insidePolygon } from './DistrictNavigation';
import { roadSegments, placePose, distanceToBounds } from './DistrictPresentation';

/** District meshes are replaceable. The car, bag and audio owner survive work-area changes. */
export class World {
  readonly car: Node;
  readonly bag = new Node('Order bag');
  private geometry: ModelGeometry;
  private districtGeometry: ModelGeometry | null = null;
  private districtRoot: Node | null = null;
  private prefabs: Prefab[] = [];
  private chunks: {node:Node; bounds:NonNullable<DistrictDefinition['blocks']>[number]['bounds']}[] = [];
  private details: {node:Node;position:CityPoint}[] = [];
  private sedan: CarModel;
  private bagPanel: PaintedPanel;
  private extraBag = new Node('Second bag and drink carrier');
  private actors: {place:DistrictRestaurant;clerk:Person;rider:Person;parcel:Node}[] = [];
  private district!: DistrictDefinition;
  private actorTime = 0;
  private riderTime = 0;
  private handoffTime = 0;
  private light: DirectionalLight;
  private lamps:SphereLight[]=[];
  private quality: 'low'|'standard' = 'standard';
  generation = 0;
  loading = false;

  constructor(private root:Node,private surface:Material,private unlit:Material,private order:Readonly<OrderData>) {
    this.geometry=new ModelGeometry(root,surface,unlit);
    const sun=new Node('Late-afternoon sun'); root.addChild(sun);sun.setRotationFromEuler(-38,-35,0);
    this.light=sun.addComponent(DirectionalLight);this.light.color=new Color(255,225,185);this.light.illuminance=44000;
    this.light.shadowEnabled=true;this.light.shadowDistance=55;this.light.shadowBias=.001;
    const globals=root.scene.globals;
    globals.shadows.enabled=true;globals.shadows.type=1;globals.shadows.shadowMapSize=2048;
    globals.fog.enabled=true;globals.fog.type=0;globals.fog.fogStart=150;globals.fog.fogEnd=510;
    globals.fog.fogColor=new Color(188,209,222);
    this.geometry.sky();
    this.sedan=new CarModel(this.geometry);this.car=this.sedan.node;
    root.addChild(this.bag);
    this.geometry.box('Folded paper bag',0,0,0,.34,.49,.24,'#bb8c52',this.bag);
    this.geometry.box('Folded bag top',0,.26,0,.35,.045,.25,'#c79b62',this.bag);
    this.bagPanel=this.geometry.panel('Shared order bag label',.27,.22,256,192,this.bag);
    this.bagPanel.node.setPosition(0,.04,.126);
    this.bag.addChild(this.extraBag);this.extraBag.setPosition(.35,0,0);
    this.geometry.box('Second sealed bag',0,0,0,.30,.44,.23,'#bb8c52',this.extraBag);
    for(const z of [-.06,.06]) this.geometry.cylinder('Sealed tea cup',0,.36,z,.065,.20,'#c9ac7b',this.extraBag);
    this.setOrder(order);
  }

  async loadDistrict(district:DistrictDefinition):Promise<void> {
    const version=++this.generation;this.loading=true;
    this.unloadDistrict();this.district=district;this.sedan.setDistrict(district);
    const blocks=district.blocks ?? [];
    const results=await Promise.allSettled(blocks.map(block=>new Promise<Prefab>((resolve,reject)=>{
      resources.load(block.asset+'/'+block.id,Prefab,(error,prefab)=>error?reject(error):resolve(prefab.addRef() as Prefab));
    })));
    const loaded=results.filter((result):result is PromiseFulfilledResult<Prefab>=>result.status==='fulfilled').map(result=>result.value);
    if(version!==this.generation || results.some(result=>result.status==='rejected')) {
      loaded.forEach(prefab=>prefab.decRef());this.loading=false;
      throw new Error('District model loading failed. Retry work-area selection.');
    }
    this.prefabs=loaded;
    const group=new Node(district.name+' source geometry');this.root.addChild(group);this.districtRoot=group;
    const g=new ModelGeometry(group,this.surface,this.unlit);this.districtGeometry=g;
    this.buildStreets(g,district);
    const facades=[this.facade(g,0),this.facade(g,1),this.facade(g,2)];
    const roof=g.material('#5b6361');
    blocks.forEach((block,index)=>{
      const node=instantiate(loaded[index]);group.addChild(node);
      for(const renderer of node.getComponentsInChildren(MeshRenderer)) {
        renderer.sharedMaterials=renderer.sharedMaterials.map(material=>{
          const match=material?.name.match(/NYC wall (\d)/);
          return match?facades[Number(match[1])%3]:roof;
        });
        renderer.shadowCastingMode=MeshRenderer.ShadowCastingMode.ON;
      }
      this.chunks.push({node,bounds:block.bounds});
    });
    for(const place of district.restaurants) this.restaurant(g,place);
    for(const place of district.deliveries) this.destination(g,place);
    this.shopfronts(g,district);
    for(const landmark of district.landmarks) {
      const sign=this.sign(g,landmark.name,2.8,.65,'#243f46');
      sign.setPosition(landmark.position.x,2.4,landmark.position.z);sign.setRotationFromEuler(0,landmark.yaw,0);
      g.cylinder('Transit sign post',landmark.position.x,1.2,landmark.position.z,.055,2.4,'#4e675b');
      if(landmark.kind==='subway') {
        for(const side of [-1,1]) {
          g.box('Subway entrance railing',landmark.position.x+side*.65,.55,landmark.position.z+1.6,.045,1.1,2.5,'#33564b');
          for(const offset of [.5,1,1.5,2,2.5])g.box('Subway railing upright',landmark.position.x+side*.65,.5,landmark.position.z+offset,.05,1,.05,'#33564b');
        }
        g.box('Subway stairwell indication',landmark.position.x,.09,landmark.position.z+1.6,1.2,.025,2.5,'#283f40');
      }
    }
    g.batchStatic();this.setOrder(this.order);this.loading=false;
  }

  private unloadDistrict():void {
    if(this.districtRoot) {this.districtRoot.active=false;this.districtRoot.destroy();}
    this.districtRoot=null;this.actors=[];this.lamps=[];this.chunks=[];this.details=[];
    this.districtGeometry?.dispose();this.districtGeometry=null;
    this.prefabs.forEach(prefab=>prefab.decRef());this.prefabs=[];
  }
  dispose():void {this.generation++;this.unloadDistrict();this.sedan.dispose();this.geometry.dispose();}
  setQuality(quality:'low'|'standard'):void {
    this.quality=quality;this.light.shadowDistance=quality==='low'?30:55;
    this.root.scene.globals.shadows.shadowMapSize=quality==='low'?1024:2048;
    this.lamps.forEach(light=>light.enabled=quality==='standard');
    view.enableRetina(quality==='standard');this.sedan.setQuality(quality);
  }
  get resourceState():string {return `${this.district?.id} generation ${this.generation} · ${this.prefabs.length} prefabs · ${this.chunks.filter(chunk=>chunk.node.active).length}/${this.chunks.length} blocks · ${this.quality}`;}
  get bagLabel():BagLabel {return {orderId:this.order.id,code:this.order.code,count:this.order.bagCount??1};}
  get bagPose():{x:number;z:number;yaw:number} {
    const place=this.district.restaurants.find(place=>place.id===this.order.restaurantId)!;
    return {...placePose(place,.8,5.0),yaw:place.yaw+180};
  }
  setOrder(order:Readonly<OrderData>):void {
    this.order=order;this.riderTime=0;
    this.extraBag.active=(order.bagCount??1)>1;
    const tag=this.bagPanel,c=tag.context;
    c.fillStyle='#f2e7cd';c.fillRect(0,0,256,192);c.fillStyle='#25484a';c.textAlign='center';
    c.font='22px DM-Sans';c.fillText(order.id,128,48);c.font='bold 48px DM-Sans';c.fillText(order.code,128,117);
    c.font='18px DM-Sans';c.fillText(`${order.bagCount??1} BAG · SEALED`,128,160);tag.texture.uploadData(tag.canvas);
  }
  canMove=(x:number,z:number,radius:number):boolean=>{
    if(this.loading || !isAccessible(this.district,{x,z},radius>1?'car':'foot',radius)) return false;
    if(radius>1) return true;
    return this.district.restaurants.every(place=>{
      const point=roomPoint(place.entry,place.yaw,{x,z});
      return Math.abs(point.x)>(place.width-1.6)/2+radius || Math.abs(point.z-5.6)>.45+radius;
    });
  };
  groundHeight(x:number,z:number):number {return this.district.restaurants.some(place=>{const p=roomPoint(place.entry,place.yaw,{x,z});return Math.abs(p.x)<place.width/2 && p.z>0 && p.z<place.depth;})?.08:0;}
  handoff():void {this.handoffTime=1.2;}
  update(dt:number,telemetry:CarTelemetry):void {
    this.sedan.update(dt,telemetry);
    for(const chunk of this.chunks) chunk.node.active=distanceToBounds(telemetry,chunk.bounds)<(this.quality==='low'?210:340);
    for(const detail of this.details) detail.node.active=Math.hypot(telemetry.x-detail.position.x,telemetry.z-detail.position.z)<(this.quality==='low'?100:170);
  }
  updateActors(dt:number,stage:OrderStage,joined:boolean,remaining:number,player:CityPoint):void {
    this.actorTime+=dt;this.handoffTime=Math.max(0,this.handoffTime-dt);
    if(joined && remaining===0 || stage!=='accepted' && stage!=='idle') this.riderTime+=dt;
    for(const actor of this.actors) {
      const active=actor.place.id===this.order.restaurantId;
      actor.clerk.animate(this.actorTime,active?Math.sin(this.handoffTime*Math.PI/2):0,false);
      const time=active?this.riderTime:0;
      const progress=Math.min(1,Math.max(0,time-1.2)/7);
      actor.rider.node.setPosition(-1.9+progress*3.9,0,3.3-progress*5.8);
      actor.rider.node.setRotationFromEuler(0,time>1.2?150:0,0);
      actor.rider.animate(this.actorTime,time>0&&time<1.2?.8:0,progress>0&&progress<1);
      actor.parcel.active=time>.65;
    }
  }
  private facade(g:ModelGeometry,style:number):Material {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
    c.fillStyle=(this.district.id==='chinatown'?['#99725b','#ad8d71','#805f54']:['#ac8067','#b7ae95','#8c7368'])[style];c.fillRect(0,0,256,256);
    c.strokeStyle='#756f6455';c.lineWidth=1;
    for(let y=0;y<256;y+=8) {c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();for(let x=(y%16?0:12);x<256;x+=24){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+8);c.stroke();}}
    for(const x of [24,152])for(const y of [24,152]) {
      c.fillStyle='#d7c5a5';c.fillRect(x-5,y-5,90,82);c.fillStyle='#294452';c.fillRect(x,y,80,70);
      c.fillStyle='#a3acaa';c.fillRect(x+38,y,4,70);c.fillRect(x,y+33,80,3);
      c.fillStyle='#ead8a777';c.fillRect(x+4,y+4,31,27);c.fillStyle='#6b736e';c.fillRect(x-7,y+71,94,6);
    }
    return g.paintedMaterial(canvas,true).material;
  }
  private sign(g:ModelGeometry,text:string,width:number,height:number,color:string,parent:Node=g.root):Node {
    return g.cachedPanel(text+color,width,height,c=>{
      c.fillStyle=color;c.fillRect(0,0,512,128);c.strokeStyle='#c4b494';c.lineWidth=4;c.strokeRect(6,6,500,116);
      c.fillStyle='#f4e7c9';c.textAlign='center';c.textBaseline='middle';c.font='bold 48px NYDistrictSans, DM-Sans';c.fillText(text,256,65,490);
    },parent);
  }
  private buildStreets(g:ModelGeometry,district:DistrictDefinition):void {
    const b=district.bounds;
    g.box('Continuous city ground',(b.minX+b.maxX)/2,-.25,(b.minZ+b.maxZ)/2,b.maxX-b.minX+1000,.4,b.maxZ-b.minZ+1000,'#a6aaa0');
    for(const road of district.roads) {
      for(const segment of roadSegments(road.points)) {
        const pavement=g.box(road.name+' sidewalk',segment.center.x,-.025,segment.center.z,road.width+6,.15,segment.length+3,'#bcb8a6');pavement.setRotationFromEuler(0,segment.yaw,0);
        const lane=g.box(road.name,segment.center.x,.005,segment.center.z,road.width,.13,segment.length+1,road.car?'#414c50':road.direction==='NV'?'#bca98e':'#80524c');lane.setRotationFromEuler(0,segment.yaw,0);
        if(road.car) {
          const stripe=g.box('Centre marking',segment.center.x,.075,segment.center.z,.1,.015,Math.max(1,segment.length-18),'#d7cfa7');stripe.setRotationFromEuler(0,segment.yaw,0);
        }
      }
      const segment=roadSegments(road.points)[0];
      if(segment.length>25) {
        const name=this.sign(g,road.name,3.5,.5,'#31574b');
        const angle=segment.yaw*Math.PI/180,offset=road.width/2+1;
        const pole={x:segment.center.x+Math.cos(angle)*offset,z:segment.center.z-Math.sin(angle)*offset};
        name.setPosition(pole.x,3,pole.z);name.setRotationFromEuler(0,segment.yaw+90,0);
        g.cylinder('Street sign pole',pole.x,1.5,pole.z,.055,3,'#69766c');
      }
      if(!road.car && road.direction!=='NV') {
        const bus=this.sign(g,'BUS ONLY · 6 AM–7 PM',4,.7,'#81524b');bus.setPosition(segment.center.x,.085,segment.center.z);bus.setRotationFromEuler(-90,segment.yaw,0);
      }
    }
    for(const place of [...district.restaurants,...district.deliveries]) {
      const p=place.parking;const sign=this.sign(g,'DELIVERY · GAME BAY',2.4,.5,'#3c6159');sign.setPosition(p.x,1.8,p.z);
      for(const side of [-1,1]) g.box('Temporary game pickup bay',p.x+side*1.3,.09,p.z,.08,.02,5.5,'#dfc78d');
    }
  }
  private placeRoot(place:DistrictPlace,g:ModelGeometry):Node {
    const node=new Node(place.name+' close-up');g.root.addChild(node);node.setPosition(place.entry.x,0,place.entry.z);node.setRotationFromEuler(0,place.yaw,0);
    this.details.push({node,position:place.entry});return node;
  }
  private restaurant(g:ModelGeometry,place:DistrictRestaurant):void {
    const node=this.placeRoot(place,g),w=place.width,d=place.depth;
    g.box('Tiled restaurant floor',0,.02,d/2,w,.1,d,'#c9bd9c',node);
    g.box('Warm ceiling',0,3.12,d/2,w,.1,d,'#e0d4b6',node);
    for(const side of [-1,1]) {
      g.box('Restaurant side wall',side*(w/2-.06),1.55,d/2,.12,3.1,d,'#9ba99a',node);
      g.box('Shop window frame',side*(w/4+.5),1.5,-.04,w/2-1,.09,.12,'#dfd5b7',node);
      const glass=g.box('Front display glass',side*(w/4+.5),1.5,0,w/2-1,2.7,.035,g.glassMaterial(),node);
      glass.getComponent(MeshRenderer)!.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;
      g.box('Door jamb',side*1.1,1.5,-.06,.1,3,.15,'#c4b48b',node);
    }
    g.box('Back kitchen wall',0,1.55,d-.08,w,3.1,.16,'#839487',node);
    g.roundedBox('Service counter',0,.58,5.6,w-1.6,1.16,.9,.05,'#556d63',node);
    g.box('Stone counter top',0,1.19,5.6,w-1.45,.1,1.05,'#d4c6a6',node);
    g.box('Frontage sign backing',0,2.94,-.12,w,.62,.25,'#324f44',node);
    const sign=this.sign(g,place.chineseName+' · '+place.name,w-.15,.58,'#324f44',node);sign.setPosition(0,2.95,-.26);sign.setRotationFromEuler(0,180,0);
    const menu=this.sign(g,place.menu,4,.65,'#263f3d',node);menu.setPosition(0,2.38,d-.18);menu.setRotationFromEuler(0,180,0);
    g.box('Preparation shelf',0,1.2,6.4,w-.3,.12,.8,'#9eaa90',node);
    const lamp=new Node('Warm counter light');node.addChild(lamp);lamp.setPosition(0,2.75,4.3);
    const light=lamp.addComponent(SphereLight);light.color=new Color(255,220,165);light.range=7;light.luminousFlux=480;
    this.lamps.push(light);
    for(const x of [-w*.28,0,w*.28]) {
      g.cylinder('Pendant lamp shade',x,2.82,3.4,.22,.12,'#e6c78a',node);
      g.cylinder('Bowl on preparation shelf',x,1.35,6.4,.18,.14,'#e9d8b3',node);
      g.cylinder('Chopstick holder',x+.4,1.4,6.4,.07,.25,'#6d7966',node);
    }
    const clerk=new Person(g,node,'#c4b18a',true);clerk.node.setPosition(.5,0,6.45);clerk.node.setRotationFromEuler(0,180,0);
    const rider=new Person(g,node,'#728879');rider.node.setPosition(-1.9,0,3.3);
    const parcel=new Node('Other customer bag');rider.parcelAnchor.addChild(parcel);g.box('Small takeaway bag',0,0,0,.22,.32,.18,'#bd965d',parcel);parcel.active=false;
    this.actors.push({place,clerk,rider,parcel});g.batchStatic(node);
  }
  private shopfronts(g:ModelGeometry,district:DistrictDefinition):void {
    const occupied=new Set([...district.restaurants,...district.deliveries].map(place=>place.buildingId));
    let count=0;
    for(const building of district.buildings) {
      if(building.block.startsWith('context') || occupied.has(building.id) || count>=38)continue;
      const candidates=building.footprint.map((a,index)=>{
        const b=building.footprint[(index+1)%building.footprint.length],mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
        const near=Math.min(...district.roads.flatMap(road=>road.points.slice(1).map((end,i)=>projectPoint(mid,road.points[i],end).distance-road.width/2)));
        return {a,b,mid,near,length:Math.hypot(a.x-b.x,a.z-b.z)};
      }).filter(edge=>edge.length>5 && edge.near>0 && edge.near<7).sort((a,b)=>a.near-b.near);
      if(!candidates.length)continue;
      const edge=candidates[0],width=Math.min(7.5,edge.length-.4);
      let yaw=Math.atan2(-(edge.b.z-edge.a.z),edge.b.x-edge.a.x)*180/Math.PI;
      const place={entry:edge.mid,yaw};
      if(!insidePolygon(placePose(place,0,.4),building.footprint))place.yaw+=180;
      const node=this.placeRoot({...place,id:'front-'+building.id,name:'Commercial frontage',parking:place.entry,walkway:[]},g);
      const names=district.id==='flushing'?['亚洲超市 · MARKET','烘焙 · BAKERY','茶铺 · TEA','美食广场 · FOOD HALL']:['GROCER · 食品','TEA & BAKERY · 茶点','PRINT & POST','NEIGHBORHOOD MARKET'];
      g.box('Lower storefront glazing',0,1.35,-.04,width,2.7,.12,'#2d4e55',node);
      for(const x of [-width/2,0,width/2])g.box('Storefront frame',x,1.35,-.14,.08,2.7,.1,'#b2a383',node);
      const sign=this.sign(g,names[count%names.length],width,.65,district.id==='flushing'?'#455e49':'#743d32',node);sign.setPosition(0,2.95,-.14);sign.setRotationFromEuler(0,180,0);
      g.box('Canvas awning',0,2.5,-.45,width,.12,.9,district.id==='flushing'?'#7b9275':'#a6785b',node);
      if(district.id==='chinatown' && count%3===0 && building.height>10) {
        for(const y of [4.5,7.5]) {
          g.box('Fire escape landing',0,y,-.6,3,.1,1.2,'#48514c',node);
          g.box('Fire escape top rail',0,y+.9,-1.12,3,.045,.045,'#48514c',node);
          for(const x of [-1.4,-.7,0,.7,1.4])g.box('Fire escape baluster',x,y+.45,-1.12,.04,.9,.04,'#48514c',node);
          g.beam('Fire escape stair',new Vec3(-1.3,y,-.6),new Vec3(1.3,y+3,-.6),.065,'#48514c',node);
        }
      }
      g.batchStatic(node);count++;
    }
  }

  private destination(g:ModelGeometry,place:DistrictDefinition['deliveries'][number]):void {
    const node=this.placeRoot(place,g);
    g.box('Entrance lintel',0,2.6,0,2.4,.2,.25,'#c4b99e',node);
    for(const side of [-1,1])g.box('Entry stone jamb',side*1.05,1.3,0,.2,2.6,.3,'#c4b99e',node);
    if(place.kind==='lobby') {
      g.box('Lobby floor',0,.03,1.5,3.2,.06,3,'#c2c0a7',node);
      g.box('Lobby rear wall',0,1.4,2.9,3.2,2.8,.1,'#788b7d',node);
      for(const side of [-1,1])g.box('Lobby side',side*1.6,1.4,1.5,.1,2.8,3,'#788b7d',node);
      g.box('Mail slots',1.5,1.25,1.8,.08,.8,1.3,'#b9b7a1',node);
    } else {g.box('Recessed front door',0,1.25,.12,1.8,2.5,.1,'#35564f',node);g.box('Brass door handle',.6,1.1,-.03,.035,.3,.05,'#d8bf85',node);}
    const plate=this.sign(g,place.name,2.8,.42,'#2b4b43',node);plate.setPosition(0,2.95,-.15);plate.setRotationFromEuler(0,180,0);
    g.batchStatic(node);
  }
}
