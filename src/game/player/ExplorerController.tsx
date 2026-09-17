import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat';
import type { Group, Vector3 } from 'three';
import type { BicycleSave, ExplorerControllerProps, TravelMode, Vec3 } from '../../contracts';
import { PARKING_SPOTS, hasGroundAt, isOnWalkableDeck, nearestParking, safeGroundPosition, isTravelAllowed, isVehicleTerrainAllowed, openWaterSurfaceAt, isWater, terrainHeight, walkableDeckHeight, waterFlowAt, waterLevelAt } from '../../content/world/definition';
import { GLIDER_LAUNCH, GLIDER_TURN_BACK, isInGliderLaunch, thermalLift } from '../../content/world/gliderSites';
import { bikeModel, type BikeModelId } from '../../content/assets/bikeProfiles';
import { useExplorerInput } from '../input/useExplorerInput';
import { clearInput, headingFromMotion, readFollowMovement, readMovement } from '../input/inputState';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { ExplorerAvatar } from './ExplorerAvatar';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, JUMP_SPEED, PHYSICS_STEP_SECONDS, RUN_SPEED, WALK_SPEED, dampAngle, needsSafeReset } from './controllerMath';
import { createPoseInterpolator } from '../vehicle/poseInterpolator';
import type { CameraTargetKind } from '../camera/ThirdPersonCamera';
import { computeExplorerMovement, createExplorerMotor } from './characterMotor';
import { BicycleVisual } from '../vehicle/BicycleVisual';
import { createBicycleState, stepBicycle } from '../vehicle/bicycleMotor';
import { CarVisual } from '../vehicle/CarVisual';
import { createCarMotion, createCarPhysics, type CarPhysics } from '../vehicle/carPhysics';
import { resolveClearFeet } from '../vehicle/clearance';
import { interactionReason } from '../vehicle/mountState';
import { configureTravelCollider } from './travelCollider';
import { measureBikeTilt } from '../vehicle/bikeGrounding';
import { createStuntState, landStunt, stepStuntAir, wrapAngle } from '../vehicle/bikeStunts';
import { GLIDER, createGliderState, gliderLanding, headingToward, stepGlider, turnToward, type GliderState } from '../vehicle/gliderMotor';
import { GliderVisual, type GliderPose } from '../vehicle/GliderVisual';
import { explorerPose } from './explorerPose';
import { soccerMotion } from '../soccer/soccerMotion';
import { isInStadiumJoin } from '../../content/world/stadiumLayout';
import { buoyantVerticalSpeed, isSunk, isSwimming, swimVelocity } from './swimming';

const BIKE_HOP_SPEED=7.5;
const BIKE_AIR_GRAVITY=-17;
/** Above this speed the bike is no longer glued to the ground, so crests and ramps launch it. */
const BIKE_LAUNCH_SPEED=5;
const BIKE_MAX_LAUNCH=11;
/** Flips and spins pivot here (roughly the rider's centre of mass), not at the tyres. */
const BIKE_TRICK_PIVOT=.7;
/** A glider that barely moves for this long (wedged in scenery) is brought down. */
const GLIDER_STUCK_SECONDS=2;
/** Swimming pose: torso pitched forward and raised so the head rides above the surface. */
const SWIM_PITCH=1.1,SWIM_TREAD_PITCH=.2,SWIM_LIFT=.55;

