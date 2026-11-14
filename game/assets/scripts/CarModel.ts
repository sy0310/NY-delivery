import { Node, Vec3, MeshRenderer, utils, primitives, Camera, RenderTexture, Color } from 'cc';
import { ModelGeometry, PaintedPanel } from './ModelGeometry';

export interface CarTelemetry {
  speed: number;
  steering: number;
  distance: number;
  x: number;
  z: number;
  yaw: number;
  destination: boolean;
}

/** Original sedan with a modeled cockpit, live instruments and a rear-view camera. */
export class CarModel {
  readonly node = new Node('Orchard delivery sedan');
  private steering = new Node('Steering wheel');
  private instruments: PaintedPanel;
  private navigation: PaintedPanel;
  private refresh = 0;

  constructor(private geometry: ModelGeometry) {
    geometry.root.addChild(this.node);
    this.body();
    this.cabin();
    this.dashboard();
    this.instruments = geometry.panel('Live instrument cluster', .59, .235, 640, 256, this.node);
    this.instruments.node.setPosition(-.43, 1.315, -.655);
    this.navigation = geometry.panel('Live center navigation', .51, .345, 512, 352, this.node);
    this.navigation.node.setPosition(.34, 1.28, -.645);
    this.rearView();
  }

  private body(): void {
    const g = this.geometry;
    const profile = [
      [-2.22, .45], [-2.2, .82], [-1.94, 1.01], [-.85, 1.1],
      [.96, 1.1], [2.02, .97], [2.2, .77], [2.12, .43],
    ];
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const face = (points: Vec3[]): void => {
      const base = positions.length / 3;
      const normal = Vec3.cross(new Vec3(), Vec3.subtract(new Vec3(), points[1], points[0]),
        Vec3.subtract(new Vec3(), points[2], points[0])).normalize();
      points.forEach((point, index) => {
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(index % 2, index < 2 ? 0 : 1);
      });
      for (let index = 1; index < points.length - 1; index++) indices.push(base, base + index, base + index + 1);
    };
    for (let index = 0; index < profile.length; index++) {
      const a = profile[index];
      const b = profile[(index + 1) % profile.length];
      face([new Vec3(-.94, a[1], a[0]), new Vec3(.94, a[1], a[0]),
        new Vec3(.94, b[1], b[0]), new Vec3(-.94, b[1], b[0])]);
    }
    face(profile.map(([z, y]) => new Vec3(-.94, y, z)).reverse());
    face(profile.map(([z, y]) => new Vec3(.94, y, z)));
    g.mesh('Sculpted sedan body', utils.createMesh({ positions, normals, indices, uvs }),
      g.material('#436773', .35, .36), this.node);
    g.box('Hood panel', 0, 1.014, -1.55, 1.76, .035, .93, '#527a83', this.node);
    g.box('Front grille', 0, .67, -2.215, 1.16, .19, .025, '#1b242a', this.node);
    for (let x = -.48; x <= .5; x += .12) g.box('Grille bar', x, .67, -2.235, .018, .16, .012, '#91a2a4', this.node);
    g.box('Front bumper trim', 0, .46, -2.2, 1.62, .035, .05, '#8e9c9e', this.node);
    g.box('Rear bumper trim', 0, .47, 2.15, 1.65, .04, .06, '#38464d', this.node);
    for (const side of [-1, 1]) {
      g.box('Headlight housing', side * .69, .8, -2.18, .43, .19, .075, '#283b46', this.node);
      g.box('Headlight lens', side * .69, .82, -2.223, .34, .11, .02, '#f5efd4', this.node);
      g.box('Rear light', side * .68, .84, 2.18, .39, .13, .025, '#a44135', this.node);
      g.box('Door handle', side * .956, .98, .65, .025, .045, .19, '#b6bfc0', this.node);
      g.box('Rocker trim', side * .957, .47, 0, .04, .075, 3.45, '#27383e', this.node);
      for (const z of [-1.38, 1.38]) {
        const tire = g.cylinder('Rounded tire', side * .96, .44, z, .345, .22, '#20272b', this.node);
        tire.setRotationFromEuler(0, 0, 90);
        const rim = g.cylinder('Alloy wheel', side * 1.085, .44, z, .23, .023, '#91a2a7', this.node);
        rim.setRotationFromEuler(0, 0, 90);
        const hub = g.cylinder('Wheel hub', side * 1.104, .44, z, .08, .03, '#34434b', this.node);
        hub.setRotationFromEuler(0, 0, 90);
      }
    }
  }

