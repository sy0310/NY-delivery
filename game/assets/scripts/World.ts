import { Node, Material, Color, DirectionalLight, SphereLight, Vec3 } from 'cc';
import { ModelGeometry } from './ModelGeometry';
import type { PaintedPanel } from './ModelGeometry';
import type { BagLabel } from './OrderState';
import { CarModel, CarTelemetry } from './CarModel';
import { OrderData } from './OrderState';
import { AVENUES, CROSS_STREETS, roadAt, RESTAURANT_ORIGIN, PICKUP_PARKING, EAST_AVENUE, NORTH_STREET, SOUTH_STREET } from './CityLayout';
import { Person } from './Person';
import type { OrderStage } from './OrderState';

const STAFF_X = -16.4;

interface Obstacle { x: number; z: number; width: number; depth: number }

/** A detailed foreground street backed by several blocks of original city scenery. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly car: Node;
  readonly bag = new Node('Order bag');
  readonly npc = new Node('Waiting customer');
  private geometry: ModelGeometry;
  private sedan: CarModel;
  private bagPanel!: PaintedPanel;
  private clerk!: Person;
  private rider!: Person;
  private actorTime = 0;
  private riderTime = 0;
  private riderYaw = 0;
  private riderBag = new Node('Other rider takeaway');
  private handoffTime = 0;
  private extraBag = new Node('Second bag and drink carrier');
  private facades = new Map<string, Material>();

  constructor(private root: Node, private surface: Material, private unlit: Material, private order: Readonly<OrderData>) {
    this.geometry = new ModelGeometry(root, surface, unlit);
    this.lighting();
    this.geometry.sky();
    this.street();
    this.city();
    this.buildAt('Juniper Kitchen', RESTAURANT_ORIGIN.x, RESTAURANT_ORIGIN.z, () => this.restaurant());
    for (const [z, address] of [[-360, '18 ORCHARD WALK'], [60, '42 ORCHARD WALK'], [-250, '76 ORCHARD · LOBBY']] as const) {
      this.buildAt(address, 0, z + 30, () => this.destination(address));
    }
    this.streetFurniture();
    this.geometry.batchStatic();
    this.sedan = new CarModel(this.geometry);
    this.car = this.sedan.node;
    root.addChild(this.bag);
    this.geometry.box('Folded paper bag', 0, 0, 0, .34, .49, .24, '#bb8c52', this.bag);
    this.geometry.box('Folded bag top', 0, .26, 0, .35, .045, .25, '#c79b62', this.bag);
    const tag = this.geometry.panel('Shared order bag label', .27, .22, 256, 192, this.bag);
    tag.node.setPosition(0, .04, .126);
    this.bagPanel = tag;
    this.bag.addChild(this.extraBag);
    this.extraBag.setPosition(.35,0,0);
    this.geometry.box('Second sealed bag',0,0,0,.30,.44,.23,'#bb8c52',this.extraBag);
    this.geometry.box('Drink tray',0,.25,0,.30,.045,.23,'#8c7659',this.extraBag);
    for (const z of [-.06,.06]) {
      this.geometry.cylinder('Iced tea cup',0,.36,z,.065,.20,'#c9ac7b',this.extraBag);
      this.geometry.cylinder('Sealed drink lid',0,.465,z,.07,.02,'#e5dfcc',this.extraBag);
    }
    this.setOrder(order);
  }

  get bagLabel(): BagLabel {
    return {orderId: this.order.id, code: this.order.code, count: this.order.bagCount ?? 1};
  }

  setOrder(order: Readonly<OrderData>): void {
    this.order = order;
    this.extraBag.active = (order.bagCount ?? 1) > 1;
    this.riderTime = 0;
    this.riderYaw = 0;
    this.riderBag.active = false;
    this.npc.active = (order.queueSeconds ?? 8) > 0;
    this.npc.setPosition(-14.2,0,.2);
    this.npc.setRotationFromEuler(0,0,0);
    const tag = this.bagPanel;
    tag.context.fillStyle = '#f2e7cd';
    tag.context.fillRect(0, 0, 256, 192);
    tag.context.fillStyle = '#25484a';
    tag.context.textAlign = 'center';
    tag.context.font = '22px DM-Sans';
    tag.context.fillText(order.id, 128, 48);
    tag.context.font = 'bold 48px DM-Sans';
    tag.context.fillText(order.code, 128, 117);
    tag.context.font = '18px DM-Sans';
    tag.context.fillText(`${order.bagCount ?? 1} BAG${(order.bagCount ?? 1) > 1 ? 'S' : ''} · SEALED`, 128, 160);
    tag.texture.uploadData(tag.canvas);
  }

  canMove = (x: number, z: number, radius: number): boolean => {
    if (x < -40 || x > EAST_AVENUE+40 || z > SOUTH_STREET+40 || z < NORTH_STREET-40) return false;
    if (radius > 1 && !roadAt(x, z)) return false;
    return this.obstacles.every(o => Math.abs(x - o.x) >= o.width / 2 + radius
      || Math.abs(z - o.z) >= o.depth / 2 + radius);
  };

  update(dt: number, telemetry: CarTelemetry): void { this.sedan.update(dt, telemetry); }
  handoff(): void { this.handoffTime = 1.2; }
  groundHeight(x: number, z: number): number {
    return x > RESTAURANT_ORIGIN.x-19 && x < RESTAURANT_ORIGIN.x-10
      && Math.abs(z-RESTAURANT_ORIGIN.z) < 6 ? .25 : 0;
  }
  updateActors(dt: number, stage: OrderStage, joined: boolean, remaining: number, player: {x:number;z:number}): void {
    this.actorTime += dt;
    this.handoffTime = Math.max(0,this.handoffTime-dt);
    const lookYaw = Math.atan2(player.x-(RESTAURANT_ORIGIN.x+STAFF_X),player.z-RESTAURANT_ORIGIN.z)*180/Math.PI-90;
    this.clerk.animate(this.actorTime,Math.sin(Math.min(1,this.handoffTime)*Math.PI/2),false,lookYaw);
    if (!this.npc.active) return;
    if (joined && remaining===0 || stage!=='accepted' && stage!=='idle') this.riderTime += dt;
    const time = this.riderTime;
    const points = [{x:-15.2,z:.2},{x:-13.9,z:1.4},{x:-11,z:1.4},{x:-8,z:1.4},{x:-8,z:-14}];
    this.riderBag.active = time > .65;
    const progress = Math.max(0,time-1.2)*1.6;
    let travel = progress;
    let walking = false;
    if (time>0 && time<1.2) this.npc.setPosition(-14.2-Math.min(1,time/.6),0,.2);
    if (time>=1.2) {
      for (let index=1;index<points.length;index++) {
        const a=points[index-1], b=points[index];
        const length=Math.hypot(b.x-a.x,b.z-a.z);
        if (travel<=length) {
          const fraction=travel/length;
          this.npc.setPosition(a.x+(b.x-a.x)*fraction,0,a.z+(b.z-a.z)*fraction);
          const desiredYaw=Math.atan2(b.x-a.x,b.z-a.z)*180/Math.PI+90;
          const difference=(desiredYaw-this.riderYaw)*Math.PI/180;
          this.riderYaw+=Math.atan2(Math.sin(difference),Math.cos(difference))*180/Math.PI*Math.min(1,dt*6);
          this.npc.setRotationFromEuler(0,this.riderYaw,0);
          walking=progress>0;
          break;
        }
        travel-=length;
      }
    }
    this.rider.animate(this.actorTime,time>0 && time<1.2 ? .85 : 0,walking);
  }

  private buildAt(name: string, x: number, z: number, build: () => void): void {
    const previous = this.geometry;
    const group = new Node(name);
    this.root.addChild(group);
    this.geometry = new ModelGeometry(group, this.surface, this.unlit);
    const obstacleStart = this.obstacles.length;
    build();
    this.geometry.batchStatic();
    for (const obstacle of this.obstacles.slice(obstacleStart)) { obstacle.x += x; obstacle.z += z; }
    group.setPosition(x, 0, z);
    this.geometry = previous;
  }

  private wall(name: string, x: number, y: number, z: number, w: number, h: number,
    d: number, color: string | Material): Node {
    this.obstacles.push({ x, z, width: w, depth: d });
    return this.geometry.box(name, x, y, z, w, h, d, color);
  }

  private lighting(): void {
    const sun = new Node('Late-afternoon sun');
    this.root.addChild(sun);
    sun.setRotationFromEuler(-38, -35, 0);
    const light = sun.addComponent(DirectionalLight);
    light.color = new Color(255, 225, 185);
    light.illuminance = 44000;
    light.shadowEnabled = true;
    light.shadowDistance = 55;
    light.shadowBias = .001;
    const globals = this.root.scene.globals;
    globals.shadows.enabled = true;
    globals.shadows.type = 1;
    globals.shadows.shadowMapSize = 2048;
    globals.fog.enabled = true;
    globals.fog.type = 0;
    globals.fog.fogStart = 105;
    globals.fog.fogEnd = 340;
    globals.fog.fogColor = new Color(188, 209, 222);
  }

  private sign(text: string, x: number, y: number, z: number, width: number,
    yaw = 90, background = '#213e3d'): void {
    const panel = this.geometry.panel(text, width, width * .185, 1024, 192);
    panel.node.setPosition(x, y, z);
    panel.node.setRotationFromEuler(0, yaw, 0);
    const c = panel.context;
    c.fillStyle = background;
    c.fillRect(0, 0, 1024, 192);
    c.strokeStyle = '#b9a77e';
    c.lineWidth = 5;
    c.strokeRect(12, 12, 1000, 168);
    c.fillStyle = '#eee5d2';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '76px InstrumentSerif';
    c.fillText(text, 512, 100, 950);
    panel.texture.uploadData(panel.canvas);
  }

  private street(): void {
    const g = this.geometry;
    for (let x = -390; x <= EAST_AVENUE+390; x += 30) for (let z = NORTH_STREET-390; z <= SOUTH_STREET+390; z += 30) {
      g.box('City ground', x, -.35, z, 30, .4, 30, '#9b9d93');
    }
    for (const avenue of AVENUES) {
      for (let z = NORTH_STREET; z <= SOUTH_STREET; z += 10) g.box('Connected avenue', avenue, -.07, z, 14, .15, 10, '#3a454d');
      for (let z = -470; z < SOUTH_STREET; z += 6) {
        if (CROSS_STREETS.some(cross => Math.abs(z-cross) < 18)) continue;
        g.box('One-way lane divider', avenue, .025, z, .10, .015, 3, '#ddd4b5');
        for (const side of [-1,1]) {
          g.box('Sidewalk', avenue+side*8.55, .075, z, 3.1, .25, 6, '#b5b5a7');
          g.box('Curb', avenue+side*7.05, .13, z, .17, .29, 6, '#d1cfba');
        }
      }
      for (const cross of CROSS_STREETS) {
        for (let x = -5.5; x <= 6; x += 1.4) for (const side of [-1,1]) {
          g.box('Pedestrian crossing', avenue+x, .03, cross+side*10, .8, .02, 2.5, '#d4d2bc');
        }
      }
      for (let z = -430; z < 100; z += 130) {
        const arrow = g.panel('One way road arrow', 1.8, 4, 128, 256);
        arrow.context.fillStyle = '#d8d6bc';
        arrow.context.font = 'bold 210px sans-serif';
        arrow.context.textAlign = 'center';
        arrow.context.fillText('↑',64,215);
        arrow.texture.uploadData(arrow.canvas);
        arrow.node.setPosition(avenue+2.5, .045, z);
        arrow.node.setRotationFromEuler(-90, avenue === 0 ? 0 : 180, 0);
      }
    }
    for (const cross of CROSS_STREETS) {
      for (let x = 0; x <= EAST_AVENUE; x += 10) {
        g.box('Connected cross street', x, -.055, cross, 10, .13, 14, '#3a454d');
        if (x > 18 && x < EAST_AVENUE-18) {
          for (const side of [-1,1]) g.box('Cross-street sidewalk', x, .075, cross+side*8.55, 10, .25, 3.1, '#b5b5a7');
          g.box('Cross-street lane marking', x, .026, cross, 4, .02, .10, '#ddd4b5');
        }
      }
    }
    for (const [x,z,name] of [[PICKUP_PARKING.x,PICKUP_PARKING.z,'JUNIPER PICKUP'],[5.5,-350,'18 ORCHARD'],[5.5,70,'42 ORCHARD'],[5.5,-240,'76 LOBBY']] as const) {
      for (const side of [-1,1]) g.box('Parking bay side', x+side*1.2,.04,z,.08,.02,6,'#dbd1a9');
      g.box('Parking bay end',x,.04,z-3,2.4,.02,.08,'#dbd1a9');
      this.sign(name,x > 200 ? x-2.1 : x+2.7,2.2,z,2.8,x > 200 ? -90 : 90,'#355b55');
    }
  }

  private facade(color: string, seed: number): Material {
    const key = color + seed % 3;
    const existing = this.facades.get(key);
    if (existing) return existing;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const c = canvas.getContext('2d')!;
    c.fillStyle = color;
    c.fillRect(0, 0, 512, 768);
    for (let y = 0; y < 768; y += 12) {
      c.fillStyle = 'rgba(26,39,44,.18)';
      c.fillRect(0, y, 512, 1);
      for (let x = (y % 24) * 2; x < 512; x += 64) c.fillRect(x, y, 1, 12);
    }
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 5; column++) {
        const x = 23 + column * 100;
        const y = 22 + row * 93;
        c.fillStyle = '#344a54';
        c.fillRect(x, y, 58, 68);
        c.fillStyle = (row * 7 + column * 3 + seed) % 5 === 0 ? '#c8b383' : '#6a8e9d';
        c.fillRect(x + 5, y + 5, 48, 55);
        c.fillStyle = 'rgba(228,237,229,.18)';
        c.fillRect(x + 7, y + 6, 17, 51);
        c.fillStyle = '#bac0b3';
        c.fillRect(x + 27, y + 4, 3, 57);
        c.fillRect(x + 4, y + 30, 50, 3);
        c.fillRect(x - 3, y + 65, 65, 5);
      }
    }
    const material = this.geometry.paintedMaterial(canvas, true).material;
    this.facades.set(key, material);
    return material;
  }

  private city(): void {
    const colors = ['#9b806b', '#a49b83', '#7f9295', '#997568', '#879391'];
    for (const avenue of AVENUES) this.buildAt('Avenue frontage', avenue, 0, () => {
      const g = this.geometry;
      for (const side of [-1,1]) for (let index=0; index<38; index++) {
        const z = -466+index*18;
        if (CROSS_STREETS.some(cross => Math.abs(z-cross)<23)) continue;
        if (avenue===RESTAURANT_ORIGIN.x && side<0 && Math.abs(z-RESTAURANT_ORIGIN.z)<18) continue;
        if (avenue===0 && side>0 && [-360,60,-250].some(door => Math.abs(z-door)<18)) continue;
        const height = 13+(index*7%5)*2.7;
        this.wall('Masonry frontage',side*17,height/2,z,14,height,16.7,this.facade(colors[index%5],index));
        g.box('Stone base',side*17,.8,z,14.1,1.6,16.8,'#7e8883');
        g.box('Roof cornice',side*17,height-.15,z,14.5,.35,17.1,'#bac0b1');
        this.storefront(side,z,index);
        if (index%3===0) this.fireEscape(side,z,height);
      }
    });
    for (const x of [-58,62,112,188,238,EAST_AVENUE+58]) for (let z=-510;z<=SOUTH_STREET+40;z+=42) {
      if (CROSS_STREETS.some(cross => Math.abs(z-cross)<28)) continue;
      const height=22+Math.abs((x+z)%27);
      this.geometry.box('Interior city block',x,height/2,z,30,height,27,this.facade(colors[Math.abs(z)%5],z));
    }
  }

  private storefront(side: number, z: number, index: number): void {
    const g = this.geometry;
    for (const offset of [-4.8, 0, 4.8]) {
      g.box('Shop glazing', side * 9.91, 1.85, z + offset, .075, 2.65, 3.7, '#42636a');
      g.box('Window reflection', side * 9.86, 2.6, z + offset, .025, .6, 3.5, '#819b9d');
      for (const edge of [-1, 1]) g.box('Storefront mullion', side * 9.8, 1.85,
        z + offset + edge * 1.87, .13, 2.8, .07, '#c2ba9f');
    }
    const canopy = g.box('Shop awning', side * 9.35, 3.25, z, 1.5, .12, 13.4,
      index % 2 ? '#405b54' : '#8d7150');
    canopy.setRotationFromEuler(0, 0, side * 8);
    const names = ['ORCHARD BOOKS', 'MERCER COFFEE', 'EASTSIDE MARKET', 'CORNER PHARMACY'];
    this.sign(names[index % names.length], side * 9.75, 3.7, z, 10.5, side < 0 ? 90 : -90);
  }

  private fireEscape(side: number, z: number, height: number): void {
    const g = this.geometry;
    for (let y = 4.5; y < Math.min(height, 15); y += 3) {
      g.box('Fire-escape platform', side * 9.55, y, z + 2.8, .95, .08, 3.1, '#36464a');
      g.box('Fire-escape rail', side * 9.08, y + .75, z + 2.8, .04, .045, 3.15, '#36464a');
      for (let offset = -1.4; offset <= 1.5; offset += .38) {
        g.box('Rail post', side * 9.08, y + .4, z + 2.8 + offset, .025, .7, .025, '#36464a');
      }
      for (const x of [side * 9.2, side * 9.7]) {
        g.beam('Fire-escape ladder rail', new Vec3(x, y, z + 1.4),
          new Vec3(x, y + 3, z + 4.1), .027, '#36464a');
      }
      for (let step = 1; step <= 12; step++) {
        g.box('Fire-escape rung', side * 9.45, y + step / 4, z + 1.4 + step * .225,
          .53, .035, .09, '#526264');
      }
    }
  }

  private restaurant(): void {
    const g = this.geometry;
    g.box('Restaurant floor', -14.5, .12, 0, 9, .25, 12, '#b5ac91');
    for (let x = -18.5; x < -10; x += .8) for (let z = -5.5; z < 6; z += .8) {
      if ((Math.round((x + 18.5) / .8) + Math.round((z + 5.5) / .8)) % 2 === 0) {
        g.box('Floor tile', x, .251, z, .77, .008, .77, '#d0c4a6');
      }
    }
    this.wall('Restaurant back wall', -19, 2.1, 0, .35, 4.2, 12, '#bfa98c');
    for (const z of [-6, 6]) this.wall('Restaurant side wall', -14.5, 2.1, z, 9, 4.2, .3, '#bfa98c');
    g.box('Restaurant ceiling', -14.5, 4.15, 0, 9, .18, 12, '#ddd2b4');
    g.box('Restaurant upper floors', -14.5, 10.7, 0, 9, 13, 12,
      this.facade('#9b806b', 2));
    g.box('Restaurant roof cornice', -14.5, 17.2, 0, 9.4, .35, 12.4, '#b8b7a4');
    for (const side of [-1, 1]) {
      g.box('Restaurant side glazing', -14.5, 1.8, side * 6.17, 6.8, 2.6, .035, '#557977');
      for (const x of [-17.9, -15.65, -13.35, -11.1]) {
        g.box('Restaurant side window frame', x, 1.8, side * 6.2, .08, 2.7, .06, '#315c55');
      }
      g.box('Restaurant side crossbar', -14.5, 1.65, side * 6.21, 6.8, .07, .06, '#315c55');
      this.sign(this.order.restaurant.toUpperCase(), -14.5, 3.53, side * 6.2, 7.8, side > 0 ? 0 : 180);
    }
    for (const z of [-4, 4]) {
      this.wall('Restaurant front wall', -10, 1.8, z, .3, 3.6, 4, '#315c55');
      g.box('Warm shop window', -9.82, 1.85, z, .035, 2.5, 3.1, '#567d7c');
      g.box('Window sill', -9.69, .57, z, .35, .12, 3.45, '#c8bb9d');
      g.box('Window mullion', -9.7, 1.85, z, .12, 2.65, .065, '#264942');
      g.box('Window crossbar', -9.69, 1.7, z, .13, .065, 3.1, '#264942');
      g.box('Reflected window light', -9.79, 2.58, z - .5, .025, .65, .62, '#9cb9ae');
      g.box('Reflected window light', -9.79, 1.12, z + .65, .025, .65, .65, '#8fa99d');
    }
    g.box('Entrance lintel', -10, 3.6, 0, .4, .65, 12, '#284b45');
    g.box('Canvas awning', -9.22, 3.3, 0, 1.7, .14, 11.5, '#315d51');
    for (let z = -5.25; z < 5.5; z += .85) g.box('Awning stripe', -9.22, 3.38, z, 1.7, .012, .25, '#cfccae');
    this.sign(this.order.restaurant.toUpperCase(), -9.71, 3.92, 0, 10.5);
    this.sign('PICKUP · THANK YOU', -18.77, 3.2, 1.3, 4);
    this.wall('Pickup counter base', -15.9, .6, 0, .75, 1.2, 5.4, '#4d6255');
    g.box('Stone countertop', -15.9, 1.25, 0, 1.0, .12, 5.7, '#d8c9aa');
    g.box('Counter brass trim', -15.38, 1.12, 0, .04, .035, 5.6, '#b5a16f');
    for (const z of [-3.5, 0, 3.5]) {
      g.beam('Pendant cable', new Vec3(-14, 4.05, z), new Vec3(-14, 3.15, z), .018, '#384241');
      g.cylinder('Lamp shade', -14, 3.12, z, .32, .16, '#57645b');
      g.cylinder('Warm diffuser', -14, 3.025, z, .26, .025, '#ead29b');
      const lamp = new Node('Warm restaurant light');
      g.root.addChild(lamp);
      lamp.setPosition(-14, 2.95, z);
      const light = lamp.addComponent(SphereLight);
      light.color = new Color(255, 210, 144);
      light.range = 7;
      light.luminousFlux = 950;
    }
    for (const z of [-2.8, -2.3, 2.4]) {
      g.cylinder('Counter paper cup', -16.05, 1.43, z, .085, .22, '#e2d9be');
      g.cylinder('Cup lid', -16.05, 1.55, z, .09, .022, '#465653');
    }
    this.clerk = new Person(g,g.root,'#b7a67e',true);
    this.clerk.node.setPosition(STAFF_X,.25,0);
    this.clerk.node.setRotationFromEuler(0,90,0);
    g.root.addChild(this.npc);
    this.rider = new Person(g,this.npc,'#6b8391');
    this.rider.node.setRotationFromEuler(0,-90,0);
    this.rider.parcelAnchor.addChild(this.riderBag);
    g.box('Rider sealed bag',0,0,0,.28,.34,.20,'#b58a58',this.riderBag);
    g.box('Rider folded bag top',0,.18,0,.29,.025,.21,'#c39c6a',this.riderBag);
    g.batchStatic(this.riderBag);
    this.npc.setPosition(-14.2, 0, .2);
    g.box('Queue mat', -12.8, .27, 0, 1.4, .02, 1.5, '#8b9c7c');
    g.box('Pickup rack uprights',-18.45,1.1,-4.5,.10,1.75,.10,'#52655a');
    for (const y of [.55,1.15,1.75]) {
      g.box('Pickup rack shelf',-17.7,y,-4.5,1.6,.07,.7,'#647568');
      g.box('Prepared paper bag',-17.7,y+.25,-4.5,.34,.45,.25,'#bd925e');
    }
    g.box('Kitchen doorway frame',-18.76,1.48,3.75,.08,2.65,1.65,'#34564f');
    g.box('Kitchen swing door',-18.69,1.48,3.75,.06,2.4,1.35,'#65786c');
    g.box('Kitchen door window',-18.64,1.9,3.75,.025,.50,.65,'#b1c4b5');
    g.cylinder('Receipt roll',-15.98,1.42,1.4,.10,.19,'#ece4cb');
    g.box('Printed pickup receipt',-15.68,1.33,1.4,.28,.012,.45,'#f1e8ce');
    g.box('Counter card reader',-15.68,1.41,2.5,.24,.16,.25,'#284746');
    const menu=g.panel('Kitchen menu',2.8,1.55,640,352);
    menu.node.setPosition(-18.76,2.62,-3.8);
    menu.node.setRotationFromEuler(0,90,0);
    menu.context.fillStyle='#294c45'; menu.context.fillRect(0,0,640,352);
    menu.context.fillStyle='#e5d9b9'; menu.context.font='36px InstrumentSerif';
    menu.context.fillText('Juniper · Evening Kitchen',35,60);
    menu.context.font='25px DM-Sans';
    ['Mushroom rice     $12','Sesame noodles    $11','Ginger / iced tea   $4','PICKUP  ·  SHOW YOUR CODE'].forEach((line,index)=>menu.context.fillText(line,35,120+index*58));
    menu.texture.uploadData(menu.canvas);

  }

  private destination(address: string): void {
    const g = this.geometry;
    this.wall('Delivery apartment', 17, 8.5, -31, 14, 17, 16, this.facade('#9c806a', 4));
    g.box('Apartment stone base', 17, .65, -31, 14.1, 1.3, 16.1, '#83918a');
    g.box('Apartment cornice', 17, 17, -31, 14.6, .4, 16.6, '#b8b8a4');
    g.box('Door surround', 9.84, 1.55, -30, .3, 3.1, 2.65, '#c9bea1');
    g.box('Green door', 9.62, 1.42, -30, .1, 2.8, 1.8, '#2a4b47');
    for (const z of [-30.45, -29.55]) g.box('Door inset', 9.55, 1.2, z, .045, 1.7, .56, '#345e53');
    g.sphere('Brass handle', 9.5, 1.25, -29.45, .08, .08, .08, '#bbab7a');
    g.box('Door canopy', 9.31, 3.15, -30, 1.4, .12, 2.8, '#3d5650');
    this.sign(address, 8.59, 3.19, -30, 2.6, -90);
    g.box('Entry lower step',8.65,.10,-30,1.55,.20,2.7,'#bab8a4');
    g.box('Entry upper step',9.18,.23,-30,.65,.24,2.4,'#cbc3a9');
    g.box('Welcome mat',8.74,.215,-30,.85,.02,1.6,'#53645a');
    g.box('Doorbell plate',9.48,1.38,-28.72,.055,.30,.17,'#b4a378');
    g.sphere('Doorbell button',9.43,1.38,-28.72,.055,.055,.055,'#d5c99c');
    g.box('Letter slot',9.54,.64,-30,.04,.08,.58,'#b4a378');
    g.box('Stone transom',9.58,2.72,-30,.08,.26,1.65,'#6b8b84');
    for (const z of [-31.55,-28.45]) {
      g.box('Entry lamp bracket',9.48,2.36,z,.18,.08,.12,'#394f4b');
      g.box('Entry lamp lantern',9.36,2.25,z,.20,.31,.20,'#d4c79f');
    }
    const number=g.panel('Readable building number',.7,.32,256,128);
    number.node.setPosition(9.45,1.98,-31.4); number.node.setRotationFromEuler(0,-90,0);
    number.context.fillStyle='#334e49'; number.context.fillRect(0,0,256,128);
    number.context.fillStyle='#eadbb3'; number.context.font='bold 82px DM-Sans'; number.context.textAlign='center';
    number.context.fillText(address.split(' ')[0],128,96); number.texture.uploadData(number.canvas);

  }

  private streetFurniture(): void {
    const g = this.geometry;
    for (const avenue of AVENUES) for (let z=-450;z<SOUTH_STREET-10;z+=54) {
      if (CROSS_STREETS.some(cross => Math.abs(z-cross)<18)) continue;
      for (const side of [-1,1]) {
        if (avenue===0 && side>0 && [-360,60,-250].some(door => Math.abs(z-door)<12)) continue;
        if (avenue===RESTAURANT_ORIGIN.x && side<0 && Math.abs(z-RESTAURANT_ORIGIN.z)<25) continue;
        g.cylinder('Street lamp',avenue+side*7.8,2.8,z,.055,5.6,'#3e5154');
        g.box('Street light housing',avenue+side*7.6,5.45,z,.65,.12,.3,'#495a5a');
        g.box('Street light diffuser',avenue+side*7.6,5.37,z,.5,.025,.22,'#d9d4ad');
        g.cylinder('Tree trunk',avenue+side*8.8,1.6,z+4,.12,2.6,'#706450');
        g.sphere('Street foliage',avenue+side*8.8,3.5,z+4,2.3,2.7,2.25,'#71875c');
      }
    }
    for (const avenue of AVENUES) this.buildAt('Parked cars',avenue,0,()=> {
      this.parkedCar(1,-40); this.parkedCar(1,-180); this.parkedCar(-1,-420);
    });
    for (const avenue of AVENUES) for (const cross of CROSS_STREETS) {
      g.cylinder('Street sign pole',avenue-8.2,1.9,cross-12,.055,3.8,'#526260');
      this.sign(avenue===0 ? 'ORCHARD ↑' : 'MERCER ↓',avenue-8.2,3.1,cross-12,3,0);
      this.sign(cross===SOUTH_STREET ? 'RIVER ←' : cross===NORTH_STREET ? 'CANAL →' : 'JUNIPER →',avenue-8.2,2.6,cross-12,3,0);
    }
  }

  private parkedCar(side: number, z: number): void {
    const g = this.geometry;
    const x = side * 5.65;
    const color = side < 0 ? '#748e91' : '#a3977b';
    this.obstacles.push({ x, z, width: 1.8, depth: 4.05 });
    g.roundedBox('Rounded parked body', x, .65, z, 1.8, .62, 4.05, .14, color);
    g.roundedBox('Parked cabin glazing', x, 1.18, z + .1, 1.56, .52, 1.95, .16, '#425c65');
    g.roundedBox('Parked roof', x, 1.49, z + .1, 1.55, .1, 1.88, .04, color);
    for (const edge of [-1, 1]) {
      g.roundedBox('Parked headlight', x + edge * .62, .75, z - 2.025,
        .34, .13, .04, .018, '#e3ddbd');
      g.roundedBox('Parked rear light', x + edge * .62, .75, z + 2.025,
        .34, .13, .04, .018, '#9e5047');
      g.box('Parked window pillar', x + edge * .79, 1.2, z + .15, .035, .48, .075, color);
    }
    for (const wheelSide of [-1, 1]) for (const offset of [-1.24, 1.24]) {
      const tire = g.cylinder('Parked tire', x + wheelSide * .9, .43, z + offset, .32, .18, '#263137');
      tire.setRotationFromEuler(0, 0, 90);
      const rim = g.cylinder('Parked alloy wheel', x + wheelSide * 1.005, .43, z + offset,
        .21, .025, '#a2aeab');
      rim.setRotationFromEuler(0, 0, 90);
    }
  }
}
