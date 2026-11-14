export interface OrderData {
  id: string;
  restaurant: string;
  customer: string;
  address: string;
  items: string;
  code: string;
  pay: number;
}

export const DEMO_ORDER: Readonly<OrderData> = Object.freeze({
  id: 'NY-1042',
  restaurant: 'Juniper Kitchen',
  customer: 'Alex Rivera',
  address: '18 Orchard Walk',
  items: '1 × Mushroom rice · 1 × Ginger tea',
  code: '4826',
  pay: 9.75,
});

export type OrderStage = 'idle' | 'accepted' | 'carrying' | 'stowed' | 'delivered';

/** Shared by the phone, counter and bag. Time is game time, independent of audio. */
export class OrderState {
  readonly data: Readonly<OrderData>;
  stage: OrderStage = 'idle';
  queueJoined = false;
  queueRemaining = 8;
  kitchenRemaining = 24;
  earnings = 0;

  constructor(data: Readonly<OrderData> = DEMO_ORDER) {
    this.data = Object.freeze({ ...data });
  }

  accept(): boolean {
    if (this.stage !== 'idle') return false;
    this.stage = 'accepted';
    return true;
  }

  joinQueue(): boolean {
    if (this.stage !== 'accepted' || this.queueJoined) return false;
    this.queueJoined = true;
    return true;
  }

  tick(seconds: number, inQueue: boolean): void {
    if (this.stage !== 'accepted' || !Number.isFinite(seconds) || seconds < 0) return;
    this.kitchenRemaining = Math.max(0, this.kitchenRemaining - seconds);
    if (this.queueJoined && inQueue) {
      this.queueRemaining = Math.max(0, this.queueRemaining - seconds);
    }
  }

  take(code: string): boolean {
    if (this.stage !== 'accepted' || !this.queueJoined || this.queueRemaining > 0
      || this.kitchenRemaining > 0 || code !== this.data.code) return false;
    this.stage = 'carrying';
    return true;
  }

  stow(): boolean {
    if (this.stage !== 'carrying') return false;
    this.stage = 'stowed';
    return true;
  }

  deliver(): boolean {
    if (this.stage !== 'stowed') return false;
    this.stage = 'delivered';
    this.earnings = this.data.pay;
    return true;
  }

  restart(): void {
    this.stage = 'idle';
    this.queueJoined = false;
    this.queueRemaining = 8;
    this.kitchenRemaining = 24;
    this.earnings = 0;
  }
}
