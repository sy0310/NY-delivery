import { Node, Vec3, MeshRenderer, utils, primitives, Camera, RenderTexture, Color, SphereLight } from 'cc';
import { ModelGeometry, PaintedPanel } from './ModelGeometry';
import { planRoute } from './CityLayout';
import { LEGACY_DISTRICT } from './LegacyDistrict';
import { drawDistrictMap } from './DistrictMap';
import type { DistrictDefinition } from './DistrictDefinition';
import type { CityPoint } from './CityLayout';

export interface CarTelemetry {
  speed: number;
  steering: number;
  distance: number;
  x: number;
  z: number;
  yaw: number;
  destination: boolean;
  target: CityPoint;
  address: string;
}

/** Original sedan with a modeled cockpit, live instruments and a rear-view camera. */
export class CarModel {
  readonly node = new Node('Orchard delivery car');
  private interior = new Node('Cabin interior');
  private steering = new Node('Steering wheel');
  private instruments: PaintedPanel;
  private navigation: PaintedPanel;
  private rearCamera!: Camera;
  private rearTexture!: RenderTexture;
  private refresh = 0;
  private rearTick=0;
  private rearInterval=1/30;
  private wheelSpin = 0;
  private steeringAngle = 0;
  private wheels: { node: Node; front: boolean }[] = [];

  constructor(private geometry: ModelGeometry, private district: DistrictDefinition = LEGACY_DISTRICT) {
    geometry.root.addChild(this.node);
    this.node.addChild(this.interior);
    this.interior.setPosition(0, -.2, 0);
    this.body();
    this.cabin();
    this.dashboard();
    this.instruments = geometry.panel('Live instrument cluster', .52, .205, 640, 256, this.interior);
    this.instruments.node.setPosition(-.43, 1.315, -.78);
    this.navigation = geometry.panel('Live center navigation', .44, .30, 512, 352, this.interior);
    this.navigation.node.setPosition(.20, 1.35, -.87);
    this.rearView();
    geometry.batchStatic(this.steering);
    geometry.batchStatic(this.interior);
    geometry.batchStatic(this.node);
  }

  setQuality(quality:'low'|'standard'):void {
    this.rearInterval=quality==='low'?1/15:1/30;
    this.rearTexture.reset({width:quality==='low'?128:256,height:quality==='low'?48:96});
  }
  dispose():void {this.rearCamera.targetTexture=null;this.rearTexture.destroy();}

  private body(): void {
    const g = this.geometry;
    const paint = g.material('#527a83', .45, .3);
    g.roundedBox('Lower body shell', 0, .51, 0, 1.88, .18, 4.42, .075, paint, this.node);
    g.roundedBox('Front body section', 0, .83, -1.65, 1.88, .5, 1.15, .1, paint, this.node);
    g.roundedBox('Rear body section', 0, .83, 1.85, 1.88, .5, .73, .1, paint, this.node);
    g.roundedBox('Sculpted hood', 0, 1.035, -1.55, 1.79, .095, .96, .04, paint, this.node);
    g.roundedBox('Rear trunk lid', 0, 1.045, 1.76, 1.78, .07, .72, .03, paint, this.node);
    g.box('Front grille', 0, .67, -2.215, 1.16, .19, .025, '#1b242a', this.node);
    for (let x = -.48; x <= .5; x += .12) g.box('Grille bar', x, .67, -2.235, .018, .16, .012, '#91a2a4', this.node);
    g.box('Front bumper trim', 0, .46, -2.2, 1.62, .035, .05, '#8e9c9e', this.node);
    g.box('Rear bumper trim', 0, .47, 2.15, 1.65, .04, .06, '#38464d', this.node);
    for (const side of [-1, 1]) {
      g.box('Headlight housing', side * .69, .8, -2.18, .43, .19, .075, '#283b46', this.node);
      g.box('Headlight lens', side * .69, .82, -2.223, .34, .11, .02, '#f5efd4', this.node);
      g.box('Rear light', side * .68, .84, 2.18, .39, .13, .025, '#a44135', this.node);
      g.box('Door handle', side * .956, .98, .65, .025, .045, .19, '#b6bfc0', this.node);
      g.roundedBox('Painted outer door', side * .97, .85, .15, .08, .6, 2.5, .035, paint, this.node);
      g.box('Rocker trim', side * .957, .47, 0, .04, .075, 3.45, '#27383e', this.node);
      for (const z of [-1.38, 1.38]) this.wheel(side, z);
    }
  }

