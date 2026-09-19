import { ColliderDesc, QueryFilterFlags, RigidBodyDesc, type World } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';
import { createNitroState, stepNitro } from './carNitro';
import { surfaceAt } from '../../content/world/roadSurface';
import { bikeModel, type BikeModelId } from '../../content/assets/bikeProfiles';

export const BIKE_MASS_KG = 220;
const BIKE_SUSPENSION_REST = .18;
const NITRO_EXTRA_SPEED_FALLBACK = 6;
const HANDBRAKE_REAR_GRIP = .55;
const GRIP_ASSIST = 6, DRIFT_ASSIST = 1.1, STRAIGHT_ASSIST = 16;
const SPEED_LIMIT_FADE = 1.2;
/** Direct steering-to-yaw gain (rad/s per rad of steering per m/s of speed), gripping and under the handbrake. */
const STEER_YAW_GAIN = .012, STEER_YAW_HANDBRAKE = .02;
/** Sane ceiling on the manufactured yaw rate (rad/s) so tuning error can never produce a runaway spin. */
const MAX_YAW_RATE = 1.2;
const HOP_IMPULSE_KG_MPS = BIKE_MASS_KG * 6.5;

export interface BikeIntent { forward: number; steer: number; brake: boolean; nitro?: boolean; handbrake?: boolean }
export interface BikeMotion {
  speed: number; signedSpeed: number; throttle: number; grounded: boolean;
  nitroActive: boolean; nitroRemaining: number;
  wheelRotation: number[]; wheelSteering: number[];
}

function createBikeMotion(): BikeMotion {
  return { speed: 0, signedSpeed: 0, throttle: 0, grounded: false, nitroActive: false, nitroRemaining: 0, wheelRotation: [0, 0], wheelSteering: [0, 0] };
}

/** A persistent dynamic chassis on the centerline (front/rear only, no left/right offset) —
 * the same raycast vehicle controller cars use, narrowed to a single-track arcade bike. */
