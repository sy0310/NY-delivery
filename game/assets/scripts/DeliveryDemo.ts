import {
  _decorator, Component, Node, Camera, Color, Vec3, Vec4, resources,
  AudioClip, Material, Font, profiler, game, input, Input, EventKeyboard, EventMouse, KeyCode,
} from 'cc';
import { EDITOR } from 'cc/env';
import { OrderState } from './OrderState';
import { VehicleController } from './VehicleController';
import { WalkingController } from './WalkingController';
import { TouchControls } from './TouchControls';
import { World } from './World';
import { MusicPlayer } from './MusicPlayer';

const { ccclass, property } = _decorator;
const DEG = 180 / Math.PI;
const DRIVER_EYE = new Vec3(-.43, 1.48, .3);
const KEY_BINDINGS: Partial<Record<KeyCode, string>> = {
  [KeyCode.KEY_W]: 'KeyW',
  [KeyCode.KEY_S]: 'KeyS',
  [KeyCode.KEY_A]: 'KeyA',
  [KeyCode.KEY_D]: 'KeyD',
  [KeyCode.KEY_E]: 'KeyE',
  [KeyCode.KEY_R]: 'KeyR',
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
  private order = new OrderState();
  private vehicle = new VehicleController();
  private walker = new WalkingController();
  private world!: World;
  private music!: MusicPlayer;
  private camera!: Node;
  private hud!: HTMLElement;
  private keys = new Set<string>();
  private inCar = true;
  private notice = '傍晚的第一单。先选一首歌，再接单出发。';
  private elapsed = 0;
  private refresh = 0;
  private frames: number[] = [];
  private diagnostics = false;
  private touch!: TouchControls;
  private driverLookYaw = 0;
  private viewPitch = -4;
  private onEditorMouse = (event: EventMouse): void => {
    if (event.type === Input.EventType.MOUSE_DOWN && event.getButton() !== 0) return;
    if (event.type === Input.EventType.MOUSE_MOVE && event.getButton() !== 0) {
      this.touch.editorMouse('mouse-up', 0, 0);
      return;
    }
    const bounds = game.canvas.getBoundingClientRect();
    this.touch.editorMouse(event.type,
      bounds.left + event.getLocationX() / game.canvas.width * bounds.width,
      bounds.bottom - event.getLocationY() / game.canvas.height * bounds.height);
  };
  private peakSeatDrift = 0;
  private peakSeatYawDrift = 0;

  async start(): Promise<void> {
    await Promise.all(['DM-Sans', 'InstrumentSerif'].map(name => new Promise<void>(resolve => {
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
    camera.far = 560;
    camera.clearColor = new Color(188, 209, 222, 255);
    this.music = new MusicPlayer();
    profiler.hideStats();
    this.createHUD();
    resources.load('music/evening-loop', AudioClip, (error, clip) => {
      if (error) this.music.message = '演示曲载入失败，仍可选择本地歌曲';
      else this.music.setDemo(clip.nativeUrl);
    });
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    if (EDITOR) for (const type of [Input.EventType.MOUSE_DOWN, Input.EventType.MOUSE_MOVE, Input.EventType.MOUSE_UP] as const) {
      input.on(type, this.onEditorMouse, this);
    }
    window.addEventListener('blur', this.clearKeys);
    this.updateView();
    this.renderHUD();
  }

  private onKeyDown = (event: EventKeyboard): void => {
    if (document.activeElement?.matches('input,select')) return;
    const code = KEY_BINDINGS[event.keyCode];
    if (!code || this.keys.has(code)) return;
    this.keys.add(code);
    if (code === 'KeyE') this.interact();
    if (code === 'KeyR') this.recover();
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
  private atCounter(): boolean { return !this.inCar && this.distance(-14.3, 0) < 2.6; }

  update(dt: number): void {
    if (!this.world) return;
    if (this.order.stage !== 'idle' && this.order.stage !== 'delivered') this.elapsed += dt;
    this.frames.push(dt);
    if (this.frames.length > 600) this.frames.shift();
    const step = Math.min(dt, .05);
    const controls = this.touch.input;
    const horizontal = Math.max(-1, Math.min(1, this.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) + controls.horizontal));
    const keyboardForward = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const forward = Math.max(-1, Math.min(1, keyboardForward + (this.inCar ? controls.throttle : controls.forward)));
    if (this.inCar) this.vehicle.update(step, forward, -horizontal, this.keys.has('Space') || controls.braking, this.world.canMove);
    else this.walker.update(step, forward, horizontal, (x, z, radius) => {
      const dx = x - this.vehicle.x;
      const dz = z - this.vehicle.z;
      const localX = dx * Math.cos(this.vehicle.yaw) - dz * Math.sin(this.vehicle.yaw);
      const localZ = dx * Math.sin(this.vehicle.yaw) + dz * Math.cos(this.vehicle.yaw);
      return this.world.canMove(x, z, radius) && (Math.abs(localX) > 1.05 + radius || Math.abs(localZ) > 2.15 + radius);
    });
    this.order.tick(Math.min(dt, .25), this.atCounter());
    this.world.npc.active = this.order.queueRemaining > 0;
    this.world.car.setPosition(this.vehicle.x, 0, this.vehicle.z);
    this.world.car.setRotationFromEuler(0, this.vehicle.yaw * DEG, 0);
    this.world.update(dt, {
      speed: this.vehicle.speed,
      steering: this.inCar ? -horizontal : 0,
      distance: this.vehicle.distance,
      x: this.vehicle.x,
      z: this.vehicle.z,
      yaw: this.vehicle.yaw,
      destination: ['stowed', 'delivering', 'delivered'].includes(this.order.stage),
    });
    this.updateView();
    this.updateBag();
    this.music.update(this.inCar, Math.hypot(this.walker.x - this.vehicle.x, this.walker.z - this.vehicle.z));
    this.refresh += dt;
    if (this.refresh > .1) { this.renderHUD(); this.refresh = 0; }
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
    this.camera.setPosition(this.walker.x, 1.7, this.walker.z);
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
        1.05, this.walker.z - .45 * Math.sin(yaw) - .65 * Math.cos(yaw));
    } else if (stage === 'stowed') {
      this.world.bag.setPosition(.45, 1.06, .35);
    } else this.world.bag.setPosition(-15.5, 1.55, -.6);
  }

  private interact(): void {
    if (this.inCar) {
      const exit = this.vehicle.exitPosition(this.world.canMove);
      if (!exit) { this.notice = '先刹停车辆。两侧受阻时挪车后再下车。'; return; }
      this.walker.place(exit, this.vehicle.yaw + this.driverLookYaw);
      this.driverLookYaw = 0;
      this.inCar = false;
      this.clearKeys();
      this.order.retrieve();
      this.notice = this.order.stage === 'delivering'
        ? '已下车。步行到 18 Orchard Walk 门口，按 E 交付。'
        : '已下车。W/S 前后走，A/D 横移，拖动空白处转视角，靠近取餐柜台按 E。';
      return;
    }
    if (this.distance(this.vehicle.x, this.vehicle.z) < 3.4) {
      if (this.order.stage === 'carrying' || this.order.stage === 'delivering') {
        this.order.stow();
        this.notice = '餐袋已放在副驾驶。再次按 E 上车，沿街驶向 18 Orchard Walk。';
        this.music.chime();
      } else {
        this.inCar = true;
        this.recenterView();
        this.vehicle.speed = 0;
        this.clearKeys();
        this.notice = '已系好安全带。W 加速，空格刹车。';
      }
      return;
    }
    if (this.atCounter() && this.order.stage === 'accepted') {
      if (!this.order.queueJoined) {
        this.order.joinQueue();
        this.notice = this.order.kitchenRemaining > 0
          ? '已加入队列。前面还有一位客人，厨房正在备餐。'
          : '已加入队列。餐已备好，请等前面的客人完成取餐。';
      } else this.notice = '留在取餐区等候，轮到你后在手机中输入交接码。';
      return;
    }
    if (this.distance(9.4, -30) < 2.5 && this.order.stage === 'delivering') {
      this.order.deliver();
      this.notice = '送达成功。顾客收到了热餐，结算已完成。';
      this.music.chime();
      return;
    }
    this.notice = '靠近餐厅柜台、汽车或送达门口后按 E。';
  }

  private recover(): void {
    this.vehicle.reset();
    this.recenterView();
    this.walker.place({ x: -5, z: 23 }, 0);
    this.clearKeys();
    this.notice = '已回到起点安全位置，订单与音乐进度保留。';
  }

  private restart(): void {
    if (this.order.stage !== 'delivered') return;
    this.order.restart();
    this.vehicle.reset();
    this.vehicle.distance = 0;
    this.inCar = true;
    this.recenterView();
    this.elapsed = 0;
    this.clearKeys();
    this.notice = '新的一单已准备好，音乐继续。';
    (this.hud.querySelector('#handoff-code') as HTMLInputElement).value = '';
  }

  private orderAction(): void {
    if (this.order.stage === 'delivered') { this.restart(); return; }
    if (this.order.stage !== 'idle') { this.interact(); return; }
    if (this.music.audio.paused) { this.notice = '先点击播放演示曲，或选择一首本地歌曲。'; return; }
    this.order.accept();
    this.music.chime();
    this.notice = '已接单。向前驶向左侧 Juniper Kitchen，停稳后下车。';
  }

  private createHUD(): void {
    this.hud = document.createElement('div');
    this.hud.id = 'delivery-hud';
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
      #delivery-hud .toolbar { position:absolute; top:22px; right:130px; display:flex; gap:8px; pointer-events:auto; }
      #delivery-hud .toolbar button { background:#183339d9; color:#e4e5dc; border:1px solid #718f85; min-height:44px; }
      #delivery-hud:not(.touch-mode) #order-toggle, #delivery-hud:not(.touch-mode) #music-toggle { display:none; }
      #delivery-hud.touch-mode .controls, #delivery-hud.touch-mode .phone, #delivery-hud.touch-mode .music { display:none; }
      #delivery-hud.touch-mode.phone-open .phone, #delivery-hud.touch-mode.music-open .music { display:block; }
      #delivery-hud.touch-mode .top { top:12px; left:16px; }
      #delivery-hud.touch-mode .wordmark { font-size:18px; }
      #delivery-hud.touch-mode .sub { display:none; }
      #delivery-hud.touch-mode .route { margin-top:6px; padding:6px 10px; max-width:300px; }
      #delivery-hud.touch-mode .speed { top:12px; right:16px; }
      #delivery-hud.touch-mode .speed > span:first-child { font-size:32px; }
      #delivery-hud.touch-mode .toolbar { top:12px; right:120px; }
      #delivery-hud.touch-mode .phone { top:74px; right:16px; padding:12px; max-height:calc(100% - 84px); overflow:auto; }
      #delivery-hud.touch-mode .phone button, #delivery-hud.touch-mode .phone input { min-height:44px; }
      #delivery-hud.touch-mode .music button { min-height:44px; }
      #delivery-hud.touch-mode .music { top:74px; left:16px; bottom:auto; width:310px; }
      #delivery-hud.touch-mode .notice { bottom:178px; max-width:360px; font-size:11px; }
      @media (max-width:600px) {
        #delivery-hud.touch-mode .toolbar { top:80px; right:16px; }
        #delivery-hud.touch-mode .route { max-width:240px; }
        #delivery-hud.touch-mode .phone { top:134px; }
        #delivery-hud.touch-mode .music { top:134px; }
        #delivery-hud.touch-mode .notice { bottom:245px; width:calc(100% - 32px); }
        #delivery-hud.touch-mode .look-hint { top:140px; right:16px; }
        #delivery-hud.touch-mode .touch-tools { bottom:174px; left:24px; transform:none; }
      }
      </style>
      <nav class="toolbar"><button id="touch-toggle">触屏操作</button><button id="order-toggle">订单</button><button id="music-toggle">音乐</button></nav>
      <div class="top"><div class="sub">NEW YORK · 6:42 PM</div><div class="wordmark">我在纽约送外卖</div><div class="route" id="route"></div></div>
      <section class="phone"><div class="phone-header"><span>ORCHARD / DELIVERY</span><span>● 4G</span></div><h2 id="restaurant"></h2><div class="muted" id="order-id"></div><div class="order-detail" id="items"></div><div class="muted">交接码</div><div class="code" id="order-code"></div><div class="muted" id="customer"></div><div class="status" id="status"></div>
      <div id="code-panel"><input id="handoff-code" inputmode="numeric" maxlength="4" placeholder="输入交接码" aria-label="交接码"><button id="verify">核对并取餐</button><button id="skip">等餐快进</button></div>
      <button id="action">接单</button><div id="result"><div class="muted">DELIVERED · 本单收入</div><div id="pay"></div><div id="summary" class="muted"></div><button id="restart">开始下一单</button></div></section>
      <div class="controls"><kbd>W / S</kbd> 前进 / 后退　<kbd>A / D</kbd> 驾驶转向 / 步行横移<br>鼠标拖动空白处 · 自由观察　<kbd>SPACE</kbd> 刹车<br><kbd>E</kbd> 上下车 / 交互　<kbd>R</kbd> 卡住恢复<br><kbd>M</kbd> 音乐播放 / 暂停</div>
      <div class="speed"><span id="mph">0</span><span>mph<br><span id="mode">DRIVING</span></span></div>
      <section class="music"><div class="music-title"><span>ORCHARD RADIO</span><span id="music-time">00:00</span></div><div id="track"></div><button id="play">播放 / 暂停</button><button id="choose">本地 MP3 / WAV</button><button id="next">切歌</button><label>音量 <input id="volume" aria-label="音乐音量" type="range" min="0" max="1" step=".01" value=".55"></label><label style="font-size:10px"><input id="continuous" type="checkbox">连续聆听</label></section>
      <div class="notice" id="notice"></div><pre id="diagnostics" style="display:none;position:absolute;left:28px;top:165px;background:#142b30dd;padding:12px;font:11px monospace"></pre>`;
    document.body.appendChild(this.hud);
    this.touch = new TouchControls(this.hud, game.canvas, this.look,
      () => this.orderAction(), this.recenterView, () => this.recover(), EDITOR);
    const on = (id: string, action: () => void) => {
      this.hud.querySelector('#' + id)!.addEventListener('click', () => {
        action();
        game.canvas.focus();
      });
    };
    on('touch-toggle', () => { this.clearKeys(); this.touch.toggle(); });
    on('order-toggle', () => this.hud.classList.toggle('phone-open'));
    on('music-toggle', () => this.hud.classList.toggle('music-open'));
    on('play', () => this.music.toggle());
    on('choose', () => this.music.choose());
    on('next', () => this.music.next());
    on('restart', () => this.restart());
    on('action', () => this.orderAction());
    on('verify', () => {
      const code = (this.hud.querySelector('#handoff-code') as HTMLInputElement).value;
      if (!this.atCounter()) { this.notice = '请回到柜台旁核验取餐。'; return; }
      const taken = this.order.take(code);
      this.notice = taken ? '核验成功。餐袋标签已与手机订单匹配，回车旁按 E 装袋。' : '暂时无法取餐。核对交接码，并等待排队与厨房状态完成。';
      if (taken) this.music.chime();
    });
    on('skip', () => {
      if (this.atCounter() && this.order.queueJoined) {
        this.order.tick(30, true);
        this.notice = '等待已快进，歌曲保持原播放速度。请核对交接码取餐。';
      }
    });
    this.hud.querySelector('#volume')!.addEventListener('input', event => this.music.volume(Number((event.target as HTMLInputElement).value)));
    this.hud.querySelector('#continuous')!.addEventListener('change', event => { this.music.continuous = (event.target as HTMLInputElement).checked; });
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
    const stage = this.order.stage;
    text('restaurant', data.restaurant);
    text('order-id', data.id + ' · $' + data.pay.toFixed(2));
    text('items', data.items);
    text('order-code', data.code);
    text('customer', data.customer + ' · ' + data.address);
    text('mph', String(Math.round(Math.abs(this.vehicle.speed) * 2.23694)));
    text('mode', this.inCar ? 'DRIVING' : 'ON FOOT');
    text('notice', this.notice);
    text('track', this.music.message);
    const time = Math.floor(this.music.audio.currentTime || 0);
    text('music-time', String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0'));
    const routes = {
      idle: '选一首歌，接下傍晚的第一单',
      accepted: `← Juniper Kitchen · ${Math.round(this.distance(-10, 0))} m`,
      carrying: '回到汽车旁 · 按 E 将餐袋装车',
      stowed: `18 Orchard Walk → · ${Math.round(this.distance(9.4, -30))} m`,
      delivering: `携带餐袋 · 18 Orchard Walk → · ${Math.round(this.distance(9.4, -30))} m`,
      delivered: '订单完成 · 享受你的傍晚',
    };
    text('route', routes[stage]);
    const statuses = {
      idle: '歌曲就绪后接单。餐厅在前方左侧。',
      accepted: `队列 ${this.order.queueJoined ? Math.ceil(this.order.queueRemaining) + ' s' : '尚未加入'} · 厨房 ${Math.ceil(this.order.kitchenRemaining)} s`,
      carrying: `餐袋 ${data.id} · 标签 ${data.code} · 已领取`,
      stowed: '餐袋已装车 · 门口下车后按 E 交付',
      delivering: `餐袋 ${data.id} · 标签 ${data.code} · 送往门口`,
      delivered: '已交付 · 本单只结算一次',
    };
    text('status', statuses[stage]);
    this.hud.querySelector<HTMLElement>('#code-panel')!.style.display = stage === 'accepted' && this.order.queueJoined ? 'block' : 'none';
    this.hud.querySelector<HTMLElement>('#result')!.style.display = stage === 'delivered' ? 'block' : 'none';
    this.hud.querySelector<HTMLElement>('#action')!.style.display = stage === 'delivered' ? 'none' : 'block';
    let action = 'E · 交互';
    if (stage === 'delivered') action = '开始下一单';
    else if (stage === 'idle') action = '接单 · $' + data.pay.toFixed(2);
    else if (this.inCar) action = 'E · 停稳下车';
    else if (stage === 'delivering' && this.distance(9.4, -30) < 2.5) action = 'E · 交付';
    else if (this.atCounter() && stage === 'accepted') action = 'E · 排队 / 交接';
    else if (this.distance(this.vehicle.x, this.vehicle.z) < 3.4) {
      action = stage === 'carrying' || stage === 'delivering' ? 'E · 装袋' : 'E · 上车';
    }
    text('action', action);
    this.touch.update(this.inCar, action);
    text('touch-toggle', this.touch.enabled ? '键鼠操作' : '触屏操作');
    this.hud.querySelector('#touch-toggle')!.setAttribute('aria-pressed', String(this.touch.enabled));
    text('pay', '$' + this.order.earnings.toFixed(2));
    text('summary', Math.round(this.vehicle.distance) + ' m · ' + Math.round(this.elapsed) + ' s');
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
    text('diagnostics', [
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
    ].join('\n'));
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    window.removeEventListener('blur', this.clearKeys);
    if (EDITOR) for (const type of [Input.EventType.MOUSE_DOWN, Input.EventType.MOUSE_MOVE, Input.EventType.MOUSE_UP] as const) {
      input.off(type, this.onEditorMouse, this);
    }
    this.touch?.dispose();
    this.music?.dispose();
    this.hud?.remove();
  }
}
