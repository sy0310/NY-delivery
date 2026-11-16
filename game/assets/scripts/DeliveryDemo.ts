import {
  _decorator, Component, Node, Camera, Color, Vec3, Vec4, resources,
  AudioClip, Material, Font, profiler, game, input, Input, EventKeyboard, KeyCode, director,
} from 'cc';
import { EDITOR } from 'cc/env';
import { OrderState } from './OrderState';
import { VehicleController, MAX_ROAD_WHEEL_ANGLE } from './VehicleController';
import { WalkingController } from './WalkingController';
import { TouchControls } from './TouchControls';
import { World } from './World';
import { resolveInteraction, directionTo } from './Interaction';
import type { Interaction } from './Interaction';
import { MusicPlayer } from './MusicPlayer';
import { MusicPanel } from './MusicPanel';
import { planRoute } from './CityLayout';
import { routeWalking } from './WalkingRoute';
import { FLUSHING_DISTRICT } from './FlushingDistrict';
import { CHINATOWN_DISTRICT } from './ChinatownDistrict';
import type { DistrictDefinition } from './DistrictDefinition';
import { createDistrictOrder, canSwitchDistrict } from './DistrictOrders';
import { drawDistrictMap, navigationStep } from './DistrictMap';
import { OrderTiming } from './OrderTiming';
import { PerformanceRun } from './PerformanceRun';
import { VEHICLE_LAYER } from './QualityPreset';

const { ccclass, property } = _decorator;
const DEG = 180 / Math.PI;
const DRIVER_EYE = new Vec3(-.43, 1.48, .10);
const FORWARD_KEYS = EDITOR ? ['KeyW'] : ['KeyW', 'ArrowUp'];
const BACKWARD_KEYS = EDITOR ? ['KeyS'] : ['KeyS', 'ArrowDown'];
const LEFT_KEYS = EDITOR ? ['KeyA'] : ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = EDITOR ? ['KeyD'] : ['KeyD', 'ArrowRight'];
const LOOK_HINT = EDITOR ? '方向键调整视角' : '拖动空白处转视角';
const KEY_BINDINGS: Partial<Record<KeyCode, string>> = {
  [KeyCode.KEY_W]: 'KeyW',
  [KeyCode.KEY_S]: 'KeyS',
  [KeyCode.KEY_A]: 'KeyA',
  [KeyCode.KEY_D]: 'KeyD',
  [KeyCode.KEY_E]: 'KeyE',
  [KeyCode.KEY_M]: 'KeyM',
  [KeyCode.SPACE]: 'Space',
  [KeyCode.ARROW_UP]: 'ArrowUp',
  [KeyCode.ARROW_DOWN]: 'ArrowDown',
  [KeyCode.ARROW_LEFT]: 'ArrowLeft',
  [KeyCode.ARROW_RIGHT]: 'ArrowRight',
  [KeyCode.F3]: 'F3',
};

@ccclass('DeliveryDemo')
export class DeliveryDemo extends Component {
  @property(Material) surfaceMaterial: Material = null!;
  @property(Material) signMaterial: Material = null!;
  private district = FLUSHING_DISTRICT;
  private order = new OrderState(createDistrictOrder(this.district,0));
  private orderSequence = 0;
  private areaSequence=0;
  private loading=false;
  private sceneReady=false;
  private quality: 'low'|'standard'='standard';
  private swaps=0;
  private completedRuns:object[]=[];
  private switchEvents:object[]=[];
  private timing = new OrderTiming();
  private orderStartDistance = 0;
  private working = true;
  private paused = false;
  private vehicle = new VehicleController();
  private walker = new WalkingController();
  private world!: World;
  private music!: MusicPlayer;
  private musicPanel!: MusicPanel;
  private camera!: Node;
  private hud!: HTMLElement;
  private keys = new Set<string>();
  private inCar = true;
  private notice = '傍晚的第一单已就绪。音乐可自由选择，也可静音出发。';
  private elapsed = 0;
  private noticeAge = 0;
  private lastNotice = '';
  private refresh = 0;
  private frames: number[] = [];
  private diagnostics = false;
  private touch!: TouchControls;
  private driverLookYaw = 0;
  private viewPitch = -4;
  private peakSeatDrift = 0;
  private peakSeatYawDrift = 0;
  private performanceRun: PerformanceRun | null = null;
  private sampling = false;
  private performanceStart = 0;
  private performanceNext = 0;
  private wasBackground = false;
  private timeToHud = 0;
  private timeToSceneReady=0;
  private startupFrames:object[]=[];
  private resourceSamples: object[] = [];
  private runSummary = '';
  private mapOpen = false;
  private buildVersion='editor';
  private lastExit = {x:.6,z:23};

  async start(): Promise<void> {
    void fetch('build-info.json').then(response=>response.ok?response.json():null).then(info=>{
      if(typeof info?.commit==='string')this.buildVersion=info.commit.slice(0,7);
    }).catch(()=>{});
    await Promise.all(['DM-Sans', 'InstrumentSerif','NYDistrictSans'].map(name => new Promise<void>(resolve => {
      resources.load('fonts/' + name, Font, async (error, font) => {
        if (!error) {
          try {
            const face = new FontFace(name, `url("${font.nativeUrl}")`);
            document.fonts.add(await face.load());
          } catch { /* Keep the browser's readable fallback if font loading fails. */ }
        }
        resolve();
      });
    })));
    if (!this.isValid) return;
    this.vehicle.x=this.district.spawn.x;
    this.vehicle.z=this.district.spawn.z;
    this.vehicle.yaw=this.district.spawn.yaw*Math.PI/180;
    this.world = new World(this.node, this.surfaceMaterial, this.signMaterial, this.order.data);
    this.world.car.setPosition(this.vehicle.x, 0, this.vehicle.z);
    const scene = this.node.scene;
    scene.globals.ambient.skyColor = new Vec4(.48, .61, .72, 1);
    scene.globals.ambient.skyIllum = 20000;
    scene.globals.ambient.groundAlbedo = new Vec4(.23, .26, .24, 1);
    scene.globals.skybox.enabled = false;
    this.camera = new Node('Driver and walking camera');
    this.node.addChild(this.camera);
    const camera = this.camera.addComponent(Camera);
    camera.fov = 70;
    camera.near = .05;
    camera.far = 1600;
    camera.visibility |= VEHICLE_LAYER;
    camera.clearColor = new Color(117, 139, 151, 255);
    this.music = new MusicPlayer();
    profiler.hideStats();
    this.createHUD();
    this.timeToHud=performance.now();
    resources.load('music/evening-loop', AudioClip, (error, clip) => {
      if (error) this.music.message = '演示曲载入失败，仍可选择本地歌曲';
      else this.music.setDemo(clip.nativeUrl);
    });
    resources.load('music/river-lights', AudioClip, (error, clip) => {
      if (!error) this.music.setDemo(clip.nativeUrl, 'river', 'River Lights');
    });
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    window.addEventListener('blur', this.clearKeys);
    this.notice='正在加载法拉盛街区…';
    this.renderHUD();
    await this.loadArea(this.district);
    this.updateView();
    this.renderHUD();
    this.timeToSceneReady = performance.now();
  }

