import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Euler } from 'three';
import { resolveClearFeet } from '../src/game/vehicle/clearance';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, FEET_TO_CENTER } from '../src/game/player/controllerMath';
import { traversalBoxes } from '../src/game/world/traversalGeometry';

const worlds:RAPIER.World[]=[];
beforeAll(async()=>{await RAPIER.init();});
afterEach(()=>{for(const world of worlds.splice(0))world.free();});
function fixture(ground=true){
  const world=new RAPIER.World({x:0,y:-22,z:0});worlds.push(world);
  if(ground)world.createCollider(RAPIER.ColliderDesc.cuboid(10,.5,10).setTranslation(0,75.5,-460));
  world.step();return world;
}
function expectClear(world:RAPIER.World,feet:[number,number,number],ride:boolean,heading=0,exclude?:RAPIER.RigidBody){
  const angle=ride?Math.PI-heading:0;
  const shape=ride?new RAPIER.Cuboid(.38,FEET_TO_CENTER,.95):new RAPIER.Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS);
  expect(world.intersectionWithShape({x:feet[0],y:feet[1]+FEET_TO_CENTER,z:feet[2]},{x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},shape,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,exclude)).toBeNull();
}
describe('real collider mount and dismount clearance',()=>{
  it('resolves exact-size foot and bicycle shapes on flat ground and excludes the controlled body',()=>{
    const world=fixture();
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,76+FEET_TO_CENTER,-460));
    world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS),body);world.step();
    for(const ride of [false,true]){
      const feet=resolveClearFeet(world,body,0,-460,76,ride,0);
      expect(feet).not.toBeNull();expect(feet![1]).toBeCloseTo(76.06,4);expectClear(world,feet!,ride,0,body);
    }
  });
  it('rejects a low ceiling that the old undersized foot and ride probes missed',()=>{
    const world=fixture();world.createCollider(RAPIER.ColliderDesc.cuboid(2,.04,2).setTranslation(0,77.69,-460));world.step();
    // Prove the previous probes miss this 1.65m ceiling before checking the fix.
    for(const ride of [false,true]) {
      const legacy=ride?new RAPIER.Cuboid(.38,.56,.95):new RAPIER.Capsule(.45,.25);
      expect(world.intersectionWithShape({x:0,y:76.06+(ride?.98:.85),z:-460},{x:0,y:0,z:0,w:1},legacy)).toBeNull();
      expect(resolveClearFeet(world,null,0,-460,76,ride,0)).toBeNull();
    }
  });
  it('accounts for parked heading beside a wall',()=>{
    const world=fixture();world.createCollider(RAPIER.ColliderDesc.cuboid(.15,2,3).setTranslation(.8,78,-460));world.step();
    expect(resolveClearFeet(world,null,0,-460,76,true,0)).not.toBeNull();
    expect(resolveClearFeet(world,null,0,-460,76,true,Math.PI/2)).toBeNull();
  });
  it('raises the whole bicycle above an uphill footprint without penetrating the slope',()=>{
    const world=fixture(false),vertices=new Float32Array([-5,74,-465,5,74,-465,-5,78,-455,5,78,-455]);
    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,new Uint32Array([0,2,1,1,2,3])));world.step();
    const feet=resolveClearFeet(world,null,0,-460,76,true,0);
    expect(feet).not.toBeNull();expect(feet![1]).toBeCloseTo(76+.95*.4+.06,3);expectClear(world,feet!,true);
  });
  it('uses actual elevated bridge colliders and rejects a footprint hanging off a deck',()=>{
    const world=fixture(false);
    for(const shape of traversalBoxes().filter(shape=>shape.id.startsWith('bridge-'))){
      const rotation=new Quaternion().setFromEuler(new Euler(...shape.rotation));
      world.createCollider(RAPIER.ColliderDesc.cuboid(shape.size[0]/2,shape.size[1]/2,shape.size[2]/2).setTranslation(...shape.position).setRotation(rotation));
    }
    world.step();const feet=resolveClearFeet(world,null,12,-99,15,true,0);
    expect(feet).not.toBeNull();expect(feet![1]).toBeCloseTo(15.06,4);expectClear(world,feet!,true);
    expect(resolveClearFeet(world,null,14,-99,15,true,0)).toBeNull();
  });
  it('rejects steep ground, empty support, unsupported water and nonfinite input',()=>{
    const empty=fixture(false);expect(resolveClearFeet(empty,null,0,-460,76,true,0)).toBeNull();
    const world=fixture();expect(resolveClearFeet(world,null,NaN,-460,76,true,0)).toBeNull();
    const rotation=new Quaternion().setFromEuler(new Euler(Math.PI/3,0,0));
    const steep=fixture(false);steep.createCollider(RAPIER.ColliderDesc.cuboid(4,.1,4).setTranslation(0,76,-460).setRotation(rotation));steep.step();
    expect(resolveClearFeet(steep,null,0,-460,76,false,0)).toBeNull();
    const river=fixture(false);river.createCollider(RAPIER.ColliderDesc.cuboid(4,.5,4).setTranslation(0,8.5,-99));river.step();
    expect(resolveClearFeet(river,null,0,-99,9,true,0)).toBeNull();
  });
  it('ignores sensors and refuses moving rigid bodies as restore supports',()=>{
    const world=fixture();world.createCollider(RAPIER.ColliderDesc.cuboid(2,.1,2).setTranslation(0,76.4,-460).setSensor(true));world.step();
    expect(resolveClearFeet(world,null,0,-460,76,true,0)?.[1]).toBeCloseTo(76.06,4);
    const moving=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,76.3,-460));world.createCollider(RAPIER.ColliderDesc.cuboid(2,.1,2),moving);world.step();
    expect(resolveClearFeet(world,null,0,-460,76,true,0)).toBeNull();
  });
});
