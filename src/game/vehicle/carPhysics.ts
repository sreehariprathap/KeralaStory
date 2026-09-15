import { ColliderDesc, QueryFilterFlags, RigidBodyDesc, type World } from '@dimforge/rapier3d-compat';
import type { CarModelId } from '../../content/assets/models';
import type { Vec3 } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';
import type { CarIntent } from './carMotor';
import { createNitroState, stepNitro } from './carNitro';

export const CAR_MASS_KG = 1100;
export const CAR_SUSPENSION_REST = .28;
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
    .setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(1.8)
    .setAdditionalMassProperties(CAR_MASS_KG,{x:0,y:-.32,z:0},{x:1050,y:1650,z:850},{x:0,y:0,z:0,w:1}));
  const chassis = model === 'admin' ? {x:.65,y:.58,z:1.45,offset:.20} : {x:.78,y:.38,z:1.78,offset:-.08};
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
    vehicle.setWheelSuspensionStiffness(i,150);
    vehicle.setWheelSuspensionCompression(i,8);
    vehicle.setWheelSuspensionRelaxation(i,12);
    vehicle.setWheelMaxSuspensionTravel(i,.20);
    vehicle.setWheelMaxSuspensionForce(i,30000);
    vehicle.setWheelFrictionSlip(i,2.2);
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
      let brake=!occupied||intent.brake, force=0;
      if(throttle===0&&Math.abs(speed)<.25) reverseArmed=true;
      if(throttle>0) {if(speed<-.3)brake=true;else if(speed<(nitro.active?20:14))force=4400*throttle*nitro.multiplier;reverseArmed=false;}
      if(throttle<0) {if(speed>.25){brake=true;reverseArmed=false;}else if(reverseArmed&&speed>-4)force=2600*throttle;else brake=true;}
      if(intent.brake){force=0;reverseArmed=false;}
      motion.throttle=occupied&&!brake?Math.abs(throttle):0;
      const target=occupied?-Math.max(-1,Math.min(1,intent.steer))*(.5-.23*Math.min(1,Math.abs(speed)/(nitro.active?20:14))):0;
      steering+=(target-steering)*(1-Math.exp(-8*dt));
      for(let i=0;i<4;i++) {
        vehicle.setWheelSteering(i,i<2?steering:0);
        vehicle.setWheelEngineForce(i,brake?0:force/4);
        vehicle.setWheelBrake(i,brake?CAR_MASS_KG*9*dt/4:throttle===0?CAR_MASS_KG*.5*dt/4:0);
      }
      vehicle.updateVehicle(dt,QueryFilterFlags.EXCLUDE_SENSORS,undefined,candidate=>candidate.parent()?.handle!==body.handle);
    },
    dispose(){world.removeVehicleController(vehicle);world.removeRigidBody(body);},
  };
}
export type CarPhysics = ReturnType<typeof createCarPhysics>;