  private async loadArea(next:DistrictDefinition):Promise<void> {
    if(this.loading) return;
    if(this.sceneReady && !canSwitchDistrict(this.order.stage,this.working)) {
      this.notice='完成当前订单并结束本次工作后，可选择新区域。';return;
    }
    const changed=next.id!==this.district.id;
    const audioBefore=this.musicSnapshot();
    const previousDistrict=this.district.id;
    if(!changed && this.sceneReady)return;
    this.loading=true;this.sceneReady=false;this.clearKeys();this.vehicle.speed=0;
    this.hud.querySelector('#notice')!.textContent='正在加载 '+next.name+'…';
    this.hud.querySelector<HTMLElement>('#notice')!.hidden=false;
    this.hud.querySelectorAll<HTMLButtonElement>('.area-select').forEach(button=>button.disabled=true);
    try {
      await this.world.loadDistrict(next);
      if(changed) {
        this.orderSequence++;this.areaSequence=0;this.swaps++;
        if(!this.order.selectArea(createDistrictOrder(next,this.orderSequence,0)))throw new Error('Order state rejected district change');
      }
      this.district=next;this.world.setOrder(this.order.data);
      Object.assign(this.vehicle,{x:next.spawn.x,z:next.spawn.z,yaw:next.spawn.yaw/DEG,speed:0});
      this.walker.place(next.spawn,this.vehicle.yaw);this.lastExit={...next.spawn};this.inCar=true;this.recenterView();
      this.world.car.setPosition(this.vehicle.x,0,this.vehicle.z);
      this.world.car.setRotationFromEuler(0,next.spawn.yaw,0);
      this.updateView();
      this.world.setQuality(this.quality);this.sceneReady=true;
      if(changed)this.switchEvents.push({seconds:performance.now()/1000,from:previousDistrict,to:next.id,
        before:audioBefore,after:this.musicSnapshot(),generation:this.world.generation});
      this.notice='已进入 '+next.name+'。选择接单后出发，音乐保持当前状态。';
    } catch(error) {
      this.notice='街区加载失败，可在工作区域中重试。'+String(error);
      console.error(error);
    } finally {
      this.loading=false;this.clearKeys();this.renderHUD();
    }
  }

  private musicSnapshot():object {
    return {time:this.music.audio.currentTime,paused:this.music.audio.paused,source:this.music.playlist.source,
      wantsPlayback:this.music.playlist.wantsPlayback,track:this.music.playlist.current?.id,
      queue:this.music.playlist.tracks.map(track=>track.id),levels:this.music.levels};
  }

  private onKeyDown = (event: EventKeyboard): void => {
    if (!this.sceneReady || this.loading) return;
    if (event.keyCode === KeyCode.ESCAPE) { this.togglePause(); return; }
    if (document.activeElement?.matches('input,select,textarea')) return;
    const code = KEY_BINDINGS[event.keyCode];
    if (!code || this.keys.has(code)) return;
    this.keys.add(code);
    if (code === 'KeyE') this.interact();
    if (code === 'KeyM') this.music.toggle();
    if (code === 'F3') this.diagnostics = !this.diagnostics;
  };

  private onKeyUp = (event: EventKeyboard): void => { this.keys.delete(KEY_BINDINGS[event.keyCode]); };
  private clearKeys = (): void => { this.keys.clear(); this.touch?.clear(); };

  private look = (x: number, y: number): void => {
    if (this.inCar) this.driverLookYaw = Math.max(-1.75, Math.min(1.75, this.driverLookYaw - x));
    else this.walker.yaw -= x;
    this.viewPitch = Math.max(-65, Math.min(65, this.viewPitch - y * DEG));
  };

  private recenterView = (): void => { this.driverLookYaw = 0; this.viewPitch = -4; };
  private axis(positive: string[], negative: string[]): number {
    return Number(positive.some(key => this.keys.has(key))) - Number(negative.some(key => this.keys.has(key)));
  }
  private distance(x: number, z: number): number {
    const player = this.inCar ? this.vehicle : this.walker;
    return Math.hypot(player.x - x, player.z - z);
  }
  private get pickup(): {x: number; z: number} { return this.order.data.pickup ?? {x:-14.3, z:0}; }
  private get dropoff(): {x: number; z: number} { return this.order.data.dropoff ?? {x:9.4, z:-30}; }
  private atCounter(): boolean { return !this.inCar && this.distance(this.pickup.x, this.pickup.z) < 2.6; }

  private getInteraction(): Interaction {
    const player = this.inCar ? this.vehicle : this.walker;
    const action = resolveInteraction({stage: this.order.stage, inCar: this.inCar, speed: this.vehicle.speed,
      queueJoined: this.order.queueJoined, ready: this.order.queueRemaining === 0 && this.order.kitchenRemaining === 0,
      pickup: directionTo(player, this.pickup), dropoff: directionTo(player, this.dropoff),
      carDistance: this.distance(this.vehicle.x, this.vehicle.z)});
    if (action.kind === 'accept') action.label += ' · $' + this.order.data.pay.toFixed(2);
    if (action.kind === 'continue' && !this.working) action.label = '开始新工作';
    return action;
  }

  private showInteraction(action: Interaction): void {
    const button = this.hud.querySelector<HTMLButtonElement>('#action')!;
    button.textContent = action.label;
    button.disabled = !action.enabled;
    this.touch.update(this.inCar, action.label, action.enabled);
    const compact = this.hud.querySelector<HTMLButtonElement>('#context-action')!;
    compact.textContent = action.label;
    compact.disabled = !action.enabled;
  }

  private enterCar(): void {
    this.inCar = true;
    this.recenterView();
    this.vehicle.speed = 0;
    this.clearKeys();
  }

