# Drivable Bus and Three New Cars — Design

Date: 2026-09-19
Branch: `feature/map-expansion`
Status: approved for implementation

## Scope

Add four player-drivable vehicles from GLB sources already in
`public/assets/cars/`:

| id | Name | Source GLB | Character |
| --- | --- | --- | --- |
| `lambini` | Lambini GT | `bbr_2_-_lambini_gt.glb` | Low, fast supercar |
| `celero` | Celero GT | `bbr_2_-_celero_gt.glb` | Fast hatch/coupe |
| `willys-buggy` | Willys buggy | `willys_mountain_buggy_2.glb` | Tall off-roader, big tyres |
| `bus` | KSRTC bus | `etalon_a079_reworked.glb` | 8.5 m, six wheels, heavy |

All four are ordinary store/picker entries alongside the existing ten cars.
The player spawns and drives them exactly as today — there is no new mount
flow, no route, no schedule, no NPC driver. "Runs across towns" means the
player can drive the bus the length of the Chalakkudy–Malakkappara road; it
does not mean a bus service.

The three cars are data-only. The bus is the reason this needs a spec: it is
the first vehicle that does not fit the assumptions baked into
`carPhysics.ts` (exactly four wheels, one global mass, one camera distance,
one spawn footprint).

## Decisions

| Question | Decision |
| --- | --- |
| Bus role | Player-drivable, same as any car. Not an NPC route, not fast travel, not parked-at-stands-only. |
| Bus feel | Heavy and honest: ~8500 kg, top speed 19 m/s (~68 km/h), reduced steering lock, long braking, no nitro. |
| Six wheels | Generalize `carPhysics.ts` to `profile.wheels.length`. Not four-physics-plus-two-decorative, and not a separate `busPhysics.ts`. |
| Existing cars | Must come out numerically identical. Every new profile field is optional and defaults to today's constant. |
| Paint colours | Not in scope. The four keep their exported liveries; `paint` stays unset, as it is for nine of the current ten cars (only `supercar` sets it). |
| Malakkappara box bus | Left alone. The hand-built geometry in `malakkapparaTown.ts:121` stays; swapping it for a 22 MB GLB is a separate perf decision. |
| Bus stops / routes / NPC traffic | Out of scope. |
| Asset optimization | None by hand. `scripts/optimize-assets.mjs` already Draco/WebP-compresses every served GLB at build time. |
| Tuning numbers | Mass, drive force, inertia and top speed below are calibrated starting points, tuned by feel during implementation. Geometry (wheel positions, radii, lengths) is measured and is a requirement. |

## Measured calibration

Measured by replaying the exact normalization `ModelAsset` performs: apply
`rotationY`, measure bounds, scale by `length / size.z`, recentre x/z, sit
`min.y` on 0. Every wheel's centre height equals its radius, which confirms
the calibration matches the renderer. `vehicleProfiles.test.ts` re-derives
these from the GLB meshes, so they are enforced, not asserted.

### `lambini` — `rotationY: 0`, `length: 4.2` (scale 1.04646, final 2.225 × 1.472 × 4.200)

```
wheel( .79660,.39347, 1.05764,.39347,'mesh_12_15nr012_mat_7011_0','mesh_12_19nr013_mat_8015_0','mesh_12_8nr012_mat_3009_0')
wheel(-.79660,.39347, 1.05764,.39347,'mesh_12_15nr011_mat_7010_0','mesh_12_19nr012_mat_8014_0','mesh_12_8nr011_mat_3008_0')
wheel( .76823,.39347,-1.07211,.39347,'mesh_12_15nr013_mat_7012_0','mesh_12_19nr014_mat_8016_0','mesh_12_8nr013_mat_3010_0')
wheel(-.76823,.39347,-1.07211,.39347,'mesh_12_15nr010_mat_7009_0','mesh_12_19nr011_mat_8013_0','mesh_12_8nr010_mat_3007_0')
```

chassis `{ x: .95, y: .45, z: 1.85, offset: .10 }` (belly clearance .49 m), `topSpeed: 34`.

### `celero` — `rotationY: 0`, `length: 4.3` (scale 1.02885, final 2.168 × 1.302 × 4.300)

