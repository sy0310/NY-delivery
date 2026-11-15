import { TouchInput } from './TouchInput';

/** DOM pointer capture keeps two-thumb controls active when fingers leave a button. */
export class TouchControls {
  readonly input = new TouchInput();
  enabled = matchMedia('(pointer: coarse)').matches;
  private root: HTMLElement;
  private abort = new AbortController();
  private inCar = true;
  private gear = 1;
  private blocked = false;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;

  constructor(private hud: HTMLElement, private canvas: HTMLCanvasElement,
    private look: (x: number, y: number) => void, interact: () => void,
    recenter: () => void, private editor = false) {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.innerHTML = `
      <style>
      #delivery-hud .touch-controls { position:absolute; inset:0; display:none; pointer-events:none; }
      #delivery-hud.touch-mode .touch-controls { display:block; }
      #delivery-hud .touch-controls button, #delivery-hud .stick { touch-action:none; user-select:none; -webkit-user-select:none; }
      #delivery-hud .stick { position:absolute; left:24px; bottom:24px; width:132px; height:132px; border:2px solid #c6d3c18a; border-radius:50%; background:#18333966; pointer-events:auto; }
      #delivery-hud .stick-label { position:absolute; top:8px; width:100%; text-align:center; color:#e7e6cf; font-size:11px; }
      #delivery-hud .stick-knob { position:absolute; left:40px; top:40px; width:48px; height:48px; border:1px solid #d9bd83; border-radius:50%; background:#bfab7dbb; pointer-events:none; }
      #delivery-hud .pedals { position:absolute; bottom:24px; right:24px; display:grid; grid-template-columns:70px 70px; gap:10px; }
      #delivery-hud .pedals button { background:#19353ce6; color:#eee8d6; border:1px solid #99ada3; min-height:44px; border-radius:12px; }
      #delivery-hud .pedals .selected { background:#d9bd83; color:#172c32; }
      #delivery-hud .pedals #touch-brake { height:78px; }
      #delivery-hud .pedals #touch-gas { height:100px; background:repeating-linear-gradient(90deg,#34554eee 0 10px,#294740ee 10px 13px); }
      #delivery-hud .touch-controls button.held { background:#d9bd83 !important; color:#172c32 !important; }
      #delivery-hud #touch-action { position:absolute; bottom:194px; right:24px; min-height:48px; width:150px; }
      #delivery-hud .touch-tools { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); display:flex; gap:8px; }
      #delivery-hud .touch-tools button { min-height:44px; padding:8px 12px; color:#dce4d6; background:#183339ce; border:1px solid #92aaa0; }
      #delivery-hud .look-hint { position:absolute; top:100px; right:24px; font-size:10px; color:#ecedd9; background:#183339b0; padding:3px 7px; border-radius:4px; }
      #delivery-hud .touch-controls[data-mode=walk] .pedals { display:none; }
      #delivery-hud .touch-controls[data-mode=walk] #touch-action { bottom:44px; }
      #delivery-hud .touch-controls.blocked { visibility:hidden; }
      </style>
      <div class="stick" role="application" aria-label="移动摇杆"><span class="stick-label">转向</span><span class="stick-knob"></span></div>
      <div class="look-hint">右侧空白处拖动视角</div>
      <div class="pedals"><button id="gear-drive" class="selected" aria-label="前进档">D 前进</button><button id="gear-reverse" aria-label="倒车档">R 倒车</button><button id="touch-brake">刹车</button><button id="touch-gas">油门</button></div>
      <button id="touch-action">下车</button><div class="touch-tools"><button id="touch-center">视角回正</button></div>`;
    hud.appendChild(this.root);
    const options = { signal: this.abort.signal };
    this.root.addEventListener('click', () => canvas.focus(), options);
    if (editor) {
      this.enabled = false;
      hud.querySelector<HTMLElement>('#touch-toggle')!.hidden = true;
    }
    const stick = this.root.querySelector<HTMLElement>('.stick')!;
    const moveStick = (event: PointerEvent) => {
      const bounds = stick.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width * .34);
      const y = this.inCar ? 0 : (event.clientY - bounds.top - bounds.height / 2) / (bounds.height * .34);
      this.input.moveStick(event.pointerId, x, y);
      this.drawStick();
    };
    stick.addEventListener('pointerdown', event => {
      if (this.editor || this.blocked) return;
      event.preventDefault();
      if (!this.input.beginStick(event.pointerId)) return;
      stick.setPointerCapture(event.pointerId);
      moveStick(event);
    }, options);
    stick.addEventListener('pointermove', moveStick, options);
    const release = (event: PointerEvent) => {
      this.input.release(event.pointerId);
      (event.currentTarget as HTMLElement).classList.remove('held');
      this.drawStick();
    };
    for (const target of [stick, this.button('touch-gas'), this.button('touch-brake')]) {
      target.addEventListener('pointerup', release, options);
      target.addEventListener('pointercancel', release, options);
      target.addEventListener('lostpointercapture', release, options);
    }
    for (const id of ['touch-gas', 'touch-brake']) {
      this.button(id).addEventListener('pointerdown', event => {
        if (this.editor || this.blocked) return;
        event.preventDefault();
        this.button(id).setPointerCapture(event.pointerId);
        this.button(id).classList.add('held');
        this.input.pressPedal(event.pointerId, id === 'touch-brake' ? 'brake' : this.gear > 0 ? 'gas' : 'reverse');
      }, options);
    }
    for (const direction of [1, -1]) {
      this.button(direction > 0 ? 'gear-drive' : 'gear-reverse').addEventListener('click', () => {
        this.clear();
        this.gear = direction;
        this.button('gear-drive').classList.toggle('selected', direction > 0);
        this.button('gear-reverse').classList.toggle('selected', direction < 0);
      }, options);
    }
    this.button('touch-action').addEventListener('click', interact, options);
    this.button('touch-center').addEventListener('click', recenter, options);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', event => {
      if (this.editor || this.blocked) return;
      if (this.lookPointer !== null || event.button !== 0) return;
      const bounds = canvas.getBoundingClientRect();
      if (event.pointerType !== 'mouse' && event.clientX < bounds.left + bounds.width * .4) return;
      this.lookPointer = event.pointerId;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.focus();
      event.preventDefault();
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointer) return;
      const width = canvas.getBoundingClientRect().width;
      this.look((event.clientX - this.lookX) / width * 2.8, (event.clientY - this.lookY) / width * 2.8);
      this.lookX = event.clientX;
      this.lookY = event.clientY;
    }, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(name, (event: PointerEvent) => {
        if (this.lookPointer === event.pointerId) this.lookPointer = null;
      }, options);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); }, options);
    this.applyMode();
  }

  private button(id: string): HTMLButtonElement { return this.root.querySelector<HTMLButtonElement>('#' + id)!; }
  private drawStick(): void {
    const knob = this.root.querySelector<HTMLElement>('.stick-knob')!;
    knob.style.transform = `translate(${this.input.horizontal * 44}px, ${-this.input.forward * 44}px)`;
  }
  private applyMode(): void { this.hud.classList.toggle('touch-mode', this.enabled); }
  toggle(): void { this.enabled = !this.enabled; this.clear(); this.applyMode(); }
  clear(): void {
    this.input.clear();
    this.lookPointer = null;
    this.root.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
    this.drawStick();
  }
  suspend(blocked: boolean): void {
    if (blocked !== this.blocked) this.clear();
    this.blocked = blocked;
    this.root.classList.toggle('blocked',blocked);
  }
  update(inCar: boolean, action: string, enabled = true): void {
    if (inCar !== this.inCar) this.clear();
    this.inCar = inCar;
    this.root.dataset.mode = inCar ? 'drive' : 'walk';
    this.root.querySelector('.stick-label')!.textContent = inCar ? '‹  转向  ›' : '移动';
    this.button('touch-action').textContent = action.replace('E · ', '');
    this.button('touch-action').disabled = !enabled;
  }
  dispose(): void { this.abort.abort(); this.root.remove(); }
}
