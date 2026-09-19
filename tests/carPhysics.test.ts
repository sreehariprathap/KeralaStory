import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCarMotion, createCarPhysics, CAR_MASS_KG, CAR_WHEELS, DEFAULT_TOP_SPEED } from '../src/game/vehicle/carPhysics';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';
import type { CarModelId } from '../src/content/assets/models';
import { MAIN_PATH, safeGroundPosition } from '../src/content/world/definition';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
import { surfaceAt } from '../src/content/world/roadSurface';

const DT = 1 / 60;
const models: CarModelId[] = ['admin', 'muscle', 'car-carton', 'fennec', 'bronco', 'cyberpunk'];
const worlds: RAPIER.World[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

function fixture(model: CarModelId, options: { ground?: boolean; slope?: boolean; feetY?: number; groundHalfSize?: number } = {}) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  const ground = options.ground ?? true;
  if (ground) {
    const groundDesc = RAPIER.ColliderDesc.cuboid(options.groundHalfSize ?? 150, 0.2, options.groundHalfSize ?? 150).setTranslation(0, -0.2, 0);
    if (options.slope) groundDesc.setRotation({ x: Math.sin(Math.PI / 36), y: 0, z: 0, w: Math.cos(Math.PI / 36) });
    world.createCollider(groundDesc);
  }
  const car = createCarPhysics(world, [0, options.feetY ?? 3, 0], Math.PI, model);
  const step = (forward = 0, steer = 0, brake = false, occupied = true) => {
    car.step({ forward, steer, brake }, DT, occupied);
    world.step();
  };
  return { world, car, step };
}

function terrainFixture(model: CarModelId, point: readonly [number, number]) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  for (const region of ['north', 'south'] as const) {
    const mesh = terrainMeshData(region);
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  }
  const feet = safeGroundPosition([point[0], 0, point[1]]);
  const car = createCarPhysics(world, feet, Math.PI, model);
  const step = (forward = 0) => { car.step({ forward, steer: 0, brake: false }, DT, false); world.step(); };
  return { world, car, step };
}

/** Like terrainFixture, but keeps the car occupied and driveable (terrainFixture hardcodes
 * occupied: false, which forces throttle to zero regardless of the forward value passed). */
function surfaceFixture(model: CarModelId, point: readonly [number, number]) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  for (const region of ['north', 'south'] as const) {
    const mesh = terrainMeshData(region);
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
  }
  const feet = safeGroundPosition([point[0], 0, point[1]]);
  const car = createCarPhysics(world, feet, Math.PI, model);
  const step = (forward = 0, steer = 0, brake = false) => { car.step({ forward, steer, brake }, DT, true); world.step(); };
  return { world, car, step };
}