  update(dt: number): void {
    if (!this.world || !this.hud) return;
    this.samplePerformance(dt);
    if(!this.sceneReady || this.loading) return;
    if(this.startupFrames.length<180)this.startupFrames.push({milliseconds:dt*1000,sinceNavigation:performance.now(),foreground:!document.hidden&&document.hasFocus(),...this.readResources()});
    if (!this.paused && this.order.stage !== 'idle' && this.order.stage !== 'delivered') this.elapsed += dt;
    this.noticeAge += dt;
    this.frames.push(dt);
    if (this.frames.length > 600) this.frames.shift();
    const step = this.paused ? 0 : Math.min(dt, .05);
    const blocked = this.paused || this.mapOpen || this.hud.classList.contains('music-open')
      || this.hud.classList.contains('phone-open');
    this.touch.suspend(blocked);
    const controls = this.touch.input;
    const horizontal = blocked ? 0 : Math.max(-1, Math.min(1, this.axis(RIGHT_KEYS, LEFT_KEYS) + controls.horizontal));
    const keyboardForward = blocked ? 0 : this.axis(FORWARD_KEYS, BACKWARD_KEYS);
    if (EDITOR) {
      this.look(this.axis(['ArrowRight'], ['ArrowLeft']) * step * 1.8,
        this.axis(['ArrowDown'], ['ArrowUp']) * step * 1.2);
    }
    const forward = Math.max(-1, Math.min(1, keyboardForward + (this.inCar ? controls.throttle : controls.forward)));
    if (this.inCar) this.vehicle.update(step, forward, -horizontal, blocked || this.keys.has('Space') || controls.braking, this.world.canMove);
    else this.walker.update(step, forward, horizontal, (x, z, radius) => {
      const dx = x - this.vehicle.x;
      const dz = z - this.vehicle.z;
      const localX = dx * Math.cos(this.vehicle.yaw) - dz * Math.sin(this.vehicle.yaw);
      const localZ = dx * Math.sin(this.vehicle.yaw) + dz * Math.cos(this.vehicle.yaw);
      return this.world.canMove(x, z, radius) && (Math.abs(localX) > 1.05 + radius || Math.abs(localZ) > 2.15 + radius);
    });
    this.timing.tick(this.paused ? 0 : dt, this.order.stage, this.inCar, this.vehicle.speed,
      this.order.queueJoined && this.atCounter(), this.order.queueRemaining > 0 || this.order.kitchenRemaining > 0);
    this.order.tick(this.paused ? 0 : Math.min(dt, .25), this.atCounter());
    this.world.updateActors(step, this.order.stage, this.order.queueJoined, this.order.queueRemaining, this.inCar ? this.vehicle : this.walker);
    this.world.car.setPosition(this.vehicle.x, 0, this.vehicle.z);
    this.world.car.setRotationFromEuler(0, this.vehicle.yaw * DEG, 0);
    this.world.update(dt, {
      speed: this.vehicle.speed,
      steering: this.inCar ? this.vehicle.steering : 0,
      distance: this.vehicle.distance,
      x: this.vehicle.x,
      z: this.vehicle.z,
      yaw: this.vehicle.yaw,
      destination: ['stowed', 'delivering', 'delivered'].includes(this.order.stage),
      target: this.order.stage === 'accepted' || this.order.stage === 'idle' ? this.order.data.pickupParking! : this.order.data.dropoffParking!,
      address: this.order.stage === 'accepted' || this.order.stage === 'idle' ? this.order.data.restaurant : this.order.data.address,
    }, {position:this.inCar ? this.vehicle : this.walker,inCar:this.inCar,paused:this.paused});
    this.updateView();
    this.updateBag();
    this.music.update(this.inCar, Math.hypot(this.walker.x - this.vehicle.x, this.walker.z - this.vehicle.z), this.vehicle.speed);
    this.refresh += dt;
    if (this.refresh > .1) { this.renderHUD(); this.refresh = 0; }
  }

  private readResources():{drawCalls:number;triangles:number;textureBytes:number;bufferBytes:number;jsHeapBytes:number|null;mirrorMode:string;mirrorEnabled:boolean;mirrorUpdates:number;panelUpdates:number} {
    const device=director.root!.device;
    const memory=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory;
    return {drawCalls:device.numDrawCalls,triangles:device.numTris,textureBytes:device.memoryStatus.textureSize,
      bufferBytes:device.memoryStatus.bufferSize,jsHeapBytes:memory?.usedJSHeapSize??null,
      mirrorMode:this.world.carDisplays.mode,mirrorEnabled:this.world.carDisplays.mirror,
      mirrorUpdates:this.world.carDisplays.mirrorUpdates,panelUpdates:this.world.carDisplays.panelUpdates};
  }

  private samplePerformance(dt: number): void {
    if (!this.sampling || !this.performanceRun) return;
    const background = document.hidden || !document.hasFocus();
    const mode = background || this.wasBackground ? 'background' : this.paused || this.loading ? 'paused'
      : this.order.stage === 'idle' || this.order.stage === 'delivered' ? 'idle' : 'active';
    this.wasBackground = background;
    this.performanceRun.frame(dt, mode,this.district.id);
    const now = performance.now();
    if (now < this.performanceNext) return;
    this.performanceNext = now + 5000;
    this.resourceSamples.push({seconds:(now-this.performanceStart)/1000, mode,
      district:this.district.id,quality:this.quality,renderScale:director.root!.pipeline.shadingScale,generation:this.world.generation,completed:this.order.completedOrders,
      ...this.readResources()});
    const active = this.performanceRun.summary().active;
    this.runSummary = `Run active ${active.seconds.toFixed(1)}s · ${active.fps.toFixed(1)} FPS · p95 ${active.p95.toFixed(1)} / p99 ${active.p99.toFixed(1)} ms · >50ms ${active.longFrames}`;
  }

  private startPerformance(): void {
    this.performanceRun = new PerformanceRun();
    this.resourceSamples = [];
    this.performanceStart = performance.now();
    this.performanceNext = 0;
    this.wasBackground = document.hidden;
    this.sampling = true;
    if (this.paused) this.togglePause();
    this.notice = '整段性能采样已开始，暂停菜单可停止并查看原始数据。';
  }

  private finishPerformance(): void {
    if (!this.performanceRun) return;
    this.sampling = false;
    const output = this.hud.querySelector<HTMLTextAreaElement>('#performance-output')!;
    output.value = JSON.stringify({engine:'3.8.8',time:new Date().toISOString(),
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      timeToHudMs:this.timeToHud,startup:{hudMs:this.timeToHud,sceneReadyMs:this.timeToSceneReady,frames:this.startupFrames,
        scope:'First page scene, browser process already running. Cocos texture/buffer estimates and optional JS heap.'},switchEvents:this.switchEvents,deliveries:this.completedRuns,swaps:this.swaps,completedOrders:this.order.completedOrders,quality:this.quality,
      districts:Object.fromEntries([FLUSHING_DISTRICT,CHINATOWN_DISTRICT].map(district=>[district.id,this.performanceRun!.summary(district.id)])),
      summary:this.performanceRun.summary(),resources:this.resourceSamples,
      frameColumns:['milliseconds','mode','district'],frames:this.performanceRun.samples,
      memoryScope:'Cocos estimated texture/buffer bytes and browser-reported JS heap. Native/driver/process memory is not collected.'});
    this.hud.querySelector<HTMLElement>('#performance-panel')!.hidden = false;
  }

  private updateView(): void {
    const renderCamera = this.camera.getComponent(Camera)!.camera;
    const { width, height } = game.canvas.getBoundingClientRect();
    // Runtime-created cameras can retain the old projection after a viewport resize.
    if (renderCamera && height > 0 && Math.abs(renderCamera.aspect - width / height) > .0001) {
      renderCamera.resize(width, height);
    }
    if (this.inCar) {
      if (this.camera.parent !== this.world.car) this.camera.setParent(this.world.car);
      this.camera.setPosition(DRIVER_EYE);
      this.camera.setRotationFromEuler(this.viewPitch, this.driverLookYaw * DEG, 0);
      return;
    }
    if (this.camera.parent !== this.node) this.camera.setParent(this.node);
    this.camera.setPosition(this.walker.x, 1.7 + this.world.groundHeight(this.walker.x,this.walker.z), this.walker.z);
    this.camera.setRotationFromEuler(this.viewPitch, this.walker.yaw * DEG, 0);
  }

