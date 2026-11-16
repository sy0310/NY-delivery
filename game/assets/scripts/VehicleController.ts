export const WHEELBASE = 2.76;
export const MAX_ROAD_WHEEL_ANGLE = 35;
const MAX_FORWARD_SPEED = 9.5;
const MAX_REVERSE_SPEED = 2.5;

export interface Position { x: number; z: number }
export type CanMove = (x: number, z: number, radius: number) => boolean;

export class VehicleController {
  x = 2.5;
  z = 23;
  yaw = 0;
  speed = 0;
  distance = 0;
  steering = 0;
  touchingEdge = false;
  private steeringInput = 0;
  private driveInput = 0;

  update(dt: number, throttle: number, steer: number, brake: boolean, canMove: CanMove): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const steps = Math.ceil(Math.min(dt,.5)*120), step = Math.min(dt,.5)/steps;
    const targetSteer = Math.max(-1,Math.min(1,steer));
    const targetDrive = brake ? 0 : Math.max(-1,Math.min(1,throttle));
    this.touchingEdge = false;
    for (let tick=0;tick<steps;tick++) {
      this.steeringInput += Math.max(-step*3,Math.min(step*3,targetSteer-this.steeringInput));
      this.driveInput += Math.max(-step*4,Math.min(step*4,targetDrive-this.driveInput));
      const previousSpeed = this.speed;
      const opposing = this.speed*this.driveInput < 0;
      const limit = this.driveInput < 0 ? MAX_REVERSE_SPEED : MAX_FORWARD_SPEED;
      const acceleration = opposing ? this.driveInput*5.5 : this.driveInput*2.6*(1-.6*Math.abs(this.speed)/limit);
      const resistance = .35 + .007*this.speed*this.speed + (brake ? 7.5 : 0);
      this.speed += acceleration*step;
      this.speed -= Math.sign(this.speed)*Math.min(Math.abs(this.speed),resistance*step);
      if (opposing && previousSpeed*this.speed < 0) this.speed = 0;
      this.speed = Math.max(-MAX_REVERSE_SPEED,Math.min(MAX_FORWARD_SPEED,this.speed));
      // Limit lateral acceleration as speed rises, retaining parking-lock steering at low speed.
      const wheelLimit = Math.min(MAX_ROAD_WHEEL_ANGLE*Math.PI/180,Math.atan(3.6*WHEELBASE/Math.max(1,this.speed*this.speed)));
      const wheelAngle = this.steeringInput*wheelLimit;
      this.steering = wheelAngle/(MAX_ROAD_WHEEL_ANGLE*Math.PI/180);
      const yaw = this.yaw + this.speed*step*Math.tan(wheelAngle)/WHEELBASE;
      let x = this.x-Math.sin(yaw)*this.speed*step;
      let z = this.z-Math.cos(yaw)*this.speed*step;
      const requested = Math.hypot(x-this.x,z-this.z);
      if (!canMove(x,z,1.25)) {
        this.touchingEdge = true;
        // Preserve the legal tangent at glancing contact, so reverse remains usable at a kerb.
        x = canMove(x,this.z,1.25) ? x : this.x;
        z = canMove(x,z,1.25) ? z : this.z;
      }
      const travelled = Math.hypot(x-this.x,z-this.z);
      if (requested>0) this.speed *= travelled/requested;
      if (travelled>1e-7) this.yaw = yaw;
      this.distance += travelled;
      this.x=x;this.z=z;
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
    this.steering = this.steeringInput = this.driveInput = 0;
    this.touchingEdge = false;
  }
}
