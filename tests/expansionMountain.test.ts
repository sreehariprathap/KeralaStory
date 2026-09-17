import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, terrainHeight } from '../src/content/world/definition';
import { computeExplorerMovement, createExplorerMotor } from '../src/game/player/characterMotor';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER, WALK_SPEED, needsSafeReset } from '../src/game/player/controllerMath';
import type { Vec3 } from '../src/contracts';

beforeAll(async()=>{await RAPIER.init();});
function walk(route:readonly Vec3[]){
  const world=new RAPIER.World({x:0,y:-22,z:0});world.timestep=1/60;
  try{
    for(const chunk of [...EXPANSION_GROUND.chunks,EXPANSION_GROUND.originalNorthChunk])world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(chunk.vertices),new Uint32Array(chunk.indices)));
    const p=route[0], body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p[0],terrainHeight(p[0],p[2])+FEET_TO_CENTER+.06,p[2]));
    const capsule=world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),body), motor=createExplorerMotor(world), state={grounded:false,verticalSpeed:0};world.step();
    let steps=0, groundedSteps=0;
    for(const target of route.slice(1)){
      let arrived=false;
      const p=body.translation(), budget=Math.ceil(Math.hypot(p.x-target[0],p.z-target[2])/WALK_SPEED*60*3)+120;
      for(let i=0;i<budget;i++){
        const p=body.translation(),distance=Math.hypot(target[0]-p.x,target[2]-p.z);
        if(distance<.13){arrived=true;break;}
        const move=computeExplorerMovement(motor,capsule,state,{xVelocity:(target[0]-p.x)/distance*WALK_SPEED,zVelocity:(target[2]-p.z)/distance*WALK_SPEED,jump:false},1/60);
        body.setNextKinematicTranslation({x:p.x+move.x,y:p.y+move.y,z:p.z+move.z});world.step();steps++;
        if(state.grounded)groundedSteps++;
        expect(needsSafeReset(body.translation()),`unsafe ${JSON.stringify(body.translation())}`).toBe(false);
      }
      expect(arrived,`blocked approaching ${target} at ${JSON.stringify(body.translation())}`).toBe(true);
    }
    expect(groundedSteps/steps).toBeGreaterThan(.95);
    return steps/60;
  }finally{world.free();}
}
it('walks continuously from the original junction to the summit and descends without jumping or reset',()=>{
  const road=EXPANSION_LAYOUT.routes.find(r=>r.id==='chokkana-main-road')!;
  const spur=EXPANSION_LAYOUT.routes.find(r=>r.id==='summit-access-road')!;
  const trail=EXPANSION_LAYOUT.routes.find(r=>r.id==='summit-trail')!;
  const start=road.points.filter(p=>p[0]>=-65);
  const route=[...start,...spur.points,...trail.points];
  expect(walk(route)).toBeGreaterThan(180);
  walk([...route].reverse());
},60000);
it('walks the descending waterfall trail in both directions without jumping',()=>{
  const route=EXPANSION_LAYOUT.routes.find(r=>r.id==='athirappilly-view-trail')!.points;
  walk(route);walk([...route].reverse());
},30000);