  private wheel(side: number, z: number): void {
    const g = this.geometry;
    const wheel = new Node('Suspended wheel');
    this.node.addChild(wheel);
    wheel.setPosition(side * .98, .44, z);
    this.wheels.push({ node: wheel, front: z < 0 });
    const tire = g.cylinder('Round tire', 0, 0, 0, .345, .22, '#20272b', wheel);
    tire.setRotationFromEuler(0, 0, 90);
    const rim = g.cylinder('Alloy rim recess', side * .12, 0, 0, .245, .022, '#41525a', wheel);
    rim.setRotationFromEuler(0, 0, 90);
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      g.beam('Alloy spoke', new Vec3(side * .136, Math.cos(angle) * .07, Math.sin(angle) * .07),
        new Vec3(side * .136, Math.cos(angle) * .215, Math.sin(angle) * .215), .018, '#b2b9b7', wheel);
    }
    const hub = g.cylinder('Wheel hub', side * .143, 0, 0, .065, .025, '#91a2a7', wheel);
    hub.setRotationFromEuler(0, 0, 90);
    g.batchStatic(wheel);
  }

  private cabin(): void {
    const g = this.geometry;
    const door = g.material('#344148', .02, .87, 'grain');
    const fabric = g.material('#5c6261', 0, .96, 'grain');
    const trim = g.material('#9b9e96', .7, .34, 'brushed');
    for (const side of [-1, 1]) {
      g.roundedBox('Door inner shell', side * .925, 1.02, .24, .09, .48, 2.15, .04, door, this.interior);
      g.roundedBox('Soft door armrest', side * .83, 1.13, .3, .18, .11, .66, .045, door, this.interior);
      g.roundedBox('Door brushed trim', side * .87, 1.28, .23, .026, .026, 1.68, .012, trim, this.interior);
      g.roundedBox('Inset door handle', side * .854, 1.23, -.22, .055, .06, .24, .025, trim, this.interior);
      for (const z of [.1, .21]) g.roundedBox('Window control', side * .82, 1.192, z,
        .065, .015, .065, .006, '#adb5ae', this.interior);
      g.beam('Slender windshield pillar', new Vec3(side * .91, 1.1, -1.1),
        new Vec3(side * .82, 2.03, -.59), .03, '#8b928b', this.interior);
      g.beam('Rear window pillar', new Vec3(side * .92, 1.05, 1.65),
        new Vec3(side * .82, 2.03, 1.19), .055, '#4b6870', this.interior);
      g.roundedBox('Sculpted seat cushion', side * .46, .86, .6, .67, .23, .71, .095, fabric, this.interior);
      const back = g.roundedBox('Contoured seat back', side * .46, 1.2, .94, .66, .73, .2, .085, fabric, this.interior);
      back.setRotationFromEuler(-9, 0, 0);
      g.roundedBox('Seat center insert', side * .46, 1.19, .82, .37, .54, .035, .017, '#767972', this.interior);
      for (const offset of [-.21, .21]) {
        g.beam('Seat piping', new Vec3(side * .46 + offset, .98, .32),
          new Vec3(side * .46 + offset, .98, .84), .004, '#a6a694', this.interior);
        g.beam('Headrest support', new Vec3(side * .46 + offset / 2, 1.53, .98),
          new Vec3(side * .46 + offset / 2, 1.68, .98), .012, '#a8b2b0', this.interior);
      }
      g.roundedBox('Seat headrest', side * .46, 1.72, .98, .39, .27, .16, .065, fabric, this.interior);
      g.roundedBox('Side mirror housing', side * 1.09, 1.38, -.85, .28, .18, .29, .065, '#263940', this.interior);
      g.box('Side mirror glass', side * 1.09, 1.4, -.69, .22, .12, .02, '#a2bdc6', this.interior);
      const window = g.mesh('Tinted side window', utils.createMesh(primitives.quad()), g.glassMaterial(true), this.interior);
      window.setPosition(side * .895, 1.675, .29);
      window.setScale(1.62, .7, 1);
      window.setRotationFromEuler(0, side * -90, 0);
      window.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
      g.roundedBox('Painted center pillar', side * .89, 1.665, .35, .075, .74, .095,
        .025, '#527a83', this.interior);
      g.roundedBox('Window rubber sill', side * .9, 1.325, .29, .05, .035, 1.76,
        .012, '#25383b', this.interior);
    }
    g.roundedBox('Soft headliner', 0, 2.045, .3, 1.76, .065, 1.85, .025, '#7f8988', this.interior);
    g.roundedBox('Painted roof', 0, 2.09, .3, 1.8, .1, 1.95, .045, '#527a83', this.interior);
    g.roundedBox('Rear seat', 0, 1.03, 1.55, 1.55, .45, .42, .12, fabric, this.interior);
    g.roundedBox('Rear seat back', 0, 1.38, 1.37, 1.5, .57, .17, .07, fabric, this.interior);
    g.box('Carpet', 0, .62, .23, 1.72, .05, 2.5, '#202a30', this.interior);
    const windshield = g.mesh('Laminated windshield', utils.createMesh(primitives.quad()), g.glassMaterial(), this.interior);
    windshield.setPosition(0, 1.67, -.825);
    windshield.setScale(1.64, .8, 1);
    windshield.setRotationFromEuler(25, 0, 0);
    windshield.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    const rearWindow = g.mesh('Rear windshield', utils.createMesh(primitives.quad()), g.glassMaterial(true), this.interior);
    rearWindow.setPosition(0, 1.665, 1.42);
    rearWindow.setScale(1.64, .86, 1);
    rearWindow.setRotationFromEuler(-32, 0, 0);
    rearWindow.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    const fill = new Node('Soft windshield light');
    this.interior.addChild(fill);
    fill.setPosition(0, 1.87, -.4);
    const light = fill.addComponent(SphereLight);
    light.color = new Color(194, 211, 218);
    light.range = 2.3;
    light.luminousFlux = 40;
  }

  private dashboard(): void {
    const g = this.geometry;
    const softTouch = g.material('#425058', .02, .84, 'grain');
    const leather = g.material('#35434a', 0, .8, 'grain');
    const satin = g.material('#a8aaa0', .75, .33, 'brushed');
    g.roundedBox('Curved padded dashboard', 0, 1.15, -.91, 1.77, .19, .46, .075, softTouch, this.interior);
    g.roundedBox('Contoured lower fascia', 0, 1.02, -.68, 1.76, .18, .19, .06, leather, this.interior);
    g.roundedBox('Satin dashboard edge', 0, 1.205, -.69, 1.75, .022, .025, .01, satin, this.interior);
    g.roundedBox('Instrument hood', -.43, 1.34, -.88, .64, .29, .17, .055, softTouch, this.interior);
    g.roundedBox('Instrument binnacle', -.43, 1.318, -.825, .60, .26, .075, .025, '#17252b', this.interior);
    g.roundedBox('Center screen surround', .20, 1.35, -.935, .52, .37, .1, .035, satin, this.interior);
    g.roundedBox('Center screen frame', .20, 1.35, -.91, .49, .345, .065, .025, '#101d23', this.interior);
    for (let x = -.8; x < .8; x += .022) {
      g.box('Dashboard stitching', x, 1.245, -.82, .009, .003, .006, '#a4a99b', this.interior);
    }
    for (const x of [-.79, .75]) {
      g.roundedBox('Air vent recess', x, 1.13, -.66, .19, .095, .025, .012, '#101c23', this.interior);
      for (let y = 1.1; y < 1.17; y += .019) g.box('Air vent slat', x, y, -.64, .17, .007, .012, '#6b7478', this.interior);
      g.roundedBox('Vent thumb slider', x, 1.13, -.623, .04, .026, .015, .006, satin, this.interior);
    }
    g.roundedBox('Padded center tunnel', .04, .86, .12, .3, .3, 1.1, .085, leather, this.interior);
    g.roundedBox('Gear selector boot', .04, 1.02, -.05, .16, .065, .18, .03, softTouch, this.interior);
    g.cylinder('Gear selector stalk', .04, 1.1, -.05, .024, .22, '#b6b7af', this.interior);
    g.sphere('Gear selector grip', .04, 1.22, -.05, .09, .1, .12, '#25323b', this.interior);
    for (const z of [.34, .58]) {
      g.cylinder('Cup holder', .04, 1.017, z, .07, .008, '#111c22', this.interior);
      const rim = g.mesh('Cup holder trim', utils.createMesh(primitives.torus(.074, .006,
        { radialSegments: 8, tubularSegments: 32 })), satin, this.interior);
      rim.setPosition(.04, 1.023, z);
    }
    g.roundedBox('Climate control panel', .34, .99, -.665, .54, .14, .08, .025, softTouch, this.interior);
    for (const x of [.19, .34, .49]) {
      const knob = g.cylinder('Climate control dial', x, .98, -.64, .043, .028, '#9caaa9', this.interior);
      knob.setRotationFromEuler(90, 0, 0);
      g.box('Dial indicator', x, 1.005, -.622, .008, .012, .008, '#e5cf95', this.interior);
    }
    const column = new Node('Tilted steering column');
    this.interior.addChild(column);
    column.setPosition(-.43, 1.11, -.6);
    column.setRotationFromEuler(67, 0, 0);
    column.addChild(this.steering);
    g.mesh('Leather steering rim', utils.createMesh(primitives.torus(.192, .022,
      { radialSegments: 20, tubularSegments: 64 })), leather, this.steering);
    g.roundedBox('Molded airbag hub', 0, 0, 0, .21, .075, .15, .035, leather, this.steering);
    for (const side of [-1, 1]) {
      g.roundedBox('Sculpted steering spoke', side * .135, 0, 0, .11, .035, .05, .015, satin, this.steering);
      g.roundedBox('Steering button pod', side * .096, .028, -.012, .063, .03, .055, .012, leather, this.steering);
      for (const z of [-.025, .004]) {
        g.roundedBox('Steering thumb button', side * .096, .047, z, .035, .008, .012,
          .004, '#a4afab', this.steering);
      }
    }
    g.roundedBox('Lower steering spoke', 0, 0, .115, .055, .03, .13, .012, satin, this.steering);
    g.roundedBox('Horn badge', 0, .041, 0, .038, .006, .025, .003, satin, this.steering);
  }

  private rearView(): void {
    const g = this.geometry;
    g.beam('Mirror stalk', new Vec3(0, 2.035, -.73), new Vec3(0, 1.96, -.73), .014, '#26343c', this.interior);
    g.roundedBox('Rear-view mirror frame', 0, 1.91, -.73, .39, .15, .035, .016, '#17262e', this.interior);
    const texture = new RenderTexture();
    texture.initialize({ width: 256, height: 96 });
    const mirror = g.panel('Real rear-view reflection', .35, .116, 256, 96, this.interior);
    mirror.node.setPosition(0, 1.912, -.705);
    const material = mirror.node.getComponent(MeshRenderer)!.getMaterialInstance(0)!;
    material.setProperty('mainTexture', texture);
    const cameraNode = new Node('Rear-view camera');
    this.interior.addChild(cameraNode);
    cameraNode.setPosition(0, 1.71, 1.58);
    cameraNode.setRotationFromEuler(0, 180, 0);
    const camera = cameraNode.addComponent(Camera);
    camera.targetTexture = texture;
    camera.priority = -10;
    camera.fov = 62;
    camera.near = .1;
    camera.far = 450;
    camera.clearColor = new Color(185, 210, 224);
    this.rearCamera = camera;
    this.rearTexture = texture;
  }

  update(dt: number, telemetry: CarTelemetry): void {
    // Creator's native preview redirects scene cameras when its panel opens or resizes.
    const camera = this.rearCamera.camera;
    if (camera && camera.window !== this.rearTexture.window) {
      camera.changeTargetWindow(this.rearTexture.window);
    }
    this.steeringAngle += (telemetry.steering * 90 - this.steeringAngle) * Math.min(1, dt * 12);
    this.steering.setRotationFromEuler(0, this.steeringAngle, 0);
    this.wheelSpin = (this.wheelSpin - telemetry.speed * dt / .345 * 180 / Math.PI) % 360;
    for (const wheel of this.wheels) {
      wheel.node.setRotationFromEuler(this.wheelSpin, wheel.front ? this.steeringAngle / 90 * 22 : 0, 0);
    }
    this.rearTick+=dt;this.rearCamera.enabled=this.rearTick>=this.rearInterval;
    if(this.rearCamera.enabled)this.rearTick=0;
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

  setDistrict(district: DistrictDefinition): void { this.district=district; }

  private drawNavigation(telemetry: CarTelemetry): void {
    const {context:c,texture,canvas}=this.navigation;
    const route=planRoute(telemetry,telemetry.target,this.district);
    drawDistrictMap(c,512,302,this.district,{player:telemetry,target:telemetry.target,route:route.points});
    c.fillStyle='#18363b';c.fillRect(0,302,512,50);
    c.fillStyle=route.reachable?'#f5e8cd':'#e6ac91';c.font='21px DM-Sans, NYDistrictSans, sans-serif';
    c.fillText(route.reachable?telemetry.address.toUpperCase():'No legal car route',22,334,468);
    texture.uploadData(canvas);
  }
}
