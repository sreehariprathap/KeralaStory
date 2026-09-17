import { QueryFilterFlags } from '@dimforge/rapier3d-compat';
import type { Collider, KinematicCharacterController, Vector, World } from '@dimforge/rapier3d-compat';
import { GRAVITY, JUMP_SPEED } from './controllerMath';

export interface MotorState { grounded: boolean; verticalSpeed: number }
export interface MotorIntent {
  xVelocity: number; zVelocity: number; jump: boolean;
  /** Overrides for vehicles: `snap: false` lets a fast bike leave the ground over crests. */
  jumpSpeed?: number; gravity?: number; snap?: boolean;
}

export function createExplorerMotor(world: World): KinematicCharacterController {
  const controller = world.createCharacterController(0.025);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setSlideEnabled(true);
  controller.enableAutostep(0.32, 0.22, false);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI * 0.29);
  controller.enableSnapToGround(0.25);
  controller.setApplyImpulsesToDynamicBodies(false);
  return controller;
}

/** One fixed physics step. Returns collision-constrained translation; the caller owns the body. */
export function computeExplorerMovement(controller: KinematicCharacterController, collider: Collider, state: MotorState, intent: MotorIntent, dt: number): Vector {
  if (intent.jump && state.grounded) {
    state.verticalSpeed = intent.jumpSpeed ?? JUMP_SPEED;
    state.grounded = false;
  }
  state.verticalSpeed = Math.max(-30, state.verticalSpeed + (intent.gravity ?? GRAVITY) * dt);
  if (state.grounded && state.verticalSpeed < 0) state.verticalSpeed = -2;
  if (state.verticalSpeed > 0 || intent.snap === false) controller.disableSnapToGround(); else controller.enableSnapToGround(0.25);
  const desired = { x: intent.xVelocity * dt, y: state.verticalSpeed * dt, z: intent.zVelocity * dt };
  const bodyHandle = collider.parent()?.handle;
  controller.computeColliderMovement(collider, desired, QueryFilterFlags.EXCLUDE_SENSORS, undefined, candidate => candidate.parent()?.handle !== bodyHandle);
  const corrected = controller.computedMovement();
  state.grounded = controller.computedGrounded();
  if (state.grounded && state.verticalSpeed < 0) state.verticalSpeed = -2;
  if (state.verticalSpeed > 0 && corrected.y < desired.y - 0.001) state.verticalSpeed = 0;
  return corrected;
}