describe('real Rapier car physics', () => {
  for (const model of models) {
    for (const degrees of [20, 30, 35]) {
      it(`${model} hill starts and climbs a ${degrees} degree incline through tyre contact`, () => {
        const world = new RAPIER.World({x:0,y:-20,z:0});
        worlds.push(world);
        const angle = -degrees * Math.PI / 180;
        // Long enough that the fastest car is still on the ramp after four seconds of full throttle.
        world.createCollider(RAPIER.ColliderDesc.cuboid(12,.2,260)
          .setTranslation(0,-.2,0).setRotation({x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)}));
        const car = createCarPhysics(world,[0,2,0],Math.PI,model);
        const step = (forward:number, occupied=true) => {car.step({forward,steer:0,brake:false},DT,occupied);world.step();};
        for(let i=0;i<240;i++) step(0,false);
        const start={...car.body.translation()};
        for(let i=0;i<120;i++) step(0,false);
        expect(Math.abs(car.body.translation().z-start.z)).toBeLessThan(.25);
        let groundedFrames=0;
        for(let i=0;i<240;i++) {step(1);if(car.motion.grounded)groundedFrames++;}
        const end=car.body.translation();
        expect(end.z-start.z).toBeGreaterThan(3);
        expect(end.y-start.y).toBeGreaterThan(1);
        expect(car.motion.signedSpeed).toBeGreaterThan(.5);
        expect(groundedFrames).toBeGreaterThan(220);
      });
    }
    it(`${model} settles with all tyre contact on flat ground at the authored mass`, () => {
      const { world, car, step } = fixture(model);
      expect(car.body.mass()).toBeCloseTo(CAR_MASS_KG, 5);
      for (let frame = 0; frame < 240; frame++) step();
      const translation = car.body.translation();
      expect(car.motion.grounded).toBe(true);
      expect(car.vehicle.wheelIsInContact(0)).toBe(true);
      expect(car.vehicle.wheelIsInContact(1)).toBe(true);
      expect(car.vehicle.wheelIsInContact(2)).toBe(true);
      expect(car.vehicle.wheelIsInContact(3)).toBe(true);
      expect(Math.abs(translation.y - 0.84)).toBeLessThan(0.15);
      for (let i = 0; i < 4; i++) {
        const connection = car.vehicle.wheelChassisConnectionPointCs(i);
        expect(connection).not.toBeNull();
        if (!connection) throw new Error(`missing wheel connection ${i}`);
        const suspensionLength = car.vehicle.wheelSuspensionLength(i);
        if (suspensionLength == null) throw new Error(`missing wheel suspension ${i}`);
        const contactY = translation.y + connection.y - suspensionLength - CAR_WHEELS[model][i].radius;
        expect(contactY).toBeCloseTo(0, 1);
      }
      expect(world.bodies.contains(car.body.handle)).toBe(true);
    });

    it(`${model} wakes from a settled sleep and responds to forward throttle`, () => {
      const { car, step } = fixture(model);
      for (let frame = 0; frame < 600; frame++) step();
      const parkedZ = car.body.translation().z;
      for (let frame = 0; frame < 90; frame++) step(1);
      expect(car.body.translation().z).toBeGreaterThan(parkedZ + 0.5);
      expect(car.motion.signedSpeed).toBeGreaterThan(0);
    });

    it(`${model} falls under gravity when airborne`, () => {
      const { car, step } = fixture(model, { ground: false, feetY: 10 });
      const initialY = car.body.translation().y;
      for (let frame = 0; frame < 30; frame++) step();
      expect(car.body.translation().y).toBeLessThan(initialY - 1);
      expect(car.motion.grounded).toBe(false);
    });

    it(`${model} settles with a measurable body tilt on a ten degree slope`, () => {
      const { car, step } = fixture(model, { slope: true, feetY: 3 });
      for (let frame = 0; frame < 240; frame++) step();
      const rotation = car.body.rotation();
      const tilt = Math.atan2(2 * (rotation.w * rotation.x + rotation.y * rotation.z), 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y));
      expect(car.motion.grounded).toBe(true);
      expect(Math.abs(tilt)).toBeGreaterThan(0.03);
      expect(Math.abs(tilt)).toBeLessThan(0.45);
    });

    it(`${model} moves along local positive Z for forward throttle at heading PI`, () => {
      const { car, step } = fixture(model);
      for (let frame = 0; frame < 120; frame++) step(1);
      expect(car.body.translation().z).toBeGreaterThan(1);
      expect(car.body.translation().x).toBeCloseTo(0, 1);
      expect(car.motion.signedSpeed).toBeGreaterThan(0);
    });

    it(`${model} reduces speed under braking`, () => {
      const { car, step } = fixture(model);
      for (let frame = 0; frame < 150; frame++) step(1);
      const beforeBrake = car.motion.speed;
      for (let frame = 0; frame < 45; frame++) step(0, 0, true);
      expect(beforeBrake).toBeGreaterThan(1);
      expect(car.motion.speed).toBeLessThan(beforeBrake * 0.7);
    });

    it(`${model} reverses after forward motion has been released`, () => {
      const { car, step } = fixture(model);
      for (let frame = 0; frame < 120; frame++) step(1);
      const heldBrakeZ = car.body.translation().z;
      for (let frame = 0; frame < 60; frame++) step(1, 0, true);
      expect(car.body.translation().z).toBeGreaterThan(heldBrakeZ - 0.2);
      expect(car.motion.signedSpeed).toBeGreaterThan(-0.1);
      for (let frame = 0; frame < 180; frame++) step(0, 0, true);
      const beforeReverse = car.body.translation().z;
      step();
      for (let frame = 0; frame < 180; frame++) step(-1);
      expect(car.body.translation().z).toBeLessThan(beforeReverse - 0.5);
      expect(car.motion.signedSpeed).toBeLessThan(0);
    });

    it(`${model} steers right toward negative X from heading PI`, () => {
      const { car, step } = fixture(model);
      for (let frame = 0; frame < 150; frame++) step(1, 1);
      expect(car.body.translation().x).toBeLessThan(-0.3);
      expect(Math.sin(car.sample())).toBeLessThan(0);
    });

    it(`${model} holds position on a slope while parked and unoccupied`, () => {
      const { car, step } = fixture(model, { slope: true });
      for (let frame = 0; frame < 240; frame++) step(0, 0, false, false);
      const parked = car.body.translation();
      for (let frame = 0; frame < 120; frame++) step(0, 0, false, false);
      const settled = car.body.translation();
      expect(Math.hypot(settled.x - parked.x, settled.z - parked.z)).toBeLessThan(0.2);
      expect(car.motion.grounded).toBe(true);
    });

    it(`${model} settles on the authored north and south terrain contact spine`, () => {
      const points = [MAIN_PATH[1], MAIN_PATH[4], MAIN_PATH[12]] as const;
      for (const point of points) {
        const { car, step } = terrainFixture(model, point);
        for (let frame = 0; frame < 240; frame++) step();
        const body = car.body.translation();
        const rotation = car.body.rotation();
        const localUpY = 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z);
        const contacts = [0, 1, 2, 3].filter(i => car.vehicle.wheelIsInContact(i)).length;
        expect(contacts).toBeGreaterThanOrEqual(2);
        expect(Number.isFinite(body.y)).toBe(true);
        expect(body.y).toBeGreaterThan(-10);
        expect(body.y).toBeLessThan(100);
        expect(localUpY).toBeGreaterThan(0.8);
      }
    });

    it(`${model} climbs the ten degree +X slope while throttling uphill`, () => {
      const { car, step } = fixture(model, { slope: true, feetY: 3 });
      for (let frame = 0; frame < 240; frame++) step();
      const startZ = car.body.translation().z;
      for (let frame = 0; frame < 180; frame++) step(1);
      expect(car.body.translation().z).toBeGreaterThan(startZ + 1);
    });

    it(`${model} cruises at its top speed without pitching back and forth`, () => {
      const { car, step } = fixture(model, { groundHalfSize: 300 });
      for (let frame = 0; frame < 120; frame++) step();
      for (let frame = 0; frame < 300; frame++) step(1);
      let reversals = 0, previous = 0;
      for (let frame = 0; frame < 240; frame++) {
        step(1);
        const pitchRate = car.body.angvel().x;
        if (Math.abs(pitchRate) > .02 && Math.sign(pitchRate) !== Math.sign(previous)) reversals++;
        previous = pitchRate;
      }
      expect(reversals).toBeLessThanOrEqual(1);
      // The synthetic flat fixture spawns at real-world (0, 0), which the authored road network
      // classifies as off-road, so the rated topSpeed is scaled by that surface's topSpeedFactor.
      const rated = (VEHICLE_PROFILES[model].topSpeed ?? DEFAULT_TOP_SPEED) * surfaceAt(0, 0).topSpeedFactor;
      expect(car.motion.speed).toBeGreaterThan(rated - .5);
      expect(car.motion.speed).toBeLessThan(rated + .5);
    });

    it(`${model} disposal removes the chassis and vehicle controller`, () => {
      const { world, car } = fixture(model);
      const handle = car.body.handle;
      expect(world.bodies.contains(handle)).toBe(true);
      expect(world.vehicleControllers.size).toBe(1);
      car.dispose();
      expect(world.bodies.contains(handle)).toBe(false);
      expect(world.vehicleControllers.size).toBe(0);
    });
  }
});