export function createBikePhysics(world: World, feet: Vec3, heading: number, model: BikeModelId) {
  const tuning = bikeModel(model);
  const yaw = Math.PI - heading;
  const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(feet[0], feet[1] + FEET_TO_CENTER, feet[2])
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCcdEnabled(true).setLinearDamping(.15).setAngularDamping(5)
    .setAdditionalMassProperties(BIKE_MASS_KG, { x: 0, y: -.2, z: 0 }, { x: 60, y: 40, z: 90 }, { x: 0, y: 0, z: 0, w: 1 }));
  world.createCollider(ColliderDesc.cuboid(.22, .35, tuning.length / 2).setTranslation(0, .35, 0).setDensity(0).setFriction(.4).setRestitution(.03), body);
  body.recomputeMassPropertiesFromColliders();
  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis = 1; vehicle.setIndexForwardAxis = 2;
  const wheelZ = [tuning.halfWheelbase, -tuning.halfWheelbase];
  wheelZ.forEach((z, i) => {
    const sag = Math.abs(world.gravity.y) / (2 * 150);
    vehicle.addWheel({ x: 0, y: tuning.wheelRadius + BIKE_SUSPENSION_REST - sag - FEET_TO_CENTER, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, BIKE_SUSPENSION_REST, tuning.wheelRadius);
    vehicle.setWheelSuspensionStiffness(i, 260);
    vehicle.setWheelSuspensionCompression(i, 6);
    vehicle.setWheelSuspensionRelaxation(i, 10);
    vehicle.setWheelMaxSuspensionTravel(i, .45);
    vehicle.setWheelMaxSuspensionForce(i, 20000);
    vehicle.setWheelFrictionSlip(i, 3.2);
    vehicle.setWheelSideFrictionStiffness(i, 1);
  });
  const motion = createBikeMotion();
  let reverseArmed = true, steering = 0;
  const nitro = createNitroState();
  const topSpeed = tuning.tuning.topSpeed, boost = tuning.tuning.nitro;
  const sample = () => {
    const q = body.rotation(), v = body.linvel();
    const forward = { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
    motion.signedSpeed = v.x * forward.x + v.y * forward.y + v.z * forward.z;
    motion.speed = Math.hypot(v.x, v.z);
    motion.grounded = [0, 1].filter(i => vehicle.wheelIsInContact(i)).length >= 1;
    wheelZ.forEach((_, i) => { motion.wheelRotation[i] = vehicle.wheelRotation(i) ?? 0; motion.wheelSteering[i] = vehicle.wheelSteering(i) ?? 0; });
    return Math.atan2(forward.x, -forward.z);
  };
  return {
    body, vehicle, motion, sample,
    hop() {
      if (!motion.grounded) return;
      body.applyImpulse({ x: 0, y: HOP_IMPULSE_KG_MPS, z: 0 }, true);
    },
    step(intent: BikeIntent, dt: number, occupied: boolean) {
      sample();
      const surface = surfaceAt(body.translation().x, body.translation().z);
      const throttle = occupied ? Math.max(-1, Math.min(1, intent.forward)) : 0;
      stepNitro(nitro, occupied && !!boost && throttle > 0 && intent.nitro === true, dt);
      motion.nitroActive = nitro.active;
      motion.nitroRemaining = nitro.remaining;
      if (occupied && (throttle !== 0 || intent.steer !== 0)) body.wakeUp();
      const speed = motion.signedSpeed;
      const handbrake = occupied && intent.handbrake === true;
      let brake = !occupied || intent.brake, force = 0;
      if (throttle === 0 && Math.abs(speed) < .2) reverseArmed = true;
      const driveForce = 6000 - 3000 * Math.min(1, Math.abs(speed) / (topSpeed * 1.1));
      const extraSpeed = nitro.active ? (boost?.extraSpeed ?? NITRO_EXTRA_SPEED_FALLBACK) : 0;
      const maxDriveSpeed = (topSpeed + extraSpeed) * surface.topSpeedFactor * Math.max(.2, Math.abs(throttle) || 1);
      const limiter = Math.min(1, Math.max(0, (maxDriveSpeed - speed) / SPEED_LIMIT_FADE));
      if (throttle > 0) { if (speed < -.3) brake = true; else force = driveForce * throttle * nitro.multiplier * limiter; reverseArmed = false; }
      if (throttle < 0) { if (speed > .2) { brake = true; reverseArmed = false; } else if (reverseArmed && speed > -4) force = 3000 * throttle; else brake = true; }
      if (intent.brake) { force = 0; reverseArmed = false; }
      motion.throttle = occupied && !brake ? Math.abs(throttle) : 0;
      const lock = .6 - .35 * Math.min(1, Math.abs(speed) / (topSpeed + 3));
      const target = occupied ? -Math.max(-1, Math.min(1, intent.steer)) * (handbrake ? Math.max(lock, .45) : lock) : 0;
      steering += (target - steering) * (1 - Math.exp(-11 * dt));
      for (let i = 0; i < 2; i++) {
        const rear = i === 1;
        vehicle.setWheelSteering(i, rear ? 0 : steering);
        vehicle.setWheelEngineForce(i, brake ? 0 : force * (rear ? .55 : .45));
        vehicle.setWheelFrictionSlip(i, 3.2 * surface.gripFactor);
        vehicle.setWheelSideFrictionStiffness(i, (handbrake && rear ? HANDBRAKE_REAR_GRIP : 1) * surface.gripFactor);
        const coast = throttle === 0 && !handbrake ? BIKE_MASS_KG * 1.1 * dt / 2 : 0;
        vehicle.setWheelBrake(i, brake ? BIKE_MASS_KG * (occupied ? 55 : 90) * dt / 2 : handbrake && rear ? BIKE_MASS_KG * 4 * dt / 2 : coast);
      }
      vehicle.updateVehicle(dt, QueryFilterFlags.EXCLUDE_SENSORS, undefined, candidate => candidate.parent()?.handle !== body.handle);
      const q = body.rotation(), v = body.linvel();
      const forwardX = 2 * (q.x * q.z + q.w * q.y), forwardZ = 1 - 2 * (q.x * q.x + q.y * q.y);
      const length = Math.hypot(forwardX, forwardZ) || 1;
      const fx = forwardX / length, fz = forwardZ / length, along = v.x * fx + v.z * fz, lateral = v.x * fz - v.z * fx;
      if (motion.grounded && occupied) {
        const straight = Math.abs(intent.steer) < 1e-4 && !handbrake;
        const keep = Math.exp(-(handbrake ? DRIFT_ASSIST : straight ? STRAIGHT_ASSIST : GRIP_ASSIST) * dt), bled = lateral * (1 - keep);
        const newAlong = along + Math.sign(along || 1) * Math.abs(bled) * (handbrake ? .2 : .6);
        const newLateral = lateral * keep;
        body.setLinvel({ x: fx * newAlong + fz * newLateral, y: v.y, z: fz * newAlong - fx * newLateral }, true);
        if (straight) { const angular = body.angvel(); body.setAngvel({ x: angular.x, y: 0, z: angular.z }, true); }
        // A narrow, centerline-wheeled single-track body gets very little net yaw torque out of the
        // raycast wheel solver alone (there's no left/right track width to lever a turning moment
        // off), so steering also drives the chassis yaw directly, loosened further by the handbrake.
        const steerYawRate = steering * newAlong * (handbrake ? STEER_YAW_HANDBRAKE : STEER_YAW_GAIN);
        const angular = body.angvel();
        const blendedY = angular.y + (steerYawRate - angular.y) * (1 - Math.exp(-10 * dt));
        // Hard safety clamp on the *total* yaw rate (not just the steering contribution above): a
        // narrow single-track body losing rear grip under the handbrake is a much less stable
        // configuration than a car's wide 4-wheel loss of rear grip, and can make Rapier's own wheel
        // solver spike the chassis into a runaway spin. This ceiling applies regardless of the source.
        body.setAngvel({ x: angular.x, y: Math.max(-MAX_YAW_RATE, Math.min(MAX_YAW_RATE, blendedY)), z: angular.z }, true);
      }
      if ((!occupied && throttle === 0) || (Math.abs(speed) < .5 && (intent.brake || (throttle === 0 && Math.abs(intent.steer) < .05)))) {
        const parkedVelocity = body.linvel();
        body.setLinvel({ x: 0, y: Math.abs(parkedVelocity.y) < 0.15 ? 0 : parkedVelocity.y, z: 0 }, true);
      }
    },
    dispose() { world.removeVehicleController(vehicle); world.removeRigidBody(body); },
  };
}
export type BikePhysics = ReturnType<typeof createBikePhysics>;