```
wheel( .87130,.41515, 1.21039,.41515,'CarWheelRubberHW002_Car_Wheel_Rubber_HW006_0','CarWheelHubHWCelero_Steel002_Car_Wheel_Hub_HWCelero_Steel006_0','CarWheelBrakeBrake006_Car_Wheel_Brake_Brake013_0')
wheel(-.87130,.41515, 1.21039,.41515,'CarWheelRubberHW001_Car_Wheel_Rubber_HW005_0','CarWheelHubHWCelero_Steel001_Car_Wheel_Hub_HWCelero_Steel005_0','CarWheelBrakeBrake005_Car_Wheel_Brake_Brake012_0')
wheel( .87130,.41515,-1.24832,.41515,'CarWheelRubberHW003_Car_Wheel_Rubber_HW007_0','CarWheelHubHWCelero_Steel003_Car_Wheel_Hub_HWCelero_Steel007_0','CarWheelBrakeBrake007_Car_Wheel_Brake_Brake014_0')
wheel(-.87130,.41515,-1.24832,.41515,'CarWheelRubberHW_Car_Wheel_Rubber_HW004_0','CarWheelHubHWCelero_Steel_Car_Wheel_Hub_HWCelero_Steel004_0','CarWheelBrakeBrake004_Car_Wheel_Brake_Brake004_0')
```

chassis `{ x: .95, y: .42, z: 1.90, offset: .06 }` (belly clearance .48 m), `topSpeed: 30`.

### `willys-buggy` — `rotationY: 0`, `length: 4.0` (scale 1.04188, final 2.586 × 2.166 × 4.000)

```
wheel( 1.01681,.58824, 1.41221,.58824,'front_left_wheel_wheels_0','front_left_wheel_suspension_part_1_0')
wheel(-1.01680,.58824, 1.41221,.58824,'front_right_wheel_wheels_0','front_right_wheel_suspension_part_1_0')
wheel( 1.01681,.58824,-1.41221,.58824,'rear_left_wheel_wheels_0','rear_left_wheel_suspension_part_2_0')
wheel(-1.01680,.58824,-1.41221,.58824,'rear_right_wheel_wheels_0','rear_right_wheel_suspension_part_2_0')
```

chassis `{ x: 1.05, y: .60, z: 1.70, offset: .50 }` (belly clearance .74 m — deliberately high), default top speed, `cameraDistance: 8`.

Source node names have left/right swapped relative to world +X. The measured
coordinates are authoritative; the names are carried verbatim so the wheel
meshes resolve. This matches the existing `supercar` profile, whose `tyre_fl`
node also sits at positive X.

### `bus` — `rotationY: Math.PI`, `length: 8.5` (scale 0.99261, final 2.893 × 3.296 × 8.500)

The source faces −Z (windscreen, dashboard and front axle at negative z), so
it needs the half-turn. Six wheels: a steering front pair and a dual rear
axle.

```
wheel( .94934,.47051, 2.70290,.47051,'left_front_wheel_Material011_0')
wheel(-.92399,.47155, 2.70290,.47051,'right_front_wheel_Material011_0')
wheel( 1.04550,.47144,-1.79593,.47051,'left_rear_wheel_2_Material011_0')
wheel( .75881,.47051,-1.79593,.47051,'left_rear_wheel_1_Material011_0')
wheel(-.73347,.47155,-1.79593,.47051,'right_rear_wheel_1_Material011_0')
wheel(-1.02015,.47051,-1.79593,.47051,'right_rear_wheel_2_Material011_0')
```

The front pair is listed first because wheel order drives steering (see
below). The slight x asymmetry (.949 vs −.924) is in the source model and is
preserved rather than rounded.

chassis `{ x: 1.25, y: 1.35, z: 3.90, offset: 1.00 }` (belly clearance .49 m),
`topSpeed: 19`, `massKg: 8500`, `steerLock: .34`, `nitro: false`,
`cameraDistance: 13`, `exhaust: { x: -1.0, y: .5, z: -4.1 }`.

## Architecture

### `VehicleProfile` gains six optional fields

All default to the current hard-coded constant, so the ten existing cars
produce byte-identical physics and framing.

```ts
massKg?: number;          // default CAR_MASS_KG (1100)
driveForce?: number;      // default 40000; the 22000 fade term scales with it
steerLock?: number;       // default .55
nitro?: boolean;          // default true
cameraDistance?: number;  // default 7.6 (FRAMING.car)
exhaust?: { x: number; y: number; z: number };
```

### `carPhysics.ts` — wheel count becomes data

Today the module hard-codes four wheels in five places: the `[0,1,2,3]`
ground check, the `for (let i = 0; i < 4; i++)` per-wheel loop, the `/4`
divisors on brake and coast force, the `rear = i >= 2` test, and the
four-element arrays in `createCarMotion()`.

Changes:

- `createCarMotion()` takes a wheel count and sizes `wheelRotation`,
  `wheelSteering` and `wheelOffset` to it. Its no-argument form keeps
  returning four zeroes, so `ExplorerController`'s idle motion is unchanged.
- The grounded test counts contacts across all wheels and keeps the existing
  "at least two" threshold.
- The per-wheel loop runs to `wheels.length`; brake and coast divisors become
  `/ wheels.length`.
