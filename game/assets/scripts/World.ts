import { Node, Material, Color, DirectionalLight, SphereLight, Vec3 } from 'cc';
import { ModelGeometry } from './ModelGeometry';
import { CarModel, CarTelemetry } from './CarModel';
import { OrderData } from './OrderState';

interface Obstacle { x: number; z: number; width: number; depth: number }

/** A detailed foreground street backed by several blocks of original city scenery. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly car: Node;
  readonly bag = new Node('Order bag');
  readonly npc = new Node('Waiting customer');
  private geometry: ModelGeometry;
  private sedan: CarModel;
  private facades = new Map<string, Material>();

  constructor(private root: Node, surface: Material, unlit: Material, private order: Readonly<OrderData>) {
    this.geometry = new ModelGeometry(root, surface, unlit);
    this.lighting();
    this.geometry.sky();
    this.street();
    this.city();
    this.restaurant();
    this.destination();
    this.streetFurniture();
    this.geometry.batchStatic();
    this.sedan = new CarModel(this.geometry);
    this.car = this.sedan.node;
    root.addChild(this.bag);
    this.geometry.box('Folded paper bag', 0, 0, 0, .34, .49, .24, '#bb8c52', this.bag);
    this.geometry.box('Folded bag top', 0, .26, 0, .35, .045, .25, '#c79b62', this.bag);
    const tag = this.geometry.panel('Shared order bag label', .27, .22, 256, 192, this.bag);
    tag.node.setPosition(0, .04, .126);
    tag.context.fillStyle = '#f2e7cd';
    tag.context.fillRect(0, 0, 256, 192);
    tag.context.fillStyle = '#25484a';
    tag.context.textAlign = 'center';
    tag.context.font = '22px DM-Sans';
    tag.context.fillText(order.id, 128, 48);
    tag.context.font = 'bold 48px DM-Sans';
    tag.context.fillText(order.code, 128, 117);
    tag.context.font = '18px DM-Sans';
    tag.context.fillText('SEALED · THANK YOU', 128, 160);
    tag.texture.uploadData(tag.canvas);
  }

  canMove = (x: number, z: number, radius: number): boolean => {
    if (Math.abs(x) > 32 || z > 150 || z < -150) return false;
    return this.obstacles.every(o => Math.abs(x - o.x) >= o.width / 2 + radius
      || Math.abs(z - o.z) >= o.depth / 2 + radius);
  };

  update(dt: number, telemetry: CarTelemetry): void { this.sedan.update(dt, telemetry); }

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
    // Fog is interpolated from vertices, so long road surfaces need local segments.
    for (let x = -375; x <= 375; x += 30) for (let z = -375; z <= 375; z += 30) {
      g.box('City ground', x, -.35, z, 30, .4, 30, '#9b9d93');
    }
    for (let z = -315; z <= 315; z += 10) {
      g.box('Continuous avenue asphalt', 0, -.07, z, 14, .15, 10, '#3a454d');
    }
    for (const junction of [-174, -94, -14, 66, 146, 226]) {
      for (let x = -290; x <= 290; x += 20) {
        g.box('Continuing cross street', x, -.055, junction, 20, .13, 12, '#3a454d');
      }
      for (const edge of [-1, 1]) {
        for (let x = -5.6; x < 7; x += 1.4) {
          g.box('Crossing stripe', x, .024, junction + edge * 7.2, .8, .018, 2.5, '#d4d2bc');
        }
        for (const side of [-1, 1]) g.box('Stop line', side * 3.5, .026,
          junction + edge * 9.2, 5.1, .019, .2, '#d4d2bc');
      }
    }
    const sidewalkSpans = [[-325, -180], [-168, -100], [-88, -20], [-8, 60], [72, 140], [152, 220], [232, 325]];
    for (const side of [-1, 1]) {
      for (const [from, to] of sidewalkSpans) {
        for (let z = from; z < to; z += 12) {
          const length = Math.min(12, to - z);
          g.box('Raised sidewalk', side * 8.55, .075, z + length / 2, 3.1, .25, length, '#b5b5a7');
          g.box('Curb stone', side * 7.05, .13, z + length / 2, .17, .29, length, '#d1cfba');
        }
        for (let z = from + 1.5; z < to; z += 3) {
          g.box('Sidewalk joint', side * 8.55, .207, z, 2.9, .008, .025, '#909b96');
        }
      }
    }
    for (let z = -310; z < 315; z += 5) {
      if (Math.abs(z + 14 - Math.round((z + 14) / 80) * 80) < 11) continue;
      for (const x of [-.12, .12]) g.box('Double yellow line', x, .018, z, .085, .012, 2.8, '#c8aa60');
    }
    for (const z of [-146, 146]) {
      this.wall('Roadworks boundary', 0, .48, z, 13.7, .8, .55, '#b6b6a5');
      for (let x = -6; x <= 6; x += 1.5) g.box('Boundary reflector', x, .73,
        z + (z < 0 ? .29 : -.29), .4, .17, .02, '#d59a4d');
      this.sign('LOCAL ACCESS · ROAD WORK', 0, 1.55, z, 5, z < 0 ? 0 : 180, '#8a6539');
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
    const g = this.geometry;
    const colors = ['#9b806b', '#a49b83', '#7f9295', '#997568', '#879391'];
    for (const side of [-1, 1]) {
      for (let index = 0; index < 33; index++) {
        const z = 250 - index * 16;
        if (Math.abs(z + 14 - Math.round((z + 14) / 80) * 80) < 11) continue;
        if (side < 0 && Math.abs(z) < 14) continue;
        if (side > 0 && z < -20 && z > -43) continue;
        const height = 13 + (index * 7 % 5) * 2.7;
        this.wall('Masonry avenue building', side * 17, height / 2, z, 14, height, 14.7,
          this.facade(colors[index % colors.length], index));
        g.box('Stone building base', side * 17, .8, z, 14.1, 1.6, 14.8, '#7e8883');
        g.box('Roof cornice', side * 17, height - .15, z, 14.5, .35, 15.1, '#bac0b1');
        g.box('Roof parapet', side * 10.1, height + .35, z, .2, .8, 14.5, '#78847f');
        if (Math.abs(z) < 65) {
          this.storefront(side, z, index);
          this.fireEscape(side, z, height);
          for (let row = 0; row < 7; row++) {
            const sillY = (681 - row * 93) / 768 * height;
            if (sillY < 4.2) continue;
            for (let column = 0; column < 5; column++) {
              const windowZ = z + (column - 2) * 2.87;
              g.box('Projecting window sill', side * 9.88, sillY, windowZ,
                .3, .11, 1.85, '#bdc0af');
            }
          }
        }
      }
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        for (let index = 0; index < 13; index++) {
          const x = side * (42 + row * 26);
          const z = 235 - index * 39 + (row % 2) * 12;
          const height = 21 + (index * 13 + row * 7) % 42;
          g.box('Distant skyline', x, height / 2, z, 20, height, 25,
            this.facade(colors[(index + row) % colors.length], row + index));
          g.box('Rooftop setback', x, height + 1.4, z, 13, 2.8, 17, '#7f9298');
        }
      }
    }
    for (const z of [-300, 300]) for (let index = -3; index <= 3; index++) {
      const height = 30 + Math.abs(index) * 6;
      g.box('Horizon frontage', index * 22, height / 2, z, 20, height, 24,
        this.facade(colors[(index + 5) % colors.length], index + 4));
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
    this.sign('PICKUP · THANK YOU', -18.77, 2.9, 0, 5);
    this.wall('Pickup counter base', -16.5, .6, 0, 1.2, 1.2, 7, '#4d6255');
    g.box('Stone countertop', -16.5, 1.25, 0, 1.5, .12, 7.3, '#d8c9aa');
    g.box('Counter brass trim', -15.71, 1.12, 0, .04, .035, 7.2, '#b5a16f');
    for (const z of [-3.5, 0, 3.5]) {
      g.beam('Pendant cable', new Vec3(-14, 4.05, z), new Vec3(-14, 3.15, z), .018, '#384241');
      g.cylinder('Lamp shade', -14, 3.12, z, .32, .16, '#57645b');
      g.cylinder('Warm diffuser', -14, 3.025, z, .26, .025, '#ead29b');
      const lamp = new Node('Warm restaurant light');
      this.root.addChild(lamp);
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
    this.person(-17.8, 0, '#b7a67e', this.root);
    this.root.addChild(this.npc);
    this.person(0, 0, '#6b8391', this.npc);
    this.npc.setPosition(-14.2, 0, .2);
    g.box('Queue mat', -12.8, .27, 0, 1.4, .02, 1.5, '#8b9c7c');
  }

  private person(x: number, z: number, color: string, parent: Node): void {
    const g = this.geometry;
    const person = new Node(parent === this.npc ? 'Customer figure' : 'Kitchen staff figure');
    parent.addChild(person);
    person.setPosition(x, 0, z);
    person.setRotationFromEuler(0, parent === this.npc ? -90 : 90, 0);
    const skin = '#bf9679';
    const fabric = g.material(color, 0, .87, 'grain');
    g.roundedBox('Tailored jacket', 0, 1.11, 0, .48, .62, .30, .095, fabric, person);
    g.sphere('Trouser hips', 0, .79, -.015, .43, .29, .29, '#35434a', person);
    g.cylinder('Neck', 0, 1.47, .015, .066, .14, skin, person);
    g.sphere('Face and jaw', 0, 1.66, .018, .285, .355, .275, skin, person);
    g.sphere('Continuous hair cap', 0, 1.755, -.02, .315, .27, .315, '#493f36', person);
    g.sphere('Nose', 0, 1.665, .158, .045, .065, .06, skin, person);
    g.roundedBox('Mouth', 0, 1.586, .151, .065, .012, .009, .004, '#875f4e', person);
    g.roundedBox('Shirt neckline', 0, 1.39, .147, .115, .09, .025, .012, '#e3dcc8', person);
    g.roundedBox('Jacket zip', 0, 1.10, .153, .012, .47, .012, .004, '#b4b7a2', person);
    g.roundedBox('Chest pocket', -.13, 1.24, .156, .10, .10, .015, .012, color, person);
    for (const side of [-1, 1]) {
      g.sphere('Ear', side * .145, 1.665, .006, .045, .075, .052, skin, person);
      g.sphere('Eye white', side * .062, 1.70, .142, .043, .022, .017, '#e8e1d0', person);
      g.sphere('Iris', side * .060, 1.70, .152, .016, .019, .008, '#344443', person);
      g.roundedBox('Eyebrow', side * .063, 1.733, .144, .048, .011, .01, .003, '#493f36', person);
      g.roundedBox('Trouser leg', side * .115, .45, -.015, .185, .65, .21, .065, '#35434a', person);
      g.roundedBox('Shoe sole', side * .115, .065, .041, .20, .055, .32, .022, '#202e32', person);
      g.roundedBox('Leather shoe', side * .115, .115, .05, .19, .10, .30, .04, '#39433e', person);
      const sleeve = g.roundedBox('Jacket sleeve', side * .285, 1.15, .004, .16, .42, .19, .065, fabric, person);
      sleeve.setRotationFromEuler(0, 0, side * 8);
      g.roundedBox('Jacket cuff', side * .304, .923, .025, .145, .055, .16, .02, '#52615b', person);
      g.sphere('Hand', side * .304, .85, .04, .108, .15, .105, skin, person);
    }
    this.geometry.batchStatic(person);
  }

  private destination(): void {
    const g = this.geometry;
    this.wall('Delivery apartment', 17, 8.5, -31, 14, 17, 16, this.facade('#9c806a', 4));
    g.box('Apartment stone base', 17, .65, -31, 14.1, 1.3, 16.1, '#83918a');
    g.box('Apartment cornice', 17, 17, -31, 14.6, .4, 16.6, '#b8b8a4');
    g.box('Door surround', 9.84, 1.55, -30, .3, 3.1, 2.65, '#c9bea1');
    g.box('Green door', 9.62, 1.42, -30, .1, 2.8, 1.8, '#2a4b47');
    for (const z of [-30.45, -29.55]) g.box('Door inset', 9.55, 1.2, z, .045, 1.7, .56, '#345e53');
    g.sphere('Brass handle', 9.5, 1.25, -29.45, .08, .08, .08, '#bbab7a');
    g.box('Door canopy', 9.31, 3.15, -30, 1.4, .12, 2.8, '#3d5650');
    this.sign('18 ORCHARD WALK', 8.59, 3.19, -30, 2.6, -90);
  }

  private streetFurniture(): void {
    const g = this.geometry;
    for (const z of [-67, -45, -27, -4, 19, 43, 85]) {
      for (const side of [-1, 1]) {
        g.cylinder('Street lamp post', side * 7.75, 2.8, z, .055, 5.6, '#3e5154');
        g.beam('Lamp arm', new Vec3(side * 7.75, 5.5, z), new Vec3(side * 6.9, 5.35, z), .05, '#3e5154');
        g.box('Lamp housing', side * 6.85, 5.32, z, .65, .1, .3, '#495a5a');
        g.box('Lamp diffuser', side * 6.85, 5.25, z, .5, .025, .22, '#d9d4ad');
        const treeZ = z === -4 ? -6.5 : z + 3.5;
        this.wall('Tree planting bed', side * 8.65, .27, treeZ, 1.2, .2, 1.25, '#7d8c7b');
        g.cylinder('Tree trunk', side * 8.65, 1.7, treeZ, .12, 2.7, '#706450');
        g.sphere('Foliage crown', side * 8.65, 3.55, treeZ, 2.3, 2.75, 2.25, '#677e57');
        g.sphere('Foliage side', side * 8.35, 3.7, treeZ + .4, 1.7, 2.1, 1.7, '#7e9065');
      }
    }
    for (const [side, z] of [[1, 20], [-1, 11], [1, -44], [-1, -48]]) this.parkedCar(side, z);
    for (const side of [-1, 1]) {
      const z = side < 0 ? -6.5 : -21.5;
      g.cylinder('Signal pole', side * 7.6, 2.1, z, .065, 4.2, '#526260');
      g.box('Signal housing', side * 7.6, 3.85, z, .32, .9, .22, '#24343a');
      for (let index = 0; index < 3; index++) {
        const lens = g.cylinder('Signal lens', side * 7.6, 4.11 - index * .27, z + side * .13,
          .095, .025, index === 2 ? '#87ad7b' : '#394b4a');
        lens.setRotationFromEuler(90, 0, 0);
      }
      this.sign('ORCHARD AVE', side * 7.6, 3.1, z, 2.6, side < 0 ? 0 : 180);
    }
    for (const z of [10, -24]) {
      g.cylinder('Litter bin', 8.4, .65, z, .28, .9, '#42615b');
      g.cylinder('Bin lid', 8.4, 1.13, z, .31, .07, '#294b46');
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
