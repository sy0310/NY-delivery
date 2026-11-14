import type { CanMove, Position } from './VehicleController';

export class WalkingController {
  x = 0;
  z = 0;
  yaw = 0;

  place(position: Position, yaw: number): void {
    this.x = position.x;
    this.z = position.z;
    this.yaw = yaw;
  }

  update(dt: number, forward: number, strafe: number, canMove: CanMove): void {
    const distance = dt * 3.3 / Math.max(1, Math.hypot(forward, strafe));
    const x = this.x + (Math.cos(this.yaw) * strafe - Math.sin(this.yaw) * forward) * distance;
    const z = this.z - (Math.sin(this.yaw) * strafe + Math.cos(this.yaw) * forward) * distance;
    if (canMove(x, this.z, 0.35)) this.x = x;
    if (canMove(this.x, z, 0.35)) this.z = z;
  }
}