- `rear` is derived from the wheel's own geometry (`wheel.z < 0`) rather than
  its index. For every existing four-wheel car this is exactly equivalent:
  their indices 0 and 1 are the positive-z pair and 2 and 3 the negative-z
  pair. For the bus it correctly marks all four rear wheels as driven and
  non-steering.
- Engine force distribution keeps its rear bias but is normalized per axle.
  Today each front wheel gets `force * .2` and each rear `force * .3`, so a
  four-wheel car applies `force * 1.0` in total, 60% of it at the rear. The
  same split is instead divided by the number of wheels on that axle: with
  the bus's four rear wheels each gets `force * .6 / 4` and each front wheel
  `force * .4 / 2`. A four-wheel car is unchanged (.4/2 = .2, .6/2 = .3), and
  the bus applies the same total force as any other vehicle of its
  `driveForce`.

### Mass, inertia and drive force

`setAdditionalMassProperties` currently passes a literal 1100 kg and the
principal inertia `{x: 1050, y: 1650, z: 850}`. Mass becomes
`profile.massKg ?? CAR_MASS_KG`, and the inertia vector is scaled by
`(massKg / CAR_MASS_KG) * (length / 3.8) ** 2` — the mass-times-length-squared
dimensional rule, anchored on the tuned reference car. For the bus that is a
factor of 38.7, giving roughly `{x: 40600, y: 63800, z: 32900}`. Existing cars
scale by 1.0 by construction.

`driveForce` is 40000 N against 1100 kg today — about 36 m/s² in a world
whose gravity is 22 m/s². Scaling that linearly with mass would make the bus
accelerate like a supercar. The bus instead gets an explicit `driveForce` of
78000 N (≈ 9 m/s², a quarter of a car's), and the reverse force scales in the
same proportion.

`steerLock` replaces the literal in
`lock = .55 - .4 * min(1, |speed| / (topSpeed + 4))`. The fade keeps its
current *proportion* rather than its absolute size:
`lock = steerLock * (1 - .727 * min(1, ...))`. At the default .55 this is
arithmetically identical to today (.55 × .727 = .4).

### `carWheelAnimation.ts`

`front: index < 2` becomes the same `wheel.z > 0` test, so the bus's four rear
wheels spin but do not steer. Identical outcome for existing cars.

### Camera

`FRAMING.car.distance` stays 7.6 as the default. `ExplorerController` passes
the active profile's `cameraDistance` to `ThirdPersonCamera`, which prefers it
over the table entry when the target kind is `car`. Only the bus (13) and the
buggy (8) set it.

### Spawn and dismount footprint

`resolveClearFeet` in `clearance.ts` probes a fixed `Cuboid(.9, FEET_TO_CENTER, 1.9)`
for every car, with a matching five-point support pattern. A bus cleared
against a car-sized box would spawn intersecting shopfronts. The function
takes the half-extents from the caller (derived from the profile chassis)
instead of hard-coding them; the bicycle and foot cases are untouched. The
dismount side/along offsets in `ExplorerController` (`side = 1.55`,
`along = 3`) likewise derive from the chassis so the player steps out beside
the bus rather than inside it.

### Preview and picker

`CarPreview` frames from a fixed `[5, 3.2, 6]` over a 3.4 m ground disc. An
8.5 m bus overflows both. The camera position and disc radius scale with the
selected profile's `length`. `CarVisual`'s exhaust position, currently the
literal `-1.9` with an `admin` special case, reads `profile.exhaust`.

## Testing

- `vehicleProfiles.test.ts` — add `lambini`, `celero`, `willys-buggy` and
  `bus` to the measured-wheel suite, which re-derives every centre and radius
  from the GLB. The existing belly-clearance property test covers all four
  automatically. Catalog count 11 → 15.
- `modelAssets.test.ts` — car count 10 → 14; each new GLB must load.
- `carPhysics.test.ts` — a bus case asserting six wheels are registered, that
  its motion arrays are length six, that it tops out near 19 m/s, that nitro
  is inert, and a regression that an existing car's motion arrays are still
  length four.
- `carHandling.test.ts` — already parameterized over profiles; new entries are
  picked up. Confirm it still passes for the heavier vehicle.
- `summitTrack.test.ts` — currently drives **every** `CAR_MODELS` entry from
  the mountain foot to the peak at 45% throttle. An 8500 kg bus is not
  expected to climb a 4×4 summit track and should not be tuned until it does.
  The suite narrows to the car-class ids, and the bus gets its own, gentler
  assertion: it must traverse the Chalakkudy–Malakkappara road without
  becoming stuck or leaving the surface.
- `storeCatalog.test.ts` — derives from `CAR_MODELS`; expected to pass
  unchanged once the new ids are added.

## Out of scope

Bus stops, timetables, boardable passenger seats, NPC drivers or traffic;
paint-colour support for the four new vehicles; replacing the Malakkappara
box-geometry bus; any change to bikes, boats, planes or gliders.
