type Pedal = 'gas' | 'reverse' | 'brake';

/** Independent pointer ownership lets movement, looking and pedals coexist. */
export class TouchInput {
  horizontal = 0;
  forward = 0;
  private stick: number | null = null;
  private pedals = new Map<number, Pedal>();

  get throttle(): number {
    const held = [...this.pedals.values()];
    return Number(held.includes('gas')) - Number(held.includes('reverse'));
  }

  get braking(): boolean { return [...this.pedals.values()].includes('brake'); }

  beginStick(pointer: number): boolean {
    if (this.stick !== null) return false;
    this.stick = pointer;
    return true;
  }

  moveStick(pointer: number, x: number, y: number): void {
    if (pointer !== this.stick) return;
    const length = Math.max(1, Math.hypot(x, y));
    this.horizontal = x / length;
    this.forward = -y / length;
  }

  pressPedal(pointer: number, pedal: Pedal): void { this.pedals.set(pointer, pedal); }

  release(pointer: number): void {
    this.pedals.delete(pointer);
    if (this.stick !== pointer) return;
    this.stick = null;
    this.horizontal = this.forward = 0;
  }

  clear(): void {
    this.stick = null;
    this.horizontal = this.forward = 0;
    this.pedals.clear();
  }
}
