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

  update(dt: number, forward: number, turn: number, canMove: CanMove): void {
    this.yaw += turn * dt * 1.8;
    const x = this.x - Math.sin(this.yaw) * forward * dt * 3.3;
    const z = this.z - Math.cos(this.yaw) * forward * dt * 3.3;
    if (canMove(x, this.z, 0.35)) this.x = x;
    if (canMove(this.x, z, 0.35)) this.z = z;
  }
}
