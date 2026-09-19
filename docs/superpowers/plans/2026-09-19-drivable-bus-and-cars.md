# Drivable Bus and Three New Cars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four player-drivable vehicles — Lambini GT, Celero GT, Willys buggy and an 8.5 m six-wheeled KSRTC bus — reusing the existing Rapier vehicle controller.

**Architecture:** Vehicles in this codebase are two data entries (`CAR_MODELS` for the GLB url and rotation, `VEHICLE_PROFILES` for measured geometry) feeding one shared `carPhysics.ts`. The three cars are pure data. The bus is the first vehicle that breaks that module's assumptions — four wheels, one global mass, one camera distance, one spawn footprint — so each assumption becomes an optional profile field that defaults to today's constant. Every existing car must come out numerically identical.

**Tech Stack:** TypeScript, React, @react-three/fiber, three.js, @dimforge/rapier3d-compat, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-drivable-bus-and-cars-design.md`

## Global Constraints

- The ten existing cars must be numerically unchanged. Every new `VehicleProfile` field is optional and its absence reproduces the current hard-coded constant exactly.
- Measured geometry (wheel centres, radii, lengths, `rotationY`) is a requirement, verified by `tests/vehicleProfiles.test.ts` against the GLB meshes. Do not round or "tidy" these numbers.
- Tuning values (mass, drive force, steering lock, top speed, camera distance) are starting points. Adjust by feel during implementation; do not treat them as fixed requirements.
- No new dependencies. No changes to bikes, boats, planes or gliders.
- Do not hand-optimize the GLBs. `scripts/optimize-assets.mjs` Draco/WebP-compresses every served asset at build time.
- Run the full suite with `npm test`. A single file runs as `npm test -- tests/<name>.test.ts`.
- Commit after each task. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

### Task 1: Three new cars (data only)

Pure data. Nothing in the physics engine changes — all three have four separate wheel meshes, so they steer and spin with the existing code.

**Files:**
- Modify: `src/content/assets/models.ts` (`CAR_MODELS`, after the `toy-car` entry)
- Modify: `src/content/assets/vehicleProfiles.ts` (`VEHICLE_PROFILES`)
- Test: `tests/modelAssets.test.ts:63`, `tests/vehicleProfiles.test.ts:24-27`

**Interfaces:**
- Consumes: nothing.
- Produces: `CarModelId` gains `'lambini' | 'celero' | 'willys-buggy'`. Later tasks reference `VEHICLE_PROFILES['willys-buggy']`.

- [ ] **Step 1: Write the failing tests**

In `tests/modelAssets.test.ts`, change the count on line 63:

```ts
    expect(CAR_MODELS).toHaveLength(13);
