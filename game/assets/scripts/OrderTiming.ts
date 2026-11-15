import type { OrderStage } from './OrderState';
export class OrderTiming {
  seconds = {toPickupDrive:0, toPickupWalk:0, parking:0, wait:0, handoff:0,
    toCar:0, toDropoffDrive:0, toDropoffWalk:0};
  get total(): number { return Object.values(this.seconds).reduce((sum,value) => sum+value,0); }
  get driving(): number { return this.seconds.toPickupDrive+this.seconds.toDropoffDrive; }
  reset(): void { for (const phase of Object.keys(this.seconds)) this.seconds[phase] = 0; }
  tick(dt: number, stage: OrderStage, inCar: boolean, speed: number, joined: boolean, waiting: boolean): void {
    if (!Number.isFinite(dt) || dt < 0 || stage === 'idle' || stage === 'delivered') return;
    let phase: keyof OrderTiming['seconds'];
    if (inCar) phase = Math.abs(speed) > .15 ? (stage === 'accepted' ? 'toPickupDrive' : 'toDropoffDrive') : 'parking';
    else if (stage === 'accepted') phase = joined ? (waiting ? 'wait' : 'handoff') : 'toPickupWalk';
    else phase = stage === 'carrying' ? 'toCar' : 'toDropoffWalk';
    this.seconds[phase] += dt;
  }
}