it('gives the cyberpunk car a higher top speed than the default cars', () => {
  expect(VEHICLE_PROFILES.cyberpunk.topSpeed).toBeGreaterThan(DEFAULT_TOP_SPEED);
  const speeds = (['admin', 'cyberpunk'] as const).map(model => {
    const { car, step } = fixture(model, { groundHalfSize: 300 });
    for (let frame = 0; frame < 600; frame++) step(1);
    return car.motion.speed;
  });
  expect(speeds[1]).toBeGreaterThan(speeds[0] + 4);
});

it('swings the tail out under the handbrake for a drift', () => {
  const yaw = (handbrake: boolean) => {
    const { car, world } = fixture('muscle', { groundHalfSize: 300 });
    const step = (forward: number, steer: number) => { car.step({ forward, steer, brake: false, handbrake }, DT, true); world.step(); };
    for (let frame = 0; frame < 240; frame++) step(1, 0);
    const before = car.sample();
    for (let frame = 0; frame < 40; frame++) step(0, 1);
    return Math.abs(Math.atan2(Math.sin(car.sample() - before), Math.cos(car.sample() - before)));
  };
  expect(yaw(true)).toBeGreaterThan(yaw(false) * 1.2);
});

describe('surface-aware traction', () => {
  const PAVED_POINT = MAIN_PATH[1] as readonly [number, number];
  const OFFROAD_POINT = [-73, -399] as const;

  it('classifies the two fixture points as paved and off-road respectively', () => {
    expect(surfaceAt(PAVED_POINT[0], PAVED_POINT[1]).kind).toBe('paved');
    expect(surfaceAt(OFFROAD_POINT[0], OFFROAD_POINT[1]).kind).toBe('offroad');
  });

  it('reaches a lower steady-state top speed off-road than on the paved network', () => {
    const paved = surfaceFixture('admin', PAVED_POINT);
    const offroad = surfaceFixture('admin', OFFROAD_POINT);
    for (let frame = 0; frame < 600; frame++) { paved.step(1); offroad.step(1); }
    expect(paved.car.motion.speed).toBeGreaterThan(offroad.car.motion.speed + 2);
  });

  it('slides more sideways off-road under a hard handbrake turn than on the paved network, at the same entry speed', () => {
    const paved = surfaceFixture('admin', PAVED_POINT);
    const offroad = surfaceFixture('admin', OFFROAD_POINT);
    for (const rig of [paved, offroad]) for (let frame = 0; frame < 60; frame++) rig.step(1);
    // Off-road's lower topSpeedFactor means it settles at a lower natural speed than paved after
    // the same warm-up; normalize both to the same entry speed so only grip differs in the turn.
    const ENTRY_SPEED = 12;
    for (const rig of [paved, offroad]) {
      const v = rig.car.body.linvel();
      rig.car.body.setLinvel({ x: 0, y: v.y, z: ENTRY_SPEED }, true);
    }
    let pavedLateral = 0, offroadLateral = 0;
    for (let frame = 0; frame < 60; frame++) {
      paved.car.step({ forward: 1, steer: 1, brake: false, handbrake: true }, DT, true); paved.world.step();
      offroad.car.step({ forward: 1, steer: 1, brake: false, handbrake: true }, DT, true); offroad.world.step();
      pavedLateral = Math.max(pavedLateral, Math.abs(paved.car.body.angvel().y));
      offroadLateral = Math.max(offroadLateral, Math.abs(offroad.car.body.angvel().y));
    }
    expect(offroadLateral).toBeGreaterThan(pavedLateral);
  });
});

it('sizes the motion arrays to the profile wheel count', () => {
  expect(createCarMotion().wheelRotation).toHaveLength(4);
  expect(createCarMotion(6).wheelRotation).toHaveLength(6);
  expect(createCarMotion(6).wheelSteering).toHaveLength(6);
  expect(createCarMotion(6).wheelOffset).toHaveLength(6);
  const { car } = fixture('admin');
  expect(car.motion.wheelRotation).toHaveLength(CAR_WHEELS.admin.length);
});
