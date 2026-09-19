import { ColliderDesc, QueryFilterFlags, RigidBodyDesc, type World } from '@dimforge/rapier3d-compat';
import type { CarModelId } from '../../content/assets/models';
import type { Vec3 } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';
import type { CarIntent } from './carMotor';
import { createNitroState, stepNitro } from './carNitro';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
import { surfaceAt } from '../../content/world/roadSurface';
import { engineForceShare, isRearWheel } from './wheelLayout';

export const CAR_MASS_KG = 1100;
export const CAR_SUSPENSION_REST = .32;
/** Street cars top out near 90 km/h, the fast ones well past 110; nitrous adds a burst on top. */
export const DEFAULT_TOP_SPEED = 25;
const NITRO_EXTRA_SPEED = 12;
/** Rear tyres' sideways grip with the handbrake pulled: low enough to swing the tail out into a drift. */
const HANDBRAKE_REAR_GRIP = .3;
/** Arcade grip assist: how fast sideways sliding is bled off (1/s), gripping and while drifting. */
const GRIP_ASSIST = 5, DRIFT_ASSIST = .9, STRAIGHT_ASSIST = 14;
/** Downforce per (m/s)² keeps a fast car planted over crests instead of skipping off them. */
const DOWNFORCE = 9;
const SPEED_LIMIT_FADE = 1.5;
/** Tuned reference engine force and steering lock; a profile scales these rather than replacing them. */
const DEFAULT_DRIVE_FORCE = 40000, DEFAULT_STEER_LOCK = .55;
export interface CarMotion {
  speed: number; signedSpeed: number; throttle: number; grounded: boolean;
  nitroActive: boolean; nitroRemaining: number;
  wheelRotation: number[]; wheelSteering: number[]; wheelOffset: number[];
}
export const CAR_WHEELS = Object.fromEntries(Object.entries(VEHICLE_PROFILES).map(([id, profile]) => [id, profile.wheels])) as Record<CarModelId, typeof VEHICLE_PROFILES.admin.wheels>;
export function createCarMotion(wheelCount = 4): CarMotion {
  const perWheel = () => Array.from({ length: wheelCount }, () => 0);
  return {speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:perWheel(),wheelSteering:perWheel(),wheelOffset:perWheel()};
}

