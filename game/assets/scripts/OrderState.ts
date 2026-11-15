export interface OrderData {
  id: string;
  restaurant: string;
  customer: string;
  address: string;
  items: string;
  code: string;
  pay: number;
  bagCount?: number;
  queueSeconds?: number;
  kitchenSeconds?: number;
  note?: string;
  pickup?: {x: number; z: number};
  dropoff?: {x: number; z: number};
  pickupParking?: {x: number; z: number};
  dropoffParking?: {x: number; z: number};
} 

export interface BagLabel {
  orderId: string;
  code: string;
  count: number;
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

export function createOrder(sequence: number): Readonly<OrderData> {
  const variants = [
    {customer: 'Alex Rivera', code: '4826', pay: 9.75, items: DEMO_ORDER.items,
      queueSeconds: 0, kitchenSeconds: 0, bagCount: 1, note: '餐已备好，出示手机取餐码。'},
    {customer: 'Sam Chen', code: '1937', pay: 10.25, items: '1 × Sesame noodles · 1 × Dumplings',
      queueSeconds: 6, kitchenSeconds: 4, bagCount: 1, note: '前面一位骑手，请在取餐线内等候。'},
    {customer: 'Jordan Ellis', code: '6502', pay: 11.5, items: '1 × Rice bowl · 2 × Iced tea',
      queueSeconds: 0, kitchenSeconds: 5, bagCount: 2, note: '共两袋，饮料保持竖直，送到门厅。'},
  ];
  const index = Math.max(0, Math.floor(sequence));
  return Object.freeze({...DEMO_ORDER, ...variants[index % variants.length], id: 'NY-' + (1042 + index)});
}

export type OrderStage = 'idle' | 'accepted' | 'carrying' | 'stowed' | 'delivering' | 'delivered';

/** Shared by the phone, counter and bag. Time is game time, independent of audio. */
export class OrderState {
  private current: Readonly<OrderData>;
  private settled = new Set<string>();
  totalEarnings = 0;
  completedOrders = 0;
  get data(): Readonly<OrderData> { return this.current; }
  stage: OrderStage = 'idle';
  queueJoined = false;
  queueRemaining = 8;
  kitchenRemaining = 24;
  earnings = 0;

  constructor(data: Readonly<OrderData> = DEMO_ORDER) {
    this.current = Object.freeze({ ...data });
    this.resetCurrent();
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

  take(code: string, bag: BagLabel = {orderId: this.data.id, code: this.data.code, count: this.data.bagCount ?? 1}): boolean {
    if (this.stage !== 'accepted' || !this.queueJoined || this.queueRemaining > 0
      || this.kitchenRemaining > 0 || code !== this.data.code || bag.orderId !== this.data.id
      || bag.code !== this.data.code || bag.count !== (this.data.bagCount ?? 1)) return false;
    this.stage = 'carrying';
    return true;
  }

  stow(): boolean {
    if (this.stage !== 'carrying' && this.stage !== 'delivering') return false;
    this.stage = 'stowed';
    return true;
  }

  retrieve(): boolean {
    if (this.stage !== 'stowed') return false;
    this.stage = 'delivering';
    return true;
  }

  deliver(): boolean {
    if (this.stage !== 'delivering' || this.settled.has(this.data.id)) return false;
    this.stage = 'delivered';
    this.earnings = this.data.pay;
    this.totalEarnings += this.data.pay;
    this.completedOrders += 1;
    this.settled.add(this.data.id);
    return true;
  }

  next(data: Readonly<OrderData>): boolean {
    if (this.stage !== 'delivered' || this.settled.has(data.id) || !data.id) return false;
    this.current = Object.freeze({...data});
    this.resetCurrent();
    return true;
  }

  restart(): void {
    this.settled.clear();
    this.totalEarnings = this.completedOrders = 0;
    this.resetCurrent();
  }

  private resetCurrent(): void {
    this.stage = 'idle';
    this.queueJoined = false;
    this.queueRemaining = Math.max(0, this.data.queueSeconds ?? 8);
    this.kitchenRemaining = Math.max(0, this.data.kitchenSeconds ?? 24);
    this.earnings = 0;
  }
}