  private cabin(): void {
    const g = this.geometry;
    for (const side of [-1, 1]) {
      g.box('Door inner shell', side * .925, 1.02, .24, .09, .48, 2.15, '#263239', this.node);
      g.box('Door armrest', side * .83, 1.13, .3, .18, .11, .66, '#39434a', this.node);
      g.box('Door brushed trim', side * .87, 1.28, .23, .026, .026, 1.68, '#9b998d', this.node);
      g.beam('Slender windshield pillar', new Vec3(side * .91, 1.1, -1.1),
        new Vec3(side * .82, 2.18, -.59), .035, '#c2bdb0', this.node);
      g.beam('Rear window pillar', new Vec3(side * .92, 1.05, 1.65),
        new Vec3(side * .82, 2.18, 1.19), .055, '#4b6870', this.node);
      g.box('Seat cushion', side * .46, .86, .6, .67, .23, .71, '#45494a', this.node);
      const back = g.box('Contoured seat back', side * .46, 1.2, .94, .66, .73, .2, '#3c4348', this.node);
      back.setRotationFromEuler(-9, 0, 0);
      g.box('Seat center insert', side * .46, 1.19, .82, .37, .54, .035, '#68655f', this.node);
      g.box('Seat headrest', side * .46, 1.72, .98, .39, .27, .16, '#3a4246', this.node);
      g.box('Side mirror housing', side * 1.09, 1.38, -.85, .28, .18, .29, '#263940', this.node);
      g.box('Side mirror glass', side * 1.09, 1.4, -.69, .22, .12, .02, '#a2bdc6', this.node);
    }
    g.box('Slim headliner', 0, 2.23, .3, 1.76, .09, 1.85, '#c7c2b5', this.node);
    g.box('Rear seat', 0, 1.03, 1.55, 1.55, .45, .42, '#3a4246', this.node);
    g.box('Carpet', 0, .62, .23, 1.72, .05, 2.5, '#202a30', this.node);
  }

  private dashboard(): void {
    const g = this.geometry;
    g.box('Upper dashboard', 0, 1.15, -.91, 1.77, .19, .39, '#263038', this.node);
    g.box('Dashboard lower fascia', 0, 1.02, -.68, 1.76, .18, .17, '#353c40', this.node);
    g.box('Satin dashboard edge', 0, 1.205, -.69, 1.75, .022, .025, '#a49982', this.node);
    g.box('Instrument binnacle', -.43, 1.318, -.7, .67, .29, .075, '#17252b', this.node);
    g.box('Center screen frame', .34, 1.28, -.685, .56, .39, .065, '#101d23', this.node);
    for (const x of [-.79, .75]) {
      g.box('Air vent recess', x, 1.13, -.66, .19, .095, .025, '#101c23', this.node);
      for (let y = 1.1; y < 1.17; y += .019) g.box('Air vent slat', x, y, -.64, .17, .007, .012, '#6b7478', this.node);
    }
    g.box('Center tunnel', .04, .86, .12, .3, .3, 1.1, '#27333a', this.node);
    g.cylinder('Gear selector stalk', .04, 1.1, -.05, .024, .22, '#b6b7af', this.node);
    g.sphere('Gear selector grip', .04, 1.22, -.05, .09, .1, .12, '#25323b', this.node);
    for (const z of [.34, .58]) g.cylinder('Cup holder', .04, 1.017, z, .07, .008, '#111c22', this.node);
    for (const x of [.19, .34, .49]) {
      const knob = g.cylinder('Climate control dial', x, .98, -.64, .043, .028, '#9caaa9', this.node);
      knob.setRotationFromEuler(90, 0, 0);
    }
    this.node.addChild(this.steering);
    this.steering.setPosition(-.43, 1.11, -.46);
    this.steering.setRotationFromEuler(67, 0, 0);
    g.mesh('Leather steering rim', utils.createMesh(primitives.torus(.192, .022,
      { radialSegments: 12, tubularSegments: 40 })), g.material('#202b33', .05, .72), this.steering);
    g.box('Steering center', 0, 0, 0, .23, .065, .15, '#293740', this.steering);
    for (const side of [-1, 1]) g.box('Steering spoke', side * .135, 0, 0, .11, .035, .05, '#a3a8a2', this.steering);
    g.box('Lower steering spoke', 0, 0, .115, .055, .03, .13, '#8e9899', this.steering);
    g.box('Horn badge', 0, -.039, 0, .055, .006, .025, '#d5c4a1', this.steering);
  }

