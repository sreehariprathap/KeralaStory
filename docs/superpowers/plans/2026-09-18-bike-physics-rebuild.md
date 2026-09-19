# Bike Physics Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bikes' kinematic, character-controller-driven analytic motor with a real Rapier vehicle controller — matching how cars already work — so bikes get real terrain interaction, surface-aware traction, a genuine handbrake/drift, real ramp-launch physics, and a real jump impulse, while stunt tricks stay a cosmetic overlay.

**Architecture:** A new `bikePhysics.ts` mirrors `carPhysics.ts` structurally (a Rapier dynamic body + vehicle controller with narrow, centerline-mounted wheels). `ExplorerController.tsx`'s bicycle branch stops driving the shared kinematic character mover with `stepBicycle`'s x/z deltas, and instead creates/disposes a `bike.current` physics body at mount/dismount exactly like `car.current` already works, syncing the rendered character from it each frame.

**Tech Stack:** TypeScript, Rapier3D (`@dimforge/rapier3d-compat`), React Three Fiber, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-bike-physics-rebuild-design.md`

## Global Constraints

- No multiplayer changes — bikes, like cars, have no network sync today and none is added.
- `bikeStunts.ts` (trick pitch/spin logic) does not change — only what gates it (real wheel contact instead of the kinematic mover's grounded flag).
- The trick pitch/spin overlay must never feed back into the physics simulation (visual-only, composed at render time).
- `bikeGrounding.ts`'s `measureBikeTilt` is kept for the **parked** bike's visual tilt only (no physics body exists for a parked bike) — it is removed only from the **ridden** bike's tilt sampling, which switches to reading the real physics body's rotation.
- Reuse `roadSurface.ts` (from the car surface-traction sub-project) unmodified for bike off-road grip/speed.
- Before calling any task complete: `npm run typecheck`, `npm test`, `npm run build` must all pass.

---

### Task 1: `bikePhysics.ts` core module

**Files:**
- Create: `src/game/vehicle/bikePhysics.ts`
- Modify: `src/content/assets/bikeProfiles.ts`
- Test: `tests/bikePhysics.test.ts`

**Interfaces:**
- Consumes: `RigidBodyDesc`, `ColliderDesc`, `QueryFilterFlags`, `World` from `@dimforge/rapier3d-compat`; `Vec3` from `../../contracts`; `FEET_TO_CENTER` from `../player/controllerMath`; `createNitroState`, `stepNitro` from `./carNitro`; `surfaceAt` from `../../content/world/roadSurface`; `BikeModelId`, `bikeModel` from `../../content/assets/bikeProfiles`.
- Produces: `export interface BikeIntent { forward: number; steer: number; brake: boolean; nitro?: boolean; handbrake?: boolean }`, `export interface BikeMotion { speed: number; signedSpeed: number; throttle: number; grounded: boolean; nitroActive: boolean; nitroRemaining: number; wheelRotation: number[]; wheelSteering: number[] }`, `export function createBikePhysics(world: World, feet: Vec3, heading: number, model: BikeModelId): { body: RigidBody; vehicle: DynamicRayCastVehicleController; motion: BikeMotion; sample: () => number; hop: () => void; step: (intent: BikeIntent, dt: number, occupied: boolean) => void; dispose: () => void }`. Task 3 imports `createBikePhysics` and `BikeIntent`; Task 5 imports `BikeMotion` for the visual sync.

- [ ] **Step 1: Add `wheelRadius` to `BikeModel`**

In `src/content/assets/bikeProfiles.ts`, add the field to the interface and every model (a bicycle wheel is smaller than a motorcycle's):

```ts
export interface BikeModel {
  id: string;
  name: string;
  url?: string;
  rotationY: number;
  length: number;
  halfWheelbase: number;
  /** Wheel radius in metres, for the physics vehicle controller's suspension. */
  wheelRadius: number;
  seat: { height: number; z: number };
  rider?: { lean?: number; pedals?: boolean };
  hiddenNodes?: readonly string[];
  tuning: BicycleTuning;
}
```

Add `wheelRadius` to each entry in `BIKE_MODELS`:

```ts
export const BIKE_MODELS = [
  { id: 'roadster', name: 'Roadster bicycle', rotationY: 0, length: 1.9, halfWheelbase: .62, wheelRadius: .33, seat: { height: 1.08, z: -.3 },
    tuning: { topSpeed: 9, acceleration: 3 } },
  { id: 'electric', name: 'Electric bike', url: '/assets/bike/electric_bike_v_2.30.glb', rotationY: Math.PI / 2, length: 1.9, halfWheelbase: .56, wheelRadius: .3, seat: { height: .98, z: -.24 },
    tuning: { topSpeed: 14, acceleration: 6, brake: 9, nitro: { extraSpeed: 6, accelerationMultiplier: 1.8 } } },
  { id: 'yamaha', name: 'Yamaha FZ8', url: '/assets/bike/yamaha_bike.glb', rotationY: 0, length: 2.2, halfWheelbase: .78, wheelRadius: .32, seat: { height: .79, z: -.29 }, hiddenNodes: ['Cylinder266_758'], rider: { lean: .45, pedals: false },
    tuning: { topSpeed: 20, acceleration: 9, brake: 12, nitro: { extraSpeed: 10, accelerationMultiplier: 2 } } },
  { id: 'cyberpunk-bike', name: 'Cyberpunk bike', url: '/assets/bike/cyberpunk_bike.glb', rotationY: 0, length: 2.3, halfWheelbase: .86, wheelRadius: .34, seat: { height: .79, z: -.43 }, rider: { lean: .55, pedals: false },
    tuning: { topSpeed: 24, acceleration: 22, brake: 16, nitro: { extraSpeed: 16, accelerationMultiplier: 2.5 } } },
  { id: 'sports-bike', name: 'Sports bike', url: '/assets/bike/sports_bike.glb', rotationY: 0, length: 2.1, halfWheelbase: .72, wheelRadius: .31, seat: { height: .84, z: -.3 }, rider: { lean: .6, pedals: false },
    tuning: { topSpeed: 22, acceleration: 14, brake: 14, nitro: { extraSpeed: 12, accelerationMultiplier: 2.2 } } },
] as const satisfies readonly BikeModel[];
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/bikePhysics.test.ts
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBikePhysics } from '../src/game/vehicle/bikePhysics';
import { BIKE_MODELS, type BikeModelId } from '../src/content/assets/bikeProfiles';