/** A persistent dynamic chassis. Rapier owns gravity, suspension, impacts and slope attitude. */
export function createCarPhysics(world: World, feet: Vec3, heading: number, model: CarModelId) {
  const yaw = Math.PI-heading;
  const profile = VEHICLE_PROFILES[model];
  const massKg = profile.massKg ?? CAR_MASS_KG;
  // The {1050,1650,850} inertia below was hand-tuned across the whole car fleet, whose lengths
  // vary 3.2-4.5 m, so it is NOT a function of length for them: a car that does not declare its
  // own mass keeps that tuning exactly. A vehicle that does declare one is outside that fleet and
  // gets inertia scaled off the 3.8 m reference by the dimensional rule, mass x length^2.
  const inertiaScale = profile.massKg === undefined ? 1 : (profile.massKg / CAR_MASS_KG) * (profile.length / 3.8) ** 2;
  const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(feet[0],feet[1]+FEET_TO_CENTER,feet[2])
    .setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(6)
    .setAdditionalMassProperties(massKg,{x:0,y:-.32,z:0},{x:1050*inertiaScale,y:1650*inertiaScale,z:850*inertiaScale},{x:0,y:0,z:0,w:1}));
  // Keep a compact collision belly above the tyres' working travel on uneven tracks.
  const chassis = profile.chassis;
  const topSpeed = profile.topSpeed ?? DEFAULT_TOP_SPEED;
  // Expressed as multipliers on the tuned defaults rather than rewritten formulae: a vehicle that
  // declares nothing divides the default by itself, giving exactly 1 and bit-identical handling.
  const driveScale = (profile.driveForce ?? DEFAULT_DRIVE_FORCE) / DEFAULT_DRIVE_FORCE;
  const lockScale = (profile.steerLock ?? DEFAULT_STEER_LOCK) / DEFAULT_STEER_LOCK;
  const nitroAllowed = profile.nitro !== false;
  world.createCollider(ColliderDesc.cuboid(chassis.x,chassis.y,chassis.z).setTranslation(0,chassis.offset,0).setDensity(0).setFriction(.4).setRestitution(.03),body);
  // Vehicle suspension reads mass before the first world step.
  body.recomputeMassPropertiesFromColliders();
  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis=1; vehicle.setIndexForwardAxis=2;
  const wheels=CAR_WHEELS[model];
  const forceShare=engineForceShare(wheels);
  wheels.forEach((wheel,i)=>{
    // Compensate for static spring compression under the shared world gravity.
    const sag=Math.abs(world.gravity.y)/(4*150);
    vehicle.addWheel({x:wheel.x,y:wheel.radius+CAR_SUSPENSION_REST-sag-FEET_TO_CENTER,z:wheel.z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},CAR_SUSPENSION_REST,wheel.radius);
    vehicle.setWheelSuspensionStiffness(i,350);
    vehicle.setWheelSuspensionCompression(i,8);
    vehicle.setWheelSuspensionRelaxation(i,12);
    vehicle.setWheelMaxSuspensionTravel(i,.60);
    vehicle.setWheelMaxSuspensionForce(i,60000);
    vehicle.setWheelFrictionSlip(i,3.6);
    vehicle.setWheelSideFrictionStiffness(i,1);
  });
  const motion=createCarMotion(wheels.length);
  let reverseArmed=true, steering=0;
  const nitro=createNitroState();
  const sample=()=>{
    const q=body.rotation(),v=body.linvel();
    const forward={x:2*(q.x*q.z+q.w*q.y),y:2*(q.y*q.z-q.w*q.x),z:1-2*(q.x*q.x+q.y*q.y)};
    motion.signedSpeed=v.x*forward.x+v.y*forward.y+v.z*forward.z;
    motion.speed=Math.hypot(v.x,v.z);
    motion.grounded=wheels.filter((_,i)=>vehicle.wheelIsInContact(i)).length>=2;
    wheels.forEach((wheel,i)=>{
      motion.wheelRotation[i]=vehicle.wheelRotation(i)??0;
      motion.wheelSteering[i]=vehicle.wheelSteering(i)??0;
      motion.wheelOffset[i]=(vehicle.wheelChassisConnectionPointCs(i)?.y??0)-(vehicle.wheelSuspensionLength(i)??CAR_SUSPENSION_REST)+FEET_TO_CENTER-wheel.y;
    });
    return Math.atan2(forward.x,-forward.z);
  };
  return { body, vehicle, motion, sample,
    step(intent: CarIntent, dt: number, occupied: boolean) {
      sample();
      const surface=surfaceAt(body.translation().x,body.translation().z);
      const throttle=occupied?Math.max(-1,Math.min(1,intent.forward)):0;
      stepNitro(nitro, nitroAllowed && occupied && throttle>0 && intent.nitro===true, dt);
      motion.nitroActive=nitro.active;
      motion.nitroRemaining=nitro.remaining;
      if(occupied&&(throttle!==0||intent.steer!==0))body.wakeUp();
      const speed=motion.signedSpeed;
      const handbrake=occupied&&intent.handbrake===true;
      // Released throttle coasts on engine braking; only an unoccupied car sits on its brakes.
      let brake=!occupied||intent.brake, force=0;
      if(throttle===0&&Math.abs(speed)<.25) reverseArmed=true;
      // Low gearing supplies wheel torque against the world's 20 m/s² gravity.
      // Force still goes through tyre contact: no velocity/position overrides,
      // artificial uphill lift, or traction while airborne.
      // Punchy low gears that fade toward the top of the rev range: quick off the line, still pulling at speed.
      const driveForce=(40000-22000*Math.min(1,Math.abs(speed)/(topSpeed*1.1)))*driveScale;
      // A part-pressed (analog) throttle asks for a part of top speed, not just part of the engine's pull.
      const maxDriveSpeed = (nitro.active ? topSpeed + NITRO_EXTRA_SPEED : topSpeed) * surface.topSpeedFactor * Math.max(.2, Math.abs(throttle) || 1);
      // Fade force out over the last stretch below the cap. A hard on/off cutoff toggles full
      // torque every few steps at top speed, which rocks the chassis (visible as vibration).
      const limiter = Math.min(1, Math.max(0, (maxDriveSpeed - speed) / SPEED_LIMIT_FADE));
      if(throttle>0) {if(speed<-.3)brake=true;else force=driveForce*throttle*nitro.multiplier*limiter;reverseArmed=false;}
      if(throttle<0) {if(speed>.25){brake=true;reverseArmed=false;}else if(reverseArmed&&speed>-7)force=30000*driveScale*throttle;else brake=true;}
      if(intent.brake){force=0;reverseArmed=false;}
      motion.throttle=occupied&&!brake?Math.abs(throttle):0;
      // Full lock at parking speeds, a fraction of it flat out, so the car darts round corners but stays calm on straights.
      const lock=(.55-.4*Math.min(1,Math.abs(speed)/(topSpeed+4)))*lockScale;
      const target=occupied?-Math.max(-1,Math.min(1,intent.steer))*(handbrake?Math.max(lock,.42):lock):0;
      steering+=(target-steering)*(1-Math.exp(-10*dt));
      for(let i=0;i<wheels.length;i++) {
        const rear=isRearWheel(wheels[i]);
        vehicle.setWheelSteering(i,rear?0:steering);
        // Rear-biased drive, like the muscle cars it imitates: throttle can help swing the tail in a drift.
        vehicle.setWheelEngineForce(i,brake?0:force*forceShare[i]);
        vehicle.setWheelFrictionSlip(i,3.6*surface.gripFactor);
        vehicle.setWheelSideFrictionStiffness(i,(handbrake&&rear?HANDBRAKE_REAR_GRIP:1)*surface.gripFactor);
        const coast=throttle===0&&!handbrake?massKg*1.1*dt/wheels.length:0;
        vehicle.setWheelBrake(i,brake?massKg*(occupied?60:100)*dt/wheels.length:handbrake&&rear?massKg*14*dt/wheels.length:coast);
      }
      vehicle.updateVehicle(dt,QueryFilterFlags.EXCLUDE_SENSORS,undefined,candidate=>candidate.parent()?.handle!==body.handle);
      const q = body.rotation(), v = body.linvel();
      const forwardX = 2 * (q.x * q.z + q.w * q.y), forwardZ = 1 - 2 * (q.x * q.x + q.y * q.y);
      const length = Math.hypot(forwardX, forwardZ) || 1;
      const fx = forwardX / length, fz = forwardZ / length, along = v.x * fx + v.z * fz, lateral = v.x * fz - v.z * fx;
      if (motion.grounded && occupied) {
        // Grip assist: bleed off sideways slide (fast when gripping, slowly under the handbrake so drifts hold),
        // keeping most of that momentum going forward, the way arcade drivers expect a car to "bite".
        // With the wheel centred it tracks straight, the way the car goes where it points when you let go of the stick.
        const straight = Math.abs(intent.steer) < 1e-4 && !handbrake;
        const keep = Math.exp(-(handbrake ? DRIFT_ASSIST : straight ? STRAIGHT_ASSIST : GRIP_ASSIST) * dt), bled = lateral * (1 - keep);
        const newAlong = along + Math.sign(along || 1) * Math.abs(bled) * (handbrake ? .2 : .6);
        const newLateral = lateral * keep;
        body.setLinvel({ x: fx * newAlong + fz * newLateral, y: v.y, z: fz * newAlong - fx * newLateral }, true);
        // Straight ahead with the wheel centred, damp any stray yaw from uneven suspension contact.
        if (straight) {
          const angular = body.angvel();
          body.setAngvel({ x: angular.x, y: 0, z: angular.z }, true);
        }
        const planar = Math.hypot(v.x, v.z);
        // Along the chassis' own down axis, so on a hill it presses into the slope rather than dragging the car back.
        if (planar > 4) {
          const push = DOWNFORCE * planar * planar * dt;
          body.applyImpulse({ x: -2 * (q.x * q.y - q.w * q.z) * push, y: -(1 - 2 * (q.x * q.x + q.z * q.z)) * push, z: -2 * (q.y * q.z + q.w * q.x) * push }, true);
        }
      }
      // Parked, braked to a crawl, or rolling to a stop with no input: hold still rather than creep on a slope.
      if ((!occupied && throttle === 0) || (Math.abs(speed) < .6 && (intent.brake || (throttle === 0 && Math.abs(intent.steer) < .05)))) {
        const parkedVelocity = body.linvel();
        body.setLinvel({ x: 0, y: Math.abs(parkedVelocity.y) < 0.15 ? 0 : parkedVelocity.y, z: 0 }, true);
      }
    },
    dispose(){world.removeVehicleController(vehicle);world.removeRigidBody(body);},
  };
}
export type CarPhysics = ReturnType<typeof createCarPhysics>;
