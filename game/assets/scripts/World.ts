import {
  Node, Material, MeshRenderer, utils, primitives, Color, DirectionalLight,
  Vec3, ImageAsset, Texture2D,
} from 'cc';

interface Obstacle { x: number; z: number; width: number; depth: number }

/** Original low-poly geometry, constructed by Cocos in the running scene. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly car = new Node('Delivery sedan');
  readonly bag = new Node('Order bag');
  readonly npc = new Node('Waiting customer');
  private materials = new Map<string, Material>();

  constructor(private root: Node, private surfaceMaterial: Material, private signMaterial: Material) {
    const sun = new Node('Evening sun');
    root.addChild(sun);
    sun.setRotationFromEuler(-35, -28, 0);
    const light = sun.addComponent(DirectionalLight);
    light.color = new Color(255, 209, 154);
    light.illuminance = 48000;
    this.street();
    this.restaurant();
    this.destination();
    this.sedan();
    root.addChild(this.bag);
    this.box('Paper bag', 0, 0, 0, .38, .55, .25, '#c9965a', this.bag);
    this.box('Bag label', 0, .08, .13, .28, .22, .015, '#f4e4ba', this.bag);
    this.bag.setPosition(-15.5, 1.5, -.6);
  }

  canMove = (x: number, z: number, radius: number): boolean => {
    if (Math.abs(x) > 32 || z > 38 || z < -44) return false;
    return this.obstacles.every(o => Math.abs(x - o.x) >= o.width / 2 + radius
      || Math.abs(z - o.z) >= o.depth / 2 + radius);
  };

  private material(hex: string): Material {
    let material = this.materials.get(hex);
    if (!material) {
      material = new Material();
      material.copy(this.surfaceMaterial);
      material.setProperty('mainColor', new Color().fromHEX(hex));
      material.setProperty('roughness', .95);
      this.materials.set(hex, material);
    }
    return material;
  }

  box(name: string, x: number, y: number, z: number, w: number, h: number, d: number,
    color: string, parent: Node = this.root, obstacle = false): Node {
    const node = new Node(name);
    parent.addChild(node);
    node.setPosition(x, y, z);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = utils.createMesh(primitives.box({ width: w, height: h, length: d }));
    renderer.setMaterial(this.material(color), 0);
    if (obstacle) this.obstacles.push({ x, z, width: w, depth: d });
    return node;
  }

  private sign(text: string, x: number, y: number, z: number, width: number, yaw = 90): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const context = canvas.getContext('2d')!;
    context.translate(0, canvas.height);
    context.scale(1, -1);
    context.fillStyle = '#183c3b';
    context.fillRect(0, 0, 1024, 192);
    context.strokeStyle = '#d4b978';
    context.lineWidth = 7;
    context.strokeRect(12, 12, 1000, 168);
    context.fillStyle = '#ffe4a3';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '82px InstrumentSerif';
    context.fillText(text, 512, 102, 950);
    const texture = new Texture2D();
    texture.image = new ImageAsset(canvas);
    const material = new Material();
    material.copy(this.signMaterial);
    material.setProperty('mainTexture', texture);
    const node = new Node(text);
    this.root.addChild(node);
    node.setPosition(x, y, z);
    node.setRotationFromEuler(0, yaw, 0);
    node.setScale(width, width * .1875, 1);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = utils.createMesh(primitives.quad());
    renderer.setMaterial(material, 0);
  }

  private street(): void {
    this.box('Ground', 0, -.22, 0, 70, .3, 100, '#54565d');
    this.box('Orchard Avenue', 0, -.03, -2, 14, .1, 82, '#343c49');
    this.box('Cross street', 0, -.02, -14, 66, .1, 11, '#343c49');
    for (const side of [-1, 1]) {
      this.box('Sidewalk', side * 8.5, .08, -2, 3, .26, 82, '#b6aaa0');
      for (let z = -40; z < 38; z += 3) {
        if (z > -21 && z < -7) continue;
        this.box('Curb', side * 7, .18, z, .15, .32, 2.94, '#d9cbb6');
      }
    }
    for (let z = -38; z <= 33; z += 5) {
      if (z > -21 && z < -7) continue;
      this.box('Lane stripe', 0, .035, z, .14, .02, 2.6, '#e6bb60');
    }
    for (let x = -5.5; x < 7; x += 1.5) {
      this.box('Crosswalk', x, .045, -6.2, .85, .02, 2.6, '#e2d5ba');
    }
    const palette = ['#8c6358', '#6e7774', '#b3866e', '#786c75'];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const z = 30 - i * 13;
        if (side < 0 && Math.abs(z) < 12) continue;
        if (side > 0 && z < -22) continue;
        const height = 11 + i % 3 * 3;
        this.box('Brick walkup', side * 17, height / 2, z, 14, height, 11,
          palette[i % palette.length], this.root, true);
        this.box('Cornice', side * 17, height, z, 14.5, .45, 11.5, '#393e45');
        for (let floor = 3; floor < height - 1; floor += 2.7) {
          for (const dz of [-3.5, 0, 3.5]) {
            this.box('Window recess', side * 9.94, floor, z + dz, .08, 1.65, 1.25, '#263c4b');
            this.box('Warm window', side * 9.87, floor, z + dz, .04, 1.28, .94,
              (i + floor + dz) % 3 > 0 ? '#e6b77c' : '#596b7b');
          }
        }
      }
    }
    for (const z of [19, -4, -27]) {
      for (const side of [-1, 1]) {
        this.box('Street lamp pole', side * 8, 2.7, z, .13, 5.4, .13, '#34434b');
        this.box('Lamp glow', side * 8, 5.4, z, .55, .22, .55, '#ffe4a5');
        this.box('Planter', side * 8.7, .45, z + 3, 1.2, .8, 1.2, '#736c62', this.root, true);
        this.box('Tree trunk', side * 8.7, 1.5, z + 3, .22, 2, .22, '#70564b');
        this.box('Tree crown', side * 8.7, 3, z + 3, 2.1, 2.3, 2.1, '#737b53');
      }
    }
    this.sign('ORCHARD AVE', 7.5, 3.1, -6.5, 2.8, 0);
    this.sign('JUNIPER  ←', -6.8, 1.2, 4.4, 2.8, 0);
  }

  private restaurant(): void {
    this.box('Restaurant floor', -14.5, .12, 0, 9, .25, 12, '#b7936e');
    this.box('Back wall', -19, 2, 0, .35, 4, 12, '#9d6d54', this.root, true);
    for (const z of [-6, 6]) this.box('Side wall', -14.5, 2, z, 9, 4, .3, '#a67a60', this.root, true);
    for (const z of [-4, 4]) this.box('Storefront', -10, 1.7, z, .3, 3.4, 4, '#426662', this.root, true);
    this.box('Door lintel', -10, 3.45, 0, .4, .75, 12, '#243f41');
    this.sign('JUNIPER KITCHEN', -9.73, 3.5, 0, 9);
    this.sign('PICKUP • THANK YOU', -18.78, 2.6, 0, 5);
    this.box('Counter', -16.5, .6, 0, 1.2, 1.2, 7, '#354f4b', this.root, true);
    this.box('Countertop', -16.5, 1.25, 0, 1.5, .16, 7.3, '#dec6a1');
    for (const z of [-3.5, 0, 3.5]) {
      this.box('Pendant stem', -14, 3.5, z, .05, .6, .05, '#303d43');
      this.box('Warm pendant', -14, 3.2, z, .7, .16, .7, '#ffdc8b');
    }
    this.person('Clerk', -17.8, 0, '#d6aa69', this.root);
    this.root.addChild(this.npc);
    this.person('Queue customer', 0, 0, '#8797a5', this.npc);
    this.npc.setPosition(-14.2, 0, .2);
    this.box('Queue mat', -12.8, .27, 0, 1.4, .02, 1.5, '#d6b872');
  }

  private person(name: string, x: number, z: number, color: string, parent: Node): void {
    this.box(name + ' torso', x, 1, z, .5, .75, .32, color, parent);
    this.box(name + ' head', x, 1.62, z, .34, .36, .32, '#d4a07f', parent);
    for (const offset of [-.15, .15]) this.box('Leg', x + offset, .4, z, .15, .65, .2, '#3b454d', parent);
  }

  private destination(): void {
    this.box('Delivery building', 17, 5.5, -31, 14, 11, 16, '#88675e', this.root, true);
    this.box('Door frame', 9.83, 1.6, -30, .25, 3.2, 2.6, '#e2c59f');
    this.box('Apartment door', 9.65, 1.4, -30, .12, 2.8, 1.8, '#244e51');
    this.box('Door light', 9.5, 3.2, -30, .4, .15, .6, '#ffe5a5');
    this.sign('18 ORCHARD WALK', 9.47, 3.65, -30, 5, -90);
  }

  private sedan(): void {
    this.root.addChild(this.car);
    this.box('Body', 0, .62, 0, 1.9, .65, 4.2, '#658b89', this.car);
    this.box('Hood', 0, .98, -1.45, 1.86, .15, 1.2, '#6c9692', this.car);
    this.box('Dashboard', 0, 1.12, -.72, 1.82, .28, .48, '#253b41', this.car);
    this.box('Dashboard trim', 0, 1.27, -.9, 1.84, .045, .08, '#bd9265', this.car);
    for (const side of [-1, 1]) {
      this.box('Door panel', side * .93, 1.05, .1, .09, .5, 2.4, '#30484b', this.car);
      this.box('Windshield pillar', side * .86, 1.6, -.85, .09, .85, .09, '#32595a', this.car);
      this.box('Rear pillar', side * .86, 1.6, 1.05, .12, .9, .12, '#32595a', this.car);
      this.box('Mirror', side * 1.08, 1.4, -.75, .25, .15, .22, '#bcc9c5', this.car);
      this.box('Seat', side * .45, .95, .4, .65, .3, .65, '#b18a67', this.car);
      this.box('Seat back', side * .45, 1.3, .74, .65, .65, .16, '#a37c5f', this.car);
      for (const z of [-1.3, 1.3]) this.box('Tire', side * .98, .4, z, .22, .7, .7, '#202c36', this.car);
      this.box('Headlight', side * .6, .78, -2.12, .43, .21, .02, '#ffe9bc', this.car);
    }
    this.box('Roof', 0, 2.04, .1, 1.85, .12, 2.3, '#32595a', this.car);
    this.box('Center console', 0, 1.05, .3, .25, .4, .8, '#30484b', this.car);
    this.box('Steering column', -.43, 1.28, -.44, .09, .09, .4, '#283a40', this.car);
    const wheel = new Node('Steering wheel');
    this.car.addChild(wheel);
    wheel.setPosition(-.43, 1.39, -.28);
    wheel.setRotationFromEuler(64, 0, 0);
    const renderer = wheel.addComponent(MeshRenderer);
    renderer.mesh = utils.createMesh(primitives.torus(.21, .025, { radialSegments: 12, tubularSegments: 20 }));
    renderer.setMaterial(this.material('#23343b'), 0);
  }
}