  private rearView(): void {
    const g = this.geometry;
    g.beam('Mirror stalk', new Vec3(0, 2.02, -.73), new Vec3(0, 1.96, -.73), .014, '#26343c', this.node);
    g.box('Rear-view mirror frame', 0, 1.91, -.73, .39, .15, .035, '#17262e', this.node);
    const texture = new RenderTexture();
    texture.initialize({ width: 256, height: 96 });
    const mirror = g.panel('Real rear-view reflection', .35, .116, 256, 96, this.node);
    mirror.node.setPosition(0, 1.912, -.705);
    const material = mirror.node.getComponent(MeshRenderer)!.getMaterialInstance(0)!;
    material.setProperty('mainTexture', texture);
    const cameraNode = new Node('Rear-view camera');
    this.node.addChild(cameraNode);
    cameraNode.setPosition(0, 1.71, 1.58);
    cameraNode.setRotationFromEuler(0, 180, 0);
    const camera = cameraNode.addComponent(Camera);
    camera.targetTexture = texture;
    camera.priority = -10;
    camera.fov = 62;
    camera.near = .1;
    camera.far = 450;
    camera.clearColor = new Color(185, 210, 224);
  }

  update(dt: number, telemetry: CarTelemetry): void {
    this.steering.setRotationFromEuler(67, telemetry.steering * 28, 0);
    this.refresh += dt;
    if (this.refresh < .12) return;
    this.refresh = 0;
    this.drawInstruments(telemetry);
    this.drawNavigation(telemetry);
  }

  private drawInstruments(telemetry: CarTelemetry): void {
    const { context: c, texture, canvas } = this.instruments;
    c.fillStyle = '#102329';
    c.fillRect(0, 0, 640, 256);
    c.strokeStyle = '#728d8e';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(150, 153, 99, Math.PI * .8, Math.PI * 2.2);
    c.stroke();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let mph = 0; mph <= 80; mph += 10) {
      const angle = Math.PI * (.8 + mph / 80 * 1.4);
      const x = 150 + Math.cos(angle) * 78;
      const y = 153 + Math.sin(angle) * 78;
      c.fillStyle = '#c7d5ca';
      c.font = '17px DM-Sans';
      c.fillText(String(mph), x, y);
    }
    const mph = Math.abs(telemetry.speed) * 2.23694;
    const angle = Math.PI * (.8 + Math.min(80, mph) / 80 * 1.4);
    c.strokeStyle = '#f1b66e';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(150, 153);
    c.lineTo(150 + Math.cos(angle) * 72, 153 + Math.sin(angle) * 72);
    c.stroke();
    c.fillStyle = '#f0e6d0';
    c.font = 'bold 94px DM-Sans';
    c.fillText(String(Math.round(mph)), 373, 124);
    c.font = '23px DM-Sans';
    c.fillText('mph', 373, 191);
    c.font = 'bold 45px DM-Sans';
    c.fillStyle = '#e3ba79';
    c.fillText(Math.abs(telemetry.speed) < .1 ? 'P' : telemetry.speed < 0 ? 'R' : 'D', 558, 115);
    c.font = '18px DM-Sans';
    c.fillStyle = '#9fb9b8';
    c.fillText((telemetry.distance / 1609.34).toFixed(2) + ' mi', 550, 188);
    texture.uploadData(canvas);
  }

  private drawNavigation(telemetry: CarTelemetry): void {
    const { context: c, texture, canvas } = this.navigation;
    c.fillStyle = '#d9e1d0';
    c.fillRect(0, 0, 512, 352);
    const mapX = (x: number) => 256 + x * 10;
    const mapY = (z: number) => 174 + (z + 5) * 3.1;
    c.fillStyle = '#bdc9ba';
    for (const x of [40, 326]) for (const y of [60, 240]) c.fillRect(x, y, 145, 71);
    c.fillStyle = '#f0f0dc';
    c.fillRect(218, 0, 76, 352);
    c.fillRect(0, mapY(-14) - 18, 512, 36);
    c.strokeStyle = '#42766e';
    c.lineWidth = 12;
    c.lineJoin = 'round';
    const targetX = telemetry.destination ? 9.4 : -10;
    const targetZ = telemetry.destination ? -30 : 0;
    c.beginPath();
    c.moveTo(mapX(telemetry.x), mapY(telemetry.z));
    c.lineTo(mapX(telemetry.x), mapY(targetZ));
    c.lineTo(mapX(targetX), mapY(targetZ));
    c.stroke();
    c.fillStyle = '#b17c3f';
    c.beginPath(); c.arc(mapX(targetX), mapY(targetZ), 11, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(mapX(telemetry.x), mapY(telemetry.z));
    c.rotate(-telemetry.yaw);
    c.fillStyle = '#1c4e51';
    c.beginPath(); c.moveTo(0, -17); c.lineTo(12, 13); c.lineTo(0, 8); c.lineTo(-12, 13); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#26484b';
    c.font = '18px DM-Sans';
    c.fillText('ORCHARD AVE', 313, 95);
    c.fillStyle = '#18363b';
    c.fillRect(0, 302, 512, 50);
    c.fillStyle = '#f5e8cd';
    c.font = '21px DM-Sans';
    c.fillText(telemetry.destination ? '18 ORCHARD WALK' : 'JUNIPER KITCHEN', 22, 334);
    texture.uploadData(canvas);
  }
}
