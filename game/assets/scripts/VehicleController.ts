export interface Position { x: number; z: number }
export type CanMove = (x: number, z: number, radius: number) => boolean;

export class VehicleController {
  x = 2.5;
  z = 23;
  yaw = 0;
  speed = 0;
  distance = 0;

  update(dt: number, throttle: number, steer: number, brake: boolean, canMove: CanMove): void {
    const drag = Math.sign(this.speed) * Math.min(Math.abs(this.speed), dt * 0.9);
    this.speed = Math.max(-3, Math.min(13, this.speed + throttle * dt * 4.2 - drag));
    if (brake) this.speed = Math.sign(this.speed) * Math.max(0, Math.abs(this.speed) - dt * 10);
    this.yaw += steer * this.speed * dt * 0.085;
    const x = this.x - Math.sin(this.yaw) * this.speed * dt;
    const z = this.z - Math.cos(this.yaw) * this.speed * dt;
    if (canMove(x, z, 1.25)) {
      this.distance += Math.hypot(x - this.x, z - this.z);
      this.x = x;
      this.z = z;
    } else {
      this.speed = 0;
    }
  }

  exitPosition(canMove: CanMove): Position | null {
    if (Math.abs(this.speed) > 0.15) return null;
    for (const side of [-1, 1]) {
      for (const offset of [0, 1.5, -1.5]) {
        const x = this.x + Math.cos(this.yaw) * side * 1.9 - Math.sin(this.yaw) * offset;
        const z = this.z - Math.sin(this.yaw) * side * 1.9 - Math.cos(this.yaw) * offset;
        if (canMove(x, z, 0.4)) return { x, z };
      }
    }
    return null;
  }

  reset(): void {
    this.x = 2.5;
    this.z = 23;
    this.yaw = 0;
    this.speed = 0;
  }
}
