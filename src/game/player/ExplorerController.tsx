import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat';
import type { Group } from 'three';
import type { BicycleSave, ExplorerControllerProps, TravelMode, Vec3 } from '../../contracts';
import { PARKING_SPOTS, nearestParking, safeGroundPosition, isCycleAllowed, isTravelAllowed } from '../../content/world/definition';
import { useExplorerInput } from '../input/useExplorerInput';
import { clearInput, headingFromMotion, readFollowMovement } from '../input/inputState';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { ExplorerAvatar } from './ExplorerAvatar';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, RUN_SPEED, WALK_SPEED, dampAngle, needsSafeReset } from './controllerMath';
import { computeExplorerMovement, createExplorerMotor } from './characterMotor';
import { BicycleVisual } from '../vehicle/BicycleVisual';
import { createBicycleState, stepBicycle } from '../vehicle/bicycleMotor';
import { CarVisual } from '../vehicle/CarVisual';
import { createCarMotion, createCarPhysics, type CarPhysics } from '../vehicle/carPhysics';
import { resolveClearFeet } from '../vehicle/clearance';
import { interactionReason } from '../vehicle/mountState';
import { configureTravelCollider } from './travelCollider';

export function ExplorerController(props: ExplorerControllerProps) {
  const { mode, profile, spawn, initialHeading = Math.PI, resetToken, sensitivity, reducedMotion } = props;
  const { world, rapier } = useRapier();
  const body = useRef<RapierRigidBody>(null),collider = useRef<RapierCollider>(null),visual=useRef<Group>(null),parkedVisual=useRef<Group>(null),carParkedVisual=useRef<Group>(null);
  const controller=useRef<KinematicCharacterController|null>(null),latest=useRef(props);latest.current=props;
  const input=useExplorerInput(mode,props.onPause,props.onMap,props.inputCommands);
  const azimuth=useRef(-initialHeading),heading=useRef(initialHeading),verticalSpeed=useRef(0);
  const motion=useRef({speed:0,signedSpeed:0,grounded:false,riding:false});
  const safePosition=useRef<Vec3>([...spawn]);
  const tick=useRef(0),ready=useRef(false),riding=useRef(false),vehicle=useRef<TravelMode>('foot'),[showRider,setShowRider]=useState(false);
  const bike=useRef(createBicycleState(initialHeading));
  const car=useRef<CarPhysics|null>(null),carMotion=useRef(createCarMotion()),cameraCar=useRef<RapierRigidBody|null>(null);
  const removeCar=()=>{car.current?.dispose();car.current=null;cameraCar.current=null;carParked.current=null;carMotion.current=createCarMotion();};
  const parked=useRef<BicycleSave>({position:[...PARKING_SPOTS[0].position],headingRad:Math.PI});
  const carParked=useRef<Vec3|null>(null);
  const [spawnedCarModel,setSpawnedCarModel]=useState(props.carModelId);
  const carParkedHeading=useRef(initialHeading);
  const message=useRef(''),messageUntil=useRef(0);
  const previous=useRef({x:spawn[0],y:spawn[1]+FEET_TO_CENTER,z:spawn[2]});
  const report=(text:string)=>{message.current=text;messageUntil.current=tick.current+180;};
  const rotation=(angle:number)=>({x:0,y:Math.sin((Math.PI-angle)/2),z:0,w:Math.cos((Math.PI-angle)/2)});
  const teleport=(feet:Vec3)=>{
    const target={x:feet[0],y:feet[1]+FEET_TO_CENTER,z:feet[2]};
    body.current?.setTranslation(target,true);body.current?.setNextKinematicTranslation(target);previous.current=target;
    verticalSpeed.current=0;motion.current.speed=0;
  };
  const setTravel=(next:TravelMode)=>{
    const ride=next!=='foot'; riding.current=ride;vehicle.current=next;motion.current.riding=ride;setShowRider(ride);bike.current.speed=0;
    if(collider.current)configureTravelCollider(collider.current,next);
    cameraCar.current=next==='car'?(car.current?.body??null):null;
    body.current?.setRotation(ride?rotation(heading.current):{x:0,y:0,z:0,w:1},true);
    clearInput(input.current);
  };
  const clearFeet=(x:number,z:number,nearY:number,ride:boolean|'car',targetHeading=heading.current)=>resolveClearFeet(world,body.current,x,z,nearY,ride,targetHeading);
  const validationPending=useRef(true);
  useEffect(()=>{const c=createExplorerMotor(world);controller.current=c;return()=>{removeCar();controller.current=null;world.removeCharacterController(c);};},[world]);
  useEffect(()=>{
    if(!body.current)return;
    setTravel('foot');teleport(latest.current.spawn);safePosition.current=[...latest.current.spawn];ready.current=false;tick.current=0;validationPending.current=true;carParked.current=null;
    removeCar();heading.current=latest.current.initialHeading??Math.PI;azimuth.current=-heading.current;bike.current=createBicycleState(heading.current);
    const saved=latest.current.bicycleSpawn;
    parked.current=saved?{position:safeGroundPosition(saved.position),headingRad:saved.headingRad}:{position:[...PARKING_SPOTS[0].position],headingRad:Math.PI};
    if(!isCycleAllowed(parked.current.position[0],parked.current.position[2])){const slot=nearestParking(spawn);parked.current={position:[...slot.position],headingRad:slot.headingRad};}
    motion.current.grounded=false;
    // Repositioning is driven by resetToken; other prop changes must not teleport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[resetToken]);
  useEffect(()=>{if(mode!=='playing'&&mode!=='loading'){verticalSpeed.current=0;motion.current.speed=0;bike.current.speed=0;}car.current?.body.setEnabled(mode==='playing'||mode==='loading');},[mode]);
  const lastReturn=useRef(props.returnBicycleToken);
  useEffect(()=>{
    if(lastReturn.current===props.returnBicycleToken)return;lastReturn.current=props.returnBicycleToken;
    if(riding.current||!body.current)return;
    const p=body.current.translation(),slot=nearestParking([p.x,p.y-FEET_TO_CENTER,p.z]);
    if(Math.hypot(p.x-slot.position[0],p.z-slot.position[2])>8){report('bicycle.returnPark');return;}
    const valid=clearFeet(slot.position[0],slot.position[2],slot.position[1],true,slot.headingRad);
    if(valid){parked.current={position:valid,headingRad:slot.headingRad};report('bicycle.returned');}else report('bicycle.parkingBlocked');
  },[props.returnBicycleToken]);
  const lastCarSpawn=useRef(props.carSpawnToken);
  useEffect(()=>{
    if(lastCarSpawn.current===props.carSpawnToken)return;lastCarSpawn.current=props.carSpawnToken;
    const rigidBody=body.current;if(!rigidBody)return;
    const position=rigidBody.translation(),feet:Vec3=[position.x,position.y-FEET_TO_CENTER,position.z];
    if(vehicle.current!=='foot'){report('Exit your vehicle before spawning a car.');return;}
    const candidates:[[number,number],[number,number],[number,number],[number,number]]=[[0,4],[2,4],[-2,4],[0,-4]];
    for(const [right,forward] of candidates){const x=feet[0]+Math.cos(heading.current)*right+Math.sin(heading.current)*forward,z=feet[2]-Math.sin(heading.current)*right-Math.cos(heading.current)*forward;const valid=clearFeet(x,z,feet[1],'car',heading.current);if(valid&&isTravelAllowed('car',x,z)){removeCar();const model=latest.current.carModelId??'admin';car.current=createCarPhysics(world,valid,heading.current,model);carMotion.current=car.current.motion;car.current.body.setEnabled(latest.current.mode==='playing'||latest.current.mode==='loading');carParked.current=valid;carParkedHeading.current=heading.current;setSpawnedCarModel(model);report('Car ready nearby. Press F to drive.');return;}}
    report('No clear space to spawn the car.');
  },[props.carSpawnToken]);

  useBeforePhysicsStep(()=>{
    const rigidBody=body.current,shape=collider.current,character=controller.current;if(!rigidBody||!shape||!character)return;
    const position=rigidBody.translation();previous.current={...position};
    const playing=latest.current.mode==='playing';
    if(!playing&&latest.current.mode!=='loading'){rigidBody.setNextKinematicTranslation(position);motion.current.speed=0;return;}
    let blockedDrive=false;
    if(car.current&&vehicle.current==='car'){
      const p=car.current.body.translation(),v=car.current.body.linvel();
      const nx=p.x+v.x*.5,nz=p.z+v.z*.5;
      blockedDrive=!isTravelAllowed('car',nx,nz);
      if(blockedDrive)report('bicycle.walkOnly');
    }
    car.current?.step({forward:playing&&!blockedDrive?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:input.current.brake||!playing||blockedDrive,nitro:playing&&!blockedDrive&&vehicle.current==='car'&&(input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'))},Math.min(world.timestep,1/30),vehicle.current==='car');
    if(needsSafeReset(position)){
      setTravel('foot');teleport(safePosition.current);validationPending.current=true;const slot=nearestParking(safePosition.current);parked.current={position:[...slot.position],headingRad:slot.headingRad};removeCar();return;
    }
    const feet:Vec3=[position.x,position.y-FEET_TO_CENTER,position.z];
    if(validationPending.current&&tick.current>=2){
      validationPending.current=false;
      let valid=clearFeet(feet[0],feet[2],feet[1],false);
      const slots=[...PARKING_SPOTS].sort((a,b)=>Math.hypot(a.position[0]-feet[0],a.position[2]-feet[2])-Math.hypot(b.position[0]-feet[0],b.position[2]-feet[2]));
      if(!valid)for(const slot of slots){valid=clearFeet(slot.position[0],slot.position[2],slot.position[1],false);if(valid)break;}
      if(!valid){latest.current.onError?.('No safe trail position is available. Please reload the scene.');return;}
      teleport(valid);safePosition.current=valid;
      const p=parked.current.position;
      let bikeFeet=clearFeet(p[0],p[2],p[1],true,parked.current.headingRad);
      if(!bikeFeet)for(const slot of slots){bikeFeet=clearFeet(slot.position[0],slot.position[2],slot.position[1],true,slot.headingRad);if(bikeFeet){parked.current.headingRad=slot.headingRad;break;}}
      if(bikeFeet)parked.current.position=bikeFeet;
      if(Math.hypot(valid[0]-parked.current.position[0],valid[2]-parked.current.position[2])<.7){
        for(const side of [-1,1]){const beside=clearFeet(valid[0]+1.1*side,valid[2],valid[1],false);if(beside){teleport(beside);safePosition.current=beside;break;}}
      }
      return;
    }

    if(playing&&input.current.interactQueued){
      input.current.interactQueued=false;
      const bicycleDistance=Math.hypot(position.x-parked.current.position[0],position.z-parked.current.position[2]);
      const carDistance=carParked.current?Math.hypot(position.x-carParked.current[0],position.z-carParked.current[2]):Infinity;
      const nearby=carDistance<bicycleDistance?'car':'bicycle';
      const reason=interactionReason(vehicle.current,motion.current.grounded,vehicle.current==='car'?carMotion.current.speed:bike.current.speed,vehicle.current==='foot'?Math.min(bicycleDistance,carDistance):0,vehicle.current==='foot'?3.5:2);
      if(reason==='mount'){
        const isCar=nearby==='car', vehiclePosition=isCar?carParked.current:parked.current.position;
        if(!vehiclePosition) return;
        const vehicleHeading=isCar?carParkedHeading.current:parked.current.headingRad;heading.current=vehicleHeading;
        const valid=isCar?(carMotion.current.grounded&&carMotion.current.speed<.5?vehiclePosition:null):clearFeet(vehiclePosition[0],vehiclePosition[2],vehiclePosition[1],true,vehicleHeading);
        if(valid&&isTravelAllowed(isCar?'car':'bicycle',vehiclePosition[0],vehiclePosition[2])){if(!isCar)bike.current=createBicycleState(heading.current);setTravel(nearby);teleport(valid);azimuth.current=-heading.current;report('');return;}
        report('bicycle.noClearance');
      }else if(reason==='dismount'){
        let valid:Vec3|null=null;
        const dismountDistance=vehicle.current==='car'?1.55:1.05;
        for(const side of [-1,1]){valid=clearFeet(position.x+Math.cos(heading.current)*dismountDistance*side,position.z+Math.sin(heading.current)*dismountDistance*side,feet[1],false);if(valid){const velocity={x:valid[0]-position.x,y:valid[1]-feet[1],z:valid[2]-position.z};const hit=world.castShape(position,{x:0,y:0,z:0,w:1},velocity,new rapier.Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),.01,1,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,rigidBody,candidate=>vehicle.current!=='car'||candidate.parent()?.handle!==car.current?.body.handle);if(hit&&hit.time_of_impact<.99)valid=null;else break;}}
        if(valid){if(vehicle.current==='car'){carParked.current=feet;carParkedHeading.current=heading.current;}else parked.current={position:feet,headingRad:heading.current};setTravel('foot');teleport(valid);report('');return;}
        report('bicycle.noClearance');
      }else if(reason==='brake')report('bicycle.brakeToDismount');
    }
    const dt=Math.min(world.timestep,1/30),intent=readFollowMovement(input.current,azimuth.current);
    if(vehicle.current==='car'){input.current.sprintLocked=false;input.current.jumpQueued=false;return;}
    const desiredSpeed=playing?(intent.running?RUN_SPEED:WALK_SPEED):0;
    let vx=intent.x*desiredSpeed,vz=intent.z*desiredSpeed;
    if(riding.current){
      input.current.sprintLocked=false;
      const activeMotor=bike.current;
      const oldHeading=activeMotor.headingRad;
      const delta=stepBicycle(bike.current,{forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:input.current.brake||!playing},dt);
      vx=delta.x/dt;vz=delta.z/dt;
      if(vehicle.current==='bicycle'&&!isCycleAllowed(position.x+delta.x,position.z+delta.z)){vx=0;vz=0;bike.current.speed=0;report('bicycle.walkOnly');}
      if(Math.abs(oldHeading-activeMotor.headingRad)>.0001){
        let clear=true,raisedY=feet[1];
        for(const fraction of [.5,1]){const check=clearFeet(position.x,position.z,feet[1],true,oldHeading+(activeMotor.headingRad-oldHeading)*fraction);if(!check){clear=false;break;}raisedY=Math.max(raisedY,check[1]);}
        if(!clear){activeMotor.headingRad=oldHeading;activeMotor.speed=0;vx=0;vz=0;}
        else if(raisedY>feet[1]+.01){position.y=raisedY+FEET_TO_CENTER;rigidBody.setTranslation(position,true);}
      }
      heading.current=activeMotor.headingRad;rigidBody.setRotation(rotation(heading.current),true);
    }
    const state={grounded:motion.current.grounded,verticalSpeed:verticalSpeed.current};
    const corrected=computeExplorerMovement(character,shape,state,{xVelocity:vx,zVelocity:vz,jump:playing&&!riding.current&&input.current.jumpQueued},dt);
    input.current.jumpQueued=false;verticalSpeed.current=state.verticalSpeed;motion.current.grounded=state.grounded;
    if(riding.current&&Math.hypot(corrected.x,corrected.z)<Math.hypot(vx,vz)*dt*.3)bike.current.speed=0;
    rigidBody.setNextKinematicTranslation({x:position.x+corrected.x,y:position.y+corrected.y,z:position.z+corrected.z});
  });
  useAfterPhysicsStep(()=>{
    const rigidBody=body.current;if(!rigidBody)return;
    if(car.current){const carHeading=car.current.sample(),p=car.current.body.translation();carParked.current=[p.x,p.y-FEET_TO_CENTER,p.z];carParkedHeading.current=carHeading;if(vehicle.current==='car'){heading.current=carHeading;rigidBody.setTranslation(p,true);rigidBody.setNextKinematicTranslation(p);motion.current.grounded=carMotion.current.grounded;}}
    const p=rigidBody.translation(),dt=Math.min(world.timestep,1/30),dx=p.x-previous.current.x,dz=p.z-previous.current.z;
    motion.current.speed=vehicle.current==='car'?carMotion.current.speed:Math.hypot(dx,dz)/dt;motion.current.signedSpeed=vehicle.current==='car'?carMotion.current.signedSpeed:motion.current.speed*(riding.current?Math.sign(bike.current.speed):1);
    if(!riding.current&&motion.current.speed>.06)heading.current=headingFromMotion(dx,dz);
    const feet:Vec3=[p.x,p.y-FEET_TO_CENTER,p.z];
    if(!riding.current&&motion.current.grounded&&!needsSafeReset(p))safePosition.current=feet;
    tick.current++;
    if(!ready.current&&!validationPending.current&&motion.current.grounded&&tick.current>=3){ready.current=true;latest.current.onReady?.();}
    if(tick.current%6===0||tick.current===1){
      const bicycleDistance=Math.hypot(p.x-parked.current.position[0],p.z-parked.current.position[2]);
      const carDistance=carParked.current?Math.hypot(p.x-carParked.current[0],p.z-carParked.current[2]):Infinity;
      const reason=interactionReason(vehicle.current,motion.current.grounded,vehicle.current==='car'?carMotion.current.speed:bike.current.speed,vehicle.current==='foot'?Math.min(bicycleDistance,carDistance):0,vehicle.current==='foot'?3.5:2);
      latest.current.onSnapshot({position:feet,headingRad:heading.current,speed:motion.current.speed,grounded:motion.current.grounded,travelMode:vehicle.current,sprintLocked:input.current.sprintLocked,canInteract:reason==='mount'||reason==='dismount'||reason==='brake',bicycle:vehicle.current==='bicycle'?{position:feet,headingRad:heading.current}:parked.current,nitroActive:vehicle.current==='car'&&carMotion.current.nitroActive,nitroRemaining:vehicle.current==='car'?carMotion.current.nitroRemaining:0,interactionMessage:tick.current<messageUntil.current&&message.current?message.current:vehicle.current==='foot'&&carDistance<bicycleDistance&&reason==='mount'?'Press F to enter car.':''});
    }
  });
  useFrame((_,delta)=>{
    if(visual.current)visual.current.rotation.y=riding.current?0:dampAngle(visual.current.rotation.y,Math.PI-heading.current,1-Math.exp(-15*Math.min(delta,.06)));
    if(parkedVisual.current){parkedVisual.current.visible=vehicle.current!=='bicycle';parkedVisual.current.position.set(...parked.current.position);parkedVisual.current.rotation.y=Math.PI-parked.current.headingRad;}
    if(carParkedVisual.current){carParkedVisual.current.visible=car.current!==null;if(car.current){carParkedVisual.current.position.copy(car.current.body.translation());carParkedVisual.current.quaternion.copy(car.current.body.rotation());}}
  });
  return <>
    <group ref={parkedVisual}><BicycleVisual/></group>
    <group ref={carParkedVisual} visible={false}><group position={[0,-FEET_TO_CENTER,0]}>{spawnedCarModel&&<CarVisual modelId={spawnedCarModel} motion={carMotion} active={showRider&&vehicle.current==='car'&&mode==='playing'} reducedMotion={reducedMotion}/>}</group></group>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0],spawn[1]+FEET_TO_CENTER,spawn[2]]} enabledRotations={[false,false,false]} name="explorer-body">
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS]} friction={0}/>
      <group ref={visual} position={[0,-FEET_TO_CENTER,0]} rotation={[0,Math.PI-initialHeading,0]}>
        {showRider&&vehicle.current==='bicycle'&&<BicycleVisual motion={motion}/>}
        <group visible={!(showRider&&vehicle.current==='car')} position={[0,showRider?.25:0,showRider?-.2:0]}><ExplorerAvatar profile={profile} reducedMotion={reducedMotion} motion={motion}/></group>
      </group>
    </RigidBody>
    <ThirdPersonCamera body={body} vehicleBody={cameraCar} input={input} azimuth={azimuth} heading={heading} motion={motion} mode={mode} sensitivity={sensitivity} reducedMotion={reducedMotion} resetToken={resetToken}/>
  </>;
}