```

In `tests/vehicleProfiles.test.ts`, change the catalog count and add the three ids to the measured-wheel suite:

```ts
  it('keeps the one unresolved source unavailable in the fourteen-car catalog', () => {
    expect(CAR_PICKER_CATALOG).toHaveLength(14);
    expect(CAR_PICKER_CATALOG.filter(car => !car.available).map(car => car.id)).toEqual(['car']);
  });
  it.each(['car-carton', 'fennec', 'cyberpunk', 'supercar', 'lambini', 'celero', 'willys-buggy'] as const)('%s physics matches actual four wheel meshes', async id => {
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/modelAssets.test.ts tests/vehicleProfiles.test.ts`
Expected: FAIL — `CAR_MODELS` has length 10, and the three new ids are not assignable to `CarModelId`.

- [ ] **Step 3: Add the catalog entries**

In `src/content/assets/models.ts`, append to `CAR_MODELS` after the `toy-car` entry:

```ts
  { id: 'lambini', name: 'Lambini GT', url: '/assets/cars/bbr_2_-_lambini_gt.glb', rotationY: 0 },
  { id: 'celero', name: 'Celero GT', url: '/assets/cars/bbr_2_-_celero_gt.glb', rotationY: 0 },
  // Source node names have left/right swapped relative to world +X; the measured coordinates rule.
  { id: 'willys-buggy', name: 'Willys buggy', url: '/assets/cars/willys_mountain_buggy_2.glb', rotationY: 0 },
```

- [ ] **Step 4: Add the measured profiles**

In `src/content/assets/vehicleProfiles.ts`, append to `VEHICLE_PROFILES` before the closing brace:

```ts
  // Measured by replaying ModelAsset's normalization; see the design doc's calibration table.
  lambini: { length: 4.2, chassis: { x: .95, y: .45, z: 1.85, offset: .1 }, topSpeed: 34, wheels: [
    wheel(.7966,.39347,1.05764,.39347,'mesh_12_15nr012_mat_7011_0','mesh_12_19nr013_mat_8015_0','mesh_12_8nr012_mat_3009_0'),
    wheel(-.7966,.39347,1.05764,.39347,'mesh_12_15nr011_mat_7010_0','mesh_12_19nr012_mat_8014_0','mesh_12_8nr011_mat_3008_0'),
    wheel(.76823,.39347,-1.07211,.39347,'mesh_12_15nr013_mat_7012_0','mesh_12_19nr014_mat_8016_0','mesh_12_8nr013_mat_3010_0'),
    wheel(-.76823,.39347,-1.07211,.39347,'mesh_12_15nr010_mat_7009_0','mesh_12_19nr011_mat_8013_0','mesh_12_8nr010_mat_3007_0'),
  ] },
  celero: { length: 4.3, chassis: { x: .95, y: .42, z: 1.9, offset: .06 }, topSpeed: 30, wheels: [
    wheel(.8713,.41515,1.21039,.41515,'CarWheelRubberHW002_Car_Wheel_Rubber_HW006_0','CarWheelHubHWCelero_Steel002_Car_Wheel_Hub_HWCelero_Steel006_0','CarWheelBrakeBrake006_Car_Wheel_Brake_Brake013_0'),
    wheel(-.8713,.41515,1.21039,.41515,'CarWheelRubberHW001_Car_Wheel_Rubber_HW005_0','CarWheelHubHWCelero_Steel001_Car_Wheel_Hub_HWCelero_Steel005_0','CarWheelBrakeBrake005_Car_Wheel_Brake_Brake012_0'),
    wheel(.8713,.41515,-1.24832,.41515,'CarWheelRubberHW003_Car_Wheel_Rubber_HW007_0','CarWheelHubHWCelero_Steel003_Car_Wheel_Hub_HWCelero_Steel007_0','CarWheelBrakeBrake007_Car_Wheel_Brake_Brake014_0'),
    wheel(-.8713,.41515,-1.24832,.41515,'CarWheelRubberHW_Car_Wheel_Rubber_HW004_0','CarWheelHubHWCelero_Steel_Car_Wheel_Hub_HWCelero_Steel004_0','CarWheelBrakeBrake004_Car_Wheel_Brake_Brake004_0'),
  ] },
  // Tall off-roader: the belly sits .74 m clear, well above the .4 m floor the clearance test enforces.
  'willys-buggy': { length: 4, chassis: { x: 1.05, y: .6, z: 1.7, offset: .5 }, wheels: [
    wheel(1.01681,.58824,1.41221,.58824,'front_left_wheel_wheels_0','front_left_wheel_suspension_part_1_0'),
    wheel(-1.0168,.58824,1.41221,.58824,'front_right_wheel_wheels_0','front_right_wheel_suspension_part_1_0'),
    wheel(1.01681,.58824,-1.41221,.58824,'rear_left_wheel_wheels_0','rear_left_wheel_suspension_part_2_0'),
    wheel(-1.0168,.58824,-1.41221,.58824,'rear_right_wheel_wheels_0','rear_right_wheel_suspension_part_2_0'),
  ] },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/modelAssets.test.ts tests/vehicleProfiles.test.ts tests/storeCatalog.test.ts`
Expected: PASS. `vehicleProfiles.test.ts` re-derives every wheel centre and radius from the GLB, so a mismatch here means a wrong number, not a flaky test.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. `summitTrack.test.ts` now drives 13 cars up the mountain and takes several minutes; all three new cars are ordinary four-wheelers and should climb it.

- [ ] **Step 7: Commit**

```bash
git add src/content/assets/models.ts src/content/assets/vehicleProfiles.ts tests/modelAssets.test.ts tests/vehicleProfiles.test.ts
git commit -m "$(cat <<'MSG'
feat: add Lambini GT, Celero GT and Willys buggy

Measured from the GLB meshes by replaying ModelAsset's normalization.
All three have separate wheel meshes, so they steer and spin with the
existing four-wheel physics unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Per-profile camera distance

`FRAMING.car.distance` is a fixed 7.6 m. The buggy is tall and the bus (Task 7) is 8.5 m long, which would put the camera inside it.

**Files:**
- Modify: `src/content/assets/vehicleProfiles.ts` (`VehicleProfile` interface, `willys-buggy` profile)
- Modify: `src/game/camera/ThirdPersonCamera.tsx:12-25` (Props), `:80-84` (framing goal)
- Modify: `src/game/player/ExplorerController.tsx:616` (the `<ThirdPersonCamera .../>` element)
- Test: `tests/cameraFraming.test.ts` (create)

**Interfaces:**
- Consumes: `VEHICLE_PROFILES` from Task 1.
- Produces: `VehicleProfile.cameraDistance?: number`; `ThirdPersonCamera` prop `carDistance?: number`; exported `carFramingDistance(cameraDistance?: number): number` from `ThirdPersonCamera.tsx`.

- [ ] **Step 1: Write the failing test**

Create `tests/cameraFraming.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { carFramingDistance } from '../src/game/camera/ThirdPersonCamera';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';

describe('car camera framing', () => {
  it('keeps the shared 7.6 m chase distance when a profile asks for nothing', () => {
    expect(carFramingDistance(undefined)).toBe(7.6);
    expect(VEHICLE_PROFILES.admin.cameraDistance).toBeUndefined();
  });

  it('uses a profile override when one is set', () => {
    expect(carFramingDistance(13)).toBe(13);
  });

  it('pulls the camera back for the tall buggy', () => {
    expect(VEHICLE_PROFILES['willys-buggy'].cameraDistance).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/cameraFraming.test.ts`
Expected: FAIL — `carFramingDistance` is not exported.

- [ ] **Step 3: Add the profile field**

In `src/content/assets/vehicleProfiles.ts`, inside the `VehicleProfile` interface, after the `topSpeed` field:

```ts
  /** Chase-camera distance in metres; defaults to the shared 7.6 m car framing. */
  cameraDistance?: number;
```

Add `cameraDistance: 8` to the `willys-buggy` profile:

```ts
  'willys-buggy': { length: 4, chassis: { x: 1.05, y: .6, z: 1.7, offset: .5 }, cameraDistance: 8, wheels: [
```

- [ ] **Step 4: Thread it through the camera**

In `src/game/camera/ThirdPersonCamera.tsx`, add to `Props` after `vehicleBody`:

```ts
  /** Overrides the shared car chase distance for a long or tall vehicle. */
  carDistance?: number;
```

Export the resolver just below the `FRAMING` table:

```ts
/** The chase distance for a car, honouring a profile override. */
export function carFramingDistance(cameraDistance?: number): number {
  return cameraDistance ?? FRAMING.car.distance;
}
```

Accept the prop in the component signature (add `carDistance` to the destructured parameter list), and replace the `goal` line:

```ts
    const table = FRAMING[kind];
    const goal = kind === 'car' ? { ...table, distance: carFramingDistance(carDistance) } : table;
```

- [ ] **Step 5: Pass it from the controller**

In `src/game/player/ExplorerController.tsx`, import the profiles at the top with the other content imports:

```ts
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
```

and add the prop to the `<ThirdPersonCamera .../>` element:

```tsx
carDistance={spawnedCarModel?VEHICLE_PROFILES[spawnedCarModel].cameraDistance:undefined}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- tests/cameraFraming.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, and no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/content/assets/vehicleProfiles.ts src/game/camera/ThirdPersonCamera.tsx src/game/player/ExplorerController.tsx tests/cameraFraming.test.ts
git commit -m "$(cat <<'MSG'
feat: let a vehicle profile set its chase-camera distance

Defaults to the shared 7.6 m car framing, so the ten existing cars are
unaffected. The tall Willys buggy pulls back to 8 m; the 8.5 m bus will
need it more.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Per-profile exhaust position

`CarVisual` hard-codes the exhaust at `[.5, .32, -1.9]` with a one-off `admin` special case. A bus's tailpipe is nowhere near there.

**Files:**
- Modify: `src/content/assets/vehicleProfiles.ts` (`VehicleProfile` interface, `admin` profile)
- Modify: `src/game/vehicle/CarVisual.tsx:14-20`
- Test: `tests/carVisualExhaust.test.ts` (create)

**Interfaces:**
- Consumes: `VehicleProfile` from Task 2.
- Produces: `VehicleProfile.exhaust?: { x: number; y: number; z: number }`; exported `exhaustPosition(modelId: CarModelId): [number, number, number]` from `CarVisual.tsx`.

- [ ] **Step 1: Write the failing test**

Create `tests/carVisualExhaust.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { exhaustPosition } from '../src/game/vehicle/CarVisual';

describe('exhaust placement', () => {
  it('keeps the admin car on its hand-placed tailpipe', () => {
    expect(exhaustPosition('admin')).toEqual([.5, .32, -1.5]);
  });

  it('falls back to the shared rear position for a profile that sets none', () => {
    expect(exhaustPosition('fennec')).toEqual([.5, .32, -1.9]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/carVisualExhaust.test.ts`
Expected: FAIL — `exhaustPosition` is not exported.

- [ ] **Step 3: Add the profile field and move the admin special case into data**

In `src/content/assets/vehicleProfiles.ts`, inside `VehicleProfile`, after `cameraDistance`:

```ts
  /** Tailpipe position in metres; defaults to the shared rear position. */
  exhaust?: { x: number; y: number; z: number };
```

Add it to the `admin` profile, replacing the special case that currently lives in `CarVisual`:

```ts
  admin: { length: 3.8, legacyBoundsCap: true, exhaust: { x: .5, y: .32, z: -1.5 }, chassis: { x: .65, y: .52, z: 1.35, offset: .26 }, wheels: [
```

- [ ] **Step 4: Read it in the visual**

Replace the body of `src/game/vehicle/CarVisual.tsx` below the imports (add `VEHICLE_PROFILES` to the imports):

```tsx
/** Shared tailpipe position for a profile that does not place its own. */
const DEFAULT_EXHAUST: [number, number, number] = [.5, .32, -1.9];

export function exhaustPosition(modelId: CarModelId): [number, number, number] {
  const exhaust = VEHICLE_PROFILES[modelId]?.exhaust;
  return exhaust ? [exhaust.x, exhaust.y, exhaust.z] : DEFAULT_EXHAUST;
}

export function CarVisual({ modelId = 'admin', motion, active = false, reducedMotion = false, color }: CarVisualProps) {
  const model = CAR_MODELS.find(candidate => candidate.id === modelId) ?? CAR_MODELS[0];
  return <group>
    <ModelAsset key={model.id} url={model.url} length={3.8} rotationY={model.rotationY} name={`car-${model.id}`} carModel={model.id} carMotion={motion} carColor={color}/>
    {motion && <CarExhaust motion={motion} active={active} reducedMotion={reducedMotion} position={exhaustPosition(model.id)}/>}
  </group>;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/carVisualExhaust.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/assets/vehicleProfiles.ts src/game/vehicle/CarVisual.tsx tests/carVisualExhaust.test.ts
git commit -m "$(cat <<'MSG'
feat: let a vehicle profile place its own exhaust

Moves the admin car's one-off tailpipe offset out of a ternary in
CarVisual and into its profile. Every other car keeps the shared
default position.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Make the wheel count data-driven

`carPhysics.ts` hard-codes four wheels in five places. This task removes that assumption with no new vehicle, so any behaviour change shows up immediately as an existing test failing.

The subtle part is engine force. Today each front wheel gets `force * .2` and each rear `force * .3`, so a four-wheel car applies `force * 1.0` in total with a 40/60 front/rear split. Naively keeping those literals would give the bus's four rear wheels `force * 1.2` at the back alone. The split is instead divided by the number of wheels on that axle, which is arithmetically identical for four-wheel cars (`.4 / 2 = .2`, `.6 / 2 = .3`).

**Files:**
- Create: `src/game/vehicle/wheelLayout.ts`
- Modify: `src/game/vehicle/carPhysics.ts:22-28` (`CarMotion`, `createCarMotion`), `:58-73` (`sample`), `:104-115` (per-wheel loop)
- Modify: `src/game/vehicle/carWheelAnimation.ts:33` (`front: index < 2`)
- Test: `tests/wheelLayout.test.ts` (create), `tests/carPhysics.test.ts`

**Interfaces:**
- Consumes: `VehicleWheel` from `src/content/assets/vehicleProfiles.ts`.
- Produces: from `src/game/vehicle/wheelLayout.ts`:
  - `isRearWheel(wheel: VehicleWheel): boolean`
  - `engineForceShare(wheels: readonly VehicleWheel[]): number[]`
  `createCarMotion(wheelCount?: number)` in `carPhysics.ts` gains an optional argument defaulting to 4.

- [ ] **Step 1: Write the failing test**

Create `tests/wheelLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { engineForceShare, isRearWheel } from '../src/game/vehicle/wheelLayout';
import { VEHICLE_PROFILES } from '../src/content/assets/vehicleProfiles';
import type { VehicleWheel } from '../src/content/assets/vehicleProfiles';

const at = (x: number, z: number): VehicleWheel => ({ x, y: .3, z, radius: .3, nodes: [] });

describe('rear axle detection', () => {
  it('reads the axle off the wheel geometry, not its index', () => {
    expect(isRearWheel(at(.8, 1.2))).toBe(false);
    expect(isRearWheel(at(.8, -1.2))).toBe(true);
  });

  it('agrees with the index rule it replaces for every existing car', () => {
    for (const id of ['admin', 'muscle', 'car-carton', 'fennec', 'bronco', 'golf-gti', 'sports-coupe', 'supercar', 'toy-car', 'cyberpunk'] as const) {
      VEHICLE_PROFILES[id].wheels.forEach((wheel, index) => expect(isRearWheel(wheel), `${id}[${index}]`).toBe(index >= 2));
    }
  });
});

describe('engine force distribution', () => {
  it('reproduces the current .2/.3 split for a four-wheel car', () => {
    const shares = engineForceShare([at(.8, 1.2), at(-.8, 1.2), at(.8, -1.2), at(-.8, -1.2)]);
    expect(shares).toEqual([.2, .2, .3, .3]);
  });

  it('splits the same axle shares across a dual rear axle', () => {
    const shares = engineForceShare([at(.9, 2.7), at(-.9, 2.7), at(1, -1.8), at(.75, -1.8), at(-.75, -1.8), at(-1, -1.8)]);
    expect(shares).toEqual([.2, .2, .15, .15, .15, .15]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
  });
});
```

Append to `tests/carPhysics.test.ts`:

```ts
it('sizes the motion arrays to the profile wheel count', () => {
  expect(createCarMotion().wheelRotation).toHaveLength(4);
  expect(createCarMotion(6).wheelRotation).toHaveLength(6);
  expect(createCarMotion(6).wheelSteering).toHaveLength(6);
  expect(createCarMotion(6).wheelOffset).toHaveLength(6);
  const { car } = fixture('admin');
  expect(car.motion.wheelRotation).toHaveLength(CAR_WHEELS.admin.length);
});
```

Add `createCarMotion` to that file's existing import from `../src/game/vehicle/carPhysics`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/wheelLayout.test.ts tests/carPhysics.test.ts`
Expected: FAIL — `src/game/vehicle/wheelLayout.ts` does not exist, and `createCarMotion` takes no argument.

- [ ] **Step 3: Write the helpers**

Create `src/game/vehicle/wheelLayout.ts`:

```ts
import type { VehicleWheel } from '../../content/assets/vehicleProfiles';

/** Front/rear torque split, matching the rear bias the four-wheel cars were tuned with. */
const FRONT_AXLE_SHARE = .4, REAR_AXLE_SHARE = .6;

/** Profiles list wheels with +Z forward, so the axle is a property of the geometry, not the index. */
export function isRearWheel(wheel: VehicleWheel): boolean {
  return wheel.z < 0;
}

/**
 * Per-wheel fraction of the total engine force. The axle share is divided by the
 * number of wheels on that axle, so a dual rear axle delivers the same total
 * torque as a single one instead of twice as much.
 */
export function engineForceShare(wheels: readonly VehicleWheel[]): number[] {
  const rear = wheels.filter(isRearWheel).length, front = wheels.length - rear;
  return wheels.map(wheel => (isRearWheel(wheel) ? (rear ? REAR_AXLE_SHARE / rear : 0) : front ? FRONT_AXLE_SHARE / front : 0));
}
```

- [ ] **Step 4: Rewire `carPhysics.ts`**

Import the helpers:

```ts
import { engineForceShare, isRearWheel } from './wheelLayout';
```

Replace `createCarMotion`:

```ts
export function createCarMotion(wheelCount = 4): CarMotion {
  const perWheel = () => Array.from({ length: wheelCount }, () => 0);
  return {speed:0,signedSpeed:0,throttle:0,grounded:false,nitroActive:false,nitroRemaining:0,wheelRotation:perWheel(),wheelSteering:perWheel(),wheelOffset:perWheel()};
}
```

Inside `createCarPhysics`, after `const wheels=CAR_WHEELS[model];`, add:

```ts
  const forceShare=engineForceShare(wheels);
```

Replace `const motion=createCarMotion();` with:

```ts
  const motion=createCarMotion(wheels.length);
```

In `sample()`, replace the grounded line:

```ts
    motion.grounded=wheels.filter((_,i)=>vehicle.wheelIsInContact(i)).length>=2;
```

Replace the per-wheel loop header and its three wheel-indexed lines:

```ts
      for(let i=0;i<wheels.length;i++) {
        const rear=isRearWheel(wheels[i]);
        vehicle.setWheelSteering(i,rear?0:steering);
        // Rear-biased drive, like the muscle cars it imitates: throttle can help swing the tail in a drift.
        vehicle.setWheelEngineForce(i,brake?0:force*forceShare[i]);
        vehicle.setWheelFrictionSlip(i,3.6*surface.gripFactor);
        vehicle.setWheelSideFrictionStiffness(i,(handbrake&&rear?HANDBRAKE_REAR_GRIP:1)*surface.gripFactor);
        const coast=throttle===0&&!handbrake?CAR_MASS_KG*1.1*dt/wheels.length:0;
        vehicle.setWheelBrake(i,brake?CAR_MASS_KG*(occupied?60:100)*dt/wheels.length:handbrake&&rear?CAR_MASS_KG*14*dt/wheels.length:coast);
      }
```

- [ ] **Step 5: Rewire `carWheelAnimation.ts`**

Import the helper and read the axle from geometry. Replace the `names` line and the `wheels[index] = ...` line:

```ts
  const profileWheels = VEHICLE_PROFILES[model].wheels;
  const names = profileWheels.map(wheel => wheel.nodes);
```

```ts
    wheels[index] = { steering, spin, baseY: centerWorld.y, front: !isRearWheel(profileWheels[index]) };
```

with `import { isRearWheel } from './wheelLayout';` added to the imports.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- tests/wheelLayout.test.ts tests/carPhysics.test.ts tests/carWheelAnimation.test.ts tests/carHandling.test.ts`
Expected: PASS. These are the tuning-sensitive suites; if any handling assertion moves, the refactor changed behaviour and must be corrected rather than the assertion relaxed.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS, unchanged from Task 1.

- [ ] **Step 8: Commit**

```bash
git add src/game/vehicle/wheelLayout.ts src/game/vehicle/carPhysics.ts src/game/vehicle/carWheelAnimation.ts tests/wheelLayout.test.ts tests/carPhysics.test.ts
git commit -m "$(cat <<'MSG'
refactor: drive wheel count from the vehicle profile

Removes the hard-coded four from the grounded check, the per-wheel loop,
the brake and coast divisors, and the rear-axle test, which now reads the
wheel's own z instead of its index. Engine force is split per axle rather
than per wheel, so a dual rear axle gets the same total torque as a
single one. Arithmetically identical for all ten existing cars.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Spawn and dismount footprint from the profile

`resolveClearFeet` probes a fixed `Cuboid(.9, FEET_TO_CENTER, 1.9)` for every car, and `ExplorerController` steps the player out at a fixed `side = 1.55`, `along = 3`. A bus cleared against a car-sized box spawns inside shopfronts and drops the player inside its own bodywork.

**Files:**
- Modify: `src/game/vehicle/clearance.ts:16-31`
- Modify: `src/game/player/ExplorerController.tsx:114` (`clearFeet`), `:194` (`side`/`along`), `:244` (spawn probe)
- Test: `tests/carFootprint.test.ts` (create)

**Interfaces:**
- Consumes: `VEHICLE_PROFILES` from Task 1.
- Produces: `resolveClearFeet(world, excludeBody, x, z, nearY, ride, heading, footprint?)` where `footprint` is `{ halfX: number; halfZ: number } | undefined`. Omitting it keeps today's `.9` / `1.9`. Also `carFootprint(model: CarModelId): { halfX: number; halfZ: number }` exported from `clearance.ts`.

**Important:** the footprint is the vehicle's *plan* size, not its collision belly. The chassis box is deliberately compact (`admin` is only .65 x 1.35 against a 3.8 m car), so using it directly would make spawning **more** permissive for existing cars and let them clip walls they are currently rejected from. Use `halfZ = length / 2` and `halfX = max(chassis.x, .9)`. For the 3.8 m reference car that is exactly today's `.9` / `1.9`, so the ten existing cars keep their current spawn and dismount behaviour; only genuinely longer vehicles get a bigger probe.

- [ ] **Step 1: Write the failing test**

Create `tests/carFootprint.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { carFootprint, resolveClearFeet } from '../src/game/vehicle/clearance';

describe('car footprint', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('reproduces the current probe for the 3.8 m reference car', () => {
    expect(carFootprint('admin')).toEqual({ halfX: .9, halfZ: 1.9 });
  });

  it('widens for a wide vehicle and lengthens with the body, not the belly box', () => {
    expect(carFootprint('willys-buggy')).toEqual({ halfX: 1.05, halfZ: 2 });
    expect(carFootprint('supercar')).toEqual({ halfX: 1.05, halfZ: 2.2 });
  });

  it('rejects a slot the default car footprint accepts when a wider one is asked for', () => {
    const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(60, .2, 60).setTranslation(0, -.2, 0));
    // Two walls 2.4 m apart: a .9 m half-width car fits between them, a 1.25 m half-width bus does not.
    for (const x of [-1.2, 1.2]) world.createCollider(RAPIER.ColliderDesc.cuboid(.1, 2, 6).setTranslation(x, 2, 0));
    expect(resolveClearFeet(world, null, 0, 0, 0, 'car', 0)).not.toBeNull();
    expect(resolveClearFeet(world, null, 0, 0, 0, 'car', 0, { halfX: 1.25, halfZ: 1.9 })).toBeNull();
    world.free();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/carFootprint.test.ts`
Expected: FAIL — `carFootprint` is not exported and `resolveClearFeet` takes seven parameters.

- [ ] **Step 3: Take the footprint as a parameter**

In `src/game/vehicle/clearance.ts`, add the imports:

```ts
import type { CarModelId } from '../../content/assets/models';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
```

Add above `resolveClearFeet`:

```ts
/** The default car probe, kept for callers that do not know which car they are placing. */
const DEFAULT_CAR_FOOTPRINT = { halfX: .9, halfZ: 1.9 };

/**
 * A car's plan-view half-extents. Deliberately NOT the collision chassis, which is a
 * compact belly box: a 3.8 m car carries a 1.35 m half-length one. Clearance needs the
 * space the vehicle actually occupies, so the length drives it. At the 3.8 m reference
 * length this returns exactly the values the fixed probe used.
 */
export function carFootprint(model: CarModelId): { halfX: number; halfZ: number } {
  const profile = VEHICLE_PROFILES[model];
  return { halfX: Math.max(profile.chassis.x, DEFAULT_CAR_FOOTPRINT.halfX), halfZ: profile.length / 2 };
}
```

Change the signature and the two places that use the literals:

```ts
export function resolveClearFeet(world: World, excludeBody: RigidBody | null | undefined, x: number, z: number, nearY: number, ride: boolean | 'car', heading: number, footprint: { halfX: number; halfZ: number } = DEFAULT_CAR_FOOTPRINT): Vec3 | null {
```

```ts
  const shape = vehicle === 'car' ? new Cuboid(footprint.halfX,FEET_TO_CENTER,footprint.halfZ) : vehicle ? new Cuboid(.38,FEET_TO_CENTER,.95) : new Capsule(CAPSULE_HALF_HEIGHT,CAPSULE_RADIUS);
```

```ts
  const samples = vehicle === 'car'
    ? [[0,0],[-footprint.halfX,-footprint.halfZ],[-footprint.halfX,footprint.halfZ],[footprint.halfX,-footprint.halfZ],[footprint.halfX,footprint.halfZ]]
    : vehicle ? [[0,0],[-.38,-.95],[-.38,.95],[.38,.95],[.38,-.95]]
    : [[0,0],[-CAPSULE_RADIUS,0],[CAPSULE_RADIUS,0],[0,-CAPSULE_RADIUS],[0,CAPSULE_RADIUS]];
```

- [ ] **Step 4: Pass the real car's footprint from the controller**

In `src/game/player/ExplorerController.tsx`, import `carFootprint` alongside `resolveClearFeet` and add `import type { CarModelId } from '../../content/assets/models';` (neither `CarModelId` nor `VEHICLE_PROFILES` was imported there before Task 2). Then widen `clearFeet`:

```ts
  const clearFeet=(x:number,z:number,nearY:number,ride:boolean|'car',targetHeading=heading.current,model?:CarModelId)=>resolveClearFeet(world,body.current,x,z,nearY,ride,targetHeading,model?carFootprint(model):undefined);
```

In the car-spawn effect (line 244), pass the model being spawned. The `model` const is already computed there; move it above the loop and pass it in:

```ts
    const model=latest.current.carModelId??'admin';
    for(const [right,forward] of candidates){const x=feet[0]+Math.cos(heading.current)*right+Math.sin(heading.current)*forward,z=feet[2]-Math.sin(heading.current)*right-Math.cos(heading.current)*forward;const valid=clearFeet(x,z,feet[1],'car',heading.current,model);
```

and delete the now-duplicated `const model=...` from inside the loop body.

In the dismount block (line 194), derive the step-out offsets from the chassis instead of the literals:

```ts
    const footprint=isCar?carFootprint(spawnedCarModel??'admin'):null;
    const side=footprint?footprint.halfX+.65:1.05,along=footprint?footprint.halfZ+1.1:1.4;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/carFootprint.test.ts tests/bicycleClearance.test.ts tests/carEntry.test.ts tests/v2Terrain.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. `bicycleClearance` and `v2Terrain` call `resolveClearFeet` without the new argument and must be unaffected.

The dismount offsets are chosen so the reference car is unchanged: `admin` gives `side = .9 + .65 = 1.55` and `along = 1.9 + 1.1 = 3`, exactly the literals they replace. If `carEntry.test.ts` moves, the arithmetic is wrong — fix it rather than relaxing the assertion.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/vehicle/clearance.ts src/game/player/ExplorerController.tsx tests/carFootprint.test.ts
git commit -m "$(cat <<'MSG'
feat: size the car spawn and dismount probes from the profile

resolveClearFeet probed a fixed car-sized cuboid for every vehicle, and
the player stepped out at fixed offsets. Both now scale with the
vehicle's own plan size, so a long vehicle is not cleared against a
hatchback's footprint. The 3.8 m reference car resolves to the exact
values the literals held, so existing cars are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Scale the picker preview to the vehicle

`CarPreview` frames from a fixed `[5, 3.2, 6]` over a 3.4 m ground disc. An 8.5 m bus overflows both.

**Files:**
- Modify: `src/features/vehicles/CarPreview.tsx`
- Test: `tests/carPreview.test.ts` (create)

**Interfaces:**
- Consumes: `VEHICLE_PROFILES` from Task 1.
- Produces: `previewFraming(modelId: CarModelId): { camera: [number, number, number]; discRadius: number }` exported from `CarPreview.tsx`.

- [ ] **Step 1: Write the failing test**

Create `tests/carPreview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { previewFraming } from '../src/features/vehicles/CarPreview';

describe('car preview framing', () => {
  it('keeps the hand-tuned framing for a normal-length car', () => {
    const { camera, discRadius } = previewFraming('admin');
    expect(camera).toEqual([5, 3.2, 6]);
    expect(discRadius).toBe(3.4);
  });

  it('pulls back and widens the ground disc for a long vehicle', () => {
    const car = previewFraming('admin'), buggy = previewFraming('willys-buggy');
    expect(buggy.camera[2]).toBeGreaterThan(car.camera[2]);
    expect(buggy.discRadius).toBeGreaterThan(car.discRadius);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/carPreview.test.ts`
Expected: FAIL — `previewFraming` is not exported.

- [ ] **Step 3: Scale the framing with length**

Replace `src/features/vehicles/CarPreview.tsx` with:

```tsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { CarVisual } from '../../game/vehicle/CarVisual';
import type { CarModelId } from '../../content/assets/models';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

/** The framing was hand-tuned against a 3.8 m car; longer vehicles scale off that. */
const REFERENCE_LENGTH = 3.8;
const BASE_CAMERA: [number, number, number] = [5, 3.2, 6];
const BASE_DISC_RADIUS = 3.4;

export function previewFraming(modelId: CarModelId): { camera: [number, number, number]; discRadius: number } {
  const scale = Math.max(1, VEHICLE_PROFILES[modelId].length / REFERENCE_LENGTH);
  return {
    camera: [BASE_CAMERA[0] * scale, BASE_CAMERA[1] * scale, BASE_CAMERA[2] * scale],
    discRadius: BASE_DISC_RADIUS * scale,
  };
}

/** Selected car only; physics is never mounted in the preview canvas. */
export function CarPreview({ modelId, color }: { modelId: CarModelId; color?: string }) {
  const { camera, discRadius } = previewFraming(modelId);
  return <div style={{ height: 240 }} aria-label="Selected car preview">
    <Canvas dpr={[1, 1.5]} camera={{ position: camera, fov: 38 }} onCreated={({ camera: view }) => view.lookAt(0, .7, 0)}>
      <ambientLight intensity={1.4} /><directionalLight position={[3, 6, 4]} intensity={2.2} color="#fff1d3" />
      <Suspense fallback={null}><CarVisual modelId={modelId} color={color} reducedMotion /></Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><circleGeometry args={[discRadius, 40]} /><meshStandardMaterial color="#c7c6a0" roughness={1} /></mesh>
    </Canvas>
  </div>;
}
```

Note `admin` has `length: 3.8`, so its scale is exactly 1 and its framing is byte-identical.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/carPreview.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vehicles/CarPreview.tsx tests/carPreview.test.ts
git commit -m "$(cat <<'MSG'
feat: scale the car picker preview to the vehicle length

The camera and ground disc were fixed against a 3.8 m car. They now
scale with the profile length, so a long vehicle is framed rather than
cropped. Cars at or below the reference length are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Add the bus

Geometry and catalog only — the bus drives as a light vehicle at the end of this task. Task 8 gives it weight. This split keeps a wrong wheel position distinguishable from a wrong mass.

This task also narrows `summitTrack.test.ts`. That suite currently drives **every** `CAR_MODELS` entry from the mountain foot to the summit at 45% throttle. An 8.5 m bus is not a 4×4 and must not be tuned until it climbs a mountain track; it gets a road traversal assertion instead.

**Files:**
- Modify: `src/content/assets/models.ts` (`CAR_MODELS`)
- Modify: `src/content/assets/vehicleProfiles.ts` (`VEHICLE_PROFILES`)
- Test: `tests/modelAssets.test.ts:63`, `tests/vehicleProfiles.test.ts`, `tests/carPhysics.test.ts`, `tests/summitTrack.test.ts`, `tests/busRoute.test.ts` (create)

**Interfaces:**
- Consumes: `engineForceShare` / `isRearWheel` (Task 4), `carFootprint` (Task 5), `cameraDistance` (Task 2), `exhaust` (Task 3).
- Produces: `CarModelId` gains `'bus'`. Exported from `src/content/assets/models.ts`:
  `export const SUMMIT_CAPABLE_CAR_IDS: readonly CarModelId[]`.

- [ ] **Step 1: Write the failing tests**

In `tests/modelAssets.test.ts:63`:

```ts
    expect(CAR_MODELS).toHaveLength(14);
```

In `tests/vehicleProfiles.test.ts`, bump the catalog count to 15 and rename the case:

```ts
  it('keeps the one unresolved source unavailable in the fifteen-car catalog', () => {
    expect(CAR_PICKER_CATALOG).toHaveLength(15);
```

Add a six-wheel case to the same file, after the four-wheel suite. It repeats the four-wheel normalization because the bus has six wheels and the `it.each` above is named for four:

```ts
  it('bus physics matches actual six wheel meshes', async () => {
    const model = CAR_MODELS.find(car => car.id === 'bus')!;
    const profile = VEHICLE_PROFILES.bus, root = new Group(), scene = await loadGeometry(model.url);
    removeHiddenVehicleNodes(scene, 'bus');
    scene.rotation.y += model.rotationY; root.add(scene); root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true), size = bounds.getSize(new Vector3());
    root.scale.setScalar(profile.length / size.z);
    scene.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    root.updateMatrixWorld(true);
    expect(profile.wheels).toHaveLength(6);
    profile.wheels.forEach(wheel => {
      const wheelBounds = new Box3();
      wheel.nodes.forEach(name => { const part = root.getObjectByName(name); expect(part, name).toBeTruthy(); wheelBounds.expandByObject(part!, true); });
      const center = wheelBounds.getCenter(new Vector3());
      expect(center.x).toBeCloseTo(wheel.x, 3); expect(center.y).toBeCloseTo(wheel.y, 3); expect(center.z).toBeCloseTo(wheel.z, 2);
      expect(wheelBounds.getSize(new Vector3()).y / 2).toBeCloseTo(wheel.radius, 3);
    });
    createCarWheelAnimation(root, 'bus');
    for (let i = 0; i < 6; i++) expect(root.getObjectByName(`car-wheel-spin-${i}`)).toBeTruthy();
  });
```

Append to `tests/carPhysics.test.ts`:

```ts
it('registers all six bus wheels with the vehicle controller', () => {
  const { car } = fixture('bus');
  expect(CAR_WHEELS.bus).toHaveLength(6);
  expect(car.motion.wheelRotation).toHaveLength(6);
  expect(car.vehicle.numWheels()).toBe(6);
});

it('steers only the bus front axle and drives all four rear wheels', () => {
  const { car, step } = fixture('bus');
  for (let frame = 0; frame < 60; frame++) step(1, 1);
  car.sample();
  expect(Math.abs(car.motion.wheelSteering[0])).toBeGreaterThan(.05);
  for (const rear of [2, 3, 4, 5]) expect(car.motion.wheelSteering[rear], `wheel ${rear}`).toBe(0);
});
```

In `tests/summitTrack.test.ts`, replace the model list in the climb test and import the new constant:

```ts
import { CAR_MODELS, SUMMIT_CAPABLE_CAR_IDS, type CarModelId } from '../src/content/assets/models';
```

```ts
  it('lets every car drive from the foot to the peak', { timeout: 180_000 }, () => {
    const heading = Math.atan2(top[0] - foot[0], -(top[2] - foot[2]));
    for (const model of SUMMIT_CAPABLE_CAR_IDS) {
```

and add a guard so the exclusion stays deliberate rather than drifting:

```ts
  it('excludes only the bus from the summit climb', () => {
    const excluded = CAR_MODELS.map(car => car.id as CarModelId).filter(id => !SUMMIT_CAPABLE_CAR_IDS.includes(id));
    expect(excluded).toEqual(['bus']);
  });
```

Create `tests/busRoute.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, V2_ROUTES, isTravelAllowed, terrainHeight } from '../src/content/world/definition';
import { createCarPhysics } from '../src/game/vehicle/carPhysics';

const road = V2_ROUTES.find(route => route.id === 'malakkappara-road')!;

describe('the bus on the Malakkappara forest road', () => {
  beforeAll(async () => { await RAPIER.init(); });

  it('is allowed to drive the whole road', () => {
    for (const point of road.points) expect(isTravelAllowed('car', point[0], point[2]), `${point[0]},${point[2]}`).toBe(true);
  });

  it('pulls away from a standing start and keeps its wheels on the road', { timeout: 120_000 }, () => {
    const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    world.timestep = 1 / 60;
    for (const chunk of EXPANSION_GROUND.chunks) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(chunk.vertices), new Uint32Array(chunk.indices)).setFriction(.9));
    }
    const start = road.points[0], next = road.points[1];
    const heading = Math.atan2(next[0] - start[0], -(next[2] - start[2]));
    const car = createCarPhysics(world, [start[0], terrainHeight(start[0], start[2]) + .5, start[2]], heading, 'bus');
    let airborne = 0;
    for (let step = 0; step < 900; step++) {
      car.step({ forward: 1, steer: 0, brake: false }, 1 / 60, true);
      world.step(); car.sample();
      if (!car.motion.grounded) airborne++;
    }
    const travelled = Math.hypot(car.body.translation().x - start[0], car.body.translation().z - start[2]);
    expect(travelled).toBeGreaterThan(40);
    expect(airborne / 900).toBeLessThan(.1);
    car.dispose(); world.free();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/modelAssets.test.ts tests/vehicleProfiles.test.ts tests/busRoute.test.ts`
Expected: FAIL — `'bus'` is not a `CarModelId` and `SUMMIT_CAPABLE_CAR_IDS` does not exist.

- [ ] **Step 3: Add the catalog entry and the summit-capable list**

In `src/content/assets/models.ts`, append to `CAR_MODELS`:

```ts
  // Six wheels on a dual rear axle, and authored facing -Z, so it needs the half turn.
  { id: 'bus', name: 'KSRTC bus', url: '/assets/cars/etalon_a079_reworked.glb', rotationY: Math.PI },
```

Below the `CarModelId` type, add:

```ts
/**
 * Cars expected to climb the summit off-road track. The bus is a road vehicle:
 * it drives between the towns, not up a 4x4 track, and must not be tuned until it does.
 */
export const SUMMIT_CAPABLE_CAR_IDS = CAR_MODELS.map(car => car.id).filter(id => id !== 'bus') as readonly CarModelId[];
```

- [ ] **Step 4: Add the measured bus profile**

In `src/content/assets/vehicleProfiles.ts`, append to `VEHICLE_PROFILES`:

```ts
  // 8.5 m, six wheels: a steering front pair and a dual rear axle. The slight x asymmetry on the
  // front wheels (.949 vs -.924) is in the source model and is preserved, not rounded.
  bus: { length: 8.5, chassis: { x: 1.25, y: 1.35, z: 3.9, offset: 1 }, topSpeed: 19,
    cameraDistance: 13, exhaust: { x: -1, y: .5, z: -4.1 },
    wheels: [
      wheel(.94934,.47051,2.7029,.47051,'left_front_wheel_Material011_0'),
      wheel(-.92399,.47155,2.7029,.47051,'right_front_wheel_Material011_0'),
      wheel(1.0455,.47144,-1.79593,.47051,'left_rear_wheel_2_Material011_0'),
      wheel(.75881,.47051,-1.79593,.47051,'left_rear_wheel_1_Material011_0'),
      wheel(-.73347,.47155,-1.79593,.47051,'right_rear_wheel_1_Material011_0'),
      wheel(-1.02015,.47051,-1.79593,.47051,'right_rear_wheel_2_Material011_0'),
    ] },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/modelAssets.test.ts tests/vehicleProfiles.test.ts tests/carPhysics.test.ts tests/busRoute.test.ts tests/summitTrack.test.ts`
Expected: PASS. The belly-clearance property test covers the bus automatically: `.84 + 1 - 1.35 = .49`, above the `.4` floor.

- [ ] **Step 6: Look at it in the running app**

Run: `npm run dev`, open the store, equip the KSRTC bus, spawn it and drive. Confirm it is the right way round (you drive forward, not in reverse), that the camera frames it rather than sitting inside it, that all six wheels turn, and that the front pair steers while the rear four do not.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content/assets/models.ts src/content/assets/vehicleProfiles.ts tests/modelAssets.test.ts tests/vehicleProfiles.test.ts tests/carPhysics.test.ts tests/summitTrack.test.ts tests/busRoute.test.ts
git commit -m "$(cat <<'MSG'
feat: add the drivable KSRTC bus

Six wheels on a dual rear axle, 8.5 m, authored facing -Z so it carries a
half turn. Geometry only: it still has a car's mass and engine, which the
next commit replaces.

The summit off-road climb narrows to SUMMIT_CAPABLE_CAR_IDS. The bus is a
road vehicle and gets a Malakkappara forest road traversal test instead,
with a guard that keeps the exclusion list to exactly the bus.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Give the bus its weight

The bus currently weighs 1100 kg and has a supercar's engine. Four tuning fields make it heavy, each defaulting to today's constant.

Why the numbers: drive force is 40000 N against 1100 kg today, about 36 m/s² in a world whose gravity is 22 m/s². Scaling that linearly with mass would make an 8500 kg bus accelerate like a supercar, so it gets an explicit 78000 N — roughly 9 m/s², a quarter of a car's. Inertia scales by `(massKg / CAR_MASS_KG) * (length / 3.8) ** 2`, the mass-times-length-squared dimensional rule anchored on the tuned reference car; for the bus that is a factor of 38.7.

**Files:**
- Modify: `src/content/assets/vehicleProfiles.ts` (`VehicleProfile` interface, `bus` profile)
- Modify: `src/game/vehicle/carPhysics.ts:36-42` (body creation), `:95-112` (drive force, steering lock, nitro)
- Test: `tests/carPhysics.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4 and 7.
- Produces: `VehicleProfile` gains `massKg?: number`, `driveForce?: number`, `steerLock?: number`, `nitro?: boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/carPhysics.test.ts`:

```ts
describe('bus mass and engine', () => {
  it('weighs what its profile says and keeps the default for every car', () => {
    expect(VEHICLE_PROFILES.bus.massKg).toBe(8500);
    expect(VEHICLE_PROFILES.admin.massKg).toBeUndefined();
    const { car } = fixture('bus');
    expect(car.body.mass()).toBeGreaterThan(8000);
    expect(fixture('admin').car.body.mass()).toBeLessThan(1200);
  });

  it('pulls away far more slowly than a car', () => {
    const reach = (model: CarModelId) => {
      const { car, step } = fixture(model, { groundHalfSize: 300 });
      for (let frame = 0; frame < 180; frame++) step(1);
      return car.motion.speed;
    };
    expect(reach('bus')).toBeLessThan(reach('admin') * .6);
  });

  it('tops out near its rated speed, well under a car', () => {
    const { car, step } = fixture('bus', { groundHalfSize: 300 });
    for (let frame = 0; frame < 1800; frame++) step(1);
    const rated = VEHICLE_PROFILES.bus.topSpeed! * surfaceAt(0, 0).topSpeedFactor;
    expect(car.motion.speed).toBeGreaterThan(rated - 1.5);
    expect(car.motion.speed).toBeLessThan(rated + 1);
  });

  it('ignores nitro', () => {
    const { car } = fixture('bus', { groundHalfSize: 300 });
    for (let frame = 0; frame < 120; frame++) { car.step({ forward: 1, steer: 0, brake: false, nitro: true }, DT, true); }
    expect(car.motion.nitroActive).toBe(false);
  });

  it('turns in more lazily than a car at the same speed', () => {
    const yawAfter = (model: CarModelId) => {
      const { car, step } = fixture(model, { groundHalfSize: 300 });
      for (let frame = 0; frame < 120; frame++) step(.5, 1);
      return Math.abs(car.body.angvel().y);
    };
    expect(yawAfter('bus')).toBeLessThan(yawAfter('admin'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/carPhysics.test.ts`
Expected: FAIL — `massKg` is not a `VehicleProfile` field, and the bus currently weighs 1100 kg.

- [ ] **Step 3: Add the tuning fields**

In `src/content/assets/vehicleProfiles.ts`, inside `VehicleProfile` after `exhaust`:

```ts
  /** Kerb mass in kilograms; defaults to CAR_MASS_KG. Principal inertia scales with it and length². */
  massKg?: number;
  /** Peak engine force in newtons before the top-of-range fade; defaults to 40000. */
  driveForce?: number;
  /** Steering lock in radians at parking speed; defaults to .55. */
  steerLock?: number;
  /** Whether nitrous is available at all; defaults to true. */
  nitro?: boolean;
```

Add them to the `bus` profile:

```ts
  bus: { length: 8.5, chassis: { x: 1.25, y: 1.35, z: 3.9, offset: 1 }, topSpeed: 19,
    massKg: 8500, driveForce: 78000, steerLock: .34, nitro: false,
    cameraDistance: 13, exhaust: { x: -1, y: .5, z: -4.1 },
```

- [ ] **Step 4: Read them in the physics**

In `src/game/vehicle/carPhysics.ts`, replace the body creation so mass and inertia come from the profile. Put this above the `world.createRigidBody(...)` call:

```ts
  const profile = VEHICLE_PROFILES[model];
  const massKg = profile.massKg ?? CAR_MASS_KG;
  // Mass x length^2, the dimensional rule, anchored on the hand-tuned reference car.
  const inertiaScale = (massKg / CAR_MASS_KG) * (profile.length / 3.8) ** 2;
```

and change the mass properties argument:

```ts
    .setAdditionalMassProperties(massKg,{x:0,y:-.32,z:0},{x:1050*inertiaScale,y:1650*inertiaScale,z:850*inertiaScale},{x:0,y:0,z:0,w:1}));
```

Replace the two lines that read the chassis and top speed so they reuse `profile`:

```ts
  const chassis = profile.chassis;
  const topSpeed = profile.topSpeed ?? DEFAULT_TOP_SPEED;
  const peakDriveForce = profile.driveForce ?? 40000;
  const steerLock = profile.steerLock ?? .55;
  const nitroAllowed = profile.nitro !== false;
```

Gate nitro:

```ts
      stepNitro(nitro, nitroAllowed && occupied && throttle>0 && intent.nitro===true, dt);
```

Scale the engine force, keeping the existing 55% top-of-range fade as a proportion:

```ts
      const driveForce=peakDriveForce*(1-.55*Math.min(1,Math.abs(speed)/(topSpeed*1.1)));
```

Scale reverse in the same proportion (`30000 / 40000 = .75`):

```ts
      if(throttle<0) {if(speed>.25){brake=true;reverseArmed=false;}else if(reverseArmed&&speed>-7)force=peakDriveForce*.75*throttle;else brake=true;}
```

Make the steering lock proportional, so the default is arithmetically unchanged (`.55 * .727 = .4`):

```ts
      const lock=steerLock*(1-.727*Math.min(1,Math.abs(speed)/(topSpeed+4)));
```

Replace the remaining `CAR_MASS_KG` uses inside the per-wheel loop with `massKg`, so braking scales with what the vehicle actually weighs:

```ts
        const coast=throttle===0&&!handbrake?massKg*1.1*dt/wheels.length:0;
        vehicle.setWheelBrake(i,brake?massKg*(occupied?60:100)*dt/wheels.length:handbrake&&rear?massKg*14*dt/wheels.length:coast);
```

Note `40000 - 22000x` and `40000 * (1 - .55x)` are the same expression, and `CAR_MASS_KG` is still exported and still the default, so every existing car is unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/carPhysics.test.ts tests/carHandling.test.ts tests/busRoute.test.ts`
Expected: PASS. If an existing car's handling assertion moves, one of the "arithmetically identical" rewrites above is wrong — fix the expression, do not relax the assertion.

- [ ] **Step 6: Drive it**

Run: `npm run dev`. Drive the bus from Chalakkudy up the forest road to the Malakkappara bus stand. It should feel heavy and deliberate: slow to build speed, long to stop, unwilling to change direction quickly, and unable to nitro. Tune `massKg`, `driveForce`, `steerLock` and `topSpeed` by feel — they are starting points, not requirements. Check the other three cars still feel right.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content/assets/vehicleProfiles.ts src/game/vehicle/carPhysics.ts tests/carPhysics.test.ts
git commit -m "$(cat <<'MSG'
feat: give the bus a bus's weight and engine

Mass, drive force, steering lock and nitro availability become optional
profile fields. Principal inertia scales by mass times length squared off
the hand-tuned reference car. The bus runs 8500 kg, 78 kN and a .34 rad
lock, so it pulls away slowly, stops long and turns in lazily.

Every default reproduces the previous constant exactly, including the
rewritten drive-force and steering-lock expressions, so the thirteen
cars are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Done when

- The store and picker list fourteen cars; the Lambini GT, Celero GT, Willys buggy and KSRTC bus can each be equipped, spawned and driven.
- The bus drives the Chalakkudy–Malakkappara road, is framed by the camera, steers on its front axle only, and feels heavy.
- `npm test` passes, and no existing car's handling assertion was relaxed to get there.
