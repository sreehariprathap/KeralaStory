import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { MAIN_PATH, safeGroundPosition, isCycleAllowed } from '../src/content/world/definition';
import { buildArchitecture } from '../src/game/world/KeralaWorld';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
import { computeExplorerMovement, createExplorerMotor } from '../src/game/player/characterMotor';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, WALK_SPEED, needsSafeReset } from '../src/game/player/controllerMath';

beforeAll(async()=>{await RAPIER.init();});
function followRoute(route: [number,number][], bicycleEnvelope=false) {
  const world=new RAPIER.World({x:0,y:-22,z:0});world.timestep=1/60;
  try {
    for(const region of ['north','south'] as const) {
      const mesh=terrainMeshData(region);
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices),new Uint32Array(mesh.indices)));
    }
    const architecture=buildArchitecture();
    for(const mesh of architecture.meshes) mesh.geometry.dispose();
    for(const shape of architecture.colliders) {
      const q=new Quaternion().setFromEuler(new Euler(...shape.rotation));
      world.createCollider(RAPIER.ColliderDesc.cuboid(shape.size[0],shape.size[1],shape.size[2]).setTranslation(...shape.position).setRotation(q));
    }
    const start=safeGroundPosition([route[0][0],0,route[0][1]]);
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0],start[1]+FEET_TO_CENTER,start[2]));
    const collider=world.createCollider(bicycleEnvelope?RAPIER.ColliderDesc.cuboid(.38,FEET_TO_CENTER,.95):RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),body);
    const motor=createExplorerMotor(world),state={grounded:false,verticalSpeed:0};world.step();
    let steps=0,bicycleHeading=0,bicycleSpeed=0;
    // Roadster's old cruise tuning (9 m/s, 3 m/s^2): this harness only needs a speed ramp toward a
    // cruise speed, since heading is overridden from the route each frame regardless.
    const BICYCLE_CRUISE_SPEED=9,BICYCLE_ACCEL=3;
    for(const [x,z] of route.slice(1)) {
      let arrived=false;
      const initial=body.translation(),budget=Math.ceil(Math.hypot(x-initial.x,z-initial.z)/WALK_SPEED*60*3)+120;
      for(let i=0;i<budget;i++) {
        const p=body.translation(),distance=Math.hypot(x-p.x,z-p.z);
        if(distance<.16){arrived=true;break;}
        let speed=WALK_SPEED;
        if(bicycleEnvelope) {
          bicycleHeading=Math.atan2(x-p.x,-(z-p.z));
          bicycleSpeed=Math.min(BICYCLE_CRUISE_SPEED,bicycleSpeed+BICYCLE_ACCEL/60);speed=bicycleSpeed;
          expect(isCycleAllowed(p.x+(x-p.x)/distance*speed/60,p.z+(z-p.z)/distance*speed/60)).toBe(true);
          const angle=Math.PI-bicycleHeading;
          body.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},true);
        }
        const move=computeExplorerMovement(motor,collider,state,{xVelocity:(x-p.x)/distance*speed,zVelocity:(z-p.z)/distance*speed,jump:false},1/60);
        body.setNextKinematicTranslation({x:p.x+move.x,y:p.y+move.y,z:p.z+move.z});world.step();steps++;
        expect(needsSafeReset(body.translation()),`unsafe at ${JSON.stringify(body.translation())}`).toBe(false);
      }
      expect(arrived,`blocked approaching ${x},${z} at ${JSON.stringify(body.translation())}`).toBe(true);
    }
    return steps/60;
  } finally {world.free();}
}
it('walks the actual terrain and bridge collision spine in both directions without recovery',()=>{
  const route=MAIN_PATH.filter(([,z])=>z>=-460);
  followRoute(route);followRoute([...route].reverse());
},30000);
it('walks the quay ramp out to the pier tip and returns inside the world bounds',()=>{
  const route:[number,number][]=[[70,76],[77.5,76],[88,76],[96,76],[88,76],[77.5,76],[70,76]];
  followRoute(route);
},30000);

it('accelerates the bicycle motor to 9m/s and passes its collision envelope along the spine both ways',()=>{
  // Collision clearance gate only: headings follow the polyline directly. This
  // does not claim player steering, acceleration, or whole-device ride timings.
  const route=MAIN_PATH.filter(([,z])=>z>=-460);
  followRoute(route,true);followRoute([...route].reverse(),true);
},30000);
