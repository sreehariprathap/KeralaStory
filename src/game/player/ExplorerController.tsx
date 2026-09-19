import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat';
import type { Group, Vector3 } from 'three';
import type { BicycleSave, ExplorerControllerProps, TravelMode, Vec3 } from '../../contracts';
import { PARKING_SPOTS, hasGroundAt, isOnWalkableDeck, nearestParking, safeGroundPosition, isTravelAllowed, isVehicleTerrainAllowed, openWaterSurfaceAt, isWater, terrainHeight, walkableDeckHeight, waterFlowAt, waterLevelAt } from '../../content/world/definition';
import { GLIDER_LAUNCH, GLIDER_TURN_BACK, isInGliderLaunch, parachuteDropHeight, thermalLift } from '../../content/world/gliderSites';
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
import { createBikePhysics, type BikePhysics, type BikeMotion, type BikeIntent } from '../vehicle/bikePhysics';
import { CarVisual } from '../vehicle/CarVisual';
import { createCarMotion, createCarPhysics, type CarPhysics } from '../vehicle/carPhysics';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
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
import { BOAT_DOCKS } from '../../content/world/boatDocks';
import { BOAT, boatMoveAllowed, createBoatState, groundedPoints, stepBoat, type BoatState } from '../vehicle/boatMotor';
import { BoatVisual } from '../vehicle/BoatVisual';
import { PLANE, createPlaneState, stepPlane, touchdown, type PlaneState } from '../vehicle/planeMotor';
import { PlaneVisual, type PlaneMotion } from '../vehicle/PlaneVisual';
import { PLANE_SPAWN, checkpointsByDistance } from '../../content/world/planeSites';
import { Explosion } from '../world/Explosion';