  private updateBag(): void {
    const stage = this.order.stage;
    const parent = stage === 'stowed' ? this.world.car : this.node;
    if (this.world.bag.parent !== parent) this.world.bag.setParent(parent);
    this.world.bag.active = stage !== 'idle' && stage !== 'delivered';
    if (stage === 'carrying' || stage === 'delivering') {
      const yaw = this.walker.yaw;
      this.world.bag.setPosition(this.walker.x + .45 * Math.cos(yaw) - .65 * Math.sin(yaw),
        1.20 + this.world.groundHeight(this.walker.x,this.walker.z), this.walker.z - .45 * Math.sin(yaw) - .65 * Math.cos(yaw));
      this.world.bag.setRotationFromEuler(0,yaw*DEG,0);
    } else if (stage === 'stowed') {
      this.world.bag.setPosition(.45, 1.06, .35);
      this.world.bag.setRotationFromEuler(0,180,0);
    } else {
      const pose=this.world.bagPose;
      this.world.bag.setPosition(pose.x,1.47,pose.z);
      this.world.bag.setRotationFromEuler(0,pose.yaw,0);
    }
  }

  private interact(): void {
    if(!this.sceneReady || this.loading)return;
    const action = this.getInteraction();
    this.showInteraction(action);
    if (!action.enabled) { this.notice = action.label; return; }
    switch (action.kind) {
      case 'accept':
        this.order.accept();
        this.hud.classList.remove('phone-open');
        this.working = true;
        this.elapsed = 0;
        this.timing.reset();
        this.orderStartDistance = this.vehicle.distance;
        this.notice = '已接单，驶向 ' + this.order.data.restaurant + '。';
        this.music.chime();
        break;
      case 'continue':
        if (!this.order.next(createDistrictOrder(this.district,this.orderSequence + 1,this.areaSequence+1))) return;
        this.orderSequence += 1;
        this.areaSequence++;
        this.order.accept();
        this.hud.classList.remove('phone-open');
        this.world.setOrder(this.order.data);
        this.working = true;
        this.elapsed = 0;
        this.timing.reset();
        this.orderStartDistance = this.vehicle.distance;
        this.clearKeys();
        (this.hud.querySelector('#handoff-code') as HTMLInputElement).value = '';
        this.notice = '已接下新订单 ' + this.order.data.id + '，当前位置与音乐继续保留。';
        break;
      case 'exit': {
        const exit = this.vehicle.exitPosition(this.world.canMove);
        if (!exit) { this.notice = '两侧受阻，请挪到安全位置再下车。'; return; }
        this.walker.place(exit, this.vehicle.yaw + this.driverLookYaw);
        this.lastExit = {...exit};
        this.driverLookYaw = 0;
        this.inCar = false;
        this.clearKeys();
        this.order.retrieve();
        this.notice = `已下车。WASD 移动，${LOOK_HINT}，靠近当前目标交互。`;
        break;
      }
      case 'queue':
        this.order.joinQueue();
        this.world.handoff();
        this.notice = this.order.data.note || '已加入取餐队列，请在柜台前等候。';
        break;
      case 'pickup':
        if (this.order.take(this.order.data.code, this.world.bagLabel)) {
          this.world.handoff();
          this.notice = `取餐码 ${this.order.data.code} 与 ${this.world.bagLabel.count} 袋餐品已核对，回车旁装餐。`;
          this.music.chime();
        } else this.notice = '餐袋编号、取餐码或袋数不匹配，请在柜台重新核对。';
        break;
      case 'stow-enter':
        this.order.stow();
        this.enterCar();
        this.notice = '餐袋已放妥并上车，下一站 ' + this.order.data.address + '。';
        this.music.chime();
        break;
      case 'enter':
        this.enterCar();
        this.notice = '已上车。W 加速，空格刹车。';
        break;
      case 'deliver':
        if (this.order.deliver()) {
          this.completedRuns.push({id:this.order.data.id,district:this.district.id,restaurant:this.order.data.restaurantId,
            delivery:this.order.data.deliveryPointId,elapsed:this.elapsed,distance:this.vehicle.distance-this.orderStartDistance,
            phases:{...this.timing.seconds},earnings:this.order.earnings,completed:this.order.completedOrders});
          this.notice = '已交付 · $' + this.order.earnings.toFixed(2) + '，可继续接单或结束工作。';
          this.music.chime();
        }
        break;
    }
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.clearKeys();
    if (this.paused) this.vehicle.speed = 0;
    this.hud.classList.toggle('paused',this.paused);
    this.hud.querySelector<HTMLElement>('#pause-menu')!.hidden = !this.paused;
    if (this.paused) this.hud.classList.remove('phone-open','music-open');
  }

  private recover(): void {
    this.vehicle.reset();
    Object.assign(this.vehicle,{x:this.district.spawn.x,z:this.district.spawn.z,yaw:this.district.spawn.yaw/DEG});
    this.recenterView();
    this.walker.place(this.district.spawn,this.vehicle.yaw);
    this.clearKeys();
    this.notice = '已回到起点安全位置，订单与音乐进度保留。';
  }

  private orderAction(): void { this.interact(); }