export function ExplorerController(props: ExplorerControllerProps) {
  const { mode, profile, spawn, initialHeading = Math.PI, resetToken, sensitivity, reducedMotion, cameraControl } = props;
  const { world, rapier } = useRapier();
  const body = useRef<RapierRigidBody>(null),collider = useRef<RapierCollider>(null),visual=useRef<Group>(null),parkedVisual=useRef<Group>(null),carParkedVisual=useRef<Group>(null),rideTilt=useRef<Group>(null),parkedTilt=useRef<Group>(null);
  const controller=useRef<KinematicCharacterController|null>(null),latest=useRef(props);latest.current=props;
  const input=useExplorerInput(mode,props.onPause,props.onMap,props.inputCommands,cameraControl);
  const azimuth=useRef(-initialHeading),heading=useRef(initialHeading),verticalSpeed=useRef(0);
  const motion=useRef({speed:0,signedSpeed:0,grounded:false,riding:false,lean:0,pedaling:true,swimming:false,soccer:soccerMotion});
  const swimming=useRef(false),swimStroke=useRef(0),bikeLost=useRef(false);
  const safePosition=useRef<Vec3>([...spawn]);
  const tick=useRef(0),ready=useRef(false),riding=useRef(false),vehicle=useRef<TravelMode>('foot'),[showRider,setShowRider]=useState(false);
  const bike=useRef(createBicycleState(initialHeading));
  const glider=useRef<GliderState|null>(null),gliderPose=useRef<GliderPose>({bank:0}),gliderStuck=useRef(0),[gliding,setGliding]=useState(false);
  const stunt=useRef(createStuntState()),groundClimb=useRef(0);
  // One parked bike at a time; the ridden bike is always the parked one.
  const [bikeModelId,setBikeModelId]=useState<BikeModelId>('roadster');
  const bikeModelRef=useRef(bikeModelId);bikeModelRef.current=bikeModelId;
  const seat=bikeModel(bikeModelId).seat,riderPose=bikeModel(bikeModelId).rider;
  const [riderHip,setRiderHip]=useState(.77);
  // Thigh pivot sits a little above the seat surface (thigh thickness), centred over the seat.
  const riderOffset:[number,number]=[seat.height+.07-riderHip,seat.z];
  const car=useRef<CarPhysics|null>(null),carMotion=useRef(createCarMotion()),cameraCar=useRef<RapierRigidBody|null>(null);
  const carPose=useRef(createPoseInterpolator(PHYSICS_STEP_SECONDS));
  const removeCar=()=>{car.current?.dispose();car.current=null;cameraCar.current=null;carParked.current=null;carMotion.current=createCarMotion();carPose.current.reset();};
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
    const ride=next!=='foot'; riding.current=ride;vehicle.current=next;motion.current.riding=ride;setShowRider(ride);bike.current.speed=0;stunt.current=createStuntState();
    if(next!=='glider'){glider.current=null;gliderPose.current.bank=0;}
    setGliding(next==='glider');
    if(collider.current)configureTravelCollider(collider.current,next);
    cameraCar.current=next==='car'?(car.current?.body??null):null;
    body.current?.setRotation(ride?rotation(heading.current):{x:0,y:0,z:0,w:1},true);
    clearInput(input.current);
  };
  const clearFeet=(x:number,z:number,nearY:number,ride:boolean|'car',targetHeading=heading.current)=>resolveClearFeet(world,body.current,x,z,nearY,ride,targetHeading);
  /** Nearest dry, clear spot on foot around (x, z), searching outward in rings. */
  const nearestDryFeet=(x:number,z:number,maxRadius:number):Vec3|null=>{
    for(let radius=0;radius<=maxRadius;radius+=3)for(let i=0,steps=radius?12:1;i<steps;i++){
      const angle=i/steps*Math.PI*2,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
      if(!isTravelAllowed('foot',px,pz))continue;
      const ground=Math.max(terrainHeight(px,pz),walkableDeckHeight(px,pz)??-Infinity),valid=clearFeet(px,pz,ground,false);
      if(valid)return valid;
    }
    return null;
  };
  const landGlider=(feet:Vec3|null,message:string)=>{
    if(glider.current)heading.current=glider.current.headingRad;
    setTravel('foot');teleport(feet??safePosition.current);motion.current.grounded=true;gliderStuck.current=0;report(message);
  };
  /** Water swallows a bike: it is gone until a new one is spawned or returned to a parking spot. */
  const loseBike=()=>{
    bikeLost.current=true;
    if(vehicle.current==='bicycle')setTravel('foot');
    report('vehicle.bikeSank');
  };
  const loseCar=()=>{
    if(vehicle.current==='car')setTravel('foot');
    removeCar();report('vehicle.carSank');
  };
  /** F always gets the rider off, whatever the vehicle is doing; a stuck vehicle falls back to looser exits. */
  const exitVehicle=(position:{x:number;y:number;z:number},feet:Vec3)=>{
    const rigidBody=body.current,from=vehicle.current;if(!rigidBody||from==='foot')return;
    if(from==='glider'){
      // Bailing out drops the rider; the wing is lost.
      const sink=glider.current?.verticalSpeed??0;
      if(glider.current)heading.current=glider.current.headingRad;
      setTravel('foot');verticalSpeed.current=Math.min(0,sink);motion.current.grounded=false;gliderStuck.current=0;report('glider.bailed');
      return;
    }
    const isCar=from==='car',airborne=!motion.current.grounded,h=heading.current;
    if(isCar){carParked.current=feet;carParkedHeading.current=h;}
    else if(airborne){
      // A bike let go mid-air lands straight below, unless that is water.
      const deck=walkableDeckHeight(position.x,position.z);
      if(isWater(position.x,position.z)&&deck===null)bikeLost.current=true;
      else{const below=Math.max(terrainHeight(position.x,position.z),deck??-Infinity);parked.current={position:clearFeet(position.x,position.z,below,true,h)??[position.x,below+.05,position.z],headingRad:h};}
      // The rider keeps falling from where they let go.
      setTravel('foot');motion.current.grounded=false;report(bikeLost.current?'vehicle.bikeSank':'');
      return;
    }
    else parked.current={position:feet,headingRad:h};
    const capsule=new rapier.Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),upright={x:0,y:0,z:0,w:1};
    const side=isCar?1.55:1.05,along=isCar?3:1.4;
    // [right, forward] offsets: sides first, then behind and in front.
    const offsets=[[side,0],[-side,0],[0,-along],[0,along]].map(([r,f])=>({x:position.x+Math.cos(h)*r+Math.sin(h)*f,z:position.z+Math.sin(h)*r-Math.cos(h)*f}));
    const ignoreOwnCar=(candidate:RapierCollider)=>!isCar||candidate.parent()?.handle!==car.current?.body.handle;
    const reachable=(target:Vec3)=>{
      const hit=world.castShape(position,upright,{x:target[0]-position.x,y:target[1]-feet[1],z:target[2]-position.z},capsule,.01,1,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,rigidBody,ignoreOwnCar);
      return !hit||hit.time_of_impact>=.99;
    };
    const free=(target:Vec3)=>hasGroundAt(target[0],target[2])&&!world.intersectionWithShape({x:target[0],y:target[1]+FEET_TO_CENTER,z:target[2]},upright,capsule,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,rigidBody);
    let target:Vec3|null=null;
    for(const p of offsets){const valid=clearFeet(p.x,p.z,feet[1],false);if(valid&&reachable(valid)){target=valid;break;}}
    // Stuck, tipped or in water: any open spot beside the vehicle, even without dry footing (the rider drops or swims).
    if(!target)for(const p of offsets){const loose:Vec3=[p.x,feet[1]+.1,p.z];if(free(loose)&&reachable(loose)){target=loose;break;}}
    // A bike is only a shape around the rider, so stepping off in place always works.
    if(!target&&!isCar)target=feet;
    if(!target){const roof:Vec3=[position.x,feet[1]+2.1,position.z];if(free(roof))target=roof;}
    target??=nearestDryFeet(position.x,position.z,30)??safePosition.current;
    setTravel('foot');teleport(target);report('');
  };
  const validationPending=useRef(true);
  useEffect(()=>{const c=createExplorerMotor(world);controller.current=c;return()=>{removeCar();controller.current=null;world.removeCharacterController(c);};},[world]);
  useEffect(()=>{
    if(!body.current)return;
    setTravel('foot');teleport(latest.current.spawn);safePosition.current=[...latest.current.spawn];ready.current=false;tick.current=0;validationPending.current=true;carParked.current=null;
    removeCar();swimming.current=false;bikeLost.current=false;heading.current=latest.current.initialHeading??Math.PI;azimuth.current=-heading.current;bike.current=createBicycleState(heading.current);
    const saved=latest.current.bicycleSpawn;
    parked.current=saved?{position:safeGroundPosition(saved.position),headingRad:saved.headingRad}:{position:[...PARKING_SPOTS[0].position],headingRad:Math.PI};
    if(!isTravelAllowed('bicycle',parked.current.position[0],parked.current.position[2])){const slot=nearestParking(spawn);parked.current={position:[...slot.position],headingRad:slot.headingRad};}
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
    if(valid){parked.current={position:valid,headingRad:slot.headingRad};bikeLost.current=false;report('bicycle.returned');}else report('bicycle.parkingBlocked');
  },[props.returnBicycleToken]);
  const lastCarSpawn=useRef(props.carSpawnToken);
  useEffect(()=>{
    if(lastCarSpawn.current===props.carSpawnToken)return;lastCarSpawn.current=props.carSpawnToken;
    const finish=(ok:boolean,message:string)=>{report(message);latest.current.onCarSpawnResult?.({ok,message});};
    const rigidBody=body.current;if(!rigidBody){finish(false,'The explorer is not ready yet.');return;}
    const position=rigidBody.translation(),feet:Vec3=[position.x,position.y-FEET_TO_CENTER,position.z];
    if(vehicle.current!=='foot'){finish(false,'Exit your vehicle before spawning a car.');return;}
    const candidates:[[number,number],[number,number],[number,number],[number,number]]=[[0,4],[2,4],[-2,4],[0,-4]];
    for(const [right,forward] of candidates){const x=feet[0]+Math.cos(heading.current)*right+Math.sin(heading.current)*forward,z=feet[2]-Math.sin(heading.current)*right-Math.cos(heading.current)*forward;const valid=clearFeet(x,z,feet[1],'car',heading.current);if(valid&&isTravelAllowed('car',x,z)){const model=latest.current.carModelId??'admin';let replacement:CarPhysics;try{replacement=createCarPhysics(world,valid,heading.current,model);}catch{finish(false,'The car could not be prepared. Your current car is unchanged.');return;}removeCar();car.current=replacement;carMotion.current=car.current.motion;carPose.current.snap(replacement.body.translation(),replacement.body.rotation(),performance.now());car.current.body.setEnabled(latest.current.mode==='playing'||latest.current.mode==='loading');carParked.current=valid;carParkedHeading.current=heading.current;setSpawnedCarModel(model);finish(true,'Car ready nearby. Close this panel and approach it to drive.');return;}}
    finish(false,'No clear space to spawn the car. Move to open ground and try again.');
  },[props.carSpawnToken]);
  const lastGliderLaunch=useRef(props.gliderLaunchToken);
  useEffect(()=>{
    if(lastGliderLaunch.current===props.gliderLaunchToken)return;lastGliderLaunch.current=props.gliderLaunchToken;
    const rigidBody=body.current;if(!rigidBody)return;
    const p=rigidBody.translation();
    if(vehicle.current!=='foot'||!motion.current.grounded||!isInGliderLaunch(p.x,p.z)){report('glider.walkIn');return;}
    heading.current=GLIDER_LAUNCH.headingRad;azimuth.current=-heading.current;
    glider.current=createGliderState(heading.current);gliderStuck.current=0;
    setTravel('glider');
    teleport([p.x,p.y-FEET_TO_CENTER+1,p.z]);
    report('glider.launched');
  },[props.gliderLaunchToken]);
  const lastBikeSpawn=useRef(props.bikeSpawnToken);
  useEffect(()=>{
    if(lastBikeSpawn.current===props.bikeSpawnToken)return;lastBikeSpawn.current=props.bikeSpawnToken;
    const rigidBody=body.current;if(!rigidBody){report('The explorer is not ready yet.');return;}
    if(vehicle.current!=='foot'){report('Get off your ride before spawning a bike.');return;}
    const position=rigidBody.translation(),feetY=position.y-FEET_TO_CENTER;
    for(const [right,forward] of [[0,2.5],[1.6,2.5],[-1.6,2.5],[0,-2.5]] as const){
      const x=position.x+Math.cos(heading.current)*right+Math.sin(heading.current)*forward,z=position.z-Math.sin(heading.current)*right-Math.cos(heading.current)*forward;
      const valid=clearFeet(x,z,feetY,true,heading.current);
      if(valid){parked.current={position:valid,headingRad:heading.current};bikeLost.current=false;setBikeModelId(latest.current.bikeModelId??'roadster');report('Bike ready nearby. Walk up and press F to ride.');return;}
    }
    report('No clear space for the bike. Move to open ground and try again.');
  },[props.bikeSpawnToken]);

  useBeforePhysicsStep(()=>{
    const rigidBody=body.current,shape=collider.current,character=controller.current;if(!rigidBody||!shape||!character)return;
    const position=rigidBody.translation();previous.current={...position};
    const playing=latest.current.mode==='playing';
    if(!playing&&latest.current.mode!=='loading'){rigidBody.setNextKinematicTranslation(position);motion.current.speed=0;return;}
    let blockedDrive=false;
    if(car.current&&vehicle.current==='car'){
      const p=car.current.body.translation(),v=car.current.body.linvel();
      const nx=p.x+v.x*.5,nz=p.z+v.z*.5;
      blockedDrive=!isVehicleTerrainAllowed(nx,nz);
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
      if(vehicle.current!=='foot'){exitVehicle(position,feet);return;}
      const bicycleDistance=bikeLost.current?Infinity:Math.hypot(position.x-parked.current.position[0],position.z-parked.current.position[2]);
      const carDistance=carParked.current?Math.hypot(position.x-carParked.current[0],position.z-carParked.current[2]):Infinity;
      const nearby=carDistance<bicycleDistance?'car':'bicycle';
      const reason=interactionReason(vehicle.current,motion.current.grounded,Math.min(bicycleDistance,carDistance),3.5);
      if(reason==='mount'){
        const isCar=nearby==='car', vehiclePosition=isCar?carParked.current:parked.current.position;
        if(!vehiclePosition) return;
        const vehicleHeading=isCar?carParkedHeading.current:parked.current.headingRad;heading.current=vehicleHeading;
        const valid=isCar?(carMotion.current.grounded&&carMotion.current.speed<.5?vehiclePosition:null):clearFeet(vehiclePosition[0],vehiclePosition[2],vehiclePosition[1],true,vehicleHeading);
        if(valid&&isTravelAllowed(isCar?'car':'bicycle',vehiclePosition[0],vehiclePosition[2])){if(!isCar)bike.current=createBicycleState(heading.current);setTravel(nearby);teleport(valid);azimuth.current=-heading.current;report('');return;}
        report('bicycle.noClearance');
      }
    }
    // Mouse mode moves camera-relative every frame (GTA-style); auto mode lets the camera catch up to a held direction.
    const dt=Math.min(world.timestep,1/30),intent=latest.current.cameraControl==='mouse'?readMovement(input.current,azimuth.current):readFollowMovement(input.current,azimuth.current);
    if(vehicle.current==='car'){input.current.sprintLocked=false;input.current.jumpQueued=false;return;}
    if(vehicle.current==='glider'&&glider.current){
      const g=glider.current;
      input.current.sprintLocked=false;input.current.jumpQueued=false;
      // Near the map edge the wing turns back toward the middle of the world.
      const aheadX=position.x+Math.sin(g.headingRad)*GLIDER.edgeLookAhead,aheadZ=position.z-Math.cos(g.headingRad)*GLIDER.edgeLookAhead;
      const nearEdge=!hasGroundAt(aheadX,aheadZ);
      if(nearEdge){g.headingRad=turnToward(g.headingRad,headingToward(position.x,position.z,GLIDER_TURN_BACK.x,GLIDER_TURN_BACK.z),GLIDER.turnRate*2*dt);report('glider.edge');}
      // W dives, S flares.
      const step=stepGlider(g,{steer:nearEdge?0:input.current.move.x,pitch:input.current.move.forward,lift:thermalLift(position.x,feet[1],position.z)},dt);
      if(!hasGroundAt(position.x+step.x,position.z+step.z)){step.x=0;step.z=0;}
      const state={grounded:false,verticalSpeed:step.y/dt};
      const corrected=computeExplorerMovement(character,shape,state,{xVelocity:step.x/dt,zVelocity:step.z/dt,jump:false,gravity:0,snap:false},dt);
      const nx=position.x+corrected.x,nz=position.z+corrected.z,ny=feet[1]+corrected.y;
      const deck=walkableDeckHeight(nx,nz),surface=waterLevelAt(nx,nz),overWater=surface!==null&&!isOnWalkableDeck(nx,nz);
      // Touching water ditches the wing; the pilot drops in and swims.
      if(overWater&&g.airTime>GLIDER.minAirSeconds&&ny-surface<GLIDER.landClearance){
        heading.current=g.headingRad;setTravel('foot');verticalSpeed.current=Math.min(0,state.verticalSpeed);motion.current.grounded=false;gliderStuck.current=0;
        rigidBody.setNextKinematicTranslation({x:nx,y:position.y+corrected.y,z:nz});report('glider.splash');return;
      }
      const groundY=overWater?null:hasGroundAt(nx,nz)?Math.max(terrainHeight(nx,nz),deck??-Infinity):deck;
      const landing=gliderLanding(g,ny,groundY,state.grounded);
      if(landing!=='fly'){
        const spot=clearFeet(nx,nz,ny,false)??(groundY!==null?clearFeet(nx,nz,groundY,false):null)??nearestDryFeet(nx,nz,30);
        landGlider(spot,landing==='rough'?'glider.rough':'glider.landed');return;
      }
      gliderStuck.current=Math.hypot(corrected.x,corrected.z)<Math.hypot(step.x,step.z)*.1?gliderStuck.current+dt:0;
      if(gliderStuck.current>GLIDER_STUCK_SECONDS){landGlider(nearestDryFeet(nx,nz,30),'glider.landed');return;}
      heading.current=g.headingRad;rigidBody.setRotation(rotation(heading.current),true);
      gliderPose.current.bank=g.bank;
      verticalSpeed.current=0;motion.current.grounded=false;
      rigidBody.setNextKinematicTranslation({x:nx,y:position.y+corrected.y,z:nz});
      return;
    }
    const desiredSpeed=playing?(intent.running?RUN_SPEED:WALK_SPEED):0;
    let vx=intent.x*desiredSpeed,vz=intent.z*desiredSpeed;
    const surface=openWaterSurfaceAt(position.x,position.z,feet[1]);
    if(!riding.current){
      swimming.current=isSwimming(feet[1],surface,swimming.current);
      motion.current.swimming=swimming.current;
    }
    // Jumping from the water is a lunge under normal gravity, enough to pull out onto a low bank.
    if(!riding.current&&swimming.current&&playing&&input.current.jumpQueued){input.current.jumpQueued=false;swimming.current=false;motion.current.swimming=false;verticalSpeed.current=JUMP_SPEED;}
    if(!riding.current&&swimming.current&&surface!==null){
      input.current.sprintLocked=false;
      const stroke=playing?intent:{x:0,z:0,running:false},flow=waterFlowAt(position.x,position.z),swim=swimVelocity(stroke,flow);
      vx=swim.x;vz=swim.z;swimStroke.current=Math.hypot(stroke.x,stroke.z)*(stroke.running?1.4:1);
      // Face the stroke, not the drift.
      if(Math.hypot(stroke.x,stroke.z)>.1)heading.current=headingFromMotion(stroke.x,stroke.z);
      // Open sea past the map edge cannot be swum into.
      if(!hasGroundAt(position.x+vx*dt*8,position.z+vz*dt*8)){vx=0;vz=0;}
      const state={grounded:false,verticalSpeed:buoyantVerticalSpeed(verticalSpeed.current,feet[1],surface,dt)};
      const corrected=computeExplorerMovement(character,shape,state,{xVelocity:vx,zVelocity:vz,jump:false,gravity:0,snap:false},dt);
      verticalSpeed.current=state.verticalSpeed;motion.current.grounded=false;
      rigidBody.setNextKinematicTranslation({x:position.x+corrected.x,y:position.y+corrected.y,z:position.z+corrected.z});
      return;
    }
    if(riding.current){
      input.current.sprintLocked=false;
      const activeMotor=bike.current;
      const oldHeading=activeMotor.headingRad;
      const nitroHeld=playing&&(input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'));
      const airborne=!motion.current.grounded;
      const delta=stepBicycle(bike.current,{forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:input.current.brake||!playing,nitro:nitroHeld,airborne},dt,bikeModel(bikeModelRef.current).tuning);
      vx=delta.x/dt;vz=delta.z/dt;
      // Mid-air the bike may cross water (river jumps); it only needs to stay over the world.
      const nx=position.x+delta.x,nz=position.z+delta.z;
      if(vehicle.current==='bicycle'&&(airborne?!hasGroundAt(nx,nz):!isVehicleTerrainAllowed(nx,nz))){vx=0;vz=0;bike.current.speed=0;report('bicycle.walkOnly');}
      // Wading bikes may turn freely; the footprint check rejects water.
      if(Math.abs(oldHeading-activeMotor.headingRad)>.0001&&!isWater(position.x,position.z)){
        let clear=true,raisedY=feet[1];
        for(const fraction of [.5,1]){const check=clearFeet(position.x,position.z,feet[1],true,oldHeading+(activeMotor.headingRad-oldHeading)*fraction);if(!check){clear=false;break;}raisedY=Math.max(raisedY,check[1]);}
        if(!clear){activeMotor.headingRad=oldHeading;activeMotor.speed=0;vx=0;vz=0;}
        else if(raisedY>feet[1]+.01){position.y=raisedY+FEET_TO_CENTER;rigidBody.setTranslation(position,true);}
      }
      heading.current=activeMotor.headingRad;rigidBody.setRotation(rotation(heading.current),true);
    }
    const onBike=vehicle.current==='bicycle',wasGrounded=motion.current.grounded;
    const state={grounded:wasGrounded,verticalSpeed:verticalSpeed.current};
    const jump=playing&&input.current.jumpQueued&&(!riding.current||onBike);
    const corrected=computeExplorerMovement(character,shape,state,{xVelocity:vx,zVelocity:vz,jump,
      ...(onBike?{jumpSpeed:BIKE_HOP_SPEED,gravity:wasGrounded?undefined:BIKE_AIR_GRAVITY,snap:Math.abs(bike.current.speed)<BIKE_LAUNCH_SPEED}:{})},dt);
    input.current.jumpQueued=false;
    if(onBike){
      // Leaving the ground mid-climb keeps the climb rate, so ramps and crests throw the bike into the air.
      if(wasGrounded&&!state.grounded&&!jump)state.verticalSpeed=Math.max(state.verticalSpeed,Math.min(groundClimb.current,BIKE_MAX_LAUNCH));
      // A bike that goes under is lost; the rider is left swimming.
      const nx=position.x+corrected.x,nz=position.z+corrected.z,ny=position.y+corrected.y-FEET_TO_CENTER;
      if(isSunk(ny,openWaterSurfaceAt(nx,nz,ny))){
        loseBike();verticalSpeed.current=Math.min(0,state.verticalSpeed);motion.current.grounded=false;
        rigidBody.setNextKinematicTranslation({x:nx,y:position.y+corrected.y,z:nz});
        return;
      }
      if(state.grounded)groundClimb.current=corrected.y/dt;
      if(!state.grounded)stepStuntAir(stunt.current,{flip:playing?input.current.move.forward:0,spin:playing?input.current.move.x:0},dt);
      else{
        const landing=landStunt(stunt.current);
        if(landing?.kind==='wipeout'){bike.current.speed=0;report(landing.label);}
        else if(landing?.label)report(landing.label);
      }
    }
    verticalSpeed.current=state.verticalSpeed;motion.current.grounded=state.grounded;
    if(riding.current&&Math.hypot(corrected.x,corrected.z)<Math.hypot(vx,vz)*dt*.3)bike.current.speed=0;
    rigidBody.setNextKinematicTranslation({x:position.x+corrected.x,y:position.y+corrected.y,z:position.z+corrected.z});
  });
  useAfterPhysicsStep(()=>{
    const rigidBody=body.current;if(!rigidBody)return;
    if(car.current){const p=car.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseCar();}
    if(car.current){const carHeading=car.current.sample(),p=car.current.body.translation();carPose.current.record(p,car.current.body.rotation(),performance.now());carParked.current=[p.x,p.y-FEET_TO_CENTER,p.z];carParkedHeading.current=carHeading;if(vehicle.current==='car'){heading.current=carHeading;rigidBody.setTranslation(p,true);rigidBody.setNextKinematicTranslation(p);motion.current.grounded=carMotion.current.grounded;}}
    const p=rigidBody.translation(),dt=Math.min(world.timestep,1/30),dx=p.x-previous.current.x,dz=p.z-previous.current.z;
    motion.current.speed=vehicle.current==='car'?carMotion.current.speed:Math.hypot(dx,dz)/dt;motion.current.signedSpeed=vehicle.current==='car'?carMotion.current.signedSpeed:motion.current.speed*(riding.current?Math.sign(bike.current.speed):1);
    if(!riding.current&&swimming.current){motion.current.speed=swimStroke.current*2.2;motion.current.signedSpeed=motion.current.speed;}
    else if(!riding.current&&motion.current.speed>.06)heading.current=headingFromMotion(dx,dz);
    const feet:Vec3=[p.x,p.y-FEET_TO_CENTER,p.z];
    Object.assign(explorerPose,{ready:true,x:p.x,y:p.y,z:p.z,feetY:feet[1],headingRad:heading.current,speed:motion.current.speed,vx:dx/dt,vz:dz/dt,grounded:motion.current.grounded,swimming:swimming.current,travelMode:vehicle.current});
    if(!riding.current&&motion.current.grounded&&!swimming.current&&!needsSafeReset(p)&&(!isWater(p.x,p.z)||isOnWalkableDeck(p.x,p.z)))safePosition.current=feet;
    tick.current++;
    if(!ready.current&&!validationPending.current&&motion.current.grounded&&tick.current>=3){ready.current=true;latest.current.onReady?.();}
    if(tick.current%6===0||tick.current===1){
      const [bx,by,bz]=parked.current.position;
      if(!bikeLost.current&&vehicle.current!=='bicycle'&&isSunk(by,openWaterSurfaceAt(bx,bz,by)))loseBike();
      const bicycleDistance=bikeLost.current?Infinity:Math.hypot(p.x-bx,p.z-bz);
      const carDistance=carParked.current?Math.hypot(p.x-carParked.current[0],p.z-carParked.current[2]):Infinity;
      const reason=interactionReason(vehicle.current,motion.current.grounded,Math.min(bicycleDistance,carDistance),3.5);
      const gliderFlying=vehicle.current==='glider',below=gliderFlying?Math.max(hasGroundAt(p.x,p.z)?terrainHeight(p.x,p.z):-Infinity,waterLevelAt(p.x,p.z)??-Infinity):-Infinity;
      latest.current.onSnapshot({position:feet,gliderAvailable:vehicle.current==='foot'&&motion.current.grounded&&isInGliderLaunch(p.x,p.z),soccerAvailable:vehicle.current==='foot'&&motion.current.grounded&&isInStadiumJoin(p.x,p.z),altitude:gliderFlying&&Number.isFinite(below)?Math.max(0,feet[1]-below):undefined,climbing:gliderFlying&&(glider.current?.verticalSpeed??0)>.2,headingRad:heading.current,speed:motion.current.speed,grounded:motion.current.grounded,travelMode:vehicle.current,sprintLocked:input.current.sprintLocked,canInteract:reason==='mount'||reason==='dismount',bicycle:vehicle.current==='bicycle'?{position:feet,headingRad:heading.current}:parked.current,nitroActive:vehicle.current==='car'?carMotion.current.nitroActive:vehicle.current==='bicycle'&&bike.current.nitro.active,nitroRemaining:vehicle.current==='car'?carMotion.current.nitroRemaining:vehicle.current==='bicycle'?bike.current.nitro.remaining:0,nitroAvailable:vehicle.current==='car'||(vehicle.current==='bicycle'&&!!bikeModel(bikeModelRef.current).tuning.nitro),interactionMessage:tick.current<messageUntil.current&&message.current?message.current:vehicle.current==='foot'&&carDistance<bicycleDistance&&reason==='mount'?'Press F to enter car.':''});
    }
  });
  useFrame((_,delta)=>{
    const onBike=vehicle.current==='bicycle',pose=bikeModel(bikeModelRef.current).rider;
    motion.current.lean=onBike?pose?.lean??0:0;motion.current.pedaling=vehicle.current!=='glider'&&(!onBike||pose?.pedals!==false);
    if(visual.current)visual.current.rotation.y=riding.current?0:dampAngle(visual.current.rotation.y,Math.PI-heading.current,1-Math.exp(-15*Math.min(delta,.06)));
    if(parkedVisual.current){parkedVisual.current.visible=vehicle.current!=='bicycle'&&!bikeLost.current;parkedVisual.current.position.set(...parked.current.position);parkedVisual.current.rotation.y=Math.PI-parked.current.headingRad;}
    // Lay the bike (and its rider) along the ground under both tyres; the collider itself only yaws.
    const half=bikeModel(bikeModelRef.current).halfWheelbase;
    if(parkedTilt.current&&vehicle.current!=='bicycle'){const [x,y,z]=parked.current.position,tilt=measureBikeTilt(world,x,y,z,parked.current.headingRad,half);parkedTilt.current.rotation.x=tilt?.pitch??0;parkedTilt.current.position.y=tilt?.offset??0;}
    if(rideTilt.current){
      const t=rideTilt.current,p=vehicle.current==='bicycle'?body.current?.translation():undefined,dt=Math.min(delta,.06);
      if(!p){
        // Swimmers lie forward while stroking and stay upright while treading water.
        const swim=vehicle.current==='foot'&&swimming.current,stroking=swim&&swimStroke.current>.1,k=1-Math.exp(-8*dt);
        t.rotation.y=0;t.rotation.z=0;
        t.rotation.x+=((stroking?SWIM_PITCH:swim?SWIM_TREAD_PITCH:0)-t.rotation.x)*k;
        t.position.y+=(BIKE_TRICK_PIVOT+(stroking?SWIM_LIFT:0)-t.position.y)*k;
      }
      else if(stunt.current.airborne&&stunt.current.airTime>.12){
        // Follow the trick closely; angles stay unwrapped mid-air so multi-rotation flips read correctly.
        const k=1-Math.exp(-25*dt);
        t.rotation.x+=(stunt.current.pitch-t.rotation.x)*k;t.rotation.y+=(stunt.current.spin-t.rotation.y)*k;
        t.position.y+=(BIKE_TRICK_PIVOT-t.position.y)*k;
      }else{
        t.rotation.x=wrapAngle(t.rotation.x);t.rotation.y=wrapAngle(t.rotation.y);
        const tilt=measureBikeTilt(world,p.x,p.y-FEET_TO_CENTER,p.z,heading.current,half),k=1-Math.exp(-14*dt);
        t.rotation.x+=((tilt?.pitch??0)-t.rotation.x)*k;t.rotation.y+=(0-t.rotation.y)*k;
        t.position.y+=(BIKE_TRICK_PIVOT+(tilt?.offset??0)-t.position.y)*k;
      }
    }
    if(carParkedVisual.current){carParkedVisual.current.visible=car.current!==null&&carPose.current.ready;if(car.current&&carPose.current.ready)carPose.current.sample(performance.now(),carParkedVisual.current.position,carParkedVisual.current.quaternion);}
  });
  // Camera must follow what is drawn (interpolated), not the raw 60 Hz physics pose.
  const cameraTarget=useCallback((outFeet:Vector3):CameraTargetKind|null=>{
    if(vehicle.current==='car'&&car.current&&carPose.current.ready){carPose.current.sample(performance.now(),outFeet);outFeet.y-=FEET_TO_CENTER;return 'car';}
    if(!visual.current)return null;
    visual.current.getWorldPosition(outFeet);
    return vehicle.current==='glider'?'glider':'foot';
  },[]);
  return <>
    <group ref={parkedVisual}><group ref={parkedTilt}><BicycleVisual modelId={bikeModelId}/></group></group>
    <group ref={carParkedVisual} visible={false}><group position={[0,-FEET_TO_CENTER,0]}>{spawnedCarModel&&<CarVisual modelId={spawnedCarModel} color={props.carColor} motion={carMotion} active={showRider&&vehicle.current==='car'&&mode==='playing'} reducedMotion={reducedMotion}/>}</group></group>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0],spawn[1]+FEET_TO_CENTER,spawn[2]]} enabledRotations={[false,false,false]} name="explorer-body">
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS]} friction={0}/>
      <group ref={visual} position={[0,-FEET_TO_CENTER,0]} rotation={[0,Math.PI-initialHeading,0]}>
        <group ref={rideTilt} position={[0,BIKE_TRICK_PIVOT,0]} rotation={[0,0,0,'YXZ']}><group position={[0,-BIKE_TRICK_PIVOT,0]}>
        {showRider&&vehicle.current==='bicycle'&&<BicycleVisual modelId={bikeModelId} motion={motion}/>}
        {/* Pivot the lean around the rider's hips so they stay planted on the seat. */}
        <group visible={!(showRider&&vehicle.current==='car')} position={[0,showRider&&vehicle.current==='bicycle'?riderOffset[0]+riderHip:riderHip,showRider&&vehicle.current==='bicycle'?riderOffset[1]:0]} rotation={[showRider&&vehicle.current==='bicycle'?riderPose?.lean??0:0,0,0]}><group position={[0,-riderHip,0]}><ExplorerAvatar profile={profile} reducedMotion={reducedMotion} motion={motion} onHipHeight={setRiderHip}/></group></group>
        </group></group>
        {gliding&&<GliderVisual pose={gliderPose} backHeight={riderHip+.42} reducedMotion={reducedMotion}/>}
      </group>
    </RigidBody>
    <ThirdPersonCamera body={body} vehicleBody={cameraCar} input={input} azimuth={azimuth} heading={heading} motion={motion} mode={mode} sensitivity={sensitivity} reducedMotion={reducedMotion} resetToken={resetToken} cameraControl={cameraControl} target={cameraTarget}/>
  </>;
}
