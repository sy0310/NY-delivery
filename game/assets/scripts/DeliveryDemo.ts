import { _decorator, Component, Node, Camera, Color, Vec3, Vec4, Quat, resources, AudioClip, Material, Font, profiler } from 'cc';
import { OrderState } from './OrderState';
import { VehicleController } from './VehicleController';
import { WalkingController } from './WalkingController';
import { World } from './World';
import { MusicPlayer } from './MusicPlayer';

const { ccclass, property } = _decorator;
const DEG = 180 / Math.PI;

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
  private viewPosition = new Vec3();
  private viewRotation = new Quat();

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
    this.world = new World(this.node, this.surfaceMaterial, this.signMaterial);
    const scene = this.node.scene;
    scene.globals.ambient.skyColor = new Vec4(.55, .52, .6, 1);
    scene.globals.ambient.skyIllum = 18000;
    scene.globals.ambient.groundAlbedo = new Vec4(.22, .17, .15, 1);
    scene.globals.skybox.enabled = false;
    this.camera = new Node('Driver and walking camera');
    this.node.addChild(this.camera);
    const camera = this.camera.addComponent(Camera);
    camera.fov = 70;
    camera.near = .05;
    camera.far = 160;
    camera.clearColor = new Color(185, 153, 152, 255);
    this.music = new MusicPlayer();
    profiler.hideStats();
    this.createHUD();
    resources.load('music/evening-loop', AudioClip, (error, clip) => {
      if (error) this.music.message = '演示曲载入失败，仍可选择本地歌曲';
      else this.music.setDemo(clip.nativeUrl);
    });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearKeys);
    this.updateView(1);
    this.renderHUD();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement)?.matches('input,select')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyE') this.interact();
    if (event.code === 'KeyR') this.recover();
    if (event.code === 'KeyM') this.music.toggle();
    if (event.code === 'F3') { event.preventDefault(); this.diagnostics = !this.diagnostics; }
  };

  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private clearKeys = (): void => { this.keys.clear(); };
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
    this.elapsed += dt;
    this.frames.push(dt);
    if (this.frames.length > 600) this.frames.shift();
    const step = Math.min(dt, .05);
    const forward = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const turn = this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    if (this.inCar) this.vehicle.update(step, forward, turn, this.keys.has('Space'), this.world.canMove);
    else this.walker.update(step, forward, turn, (x, z, radius) => {
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
    this.updateView(Math.min(1, dt * 10));
    this.updateBag();
    this.music.update(this.inCar, Math.hypot(this.walker.x - this.vehicle.x, this.walker.z - this.vehicle.z));
    this.refresh += dt;
    if (this.refresh > .1) { this.renderHUD(); this.refresh = 0; }
  }

  private updateView(blend: number): void {
    const target = new Vec3();
    const yaw = this.inCar ? this.vehicle.yaw : this.walker.yaw;
    if (this.inCar) {
      target.set(this.vehicle.x - .43 * Math.cos(yaw), 1.66,
        this.vehicle.z + .43 * Math.sin(yaw) + .08);
    } else target.set(this.walker.x, 1.7, this.walker.z);
    Vec3.lerp(this.viewPosition, this.viewPosition, target, blend);
    const rotation = Quat.fromEuler(new Quat(), -4, yaw * DEG, 0);
    Quat.slerp(this.viewRotation, this.viewRotation, rotation, blend);
    this.camera.setPosition(this.viewPosition);
    this.camera.setRotation(this.viewRotation);
  }

  private updateBag(): void {
    const stage = this.order.stage;
    this.world.bag.active = stage !== 'idle' && stage !== 'delivered';
    if (stage === 'carrying' || stage === 'delivering') {
      const yaw = this.walker.yaw;
      this.world.bag.setPosition(this.walker.x + .45 * Math.cos(yaw) - .65 * Math.sin(yaw),
        1.05, this.walker.z - .45 * Math.sin(yaw) - .65 * Math.cos(yaw));
    } else if (stage === 'stowed') {
      this.world.bag.setPosition(this.vehicle.x + .45 * Math.cos(this.vehicle.yaw),
        1.26, this.vehicle.z - .45 * Math.sin(this.vehicle.yaw) + .35);
    } else this.world.bag.setPosition(-15.5, 1.55, -.6);
  }

  private interact(): void {
    if (this.inCar) {
      const exit = this.vehicle.exitPosition(this.world.canMove);
      if (!exit) { this.notice = '先刹停车辆。两侧受阻时挪车后再下车。'; return; }
      this.walker.place(exit, this.vehicle.yaw);
      this.inCar = false;
      this.clearKeys();
      this.order.retrieve();
      this.notice = this.order.stage === 'delivering'
        ? '已下车。步行到 18 Orchard Walk 门口，按 E 交付。'
        : '已下车。W/S 步行，A/D 转身，靠近取餐柜台按 E。';
      return;
    }
    if (this.distance(this.vehicle.x, this.vehicle.z) < 3.4) {
      if (this.order.stage === 'carrying' || this.order.stage === 'delivering') {
        this.order.stow();
        this.notice = '餐袋已放在副驾驶。再次按 E 上车，沿街驶向 18 Orchard Walk。';
        this.music.chime();
      } else {
        this.inCar = true;
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
    this.elapsed = 0;
    this.clearKeys();
    this.notice = '新的一单已准备好，音乐继续。';
    (this.hud.querySelector('#handoff-code') as HTMLInputElement).value = '';
  }

  private createHUD(): void {
    this.hud = document.createElement('div');
    this.hud.id = 'delivery-hud';
    this.hud.innerHTML = `
      <style>
      #delivery-hud{position:fixed;inset:0;pointer-events:none;color:#f7eed8;font:14px 'DM-Sans',sans-serif;z-index:100;line-height:1.5}
      #delivery-hud *{box-sizing:border-box}#delivery-hud button,#delivery-hud input{pointer-events:auto;font:inherit}
      #delivery-hud button{background:#e7bb73;color:#183b3d;border:0;border-radius:7px;padding:10px 14px;cursor:pointer;font-weight:700}
      #delivery-hud button:hover{background:#ffe1a9}#delivery-hud button:disabled{opacity:.45;cursor:default}
      #delivery-hud .top{position:absolute;top:22px;left:28px}#delivery-hud .wordmark{font:29px 'InstrumentSerif',serif;letter-spacing:.5px;text-shadow:0 2px 12px #182832}
      #delivery-hud .sub{font-size:11px;letter-spacing:3px;color:#e6d7ba}#delivery-hud .route{margin-top:13px;background:#1b3536ed;border-left:3px solid #e7bb73;padding:10px 16px;max-width:380px}
      #delivery-hud .phone{position:absolute;right:24px;top:22px;width:270px;background:#152b30ed;border:2px solid #6b7a78;border-radius:23px;padding:21px;box-shadow:0 12px 40px #14233155;pointer-events:auto}
      #delivery-hud .phone-header{display:flex;justify-content:space-between;font-size:11px;color:#a9c6bc;letter-spacing:1px}.phone h2{font:24px 'InstrumentSerif',serif;margin:19px 0 4px}.phone .muted{color:#a8bdb8;font-size:12px}
      #delivery-hud .order-detail{border-top:1px solid #54706a;margin-top:15px;padding-top:12px;font-size:12px}
      #delivery-hud .code{font-size:28px;letter-spacing:7px;color:#e7bb73;margin:5px 0}#delivery-hud .status{margin:12px 0;color:#cbded2;font-size:12px;min-height:38px}
      #delivery-hud #action{width:100%}#delivery-hud #code-panel{display:none;margin:10px 0}#handoff-code{background:#ebdfc7;color:#183b3d;width:100%;border:0;border-radius:5px;padding:9px;margin-bottom:7px;letter-spacing:6px}
      #delivery-hud .controls{position:absolute;left:28px;bottom:124px;font-size:12px;background:#193238ce;padding:12px 16px;border-radius:8px;color:#c6d4cc}
      #delivery-hud kbd{color:#ffe0a3;font:12px monospace}#delivery-hud .speed{position:absolute;left:28px;bottom:25px;display:flex;align-items:baseline;gap:9px;text-shadow:0 2px 10px #152b30}
      #delivery-hud #mph{font:64px 'InstrumentSerif',serif}#delivery-hud #mode{font-size:12px;letter-spacing:2px}
      #delivery-hud .music{position:absolute;bottom:24px;left:210px;right:320px;border:1px solid #61796b;background:#183a3be8;border-radius:13px;padding:13px 18px;pointer-events:auto}
      #delivery-hud .music-title{display:flex;justify-content:space-between;font-size:11px;color:#e6c68c;letter-spacing:1px}#delivery-hud #track{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;margin:5px 0 9px}
      #delivery-hud .music button{padding:5px 9px;font-size:11px;margin-right:4px}#delivery-hud input[type=range]{width:78px;accent-color:#e7bb73;vertical-align:middle}
      #delivery-hud .notice{position:absolute;bottom:130px;left:50%;transform:translateX(-50%);max-width:470px;background:#1a3438e6;padding:10px 17px;border-radius:8px;text-align:center;font-size:12px}
      #delivery-hud #result{display:none;margin-top:12px;padding:12px 0;border-top:1px solid #54706a}#delivery-hud #pay{font:32px 'InstrumentSerif',serif;color:#e7bb73}
      @media(max-width:950px){#delivery-hud .phone{width:230px;padding:16px;right:12px}.music{right:255px!important;left:140px!important}.controls{max-width:240px}.wordmark{font-size:23px!important}}
      </style>
      <div class="top"><div class="sub">NEW YORK · 6:42 PM</div><div class="wordmark">我在纽约送外卖</div><div class="route" id="route"></div></div>
      <section class="phone"><div class="phone-header"><span>ORCHARD / DELIVERY</span><span>● 4G</span></div><h2 id="restaurant"></h2><div class="muted" id="order-id"></div><div class="order-detail" id="items"></div><div class="muted">交接码</div><div class="code" id="order-code"></div><div class="muted" id="customer"></div><div class="status" id="status"></div>
      <div id="code-panel"><input id="handoff-code" inputmode="numeric" maxlength="4" placeholder="输入交接码" aria-label="交接码"><button id="verify">核对并取餐</button><button id="skip">等餐快进</button></div>
      <button id="action">接单</button><div id="result"><div class="muted">DELIVERED · 本单收入</div><div id="pay"></div><div id="summary" class="muted"></div><button id="restart">开始下一单</button></div></section>
      <div class="controls"><kbd>W / S</kbd> 加速倒车 / 步行<br><kbd>A / D</kbd> 转向　<kbd>SPACE</kbd> 刹车<br><kbd>E</kbd> 上下车 / 交互　<kbd>R</kbd> 卡住恢复<br><kbd>M</kbd> 音乐播放 / 暂停</div>
      <div class="speed"><span id="mph">0</span><span>mph<br><span id="mode">DRIVING</span></span></div>
      <section class="music"><div class="music-title"><span>ORCHARD RADIO</span><span id="music-time">00:00</span></div><div id="track"></div><button id="play">播放 / 暂停</button><button id="choose">本地 MP3 / WAV</button><button id="next">切歌</button><label>音量 <input id="volume" aria-label="音乐音量" type="range" min="0" max="1" step=".01" value=".55"></label><label style="font-size:10px"><input id="continuous" type="checkbox">连续聆听</label></section>
      <div class="notice" id="notice"></div><pre id="diagnostics" style="display:none;position:absolute;left:28px;top:165px;background:#142b30dd;padding:12px;font:11px monospace"></pre>`;
    document.body.appendChild(this.hud);
    const on = (id: string, action: () => void) => this.hud.querySelector('#' + id)!.addEventListener('click', action);
    on('play', () => this.music.toggle());
    on('choose', () => this.music.choose());
    on('next', () => this.music.next());
    on('restart', () => this.restart());
    on('action', () => {
      if (this.order.stage === 'idle') {
        if (this.music.audio.paused) { this.notice = '先点击播放演示曲，或选择一首本地歌曲。'; return; }
        this.order.accept();
        this.music.chime();
        this.notice = '已接单。向前驶向左侧 Juniper Kitchen，停稳后按 E 下车。';
      } else this.interact();
    });
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
    text('action', stage === 'idle' ? '接单 · $' + data.pay.toFixed(2) : this.inCar ? 'E · 停稳下车' : this.atCounter() && stage === 'accepted' ? 'E · 排队 / 交接' : this.distance(this.vehicle.x, this.vehicle.z) < 3.4 ? stage === 'carrying' || stage === 'delivering' ? 'E · 装袋' : 'E · 上车' : 'E · 交互');
    text('pay', '$' + this.order.earnings.toFixed(2));
    text('summary', Math.round(this.vehicle.distance) + ' m · ' + Math.round(this.elapsed) + ' s');
    const diagnostics = this.hud.querySelector<HTMLElement>('#diagnostics')!;
    diagnostics.style.display = this.diagnostics ? 'block' : 'none';
    const player = this.inCar ? this.vehicle : this.walker;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const average = this.frames.reduce((sum, frame) => sum + frame, 0) / Math.max(1, this.frames.length);
    text('diagnostics', `x ${player.x.toFixed(2)}  z ${player.z.toFixed(2)}  yaw ${(player.yaw * DEG).toFixed(1)}\nFPS ${(1 / average).toFixed(1)}  p95 ${((sorted[Math.floor(sorted.length * .95)] || 0) * 1000).toFixed(1)} ms\n${innerWidth} × ${innerHeight}  DPR ${devicePixelRatio}\nAudio ${this.music.audio.currentTime.toFixed(2)} s  gain ${this.music.effectiveVolume.toFixed(3)}\nSingle player · ${this.music.audio.paused ? 'paused' : 'playing'}`);
  }

  onDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearKeys);
    this.music?.dispose();
    this.hud?.remove();
  }
}