  private createHUD(): void {
    this.hud = document.createElement('div');
    this.hud.id = 'delivery-hud';
    this.hud.classList.add('phone-open');
    this.hud.innerHTML = `
      <style>
      #delivery-hud {
        position: fixed; inset: 0; pointer-events: none; z-index: 100;
        color: #ede9dc; font: 13px 'DM-Sans', sans-serif; line-height: 1.5;
      }
      #delivery-hud * { box-sizing: border-box; }
      #delivery-hud button, #delivery-hud input { pointer-events: auto; font: inherit; }
      #delivery-hud button {
        background: #d9bd83; color: #172c32; border: 0; border-radius: 6px;
        padding: 9px 12px; cursor: pointer; font-weight: 600;
      }
      #delivery-hud button:hover { background: #edcf98; }
      #delivery-hud button:disabled { opacity: .45; cursor: default; }
      #delivery-hud .top { position: absolute; top: 22px; left: 25px; text-shadow: 0 1px 5px #1d3449; }
      #delivery-hud .wordmark { font: 22px 'InstrumentSerif', serif; letter-spacing: 1px; }
      #delivery-hud .sub { font-size: 10px; letter-spacing: 2px; color: #e2e8de; }
      #delivery-hud .route {
        margin-top: 12px; background: #182e34d9; border-left: 3px solid #d9bd83;
        padding: 10px 14px; max-width: 340px; border-radius: 0 7px 7px 0; font-size: 12px;
      }
      #delivery-hud .phone {
        position: absolute; right: 23px; top: 86px; width: 252px; padding: 16px;
        background: #14272dee; border: 1px solid #81938a; border-radius: 18px;
        box-shadow: 0 8px 25px #10233260; pointer-events: auto;
      }
      #delivery-hud .phone-header { display: flex; justify-content: space-between; font-size: 10px; color: #9db4ae; letter-spacing: 1px; }
      #delivery-hud .phone h2 { font: 24px 'InstrumentSerif', serif; margin: 8px 0 4px; }
      #delivery-hud .muted { color: #a9bbb2; font-size: 11px; }
      #delivery-hud .order-detail { border-top: 1px solid #425d5c; margin: 10px 0 8px; padding-top: 9px; font-size: 11px; }
      #delivery-hud .code { font-size: 22px; letter-spacing: 6px; color: #dfc68f; margin: 3px 0 6px; }
      #delivery-hud .status { margin: 8px 0; color: #cbd8cf; font-size: 11px; min-height: 28px; }
      #delivery-hud #action { width: 100%; }
      #delivery-hud #code-panel { display: none; margin: 10px 0; }
      #handoff-code { background: #e5e2cf; color: #203c3f; width: 100%; border: 0; border-radius: 5px; padding: 8px; margin-bottom: 7px; letter-spacing: 6px; }
      #delivery-hud #code-panel button { font-size: 11px; padding: 8px 10px; }
      #delivery-hud .controls {
        position: absolute; left: 25px; bottom: 143px; font-size: 10px;
        color: #e4e5dc; line-height: 1.7; text-shadow: 0 1px 4px #142c36;
      }
      #delivery-hud kbd { color: #e7c68f; font: 10px monospace; }
      #delivery-hud .speed {
        position: absolute; right: 26px; top: 22px; display: flex; align-items: center;
        gap: 8px; background: #152b32c9; border-radius: 8px; padding: 6px 13px;
      }
      #delivery-hud #mph { font-size: 30px; font-weight: 500; line-height: 1.1; }
      #delivery-hud .speed > span:last-child { font-size: 10px; }
      #delivery-hud #mode { font-size: 9px; letter-spacing: 1px; color: #b7c9bd; }
      #delivery-hud .music {
        position: absolute; bottom: 23px; left: 25px; width: 410px;
        border: 1px solid #6b8179; background: #162e34e8; border-radius: 10px;
        padding: 12px 15px; pointer-events: auto;
      }
      #delivery-hud .music-title { display: flex; justify-content: space-between; font-size: 9px; color: #cbbd95; letter-spacing: 2px; }
      #delivery-hud #track { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; margin: 5px 0 9px; }
      #delivery-hud .music button { padding: 5px 8px; font-size: 10px; margin-right: 3px; }
      #delivery-hud input[type=range] { width: 62px; accent-color: #d9bd83; vertical-align: middle; }
      #delivery-hud .music label { font-size: 10px; }
      #delivery-hud .notice {
        position: absolute; bottom: 145px; left: 50%; transform: translateX(-50%);
        max-width: 390px; color: #f1e9d2; background: #152c34c9;
        padding: 8px 12px; border-radius: 5px; text-align: center; font-size: 11px;
      }
      #delivery-hud #result { display: none; margin-top: 10px; padding: 10px 0; border-top: 1px solid #425d5c; }
      #delivery-hud #pay { font: 32px 'InstrumentSerif', serif; color: #e2c78c; }
      #delivery-hud { --edge-top:max(12px,env(safe-area-inset-top)); --edge-left:max(12px,env(safe-area-inset-left)); --edge-right:max(12px,env(safe-area-inset-right)); }
      #delivery-hud [hidden] { display:none !important; }
      #delivery-hud button { min-height:44px; }
      #delivery-hud .toolbar { position:absolute; top:var(--edge-top); right:var(--edge-right); display:flex; gap:8px; pointer-events:auto; }
      #delivery-hud .toolbar button { background:#16323bea; color:#edf3ed; border:1px solid #718f85; min-width:52px; }
      #delivery-hud .top { top:var(--edge-top); left:var(--edge-left); max-width:calc(100% - 140px); }
      #delivery-hud .wordmark { font-size:20px; }
      #delivery-hud .sub, #delivery-hud .controls { display:none; }
      #delivery-hud .route { margin-top:6px; font-size:14px; padding:8px 12px; max-width:280px; }
      #delivery-hud.driving .wordmark { display:none; }
      #delivery-hud.driving .route { margin:0; font-size:18px; font-weight:600; border-color:#64e2ee; }
      #delivery-hud .speed { right:var(--edge-right); top:calc(var(--edge-top) + 54px); padding:6px 10px; }
      #delivery-hud #mph { font-size:28px; }
      #delivery-hud .phone { display:none; top:calc(var(--edge-top) + 54px); right:var(--edge-right); max-height:calc(100% - 86px); overflow:auto; width:min(280px,calc(100% - 24px)); }
      #delivery-hud.phone-open .phone, #delivery-hud.counter-open .phone { display:block; }
      #delivery-hud .phone button, #delivery-hud .phone input { min-height:44px; }
      #delivery-hud .music { display:none; position:absolute; top:calc(var(--edge-top) + 54px); bottom:auto; left:50%; transform:translateX(-50%); width:min(380px,calc(100% - 24px)); max-height:calc(100% - 86px); overflow:auto; padding:12px; }
      #delivery-hud.music-open .music { display:block; }
      #delivery-hud .music-details { position:static; display:block; padding-top:12px; }
      #delivery-hud .music button { min-height:44px; padding:8px 10px; }
      #delivery-hud .music-details select { background:#243e43; color:#f0e8d4; min-height:44px; max-width:170px; }
      #delivery-hud .music-details label { display:inline-block; margin:5px 0; }
      #delivery-hud .music-note { font-size:11px; line-height:1.5; color:#c7d2c9; }
      #delivery-hud .playlist-row { display:flex; gap:6px; margin:6px 0; }
      #delivery-hud .playlist-row button:first-child { flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; }
      #delivery-hud #navigation-hud { position:absolute; top:calc(var(--edge-top) + 56px); left:var(--edge-left); width:220px; border:1px solid #6d929c; border-radius:8px; background:#142b33f2; overflow:hidden; }
      #delivery-hud #navigation-canvas { width:100%; height:130px; display:block; }
      #delivery-hud #navigation-distance { padding:5px 9px; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #delivery-hud #context-action { position:absolute; right:var(--edge-right); bottom:24px; min-width:150px; min-height:48px; }
      #delivery-hud.phone-open #context-action, #delivery-hud.counter-open #context-action, #delivery-hud.touch-mode #context-action, #delivery-hud.paused #context-action { display:none; }
      #delivery-hud #result { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); width:min(330px,calc(100% - 24px)); background:#183339f2; border:1px solid #91a492; border-radius:10px; padding:12px 18px; pointer-events:auto; }
      #delivery-hud #pay { font-size:24px; }
      #delivery-hud #pause-menu { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(420px,calc(100% - 24px)); max-height:calc(100% - 24px); overflow:auto; padding:20px; background:#183339fa; border:1px solid #8a9d8f; border-radius:12px; pointer-events:auto; }
      #delivery-hud .menu-actions { display:flex; flex-wrap:wrap; gap:8px; }
      #delivery-hud #pause-menu details { margin-top:16px; }
      #delivery-hud #pause-menu summary { min-height:44px; padding:10px 0; cursor:pointer; }
      #delivery-hud #pause-menu select { min-height:44px; }
      #delivery-hud #sound-resume { position:absolute; left:50%; top:calc(var(--edge-top) + 54px); transform:translateX(-50%); min-height:44px; }
      #delivery-hud #performance-panel { position:absolute; z-index:20; inset:12px; padding:20px; background:#183339; pointer-events:auto; overflow:auto; }
      #delivery-hud #performance-output { display:block; width:100%; height:65%; font:12px monospace; }
      #delivery-hud #district-map { position:absolute; z-index:15; inset:12px; padding:12px; background:#142b33; border:1px solid #82968b; border-radius:10px; pointer-events:auto; overflow:auto; }
      #delivery-hud #map-legend { font-size:12px; padding:8px; }
      #delivery-hud #map-canvas { width:100%; display:block; }
      #delivery-hud .notice { bottom:100px; max-width:calc(100% - 32px); font-size:12px; }
      #delivery-hud.touch-mode .notice { bottom:188px; }
      #delivery-hud .touch-controls .touch-tools { display:none; }
      #delivery-hud .look-hint { display:none; }
      @media (max-height:450px) {
        #delivery-hud #navigation-hud { width:190px; }
        #delivery-hud #navigation-canvas { height:106px; }
        #delivery-hud .phone { font-size:12px; padding:12px; }
        #delivery-hud .phone h2 { font-size:20px; }
      }
      </style>
      <nav class="toolbar"><button id="map-toggle">地图</button><button id="pause">菜单</button></nav>
      <div class="top"><div class="sub">NEW YORK · 6:42 PM</div><div class="wordmark">我在纽约送外卖</div><div class="route" id="route"></div></div>
      <section class="phone"><div class="phone-header"><span>ORCHARD / DELIVERY</span><span>● 4G</span></div><h2 id="restaurant"></h2><div class="muted" id="order-id"></div><div class="order-detail" id="items"></div><div class="muted">交接码</div><div class="code" id="order-code"></div><div class="muted" id="customer"></div><div class="status" id="status"></div>
      <details id="code-panel"><summary>手动核验与等餐快进</summary><input id="handoff-code" inputmode="numeric" maxlength="4" placeholder="输入交接码" aria-label="交接码"><button id="verify">核对并取餐</button><button id="skip">等餐快进</button></details>
      <button id="action">接单</button></section><section id="result"><div class="muted">DELIVERED · 本单收入</div><div id="pay"></div><div id="summary" class="muted"></div><button id="restart">继续接单</button><button id="end-work">结束本次工作</button></section>
      <div class="controls"><kbd>W / S</kbd> 前进 / 后退　<kbd>A / D</kbd> 驾驶转向 / 步行横移<br>${LOOK_HINT} · 自由观察　<kbd>SPACE</kbd> 刹车<br><kbd>E</kbd> 上下车 / 交互　<kbd>ESC</kbd> 暂停 / 安全复位<br><kbd>M</kbd> 音乐播放 / 暂停</div>
      <div class="speed"><span id="mph">0</span><span>mph<br><span id="mode">DRIVING</span></span></div>

      <section id="navigation-hud" aria-label="实时导航" hidden><canvas id="navigation-canvas" width="440" height="260" aria-label="朝向前方的局部导航地图"></canvas><div id="navigation-distance"></div></section>
      <button id="context-action">接单</button>
      <button id="sound-resume" hidden>点按恢复声音</button>
      <section id="pause-menu" hidden><h2>暂停</h2><div class="menu-actions"><button id="resume">继续游戏</button><button id="order-toggle">订单详情</button><button id="music-toggle">音乐</button><button id="touch-toggle">触屏操作</button><button id="view-center">视角回正</button></div><details><summary>操作与设置</summary><p>W/S油门与倒车，A/D转向或步行横移，空格刹车。手机使用摇杆、踏板和右侧拖动观察。停稳后交互。</p><p>音乐按原播放选择继续，可在音乐面板暂停。</p><label>画质 <select id="quality" aria-label="画质"><option value="standard">标准</option><option value="low">低</option></select></label><p><button id="safe-recover">安全复位</button></p><p>恢复起点并保留订单与音乐。</p><button id="performance-start">开始性能采样</button><button id="performance-finish">停止并查看性能</button></details><details><summary>工作区域</summary><p id="area-status"></p><button class="area-select" id="area-flushing">法拉盛 · Queens</button><button class="area-select" id="area-chinatown">唐人街 · Manhattan</button><p>完成订单并结束本次工作后换区。</p></details></section>
      <section id="performance-panel" hidden><h2>整段性能采样</h2><textarea id="performance-output" aria-label="性能原始数据" readonly></textarea><button id="performance-close">关闭数据</button></section>
      <section id="district-map" hidden><button id="map-close">返回街道</button><canvas id="map-canvas" aria-label="工作区域地图"></canvas><div id="map-legend"></div></section>
      <div class="notice" id="notice"></div><pre id="diagnostics" style="display:none;position:absolute;left:28px;top:165px;background:#142b30dd;padding:12px;font:10px monospace;max-width:min(370px,calc(100% - 56px));max-height:calc(100% - 185px);white-space:pre-wrap;overflow:auto"></pre>`;
    this.musicPanel = new MusicPanel(this.music);
    this.hud.appendChild(this.musicPanel.element);
    document.body.appendChild(this.hud);
    this.touch = new TouchControls(this.hud, game.canvas, this.look,
      () => this.orderAction(), this.recenterView, EDITOR);
    const on = (id: string, action: () => void) => {
      this.hud.querySelector('#' + id)!.addEventListener('click', () => {
        action();
        game.canvas.focus();
      });
    };
    on('touch-toggle', () => { this.clearKeys(); this.touch.toggle(); });
    on('order-toggle', () => { if(this.paused)this.togglePause(); this.clearKeys(); this.hud.classList.remove('music-open'); this.hud.classList.toggle('phone-open'); });
    on('music-toggle', () => { if(this.paused)this.togglePause(); this.clearKeys(); this.hud.classList.remove('phone-open'); this.hud.classList.toggle('music-open'); });
    on('view-center',this.recenterView);
    on('map-toggle', () => { this.clearKeys(); this.hud.classList.remove('phone-open','music-open'); this.mapOpen=true; this.hud.querySelector<HTMLElement>('#district-map')!.hidden=false; });
    on('map-close', () => { this.clearKeys(); this.mapOpen=false; this.hud.querySelector<HTMLElement>('#district-map')!.hidden=true; });
    on('pause', () => this.togglePause());
    on('area-flushing',()=>{void this.loadArea(FLUSHING_DISTRICT);});
    on('area-chinatown',()=>{void this.loadArea(CHINATOWN_DISTRICT);});
    this.hud.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change',event=>{
      this.quality=(event.target as HTMLSelectElement).value as 'low'|'standard';this.world.setQuality(this.quality);
    });
    on('resume', () => this.togglePause());
    on('safe-recover', () => { this.recover(); this.togglePause(); });
    on('sound-resume', () => { void this.music.resumeSound(); });
    on('performance-start', () => this.startPerformance());
    on('performance-finish', () => this.finishPerformance());
    on('performance-close', () => { this.hud.querySelector<HTMLElement>('#performance-panel')!.hidden = true; });
    on('context-action', () => this.interact());
    on('restart', () => this.interact());
    on('end-work', () => { this.working = false; this.notice = '本次工作结束，累计完成 ' + this.order.completedOrders + ' 单 · $' + this.order.totalEarnings.toFixed(2); });
    on('action', () => this.orderAction());
    on('verify', () => {
      const code = (this.hud.querySelector('#handoff-code') as HTMLInputElement).value;
      if (!this.atCounter()) { this.notice = '请回到柜台旁核验取餐。'; return; }
      const taken = this.order.take(code, this.world.bagLabel);
      this.notice = taken ? '核验成功，回车旁装餐并上车。' : '暂时无法取餐。核对交接码，并等待排队与厨房状态完成。';
      if (taken) { this.world.handoff(); this.music.chime(); }
    });
    on('skip', () => {
      if (this.atCounter() && this.order.queueJoined) {
        this.order.tick(30, true);
        this.notice = '等待已快进，歌曲保持原播放速度。请核对交接码取餐。';
      }
    });
  }

  private renderHUD(): void {
    const viewport = game.canvas.getBoundingClientRect();
    const scale = this.touch.enabled ? Math.min(1, viewport.width / 360, viewport.height / 340)
      : Math.min(1, viewport.width / 1100, viewport.height / 650);
    if (scale > 0) {
      Object.assign(this.hud.style, {
        inset: 'auto',
        left: viewport.left + 'px',
        top: viewport.top + 'px',
        width: viewport.width / scale + 'px',
        height: viewport.height / scale + 'px',
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
      });
    }
    const text = (id: string, value: string) => { this.hud.querySelector('#' + id)!.textContent = value; };
    const data = this.order.data;
    text('area-status',this.district.name+' · '+this.world.resourceState);
    this.hud.querySelectorAll<HTMLButtonElement>('.area-select').forEach(button=>{
      button.disabled=this.loading || this.sceneReady && !canSwitchDistrict(this.order.stage,this.working);
    });
    this.hud.querySelector<HTMLElement>('#sound-resume')!.hidden = !this.music.needsResume;
    const stage = this.order.stage;
    text('restaurant', data.restaurant);
    text('order-id', data.id + ' · $' + data.pay.toFixed(2));
    text('items', data.items);
    text('order-code', data.code);
    text('customer', data.customer + ' · ' + data.address);
    text('mph', String(Math.round(Math.abs(this.vehicle.speed) * 2.23694)));
    text('mode', this.inCar ? 'DRIVING' : 'ON FOOT');
    if (this.notice !== this.lastNotice) { this.lastNotice = this.notice; this.noticeAge = 0; }
    text('notice', this.notice);
    this.hud.querySelector<HTMLElement>('#notice')!.hidden = this.noticeAge > 5 || this.inCar && Math.abs(this.vehicle.speed)>.25;
    this.musicPanel.render();
    const target = stage === 'carrying' ? this.lastExit : ['stowed','delivering'].includes(stage) ? this.dropoff : this.pickup;
    const playerHeading = this.inCar ? this.vehicle : this.walker;
    const parking = stage === 'accepted' || stage === 'idle' ? data.pickupParking! : data.dropoffParking!;
    const route = this.inCar?planRoute(playerHeading,parking,this.district,'car'):routeWalking(this.district,playerHeading,target,this.vehicle);
    const next = route.points.find(point=>this.distance(point.x,point.z)>(this.inCar?8:.7)) ?? target;
    const navigation = directionTo(playerHeading, next);
    const routeDistance = Math.round(route.distance);
    const guidance=navigationStep(playerHeading,route.points);
    const drivingDirection=guidance.symbol==='↶' ? '↶ 低速调整车头' : `${guidance.symbol} ${guidance.distance} m ${guidance.instruction}`;
    const routes = {
      idle: '自由选歌或静音 · 接单出发',
      accepted: this.inCar ? drivingDirection : `${navigation.symbol} 步行取餐 · ${routeDistance} m`,
      carrying: `${navigation.symbol} 回到汽车旁 · 装餐并上车`,
      stowed: drivingDirection,
      delivering: `${navigation.symbol} 携带餐袋 · ${data.address} · ${routeDistance} m`,
      delivered: '订单完成 · 享受你的傍晚',
    };
    text('route', route.reachable || stage==='idle' || stage==='delivered' ? routes[stage] : '当前点无合法'+(this.inCar?'车行':'步行')+'路线，请查看地图');
    this.hud.classList.toggle('driving',this.inCar && stage!=='idle' && stage!=='delivered');
    const navigationHud=this.hud.querySelector<HTMLElement>('#navigation-hud')!;
    navigationHud.hidden=this.paused || this.mapOpen || stage==='idle' || stage==='delivered'
      || this.hud.classList.contains('phone-open') || this.hud.classList.contains('music-open');
    if (!navigationHud.hidden) {
      const canvas=this.hud.querySelector<HTMLCanvasElement>('#navigation-canvas')!;
      drawDistrictMap(canvas.getContext('2d')!,canvas.width,canvas.height,this.district,
        {player:playerHeading,target:this.inCar?parking:target,route:route.points,navigation:true});
    }
    text('navigation-distance',this.vehicle.touchingEdge && this.inCar ? '路缘接触 · 松开油门，挂R退离'
      : (stage==='carrying'?'返回汽车':stage==='stowed'||stage==='delivering'?data.address:data.restaurant)+' · '+routeDistance+' m');
    if (this.mapOpen) {
      const canvas=this.hud.querySelector<HTMLCanvasElement>('#map-canvas')!;
      const width=Math.floor(this.hud.clientWidth*.92-32), height=Math.floor(this.hud.clientHeight*.75-70);
      if (canvas.width!==width || canvas.height!==height) {canvas.width=width;canvas.height=height;}
      drawDistrictMap(canvas.getContext('2d')!,width,height,this.district,
        {player:playerHeading,target:this.inCar?parking:target,route:route.points,labels:true});
      text('map-legend',this.district.restaurants.map((place,index)=>'R'+(index+1)+' '+place.name).concat(
        this.district.deliveries.map((place,index)=>'D'+(index+1)+' '+place.name)).join('　')+' · P 停车点');
    }
    const statuses = {
      idle: '音乐可自由选择，静音也能接单。',
      accepted: `队列 ${this.order.queueJoined ? Math.ceil(this.order.queueRemaining) + ' s' : '尚未加入'} · 厨房 ${Math.ceil(this.order.kitchenRemaining)} s`,
      carrying: `餐袋 ${data.id} · 标签 ${data.code} · 已领取`,
      stowed: '餐袋已装车 · 门口下车后按 E 交付',
      delivering: `餐袋 ${data.id} · 标签 ${data.code} · 送往门口`,
      delivered: '已交付 · 本单只结算一次',
    };
    text('status', statuses[stage]);
    this.hud.classList.toggle('counter-open',stage === 'accepted' && this.atCounter());
    this.hud.querySelector<HTMLElement>('#code-panel')!.style.display = stage === 'accepted' && this.order.queueJoined && this.atCounter() ? 'block' : 'none';
    this.hud.querySelector<HTMLElement>('#result')!.style.display = stage === 'delivered' ? 'block' : 'none';
    this.hud.querySelector<HTMLElement>('#action')!.style.display = stage === 'delivered' ? 'none' : 'block';
    const action = this.getInteraction();
    this.hud.querySelector<HTMLButtonElement>('#context-action')!.hidden = stage === 'delivered' || !action.enabled;
    this.showInteraction(action);
    if(!this.sceneReady || this.loading) this.hud.querySelectorAll<HTMLButtonElement>('#action,#context-action').forEach(button=>button.disabled=true);
    text('restart', action.label);
    this.hud.querySelector<HTMLButtonElement>('#end-work')!.hidden = !this.working;
    text('touch-toggle', this.touch.enabled ? '键鼠操作' : '触屏操作');
    this.hud.querySelector('#touch-toggle')!.setAttribute('aria-pressed', String(this.touch.enabled));
    text('pay', '$' + this.order.earnings.toFixed(2));
    text('summary', Math.round(this.vehicle.distance - this.orderStartDistance) + ' m · ' + Math.round(this.elapsed) + ' s · 累计 $' + this.order.totalEarnings.toFixed(2));
    const diagnostics = this.hud.querySelector<HTMLElement>('#diagnostics')!;
    diagnostics.style.display = this.diagnostics ? 'block' : 'none';
    const player = this.inCar ? this.vehicle : this.walker;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const average = this.frames.reduce((sum, frame) => sum + frame, 0) / Math.max(1, this.frames.length);
    const seat = this.world.car.inverseTransformPoint(new Vec3(), this.camera.worldPosition);
    const seatDrift = Vec3.distance(seat, DRIVER_EYE);
    const cameraYaw = Math.atan2(-this.camera.forward.x, -this.camera.forward.z);
    const yawDifference = cameraYaw - this.vehicle.yaw - this.driverLookYaw;
    const seatYawDrift = Math.abs(Math.atan2(Math.sin(yawDifference), Math.cos(yawDifference)) * DEG);
    if (this.inCar && this.diagnostics) {
      this.peakSeatDrift = Math.max(this.peakSeatDrift, seatDrift);
      this.peakSeatYawDrift = Math.max(this.peakSeatYawDrift, seatYawDrift);
    }
    const road=this.world.roadProbe(this.vehicle.lastBlocked??this.vehicle);
    text('diagnostics', [
      `Build ${this.buildVersion} · Creator 3.8.8`,
      `Wheel ${(this.vehicle.steering*MAX_ROAD_WHEEL_ANGLE).toFixed(1)} deg · road ${road.roadId} ${road.access} · curb ${road.clearance.toFixed(2)} m · ${road.reason}`,
      `x ${player.x.toFixed(2)}  z ${player.z.toFixed(2)}  yaw ${(player.yaw * DEG).toFixed(1)}`,
      `FPS ${(1 / average).toFixed(1)}  p95 ${((sorted[Math.floor(sorted.length * .95)] || 0) * 1000).toFixed(1)} ms`,
      `${innerWidth} × ${innerHeight}  DPR ${devicePixelRatio}`,
      `View aspect ${this.camera.getComponent(Camera)!.camera.aspect.toFixed(4)} canvas ${(viewport.width / viewport.height).toFixed(4)}`,
      `Seat drift ${seatDrift.toFixed(4)} m (peak ${this.peakSeatDrift.toFixed(4)} m)`,
      `Seat yaw ${seatYawDrift.toFixed(4)} deg (peak ${this.peakSeatYawDrift.toFixed(4)} deg)`,
      `Touch throttle ${this.touch.input.throttle} brake ${Number(this.touch.input.braking)} horizontal ${this.touch.input.horizontal.toFixed(2)}`,
      `Walk eye ${Math.hypot(this.camera.worldPosition.x - this.walker.x, this.camera.worldPosition.z - this.walker.z).toFixed(4)} m`,
      `Audio ${this.music.audio.currentTime.toFixed(2)} s  gain ${this.music.effectiveVolume.toFixed(3)}`,
      `Single player · ${this.music.audio.paused || this.music.audio.error ? 'paused' : 'playing'}`,
      `Context ${this.music.context?.state ?? 'uninitialized'} · music ${this.music.levels.music} environment ${this.music.levels.environment} effects ${this.music.levels.effects}`,
      `Render scale ${director.root!.pipeline.shadingScale.toFixed(2)}`,
      `Car displays ${this.world.carDisplays.mode} · mirror ${Number(this.world.carDisplays.mirror)} · updates ${this.world.carDisplays.mirrorUpdates} panels ${this.world.carDisplays.panelUpdates}`,
      `Draws ${director.root!.device.numDrawCalls} · triangles ${director.root!.device.numTris} · texture ${(director.root!.device.memoryStatus.textureSize/1048576).toFixed(1)} MiB`,
      this.runSummary,
      `District ${this.world.resourceState} · swaps ${this.swaps}`,
      `Route ${JSON.stringify(route.points)}`,
      `Goal ${JSON.stringify(this.inCar?parking:target)}`,
      `Order ${this.order.data.id} · ${this.order.completedOrders} completed · $${this.order.totalEarnings.toFixed(2)}`,
      `Phases ${JSON.stringify(Object.fromEntries(Object.entries(this.timing.seconds).map(([phase,seconds]) => [phase,Math.round(seconds)])))}`,
      `Driving ${this.timing.driving.toFixed(1)} / ${this.timing.total.toFixed(1)} s · ${(100*this.timing.driving/Math.max(1,this.timing.total)).toFixed(1)}%`,
    ].join('\n'));
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    window.removeEventListener('blur', this.clearKeys);
    this.touch?.dispose();
    this.music?.dispose();
    this.world?.dispose();
    this.hud?.remove();
  }
}
