/** Surface swimming for the explorer: buoyancy, stroke speed and river drift. Pure; the controller owns the body. */
export const SWIM_SPEED = 2.2;
export const SWIM_SPRINT_SPEED = 3.4;
/** Floating feet depth below the surface: head and shoulders stay above water. */
export const SWIM_FLOAT_DEPTH = 1.25;
/** Feet this deep start swimming; shallower than the exit depth stops it (hysteresis keeps wading stable). */
export const SWIM_ENTER_DEPTH = 1.1;
export const SWIM_EXIT_DEPTH = 0.9;
export const SWIM_CLIMB_SPEED = 5;
/** A ridden bike or a car whose wheels sit this far under the surface is lost. */
export const VEHICLE_SINK_DEPTH = 0.5;
const SPRING = 14, DAMPING = 7;

/** `surface` is null when the point is not open water. */
export function isSwimming(feetY: number, surface: number | null, wasSwimming: boolean): boolean {
  if (surface === null) return false;
  const depth = surface - feetY;
  return depth > (wasSwimming ? SWIM_EXIT_DEPTH : SWIM_ENTER_DEPTH);
}

/** Next vertical speed: a damped spring toward the floating depth, which also soaks up a dive's impact. */
export function buoyantVerticalSpeed(verticalSpeed: number, feetY: number, surface: number, dt: number): number {
  const error = surface - SWIM_FLOAT_DEPTH - feetY;
  const next = verticalSpeed + (error * SPRING - verticalSpeed * DAMPING) * dt;
  return Math.max(-8, Math.min(SWIM_CLIMB_SPEED, next));
}

/** Horizontal swim velocity: the stroke intent plus the river's current. */
export function swimVelocity(intent: { x: number; z: number; running: boolean }, flow: { x: number; z: number }): { x: number; z: number } {
  const speed = intent.running ? SWIM_SPRINT_SPEED : SWIM_SPEED;
  return { x: intent.x * speed + flow.x, z: intent.z * speed + flow.z };
}

export function isSunk(feetY: number, surface: number | null): boolean {
  return surface !== null && feetY < surface - VEHICLE_SINK_DEPTH;
}
