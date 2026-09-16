import { ColliderDesc, QueryFilterFlags, RigidBodyDesc, type World } from '@dimforge/rapier3d-compat';
import type { CarModelId } from '../../content/assets/models';
import type { Vec3 } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';
import type { CarIntent } from './carMotor';
import { createNitroState, stepNitro } from './carNitro';

export const CAR_MASS_KG = 1100;
export const CAR_SUSPENSION_REST = .32;
export interface CarMotion {
  speed: number; signedSpeed: number; throttle: number; grounded: boolean;
  nitroActive: boolean; nitroRemaining: number;
  wheelRotation: number[]; wheelSteering: number[]; wheelOffset: number[];
}
export const CAR_WHEELS = {
  admin: [{x:.771,z:1.022,radius:.274,y:.274},{x:-.771,z:1.022,radius:.274,y:.274},{x:.771,z:-.534,radius:.302,y:.302},{x:-.771,z:-.534,radius:.302,y:.302}],
  muscle: [{x:.65,z:1.095,radius:.258,y:.258},{x:-.65,z:1.095,radius:.258,y:.258},{x:.65,z:-1.059,radius:.258,y:.288},{x:-.65,z:-1.059,radius:.258,y:.288}],
} as const;
export function createCarMotion(): CarMotion {
  return {speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:[0,0,0,0],wheelSteering:[0,0,0,0],wheelOffset:[0,0,0,0]};
}

/** A persistent dynamic chassis. Rapier owns gravity, suspension, impacts and slope attitude. */
export function createCarPhysics(world: World, feet: Vec3, heading: number, model: CarModelId) {
  const yaw = Math.PI-heading;
  const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(feet[0],feet[1]+FEET_TO_CENTER,feet[2])
    .setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(6)
    .setAdditionalMassProperties(CAR_MASS_KG,{x:0,y:-.32,z:0},{x:1050,y:1650,z:850},{x:0,y:0,z:0,w:1}));
  // Keep a compact collision belly above the tyres' working travel on uneven tracks.
  const chassis = model === 'admin' ? {x:.65,y:.52,z:1.35,offset:.26} : {x:.78,y:.34,z:1.72,offset:-.02};
  world.createCollider(ColliderDesc.cuboid(chassis.x,chassis.y,chassis.z).setTranslation(0,chassis.offset,0).setDensity(0).setFriction(.4).setRestitution(.03),body);
  // Vehicle suspension reads mass before the first world step.
  body.recomputeMassPropertiesFromColliders();
  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis=1; vehicle.setIndexForwardAxis=2;
  const wheels=CAR_WHEELS[model];
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
  const motion=createCarMotion();
  let reverseArmed=true, steering=0;
  const nitro=createNitroState();
  const sample=()=>{
    const q=body.rotation(),v=body.linvel();
    const forward={x:2*(q.x*q.z+q.w*q.y),y:2*(q.y*q.z-q.w*q.x),z:1-2*(q.x*q.x+q.y*q.y)};
    motion.signedSpeed=v.x*forward.x+v.y*forward.y+v.z*forward.z;
    motion.speed=Math.hypot(v.x,v.z);
    motion.grounded=[0,1,2,3].filter(i=>vehicle.wheelIsInContact(i)).length>=2;
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
      const throttle=occupied?Math.max(-1,Math.min(1,intent.forward)):0;
      stepNitro(nitro, occupied && throttle>0 && intent.nitro===true, dt);
      motion.nitroActive=nitro.active;
      motion.nitroRemaining=nitro.remaining;
      if(occupied&&(throttle!==0||intent.steer!==0))body.wakeUp();
      const speed=motion.signedSpeed;
      let brake=!occupied||intent.brake || (throttle === 0 && Math.abs(intent.steer) < .05), force=0;
      if(throttle===0&&Math.abs(speed)<.25) reverseArmed=true;
      // Low gearing supplies wheel torque against the world's 20 m/s² gravity.
      // Force still goes through tyre contact: no velocity/position overrides,
      // artificial uphill lift, or traction while airborne.
      const driveForce=36000-18000*Math.min(1,Math.abs(speed)/10);
      const maxDriveSpeed = nitro.active ? 20 : 8;
      if(throttle>0) {if(speed<-.3)brake=true;else if(speed<maxDriveSpeed)force=driveForce*throttle*nitro.multiplier;reverseArmed=false;}
      if(throttle<0) {if(speed>.25){brake=true;reverseArmed=false;}else if(reverseArmed&&speed>-4)force=30000*throttle;else brake=true;}
      if(intent.brake){force=0;reverseArmed=false;}
      motion.throttle=occupied&&!brake?Math.abs(throttle):0;
      const target=occupied?-Math.max(-1,Math.min(1,intent.steer))*(.5-.23*Math.min(1,Math.abs(speed)/(nitro.active?20:14))):0;
      steering+=(target-steering)*(1-Math.exp(-8*dt));
      for(let i=0;i<4;i++) {
        vehicle.setWheelSteering(i,i<2?steering:0);
        vehicle.setWheelEngineForce(i,brake?0:force/4);
        vehicle.setWheelBrake(i,brake?CAR_MASS_KG*(occupied?24:100)*dt/4:throttle===0?CAR_MASS_KG*.5*dt/4:0);
      }
      vehicle.updateVehicle(dt,QueryFilterFlags.EXCLUDE_SENSORS,undefined,candidate=>candidate.parent()?.handle!==body.handle);
      // A straight input should not accumulate a tiny yaw from asymmetric
      // suspension contacts. Preserve pitch/roll for slopes, while removing
      // lateral drift so a car tracks the road it is facing.
      if (Math.abs(intent.steer) < 1e-4) {
        const q = body.rotation(), v = body.linvel();
        const forwardX = 2 * (q.x * q.z + q.w * q.y), forwardZ = 1 - 2 * (q.x * q.x + q.y * q.y);
        const length = Math.hypot(forwardX, forwardZ) || 1;
        const fx = forwardX / length, fz = forwardZ / length, along = v.x * fx + v.z * fz;
        body.setLinvel({ x: fx * along, y: v.y, z: fz * along }, true);
        const angular = body.angvel();
        body.setAngvel({ x: angular.x, y: 0, z: angular.z }, true);
      }
      if (throttle === 0 && Math.abs(intent.steer) < .05) {
        const parkedVelocity = body.linvel();
        body.setLinvel({ x: 0, y: Math.abs(parkedVelocity.y) < 0.15 ? 0 : parkedVelocity.y, z: 0 }, true);
      }
    },
    dispose(){world.removeVehicleController(vehicle);world.removeRigidBody(body);},
  };
}
export type CarPhysics = ReturnType<typeof createCarPhysics>;