/** Flips and spins pivot here (roughly the rider's centre of mass), not at the tyres. */
const BIKE_TRICK_PIVOT=.7;
/** A glider that barely moves for this long (wedged in scenery) is brought down. */
const GLIDER_STUCK_SECONDS=2;
/** Swimming pose: torso pitched forward and raised so the head rides above the surface. */
const SWIM_PITCH=1.1,SWIM_TREAD_PITCH=.2,SWIM_LIFT=.55;
/** Walking distance at which F climbs into the parked plane. */
const PLANE_MOUNT_DISTANCE=8;
/** Seconds between a crash and the pilot walking away from the nearest checkpoint. */
const CRASH_RESPAWN_SECONDS=3;
/** Fuselage sweep for collisions: a ball this far above the wheels, so a gentle touchdown never grazes it. */
const PLANE_HULL_RADIUS=1,PLANE_HULL_LIFT=2.2;
const newPlane=()=>createPlaneState(PLANE_SPAWN.x,PLANE_SPAWN.y+PLANE.gearHeight,PLANE_SPAWN.z,PLANE_SPAWN.headingRad);

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
  const bike=useRef<BikePhysics|null>(null);
  const bikeMotion=useRef<BikeMotion>({speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:[0,0],wheelSteering:[0,0]});
  const glider=useRef<GliderState|null>(null),gliderPose=useRef<GliderPose>({bank:0}),gliderStuck=useRef(0),[gliding,setGliding]=useState(false);
  const stunt=useRef(createStuntState());
  // One parked bike at a time; the ridden bike is always the parked one.
  const [bikeModelId,setBikeModelId]=useState<BikeModelId>('roadster');
  const bikeModelRef=useRef(bikeModelId);bikeModelRef.current=bikeModelId;
  const seat=bikeModel(bikeModelId).seat,riderPose=bikeModel(bikeModelId).rider;
  const [riderHip,setRiderHip]=useState(.77);
  // Thigh pivot sits a little above the seat surface (thigh thickness), centred over the seat.
  const riderOffset:[number,number]=[seat.height+.07-riderHip,seat.z];
  // Moored boats keep wherever they were left; only one is ever crewed, by index.
  const boats=useRef<BoatState[]>(BOAT_DOCKS.map(d=>createBoatState(d.x,d.z,d.headingRad,d.level))),activeBoat=useRef<number|null>(null),boatVisuals=useRef<(Group|null)[]>([]);
  const crewedBoat=()=>activeBoat.current===null?null:boats.current[activeBoat.current];
  const nearestBoat=(x:number,z:number)=>{let index=-1,distance=Infinity;boats.current.forEach((b,i)=>{if(i===activeBoat.current)return;const d=Math.hypot(b.x-x,b.z-z);if(d<distance){distance=d;index=i;}});return {index,distance};};
  // One biplane, parked at the airport until flown; a crash destroys it and a fresh one waits on the runway.
  const plane=useRef<PlaneState>(newPlane()),planeMotion=useRef<PlaneMotion>({throttle:0}),planeVisual=useRef<Group>(null),planeTilt=useRef<Group>(null);
  const crash=useRef<{elapsed:number}|null>(null),[explosion,setExplosion]=useState<{id:number;position:Vec3;water:boolean}|null>(null);
  const car=useRef<CarPhysics|null>(null),carMotion=useRef(createCarMotion()),cameraCar=useRef<RapierRigidBody|null>(null);
  const carPose=useRef(createPoseInterpolator(PHYSICS_STEP_SECONDS));
  const removeCar=()=>{car.current?.dispose();car.current=null;cameraCar.current=null;carParked.current=null;carMotion.current=createCarMotion();carPose.current.reset();};
  const removeBike=()=>{bike.current?.dispose();bike.current=null;bikeMotion.current={speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:[0,0],wheelSteering:[0,0]};};
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
    // Leaving a plane anywhere but parked on the ground (a reset mid-flight) returns it to the airport.
    if(next!=='plane'&&vehicle.current==='plane'&&(!plane.current.grounded||plane.current.speed>1))plane.current=newPlane();
    const ride=next!=='foot'; riding.current=ride;vehicle.current=next;motion.current.riding=ride;setShowRider(ride);stunt.current=createStuntState();
    if(next!=='glider'){glider.current=null;gliderPose.current.bank=0;}
    if(next!=='boat'&&activeBoat.current!==null){boats.current[activeBoat.current].speed=0;activeBoat.current=null;}
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
  /** Nearest dry, clear footing within a few metres of a boat: a bank, a stair or the dam's crest walkway. */
  const boatLanding=(x:number,z:number,level:number):Vec3|null=>{
    const capsule=new rapier.Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),upright={x:0,y:0,z:0,w:1},top=level+8;
    // Within each ring the lowest footing wins, so a crest walkway beats the top of its parapet rail.
    for(let radius=1.5;radius<=9;radius+=1.5){let best:Vec3|null=null;for(let i=0;i<16;i++){
      const angle=i/16*Math.PI*2,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
      const hit=world.castRayAndGetNormal(new rapier.Ray({x:px,y:top,z:pz},{x:0,y:-1,z:0}),16,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body.current??undefined);
      if(!hit||hit.normal.y<.75||hit.collider.parent()?.isDynamic())continue;
      const groundY=top-hit.timeOfImpact,surface=waterLevelAt(px,pz);
      if(groundY<level+.2||(surface!==null&&surface>groundY-.3))continue;
      if(world.intersectionWithShape({x:px,y:groundY+.06+FEET_TO_CENTER,z:pz},upright,capsule,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body.current??undefined))continue;
      if(!best||groundY+.06<best[1])best=[px,groundY+.06,pz];
    }if(best)return best;}
    return null;
  };
  /** F always gets the rider off, whatever the vehicle is doing; a stuck vehicle falls back to looser exits. */
  const exitVehicle=(position:{x:number;y:number;z:number},feet:Vec3)=>{
    const rigidBody=body.current,from=vehicle.current;if(!rigidBody||from==='foot')return;
    if(from==='plane'){
      // No bailing out: the plane has to be down and nearly stopped. Step off beside the cockpit.
      const pl=plane.current;
      if(!pl.grounded||pl.speed>2){report('plane.landFirst');return;}
      pl.speed=0;pl.throttle=0;
      const side=(r:number):Vec3|null=>{const x=pl.x+Math.cos(pl.headingRad)*r,z=pl.z+Math.sin(pl.headingRad)*r;return clearFeet(x,z,pl.y,false);};
      const target=side(-3.5)??side(3.5)??nearestDryFeet(pl.x,pl.z,20)??safePosition.current;
      setTravel('foot');teleport(target);motion.current.grounded=true;report('');
      return;
    }
    if(from==='boat'){
      // The boat stays moored where it floats; the rider steps ashore, or stays aboard in open water.
      const boat=activeBoat.current===null?null:boats.current[activeBoat.current],landing=boat?boatLanding(position.x,position.z,boat.level):null;
      if(boat&&!landing){report('boat.noShore');return;}
      setTravel('foot');teleport(landing??safePosition.current);motion.current.grounded=true;report('');
      return;
    }
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
    removeCar();removeBike();swimming.current=false;bikeLost.current=false;crash.current=null;setExplosion(null);heading.current=latest.current.initialHeading??Math.PI;azimuth.current=-heading.current;
    const saved=latest.current.bicycleSpawn;
    parked.current=saved?{position:safeGroundPosition(saved.position),headingRad:saved.headingRad}:{position:[...PARKING_SPOTS[0].position],headingRad:Math.PI};
    if(!isTravelAllowed('bicycle',parked.current.position[0],parked.current.position[2])){const slot=nearestParking(spawn);parked.current={position:[...slot.position],headingRad:slot.headingRad};}
    motion.current.grounded=false;
    // Repositioning is driven by resetToken; other prop changes must not teleport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[resetToken]);
  useEffect(()=>{if(mode!=='playing'&&mode!=='loading'){verticalSpeed.current=0;motion.current.speed=0;}car.current?.body.setEnabled(mode==='playing'||mode==='loading');bike.current?.body.setEnabled(mode==='playing'||mode==='loading');},[mode]);
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
  const lastParachuteDrop=useRef(props.parachuteDropToken);
  useEffect(()=>{
    if(lastParachuteDrop.current===props.parachuteDropToken)return;lastParachuteDrop.current=props.parachuteDropToken;
    const rigidBody=body.current;if(!rigidBody)return;
    if(vehicle.current!=='foot'){report('parachute.leaveVehicle');return;}
    const p=rigidBody.translation();
    // The wing opens facing the way the player looks, high above the spot they stand on.
    azimuth.current=-heading.current;swimming.current=false;motion.current.swimming=false;
    glider.current=createGliderState(heading.current);gliderStuck.current=0;
    setTravel('glider');
    teleport([p.x,parachuteDropHeight(p.x,p.z,p.y-FEET_TO_CENTER),p.z]);
    report('parachute.dropped');
  },[props.parachuteDropToken]);
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
    car.current?.step({forward:playing&&!blockedDrive?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:input.current.brake||!playing||blockedDrive,nitro:playing&&!blockedDrive&&vehicle.current==='car'&&(input.current.nitro||input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight')),handbrake:playing&&vehicle.current==='car'&&input.current.keys.has('Space')},Math.min(world.timestep,1/30),vehicle.current==='car');
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
      // F takes whichever vehicle is nearest: the plane, a boat, the car or the bike.
      const pl=plane.current,boatNear=nearestBoat(position.x,position.z);
      const planeDistance=!crash.current&&pl.grounded&&pl.speed<1&&motion.current.grounded?Math.hypot(position.x-pl.x,position.z-pl.z):Infinity;
      const landDistance=Math.min(bikeLost.current?Infinity:Math.hypot(position.x-parked.current.position[0],position.z-parked.current.position[2]),carParked.current?Math.hypot(position.x-carParked.current[0],position.z-carParked.current[2]):Infinity);
      if(planeDistance<=PLANE_MOUNT_DISTANCE&&planeDistance<=Math.min(boatNear.distance,landDistance)){
        heading.current=pl.headingRad;setTravel('plane');teleport([pl.x,pl.y,pl.z]);azimuth.current=-heading.current;report('');return;
      }
      // Boats are boarded from the bank or straight out of the water.
      if(boatNear.index>=0&&boatNear.distance<=BOAT.mountDistance&&boatNear.distance<=landDistance){
        const boat=boats.current[boatNear.index];
        heading.current=boat.headingRad;activeBoat.current=boatNear.index;swimming.current=false;motion.current.swimming=false;
        setTravel('boat');teleport([boat.x,boat.level,boat.z]);azimuth.current=-heading.current;report('');return;
      }
      const bicycleDistance=bikeLost.current?Infinity:Math.hypot(position.x-parked.current.position[0],position.z-parked.current.position[2]);
      const carDistance=carParked.current?Math.hypot(position.x-carParked.current[0],position.z-carParked.current[2]):Infinity;
      const nearby=carDistance<bicycleDistance?'car':'bicycle';
      const reason=interactionReason(vehicle.current,motion.current.grounded,Math.min(bicycleDistance,carDistance),3.5);
      if(reason==='mount'){
        const isCar=nearby==='car', vehiclePosition=isCar?carParked.current:parked.current.position;
        if(!vehiclePosition) return;
        const vehicleHeading=isCar?carParkedHeading.current:parked.current.headingRad;heading.current=vehicleHeading;
        const valid=isCar?(carMotion.current.grounded&&carMotion.current.speed<.5?vehiclePosition:null):clearFeet(vehiclePosition[0],vehiclePosition[2],vehiclePosition[1],true,vehicleHeading);
        if(valid&&isTravelAllowed(isCar?'car':'bicycle',vehiclePosition[0],vehiclePosition[2])){if(!isCar){bike.current=createBikePhysics(world,valid,vehicleHeading,bikeModelRef.current);bikeMotion.current=bike.current.motion;}setTravel(nearby);teleport(valid);azimuth.current=-heading.current;report('');return;}
        report('bicycle.noClearance');
      }
    }
    // Mouse mode moves camera-relative every frame (GTA-style); auto mode lets the camera catch up to a held direction.
    const dt=Math.min(world.timestep,1/30),intent=latest.current.cameraControl==='mouse'?readMovement(input.current,azimuth.current):readFollowMovement(input.current,azimuth.current);
    if(vehicle.current==='car'){input.current.sprintLocked=false;input.current.jumpQueued=false;return;}
    if(crash.current){
      // The wreck burns while the camera lingers, then the pilot walks away from the nearest checkpoint.
      crash.current.elapsed+=dt;rigidBody.setNextKinematicTranslation(position);
      if(crash.current.elapsed>=CRASH_RESPAWN_SECONDS){
        crash.current=null;plane.current=newPlane();setTravel('foot');
        let spot:Vec3|null=null;
        for(const c of checkpointsByDistance(position.x,position.z).slice(0,12)){spot=clearFeet(c[0],c[2],c[1],false)??nearestDryFeet(c[0],c[2],9);if(spot)break;}
        teleport(spot??safePosition.current);motion.current.grounded=false;verticalSpeed.current=0;report('plane.respawned');
      }
      return;
    }
    if(vehicle.current==='plane'){
      const pl=plane.current;input.current.sprintLocked=false;input.current.jumpQueued=false;
      const keys=input.current.keys;
      const was={x:pl.x,y:pl.y,z:pl.z};
      const wreck=(water:boolean)=>{
        crash.current={elapsed:0};planeMotion.current.throttle=0;
        setExplosion({id:Date.now(),position:[pl.x,water?(waterLevelAt(pl.x,pl.z)??pl.y):pl.y,pl.z],water});
        report('');
        rigidBody.setNextKinematicTranslation({x:pl.x,y:pl.y+FEET_TO_CENTER,z:pl.z});
      };
      const move=stepPlane(pl,{forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,
        boost:playing&&(input.current.nitro||keys.has('ShiftLeft')||keys.has('ShiftRight')),slow:playing&&(input.current.brake||keys.has('Space'))},dt);
      // Near the map edge the plane banks round toward the middle of the world.
      if(!pl.grounded){
        const ahead=90;
        if(!hasGroundAt(pl.x+Math.sin(pl.headingRad)*ahead,pl.z-Math.cos(pl.headingRad)*ahead)){
          pl.headingRad=turnToward(pl.headingRad,headingToward(pl.x,pl.z,GLIDER_TURN_BACK.x,GLIDER_TURN_BACK.z),.9*dt);report('plane.edge');
        }
      }
      let nx=was.x+move.x,ny=was.y+move.y,nz=was.z+move.z;
      if(!hasGroundAt(nx,nz)){nx=was.x;nz=was.z;}
      // Anything solid in the fuselage's path (buildings, trees with colliders, hillsides, the dam) is a crash.
      const sweep=world.castShape({x:was.x,y:was.y+PLANE_HULL_LIFT,z:was.z},{x:0,y:0,z:0,w:1},{x:nx-was.x,y:ny-was.y,z:nz-was.z},new rapier.Ball(PLANE_HULL_RADIUS),.02,1,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,rigidBody);
      if(sweep&&(!pl.grounded||pl.speed>6)){wreck(false);return;}
      if(sweep){pl.speed=0;nx=was.x;nz=was.z;}
      const deck=walkableDeckHeight(nx,nz),ground=Math.max(terrainHeight(nx,nz),deck??-Infinity),water=deck===null?waterLevelAt(nx,nz):null;
      if(pl.grounded){
        // Rolling into water, or into a bank too steep to roll over at speed, wrecks the plane.
        if(water!==null&&water>ground){wreck(true);return;}
        if(ground+PLANE.gearHeight-was.y>1.2&&pl.speed>8){wreck(false);return;}
        ny=ground+PLANE.gearHeight;pl.roll=0;
      }else{
        if(water!==null&&ny<=water+.3&&water>ground){wreck(true);return;}
        // Just after lift-off the wheels may still skim the runway: that is the take-off, not a landing.
        if(ny<=ground+PLANE.gearHeight&&pl.airTime<.8)ny=ground+PLANE.gearHeight;
        else if(ny<=ground+PLANE.gearHeight){
          if(touchdown(pl)==='crash'){pl.y=ground;wreck(false);return;}
          pl.grounded=true;pl.verticalSpeed=0;pl.pitch=0;pl.roll=0;ny=ground+PLANE.gearHeight;report('plane.landed');
        }
      }
      pl.x=nx;pl.y=ny;pl.z=nz;planeMotion.current.throttle=pl.throttle;
      heading.current=pl.headingRad;rigidBody.setRotation(rotation(heading.current),true);
      verticalSpeed.current=0;motion.current.grounded=pl.grounded;
      rigidBody.setNextKinematicTranslation({x:nx,y:ny+FEET_TO_CENTER,z:nz});
      return;
    }
    if(vehicle.current==='boat'&&activeBoat.current!==null){
      const boat=boats.current[activeBoat.current];
      input.current.sprintLocked=false;input.current.jumpQueued=false;
      const oldHeading=boat.headingRad;
      const nitroHeld=playing&&(input.current.nitro||input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'));
      const step=stepBoat(boat,{forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:input.current.brake||!playing,nitro:nitroHeld},dt);
      // Rivers carry the hull downstream; lakes and ponds are still.
      const flow=waterFlowAt(position.x,position.z);step.x+=flow.x*BOAT.drift*dt;step.z+=flow.z*BOAT.drift*dt;
      // A bank, shallows or a waterfall's lip stops the hull dead; so does a turn that would swing the bow onto one.
      // A hull already touching bottom may still turn or back off, as long as that doesn't ground it further.
      const aground=(x:number,z:number,h:number)=>groundedPoints(x,z,h,waterLevelAt,terrainHeight);
      if(!boatMoveAllowed(aground(position.x,position.z,oldHeading),aground(position.x,position.z,boat.headingRad)))boat.headingRad=oldHeading;
      if(!boatMoveAllowed(aground(position.x,position.z,boat.headingRad),aground(position.x+step.x,position.z+step.z,boat.headingRad))){if(Math.abs(boat.speed)>2)report('boat.aground');boat.speed=0;step.x=0;step.z=0;}
      heading.current=boat.headingRad;rigidBody.setRotation(rotation(heading.current),true);
      // The dam wall, bridge piers and anything else solid are handled by the character controller.
      const corrected=computeExplorerMovement(character,shape,{grounded:false,verticalSpeed:0},{xVelocity:step.x/dt,zVelocity:step.z/dt,jump:false,gravity:0,snap:false},dt);
      if(Math.hypot(corrected.x,corrected.z)<Math.hypot(step.x,step.z)*.3)boat.speed*=.5;
      boat.x=position.x+corrected.x;boat.z=position.z+corrected.z;
      boat.level=waterLevelAt(boat.x,boat.z)??boat.level;
      verticalSpeed.current=0;motion.current.grounded=true;
      rigidBody.setNextKinematicTranslation({x:boat.x,y:boat.level+FEET_TO_CENTER,z:boat.z});
      return;
    }
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
    if(riding.current&&vehicle.current==='bicycle'&&bike.current){
      input.current.sprintLocked=false;
      const nitroHeld=playing&&(input.current.nitro||input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'));
      const handbrakeHeld=playing&&input.current.brake;
      const intent:BikeIntent={forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:false,nitro:nitroHeld,handbrake:handbrakeHeld};
      bike.current.step(intent,dt,playing);
      if(playing&&input.current.jumpQueued){bike.current.hop();input.current.jumpQueued=false;}
      heading.current=bike.current.sample();
    }
    const onBike=vehicle.current==='bicycle'&&bike.current!==null;
    if(onBike){
      const wasGrounded=bikeMotion.current.grounded;
      bikeMotion.current=bike.current!.motion;
      if(!bikeMotion.current.grounded)stepStuntAir(stunt.current,{flip:playing?input.current.move.forward:0,spin:playing?input.current.move.x:0},dt);
      else if(!wasGrounded){
        const landing=landStunt(stunt.current);
        if(landing?.label)report(landing.label);
      }
    }else{
      const wasGrounded=motion.current.grounded;
      const state={grounded:wasGrounded,verticalSpeed:verticalSpeed.current};
      const jump=playing&&input.current.jumpQueued&&!riding.current;
      const corrected=computeExplorerMovement(character,shape,state,{xVelocity:vx,zVelocity:vz,jump},dt);
      input.current.jumpQueued=false;
      verticalSpeed.current=state.verticalSpeed;motion.current.grounded=state.grounded;
      rigidBody.setNextKinematicTranslation({x:position.x+corrected.x,y:position.y+corrected.y,z:position.z+corrected.z});
    }
  });
  useAfterPhysicsStep(()=>{
    const rigidBody=body.current;if(!rigidBody)return;
    if(car.current){const p=car.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseCar();}
    if(bike.current){const p=bike.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseBike();}
    if(car.current){const carHeading=car.current.sample(),p=car.current.body.translation();carPose.current.record(p,car.current.body.rotation(),performance.now());carParked.current=[p.x,p.y-FEET_TO_CENTER,p.z];carParkedHeading.current=carHeading;if(vehicle.current==='car'){heading.current=carHeading;rigidBody.setTranslation(p,true);rigidBody.setNextKinematicTranslation(p);motion.current.grounded=carMotion.current.grounded;}}
    const p=rigidBody.translation(),dt=Math.min(world.timestep,1/30),dx=p.x-previous.current.x,dz=p.z-previous.current.z;
    motion.current.speed=vehicle.current==='car'?carMotion.current.speed:vehicle.current==='bicycle'&&bike.current?bikeMotion.current.speed:Math.hypot(dx,dz)/dt;motion.current.signedSpeed=vehicle.current==='car'?carMotion.current.signedSpeed:vehicle.current==='bicycle'&&bike.current?bikeMotion.current.signedSpeed:motion.current.speed;
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
      const boatOffer=vehicle.current==='foot'&&nearestBoat(p.x,p.z).distance<=BOAT.mountDistance;
      const pl=plane.current,planeDistance=Math.hypot(p.x-pl.x,p.z-pl.z),flying=vehicle.current==='plane';
      const planeOffer=vehicle.current==='foot'&&!crash.current&&pl.grounded&&pl.speed<1&&planeDistance<=PLANE_MOUNT_DISTANCE&&planeDistance<=Math.min(bicycleDistance,carDistance);
      const gliderFlying=vehicle.current==='glider',below=gliderFlying?Math.max(hasGroundAt(p.x,p.z)?terrainHeight(p.x,p.z):-Infinity,waterLevelAt(p.x,p.z)??-Infinity):-Infinity;
      latest.current.onSnapshot({position:feet,gliderAvailable:vehicle.current==='foot'&&motion.current.grounded&&isInGliderLaunch(p.x,p.z),soccerAvailable:vehicle.current==='foot'&&motion.current.grounded&&isInStadiumJoin(p.x,p.z),altitude:flying?Math.max(0,pl.y-Math.max(terrainHeight(pl.x,pl.z),waterLevelAt(pl.x,pl.z)??-Infinity)):gliderFlying&&Number.isFinite(below)?Math.max(0,feet[1]-below):undefined,airspeed:flying?pl.speed:undefined,wasted:crash.current!==null,climbing:flying?pl.verticalSpeed>.5:gliderFlying&&(glider.current?.verticalSpeed??0)>.2,headingRad:heading.current,speed:motion.current.speed,grounded:motion.current.grounded,travelMode:vehicle.current,sprintLocked:input.current.sprintLocked,canInteract:!crash.current&&!(flying&&(!pl.grounded||pl.speed>2))&&(reason==='mount'||reason==='dismount'||boatOffer||planeOffer),bicycle:vehicle.current==='bicycle'?{position:feet,headingRad:heading.current}:parked.current,nitroActive:vehicle.current==='car'?carMotion.current.nitroActive:vehicle.current==='boat'?crewedBoat()?.nitro.active??false:vehicle.current==='bicycle'&&bikeMotion.current.nitroActive,nitroRemaining:vehicle.current==='car'?carMotion.current.nitroRemaining:vehicle.current==='boat'?crewedBoat()?.nitro.remaining??0:vehicle.current==='bicycle'?bikeMotion.current.nitroRemaining:0,nitroAvailable:vehicle.current==='car'||vehicle.current==='boat'||(vehicle.current==='bicycle'&&!!bikeModel(bikeModelRef.current).tuning.nitro),interactionMessage:tick.current<messageUntil.current&&message.current?message.current:planeOffer?'plane.board':boatOffer&&nearestBoat(p.x,p.z).distance<=Math.min(bicycleDistance,carDistance)?'boat.board':vehicle.current==='foot'&&carDistance<bicycleDistance&&reason==='mount'?'Press F to enter car.':''});
    }
  });
  useFrame((_,delta)=>{
    const onBike=vehicle.current==='bicycle',pose=bikeModel(bikeModelRef.current).rider;
    motion.current.lean=onBike?pose?.lean??0:0;motion.current.pedaling=vehicle.current!=='glider'&&vehicle.current!=='boat'&&(!onBike||pose?.pedals!==false);
    // The plane: the flown one follows the rendered pilot; pitch and bank tilt the airframe about its middle.
    if(planeVisual.current){
      const pl=plane.current,g=planeVisual.current;g.visible=!crash.current;
      if(vehicle.current==='plane'&&visual.current){visual.current.getWorldPosition(g.position);}else g.position.set(pl.x,pl.y,pl.z);
      g.rotation.set(0,Math.PI-pl.headingRad,0);
      if(planeTilt.current){planeTilt.current.rotation.set(-pl.pitch,0,pl.roll,'YXZ');}
    }
    // Moored boats bob in place; the crewed one follows the rendered rider so the two never drift apart.
    const now=performance.now()/1000;
    boats.current.forEach((b,i)=>{
      const g=boatVisuals.current[i];if(!g)return;
      const bob=reducedMotion?0:Math.sin(now*1.6+i*2.1)*.04;
      if(i===activeBoat.current&&visual.current){visual.current.getWorldPosition(g.position);g.position.y=b.level+bob;}
      else g.position.set(b.x,b.level+bob,b.z);
      g.rotation.set(reducedMotion?0:Math.sin(now*1.1+i)*.02,Math.PI-b.headingRad,reducedMotion?0:Math.sin(now*1.3+i*1.7)*.025);
    });
    if(visual.current)visual.current.rotation.y=riding.current?0:dampAngle(visual.current.rotation.y,Math.PI-heading.current,1-Math.exp(-15*Math.min(delta,.06)));
    if(parkedVisual.current){parkedVisual.current.visible=vehicle.current!=='bicycle'&&!bikeLost.current;parkedVisual.current.position.set(...parked.current.position);parkedVisual.current.rotation.y=Math.PI-parked.current.headingRad;}
    // Lay the bike (and its rider) along the ground under both tyres; the collider itself only yaws.
    const half=bikeModel(bikeModelRef.current).halfWheelbase;
    if(parkedTilt.current&&vehicle.current!=='bicycle'){const [x,y,z]=parked.current.position,tilt=measureBikeTilt(world,x,y,z,parked.current.headingRad,half);parkedTilt.current.rotation.x=tilt?.pitch??0;parkedTilt.current.position.y=tilt?.offset??0;}
    if(rideTilt.current){
      const t=rideTilt.current,riddenBike=vehicle.current==='bicycle'?bike.current:null,dt=Math.min(delta,.06);
      if(!riddenBike){
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
        // Grounded: read the real physics body's pitch directly instead of raycasting the ground.
        const q=riddenBike.body.rotation();
        const pitch=Math.atan2(2*(q.w*q.x+q.y*q.z),1-2*(q.x*q.x+q.y*q.y)),k=1-Math.exp(-14*dt);
        t.rotation.x=wrapAngle(t.rotation.x);t.rotation.y=wrapAngle(t.rotation.y);
        t.rotation.x+=(pitch-t.rotation.x)*k;t.rotation.y+=(0-t.rotation.y)*k;
        t.position.y+=(BIKE_TRICK_PIVOT-t.position.y)*k;
      }
    }
    if(carParkedVisual.current){carParkedVisual.current.visible=car.current!==null&&carPose.current.ready;if(car.current&&carPose.current.ready)carPose.current.sample(performance.now(),carParkedVisual.current.position,carParkedVisual.current.quaternion);}
  });
  // Camera must follow what is drawn (interpolated), not the raw 60 Hz physics pose.
  const cameraTarget=useCallback((outFeet:Vector3):CameraTargetKind|null=>{
    if(vehicle.current==='car'&&car.current&&carPose.current.ready){carPose.current.sample(performance.now(),outFeet);outFeet.y-=FEET_TO_CENTER;return 'car';}
    if(!visual.current)return null;
    visual.current.getWorldPosition(outFeet);
    return vehicle.current==='glider'?'glider':vehicle.current==='boat'?'boat':vehicle.current==='plane'?'plane':'foot';
  },[]);
  return <>
    <group ref={parkedVisual}><group ref={parkedTilt}><BicycleVisual modelId={bikeModelId}/></group></group>
    <group ref={planeVisual} position={[PLANE_SPAWN.x,PLANE_SPAWN.y,PLANE_SPAWN.z]}><group position={[0,1.4,0]}><group ref={planeTilt}><group position={[0,-1.4,0]}><PlaneVisual motion={planeMotion}/></group></group></group></group>
    {explosion&&<Explosion key={explosion.id} position={explosion.position} water={explosion.water}/>}
    {BOAT_DOCKS.map((dock,i)=><group key={dock.id} ref={g=>{boatVisuals.current[i]=g;}} position={[dock.x,dock.level,dock.z]} rotation={[0,Math.PI-dock.headingRad,0]}><BoatVisual/></group>)}
    <group ref={carParkedVisual} visible={false}><group position={[0,-FEET_TO_CENTER,0]}>{spawnedCarModel&&<CarVisual modelId={spawnedCarModel} color={props.carColor} motion={carMotion} active={showRider&&vehicle.current==='car'&&mode==='playing'} reducedMotion={reducedMotion}/>}</group></group>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0],spawn[1]+FEET_TO_CENTER,spawn[2]]} enabledRotations={[false,false,false]} name="explorer-body">
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS]} friction={0}/>
      <group ref={visual} position={[0,-FEET_TO_CENTER,0]} rotation={[0,Math.PI-initialHeading,0]}>
        <group ref={rideTilt} position={[0,BIKE_TRICK_PIVOT,0]} rotation={[0,0,0,'YXZ']}><group position={[0,-BIKE_TRICK_PIVOT,0]}>
        {showRider&&vehicle.current==='bicycle'&&<BicycleVisual modelId={bikeModelId} motion={motion}/>}
        {/* Pivot the lean around the rider's hips so they stay planted on the seat. */}
        <group visible={!(showRider&&(vehicle.current==='car'||vehicle.current==='boat'||vehicle.current==='plane'))} position={[0,showRider&&vehicle.current==='bicycle'?riderOffset[0]+riderHip:riderHip,showRider&&vehicle.current==='bicycle'?riderOffset[1]:0]} rotation={[showRider&&vehicle.current==='bicycle'?riderPose?.lean??0:0,0,0]}><group position={[0,-riderHip,0]}><ExplorerAvatar profile={profile} reducedMotion={reducedMotion} motion={motion} onHipHeight={setRiderHip}/></group></group>
        </group></group>
        {gliding&&<GliderVisual pose={gliderPose} backHeight={riderHip+.42} reducedMotion={reducedMotion}/>}
      </group>
    </RigidBody>
    <ThirdPersonCamera body={body} vehicleBody={cameraCar} carDistance={spawnedCarModel?VEHICLE_PROFILES[spawnedCarModel].cameraDistance:undefined} input={input} azimuth={azimuth} heading={heading} motion={motion} mode={mode} sensitivity={sensitivity} reducedMotion={reducedMotion} resetToken={resetToken} cameraControl={cameraControl} target={cameraTarget}/>
  </>;
}