const DT = 1 / 60;
const models = BIKE_MODELS.map(m => m.id) as BikeModelId[];
const worlds: RAPIER.World[] = [];

beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

function fixture(model: BikeModelId, options: { slope?: boolean; groundHalfSize?: number } = {}) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  worlds.push(world);
  const groundDesc = RAPIER.ColliderDesc.cuboid(options.groundHalfSize ?? 150, 0.2, options.groundHalfSize ?? 150).setTranslation(0, -0.2, 0);
  if (options.slope) groundDesc.setRotation({ x: Math.sin(Math.PI / 36), y: 0, z: 0, w: Math.cos(Math.PI / 36) });
  world.createCollider(groundDesc);
  const bike = createBikePhysics(world, [0, 2, 0], Math.PI, model);
  const step = (forward = 0, steer = 0, brake = false, handbrake = false, occupied = true) => {
    bike.step({ forward, steer, brake, handbrake }, DT, occupied);
    world.step();
  };
  return { world, bike, step };
}

describe('real Rapier bike physics', () => {
  for (const model of models) {
    it(`${model} settles with tyre contact on flat ground`, () => {
      const { bike, step } = fixture(model);
      for (let frame = 0; frame < 180; frame++) step();
      expect(bike.motion.grounded).toBe(true);
      expect(Number.isFinite(bike.body.translation().y)).toBe(true);
    });

    it(`${model} climbs a ten degree incline through real tyre contact`, () => {
      const { bike, step } = fixture(model, { slope: true });
      for (let frame = 0; frame < 180; frame++) step();
      const startZ = bike.body.translation().z;
      for (let frame = 0; frame < 180; frame++) step(1);
      expect(bike.body.translation().z).toBeGreaterThan(startZ + 1);
    });

    it(`${model} hop() applies an upward impulse only while grounded`, () => {
      const { bike, step } = fixture(model);
      for (let frame = 0; frame < 60; frame++) step();
      const beforeVy = bike.body.linvel().y;
      bike.hop();
      expect(bike.body.linvel().y).toBeGreaterThan(beforeVy + 1);
      // Airborne: a second hop is a no-op.
      const airborneVy = bike.body.linvel().y;
      bike.hop();
      expect(bike.body.linvel().y).toBeCloseTo(airborneVy, 1);
    });

    it(`${model} disposal removes the chassis and vehicle controller`, () => {
      const { world, bike } = fixture(model);
      const handle = bike.body.handle;
      expect(world.bodies.contains(handle)).toBe(true);
      bike.dispose();
      expect(world.bodies.contains(handle)).toBe(false);
    });
  }

  it('swings the tail out under the handbrake for a drift', () => {
    const yaw = (handbrake: boolean) => {
      const { bike, step } = fixture('yamaha', { groundHalfSize: 300 });
      for (let frame = 0; frame < 240; frame++) step(1, 0, false, false);
      const before = bike.sample();
      for (let frame = 0; frame < 40; frame++) step(0, 1, false, handbrake);
      return Math.abs(Math.atan2(Math.sin(bike.sample() - before), Math.cos(bike.sample() - before)));
    };
    expect(yaw(true)).toBeGreaterThan(yaw(false) * 1.2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/bikePhysics.test.ts`
Expected: FAIL — `src/game/vehicle/bikePhysics.ts` does not exist.

- [ ] **Step 4: Write `bikePhysics.ts`**

```ts
// src/game/vehicle/bikePhysics.ts
import { ColliderDesc, QueryFilterFlags, RigidBodyDesc, type World } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../contracts';
import { FEET_TO_CENTER } from '../player/controllerMath';
import { createNitroState, stepNitro } from './carNitro';
import { surfaceAt } from '../../content/world/roadSurface';
import { bikeModel, type BikeModelId } from '../../content/assets/bikeProfiles';

export const BIKE_MASS_KG = 220;
const BIKE_SUSPENSION_REST = .18;
const NITRO_EXTRA_SPEED_FALLBACK = 6;
const HANDBRAKE_REAR_GRIP = .35;
const GRIP_ASSIST = 6, DRIFT_ASSIST = 1.1, STRAIGHT_ASSIST = 16;
const SPEED_LIMIT_FADE = 1.2;
const HOP_IMPULSE_KG_MPS = BIKE_MASS_KG * 6.5;

export interface BikeIntent { forward: number; steer: number; brake: boolean; nitro?: boolean; handbrake?: boolean }
export interface BikeMotion {
  speed: number; signedSpeed: number; throttle: number; grounded: boolean;
  nitroActive: boolean; nitroRemaining: number;
  wheelRotation: number[]; wheelSteering: number[];
}

function createBikeMotion(): BikeMotion {
  return { speed: 0, signedSpeed: 0, throttle: 0, grounded: false, nitroActive: false, nitroRemaining: 0, wheelRotation: [0, 0], wheelSteering: [0, 0] };
}

/** A persistent dynamic chassis on the centerline (front/rear only, no left/right offset) —
 * the same raycast vehicle controller cars use, narrowed to a single-track arcade bike. */
export function createBikePhysics(world: World, feet: Vec3, heading: number, model: BikeModelId) {
  const tuning = bikeModel(model);
  const yaw = Math.PI - heading;
  const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(feet[0], feet[1] + FEET_TO_CENTER, feet[2])
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setCcdEnabled(true).setLinearDamping(.15).setAngularDamping(5)
    .setAdditionalMassProperties(BIKE_MASS_KG, { x: 0, y: -.2, z: 0 }, { x: 60, y: 40, z: 90 }, { x: 0, y: 0, z: 0, w: 1 }));
  world.createCollider(ColliderDesc.cuboid(.22, .35, tuning.length / 2).setTranslation(0, .35, 0).setDensity(0).setFriction(.4).setRestitution(.03), body);
  body.recomputeMassPropertiesFromColliders();
  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis = 1; vehicle.setIndexForwardAxis = 2;
  const wheelZ = [tuning.halfWheelbase, -tuning.halfWheelbase];
  wheelZ.forEach((z, i) => {
    const sag = Math.abs(world.gravity.y) / (2 * 150);
    vehicle.addWheel({ x: 0, y: tuning.wheelRadius + BIKE_SUSPENSION_REST - sag - FEET_TO_CENTER, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, BIKE_SUSPENSION_REST, tuning.wheelRadius);
    vehicle.setWheelSuspensionStiffness(i, 260);
    vehicle.setWheelSuspensionCompression(i, 6);
    vehicle.setWheelSuspensionRelaxation(i, 10);
    vehicle.setWheelMaxSuspensionTravel(i, .45);
    vehicle.setWheelMaxSuspensionForce(i, 20000);
    vehicle.setWheelFrictionSlip(i, 3.2);
    vehicle.setWheelSideFrictionStiffness(i, 1);
  });
  const motion = createBikeMotion();
  let reverseArmed = true, steering = 0;
  const nitro = createNitroState();
  const topSpeed = tuning.tuning.topSpeed, boost = tuning.tuning.nitro;
  const sample = () => {
    const q = body.rotation(), v = body.linvel();
    const forward = { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
    motion.signedSpeed = v.x * forward.x + v.y * forward.y + v.z * forward.z;
    motion.speed = Math.hypot(v.x, v.z);
    motion.grounded = [0, 1].filter(i => vehicle.wheelIsInContact(i)).length >= 1;
    wheelZ.forEach((_, i) => { motion.wheelRotation[i] = vehicle.wheelRotation(i) ?? 0; motion.wheelSteering[i] = vehicle.wheelSteering(i) ?? 0; });
    return Math.atan2(forward.x, -forward.z);
  };
  return {
    body, vehicle, motion, sample,
    hop() {
      if (!motion.grounded) return;
      body.applyImpulse({ x: 0, y: HOP_IMPULSE_KG_MPS, z: 0 }, true);
    },
    step(intent: BikeIntent, dt: number, occupied: boolean) {
      sample();
      const surface = surfaceAt(body.translation().x, body.translation().z);
      const throttle = occupied ? Math.max(-1, Math.min(1, intent.forward)) : 0;
      stepNitro(nitro, occupied && !!boost && throttle > 0 && intent.nitro === true, dt);
      motion.nitroActive = nitro.active;
      motion.nitroRemaining = nitro.remaining;
      if (occupied && (throttle !== 0 || intent.steer !== 0)) body.wakeUp();
      const speed = motion.signedSpeed;
      const handbrake = occupied && intent.handbrake === true;
      let brake = !occupied || intent.brake, force = 0;
      if (throttle === 0 && Math.abs(speed) < .2) reverseArmed = true;
      const driveForce = 6000 - 3000 * Math.min(1, Math.abs(speed) / (topSpeed * 1.1));
      const extraSpeed = nitro.active ? (boost?.extraSpeed ?? NITRO_EXTRA_SPEED_FALLBACK) : 0;
      const maxDriveSpeed = (topSpeed + extraSpeed) * surface.topSpeedFactor * Math.max(.2, Math.abs(throttle) || 1);
      const limiter = Math.min(1, Math.max(0, (maxDriveSpeed - speed) / SPEED_LIMIT_FADE));
      if (throttle > 0) { if (speed < -.3) brake = true; else force = driveForce * throttle * nitro.multiplier * limiter; reverseArmed = false; }
      if (throttle < 0) { if (speed > .2) { brake = true; reverseArmed = false; } else if (reverseArmed && speed > -4) force = 3000 * throttle; else brake = true; }
      if (intent.brake) { force = 0; reverseArmed = false; }
      motion.throttle = occupied && !brake ? Math.abs(throttle) : 0;
      const lock = .6 - .35 * Math.min(1, Math.abs(speed) / (topSpeed + 3));
      const target = occupied ? -Math.max(-1, Math.min(1, intent.steer)) * (handbrake ? Math.max(lock, .45) : lock) : 0;
      steering += (target - steering) * (1 - Math.exp(-11 * dt));
      for (let i = 0; i < 2; i++) {
        const rear = i === 1;
        vehicle.setWheelSteering(i, rear ? 0 : steering);
        vehicle.setWheelEngineForce(i, brake ? 0 : force * (rear ? .55 : .45));
        vehicle.setWheelFrictionSlip(i, 3.2 * surface.gripFactor);
        vehicle.setWheelSideFrictionStiffness(i, (handbrake && rear ? HANDBRAKE_REAR_GRIP : 1) * surface.gripFactor);
        const coast = throttle === 0 && !handbrake ? BIKE_MASS_KG * 1.1 * dt / 2 : 0;
        vehicle.setWheelBrake(i, brake ? BIKE_MASS_KG * (occupied ? 55 : 90) * dt / 2 : handbrake && rear ? BIKE_MASS_KG * 12 * dt / 2 : coast);
      }
      vehicle.updateVehicle(dt, QueryFilterFlags.EXCLUDE_SENSORS, undefined, candidate => candidate.parent()?.handle !== body.handle);
      const q = body.rotation(), v = body.linvel();
      const forwardX = 2 * (q.x * q.z + q.w * q.y), forwardZ = 1 - 2 * (q.x * q.x + q.y * q.y);
      const length = Math.hypot(forwardX, forwardZ) || 1;
      const fx = forwardX / length, fz = forwardZ / length, along = v.x * fx + v.z * fz, lateral = v.x * fz - v.z * fx;
      if (motion.grounded && occupied) {
        const straight = Math.abs(intent.steer) < 1e-4 && !handbrake;
        const keep = Math.exp(-(handbrake ? DRIFT_ASSIST : straight ? STRAIGHT_ASSIST : GRIP_ASSIST) * dt), bled = lateral * (1 - keep);
        const newAlong = along + Math.sign(along || 1) * Math.abs(bled) * (handbrake ? .2 : .6);
        const newLateral = lateral * keep;
        body.setLinvel({ x: fx * newAlong + fz * newLateral, y: v.y, z: fz * newAlong - fx * newLateral }, true);
        if (straight) { const angular = body.angvel(); body.setAngvel({ x: angular.x, y: 0, z: angular.z }, true); }
      }
      if ((!occupied && throttle === 0) || (Math.abs(speed) < .5 && (intent.brake || (throttle === 0 && Math.abs(intent.steer) < .05)))) {
        const parkedVelocity = body.linvel();
        body.setLinvel({ x: 0, y: Math.abs(parkedVelocity.y) < 0.15 ? 0 : parkedVelocity.y, z: 0 }, true);
      }
    },
    dispose() { world.removeVehicleController(vehicle); world.removeRigidBody(body); },
  };
}
export type BikePhysics = ReturnType<typeof createBikePhysics>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/bikePhysics.test.ts`
Expected: PASS for every model.

- [ ] **Step 6: Commit**

```bash
git add src/game/vehicle/bikePhysics.ts src/content/assets/bikeProfiles.ts tests/bikePhysics.test.ts
git commit -m "feat: add real Rapier bike vehicle physics"
```

---

### Task 2: Surface-aware traction test for bikes

**Files:**
- Test: `tests/bikePhysics.test.ts` (extend)

**Interfaces:**
- Consumes: `surfaceAt` from `../src/content/world/roadSurface`; `MAIN_PATH`, `safeGroundPosition` from `../src/content/world/definition`; `terrainMeshData` from `../src/game/world/traversalGeometry` (same real-terrain fixture pattern `tests/carPhysics.test.ts` already uses).

- [ ] **Step 1: Write the failing test**

Add near the top of `tests/bikePhysics.test.ts`:

```ts
import { surfaceAt } from '../src/content/world/roadSurface';
import { MAIN_PATH, safeGroundPosition } from '../src/content/world/definition';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
```

```ts
// New describe block appended to tests/bikePhysics.test.ts:
describe('surface-aware bike traction', () => {
  const PAVED_POINT = MAIN_PATH[1] as readonly [number, number];
  const OFFROAD_POINT = [-73, -399] as const; // verified off-road: see tests/roadSurface.test.ts / carPhysics.test.ts

  function realTerrainFixture(model: BikeModelId, point: readonly [number, number]) {
    const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    worlds.push(world);
    for (const region of ['north', 'south'] as const) {
      const mesh = terrainMeshData(region);
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.indices)));
    }
    const feet = safeGroundPosition([point[0], 0, point[1]]);
    const bike = createBikePhysics(world, feet, Math.PI, model);
    const step = (forward = 0) => { bike.step({ forward, steer: 0, brake: false }, DT, true); world.step(); };
    return { bike, step };
  }

  it('classifies the two fixture points as paved and off-road respectively', () => {
    expect(surfaceAt(PAVED_POINT[0], PAVED_POINT[1]).kind).toBe('paved');
    expect(surfaceAt(OFFROAD_POINT[0], OFFROAD_POINT[1]).kind).toBe('offroad');
  });

  it('reaches a lower steady-state top speed off-road than on the paved network', () => {
    const paved = realTerrainFixture('yamaha', PAVED_POINT);
    const offroad = realTerrainFixture('yamaha', OFFROAD_POINT);
    for (let frame = 0; frame < 600; frame++) { paved.step(1); offroad.step(1); }
    expect(paved.bike.motion.speed).toBeGreaterThan(offroad.bike.motion.speed + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run tests/bikePhysics.test.ts -t "surface-aware bike traction"`
Expected: PASS — `bikePhysics.ts` already calls `surfaceAt` from Task 1, so this should pass immediately and confirms the integration end-to-end. If the speed test fails, first check whether it's a slope-assist confound like the car sub-project hit (see `docs/superpowers/plans/2026-09-18-car-surface-traction.md` Task 2) — if so, apply the same fix (normalize entry speed before comparing, or widen the point spacing) rather than loosening the assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/bikePhysics.test.ts
git commit -m "test: verify bike surface-aware traction end-to-end"
```

---

### Task 3: Wire `bike.current` lifecycle into `ExplorerController.tsx`

**Files:**
- Modify: `src/game/player/ExplorerController.tsx`
- Modify: `src/game/player/travelCollider.ts`

**Interfaces:**
- Consumes: `createBikePhysics`, `BikeIntent`, `BikePhysics` from `../vehicle/bikePhysics` (Task 1).
- Produces: `bike.current: BikePhysics | null` (replacing today's `bike.current: BicycleMotorState`), `bikeMotion.current: BikeMotion` (a new ref, mirroring `carMotion.current`), `loseBike()` unchanged in name/behavior. Task 4 consumes `bike.current`/`bikeMotion.current` in the riding loop; Task 5 consumes `bike.current.sample()` for visuals.

- [ ] **Step 1: Fix the collider passenger check**

In `src/game/player/travelCollider.ts`, change (read the current surrounding lines first — this function also drives the collider shape switch a few lines below):

```ts
const passenger = mode === 'car' || mode === 'plane';
```

to:

```ts
const passenger = mode === 'car' || mode === 'plane' || mode === 'bicycle';
```

Bikes now have their own solid physics chassis (Task 1), so the character's own collider must become a non-solid passenger sensor while riding one, exactly like cars and planes already do — otherwise the two solid shapes fight each other.

- [ ] **Step 2: Replace the `bike` ref and add `bikeMotion`**

In `src/game/player/ExplorerController.tsx`, find where `bike` is declared (search for `const bike=useRef(createBicycleState`) and replace:

```ts
const bike=useRef(createBicycleState(initialHeading));
```

with:

```ts
const bike=useRef<BikePhysics|null>(null);
const bikeMotion=useRef<BikeMotion>({speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:[0,0],wheelSteering:[0,0]});
```

Update the import line (remove `createBicycleState`/`stepBicycle` from `./bicycleMotor`, they no longer exist after Task 6, but keep the import working for now by only adding the new one — Task 6 removes the old import):

```ts
import { createBikePhysics, type BikePhysics, type BikeMotion } from '../vehicle/bikePhysics';
```

- [ ] **Step 3: Update `removeBike`-equivalent lifecycle points**

Add a `removeBike` helper next to the existing `removeCar` (find `const removeCar=()=>{car.current?.dispose();car.current=null;...}`):

```ts
const removeBike=()=>{bike.current?.dispose();bike.current=null;bikeMotion.current={speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:[0,0],wheelSteering:[0,0]};};
```

In `setTravel` (search for `const setTravel=(next:TravelMode)=>{`), the line `bike.current.speed=0;` no longer type-checks (`bike.current` may be `null` and has no `.speed`). Remove that line entirely — Task 4's riding loop takes over responsibility for zeroing bike velocity on dismount via `removeBike()`.

- [ ] **Step 4: Update the reset/respawn point**

Find the line (search for `bike.current=createBicycleState(heading.current);` inside the larger reset function, near `removeCar();swimming.current=false;...`):

```ts
removeCar();swimming.current=false;bikeLost.current=false;crash.current=null;setExplosion(null);heading.current=latest.current.initialHeading??Math.PI;azimuth.current=-heading.current;bike.current=createBicycleState(heading.current);
```

Replace the trailing `bike.current=createBicycleState(heading.current);` with `removeBike();`:

```ts
removeCar();removeBike();swimming.current=false;bikeLost.current=false;crash.current=null;setExplosion(null);heading.current=latest.current.initialHeading??Math.PI;azimuth.current=-heading.current;
```

- [ ] **Step 5: Update the mount point**

Find the mount block (search for `if(!isCar)bike.current=createBicycleState(heading.current);setTravel(nearby);teleport(valid);`):

```ts
if(valid&&isTravelAllowed(isCar?'car':'bicycle',vehiclePosition[0],vehiclePosition[2])){if(!isCar)bike.current=createBicycleState(heading.current);setTravel(nearby);teleport(valid);azimuth.current=-heading.current;report('');return;}
```

Replace with:

```ts
if(valid&&isTravelAllowed(isCar?'car':'bicycle',vehiclePosition[0],vehiclePosition[2])){if(!isCar){bike.current=createBikePhysics(world,valid,vehicleHeading,bikeModelRef.current);bikeMotion.current=bike.current.motion;}setTravel(nearby);teleport(valid);azimuth.current=-heading.current;report('');return;}
```

- [ ] **Step 6: Update the mode-change effect and water-loss check**

Find (search for `bike.current.speed=0;} car.current?.body.setEnabled`):

```ts
useEffect(()=>{if(mode!=='playing'&&mode!=='loading'){verticalSpeed.current=0;motion.current.speed=0;bike.current.speed=0;}car.current?.body.setEnabled(mode==='playing'||mode==='loading');},[mode]);
```

Replace with:

```ts
useEffect(()=>{if(mode!=='playing'&&mode!=='loading'){verticalSpeed.current=0;motion.current.speed=0;}car.current?.body.setEnabled(mode==='playing'||mode==='loading');bike.current?.body.setEnabled(mode==='playing'||mode==='loading');},[mode]);
```

In `useAfterPhysicsStep` (search for `if(car.current){const p=car.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseCar();}`), add the bike equivalent directly after it:

```ts
if(car.current){const p=car.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseCar();}
if(bike.current){const p=bike.current.body.translation(),feetY=p.y-FEET_TO_CENTER;if(isSunk(feetY,openWaterSurfaceAt(p.x,p.z,feetY)))loseBike();}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: Errors only in the riding `useFrame` block (Task 4 fixes those — it still calls `stepBicycle`/reads `bike.current.speed` as if it were the old motor state) and the tilt-visual block (Task 5). Confirm no *other* errors — anything else means a lifecycle point was missed.

- [ ] **Step 8: Commit**

```bash
git add src/game/player/ExplorerController.tsx src/game/player/travelCollider.ts
git commit -m "feat: create/dispose a real bike physics body at mount/dismount"
```

---

### Task 4: Replace the kinematic riding loop with physics sync and a real jump impulse

**Files:**
- Modify: `src/game/player/ExplorerController.tsx`

**Interfaces:**
- Consumes: `bike.current`, `bikeMotion.current` (Task 3); `BikeIntent` (Task 1).
- Produces: `motion.current.speed`/`signedSpeed` sourced from `bikeMotion.current` while riding a bike, mirroring how they're already sourced from `carMotion.current` while driving a car (Task 5 and the HUD read these unchanged).

- [ ] **Step 1: Replace the bicycle branch of the riding `useFrame` block**

Find (search for `if(riding.current){` followed by `const activeMotor=bike.current;`):

```ts
if(riding.current){
  input.current.sprintLocked=false;
  const activeMotor=bike.current;
  const oldHeading=activeMotor.headingRad;
  const nitroHeld=playing&&(input.current.nitro||input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'));
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
```

Replace with:

```ts
if(riding.current&&vehicle.current==='bicycle'&&bike.current){
  input.current.sprintLocked=false;
  const nitroHeld=playing&&(input.current.nitro||input.current.keys.has('ShiftLeft')||input.current.keys.has('ShiftRight'));
  const handbrakeHeld=playing&&input.current.brake;
  const intent:BikeIntent={forward:playing?input.current.move.forward:0,steer:playing?input.current.move.x:0,brake:false,nitro:nitroHeld,handbrake:handbrakeHeld};
  bike.current.step(intent,dt,playing);
  if(playing&&input.current.jumpQueued){bike.current.hop();input.current.jumpQueued=false;}
  heading.current=bike.current.sample();
}
```

(The old branch's brake input doubled as both "slow down" and "handbrake" — `bikePhysics.ts`'s `step` takes a separate `handbrake` flag already wired to the same brake key here, matching the spec's decision to give bikes a real handbrake/drift. `clearFeet`-based turning collision checks are dropped: the bike's own solid chassis collider, from Task 3, now handles collision directly through real physics, the same way cars never call `clearFeet` mid-drive.)

- [ ] **Step 2: Replace the jump/vertical-motion block for bikes**

Find (search for `const onBike=vehicle.current==='bicycle',wasGrounded=motion.current.grounded;`):

```ts
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
```

Replace with (the bike no longer moves the kinematic `rigidBody` at all — that body now just trails behind for camera/visual bookkeeping the same way it already does for cars):

```ts
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
```

Note: `input.current.jumpQueued` for a mounted bike is now consumed in Step 1's block (`bike.current.hop()`), so the `!riding.current` guard here correctly leaves bike jumps alone. `landStunt`'s wipeout case no longer zeroes `bike.current.speed` directly (no longer meaningful with a physics body) — a wipeout is now just a reported message; if a stronger physical penalty is wanted (e.g. an extra brake impulse on wipeout), that's a follow-up, not required by the spec.

The `groundClimb`-based launch-boost hack, `BIKE_HOP_SPEED`, `BIKE_AIR_GRAVITY`, `BIKE_LAUNCH_SPEED`, and `BIKE_MAX_LAUNCH` constants are now unused. Delete their declarations (search for `const BIKE_HOP_SPEED=7.5;` and the three following constant lines) and delete the `groundClimb` ref declaration and its remaining reads/writes (search for `groundClimb`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: Remaining errors only in the tilt-visual block (search for `measureBikeTilt` — Task 5 fixes these) and possibly unused-import warnings for `stepBicycle`/`hasGroundAt` if no longer referenced elsewhere in the file (leave `hasGroundAt` alone if the file still uses it for other travel modes — check before removing any import).

- [ ] **Step 4: Commit**

```bash
git add src/game/player/ExplorerController.tsx
git commit -m "feat: drive bikes from real physics instead of the kinematic mover"
```

---

### Task 5: Visual tilt — real rotation while riding, keep raycast tilt for parked bikes

**Files:**
- Modify: `src/game/player/ExplorerController.tsx`

**Interfaces:**
- Consumes: `bike.current.sample()` (returns heading; body rotation read via `bike.current.body.rotation()`), `bikeMotion.current` (Task 3/4).

- [ ] **Step 1: Update the ride-tilt block**

Find (search for `if(rideTilt.current){` through its closing brace, inside the block that also handles the parked-bike tilt via `parkedTilt.current`):

```ts
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
```

Replace with:

```ts
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
    // Grounded: read the real physics body's pitch/roll directly instead of raycasting the ground.
    const q=riddenBike.body.rotation();
    const pitch=Math.atan2(2*(q.w*q.x+q.y*q.z),1-2*(q.x*q.x+q.y*q.y)),k=1-Math.exp(-14*dt);
    t.rotation.x=wrapAngle(t.rotation.x);t.rotation.y=wrapAngle(t.rotation.y);
    t.rotation.x+=(pitch-t.rotation.x)*k;t.rotation.y+=(0-t.rotation.y)*k;
    t.position.y+=(BIKE_TRICK_PIVOT-t.position.y)*k;
  }
}
```

(The parked-bike block a few lines above this one — `if(parkedTilt.current&&vehicle.current!=='bicycle'){...measureBikeTilt...}` — is left completely unchanged: a parked bike has no physics body, so `bikeGrounding.ts`'s raycast sampling is still the right tool there, exactly as the spec calls for.)

- [ ] **Step 2: Confirm `half` (halfWheelbase) is still used**

The `const half=bikeModel(bikeModelRef.current).halfWheelbase;` line above stays — it's still read by the untouched parked-bike tilt line. Do not remove it.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no remaining `measureBikeTilt`/`bike.current`-shape errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/player/ExplorerController.tsx
git commit -m "feat: read real bike physics rotation for the ridden tilt visual"
```

---

### Task 6: Delete the now-unused analytic bike motor and dead imports

**Files:**
- Delete: `src/game/vehicle/bicycleMotor.ts`
- Delete: `tests/bicycleMotor.test.ts` (if it exists and only tests the deleted module)
- Modify: `src/game/player/ExplorerController.tsx`

**Interfaces:** None — this task only removes now-dead code; no other task depends on anything here.

- [ ] **Step 1: Confirm nothing else imports `bicycleMotor.ts`**

Run: `grep -rn "bicycleMotor" src tests --include="*.ts" --include="*.tsx"`
Expected: Only `ExplorerController.tsx`'s now-unused import line remains (Task 3/4 already removed every call to `createBicycleState`/`stepBicycle`).

- [ ] **Step 2: Remove the dead import**

In `src/game/player/ExplorerController.tsx`, delete the line:

```ts
import { createBicycleState, stepBicycle } from '../vehicle/bicycleMotor';
```

- [ ] **Step 3: Delete `bicycleMotor.ts` and its test**

```bash
git rm src/game/vehicle/bicycleMotor.ts
```

Check whether `tests/bicycleMotor.test.ts` exists and only exercises `stepBicycle`/`createBicycleState`:

Run: `test -f tests/bicycleMotor.test.ts && head -5 tests/bicycleMotor.test.ts`

If it exists and imports from `../src/game/vehicle/bicycleMotor`, delete it too: `git rm tests/bicycleMotor.test.ts`. If it doesn't exist, skip this.

- [ ] **Step 4: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: PASS — no references to the deleted module remain anywhere.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove the superseded analytic bike motor"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including every model in `tests/bikePhysics.test.ts`'s per-model loop and the full pre-existing suite (bicycle-adjacent tests: `tests/bicycleClearance.test.ts`, `tests/bicycleMotor.test.ts` if not deleted in Task 6, `tests/wheelMath.test.ts`). If any pre-existing bicycle test asserted the old kinematic-motor behavior directly (rather than through `ExplorerController`), update its expectations the same way the car sub-project updated its "cruises at top speed" tests — fix the expectation to match the new, correct physics-driven behavior, not the physics.

- [ ] **Step 2: Typecheck everything**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual playtest checklist**

- Mount a bike, ride on-road and off-road, confirm a felt difference in speed/grip.
- Climb a slope on a bike; compare to the same slope on foot and in a car.
- Hold the brake key while turning at speed on a bike: confirm a real drift, tail sliding out.
- Press jump while riding: confirm a real hop, and that pressing it again mid-air does nothing.
- Ride a bike into deep water: confirm it's lost the same way a car sinking is lost (`vehicle.bikeSank` message, rider left swimming).
- Ride through an existing stunt park ramp on a bike: confirm it launches and a trick can be landed/wiped out.
- Park a bike on a slope, walk away, confirm it still visually rests tilted against the ground (the parked-bike tilt path, unchanged).
- Confirm a parked bike waiting to be mounted, and a bike freshly spawned via the bike-spawn button, both still work (Task 3 touched the mount path, not the spawn-placement path, but verify by hand).

- [ ] **Step 5: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found in full verification pass"
```
