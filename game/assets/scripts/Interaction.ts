import type { OrderStage } from './OrderState';

export interface TargetRange { distance: number; angle: number }
export interface InteractionContext {
  stage: OrderStage;
  inCar: boolean;
  speed: number;
  queueJoined: boolean;
  ready: boolean;
  pickup: TargetRange;
  dropoff: TargetRange;
  carDistance: number;
}
export type InteractionKind = 'accept' | 'continue' | 'exit' | 'deliver' | 'queue'
  | 'pickup' | 'wait' | 'stow-enter' | 'enter' | 'none';
export interface Interaction { kind: InteractionKind; label: string; enabled: boolean }

const reachable = (target: TargetRange): boolean => target.distance < 2.6
  && (target.distance < 1.25 || Math.abs(target.angle) < Math.PI * .58);

/** Current task targets take precedence over nearby transport, with one result for UI and execution. */
export function resolveInteraction(context: InteractionContext): Interaction {
  const action = (kind: InteractionKind, label: string, enabled = true): Interaction => ({kind, label, enabled});
  if (context.stage === 'idle') return action('accept', '接下这一单');
  if (context.stage === 'delivered') return action('continue', '继续接单');
  if (context.inCar) return action('exit', Math.abs(context.speed) < .15 ? '停稳下车' : '先刹停车辆', Math.abs(context.speed) < .15);
  if (context.stage === 'delivering' && reachable(context.dropoff)) return action('deliver', '交付餐袋');
  if (context.stage === 'accepted' && reachable(context.pickup)) {
    if (!context.queueJoined) return action('queue', '加入取餐队列');
    return context.ready ? action('pickup', '出示手机并核对餐袋') : action('wait', '正在备餐 / 排队', false);
  }
  if (context.carDistance < 3.4) {
    if (context.stage === 'carrying' || context.stage === 'delivering') return action('stow-enter', '装餐并上车');
    return action('enter', '上车');
  }
  return action('none', '靠近当前目标', false);
}

export function directionTo(player: {x: number; z: number; yaw: number}, target: {x: number; z: number}): {
  distance: number; angle: number; turn: 'straight' | 'left' | 'right' | 'back'; symbol: string;
} {
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const relative = Math.atan2(-dx, -dz) - player.yaw;
  const angle = Math.atan2(Math.sin(relative), Math.cos(relative));
  let turn: 'straight' | 'left' | 'right' | 'back' = 'straight';
  if (Math.abs(angle) > 2.4) turn = 'back';
  else if (angle > .35) turn = 'left';
  else if (angle < -.35) turn = 'right';
  return {distance: Math.hypot(dx, dz), angle, turn, symbol: {straight:'↑', left:'←', right:'→', back:'↶'}[turn]};
}
