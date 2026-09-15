# Architecture and contracts

This is an implementation specification, not existing code. Exact compatible dependency versions must be verified and pinned in the foundation task.

## Proposed stack and ownership

Vite + React + TypeScript provide a static application and semantic DOM menus/HUD. Three.js through React Three Fiber manages the scene. Use selected Drei helpers only as needed. Rapier provides collision queries and a kinematic character controller; use one physics world through a compatible React binding, with the controller adapter isolated. Zustand can hold low-frequency application state. Vitest covers pure contracts; Playwright covers meaningful browser flows, with manual hardware playtests for real rendering and movement.

This choice supports a web-native UI and data-driven content without adding a backend to the exploration prototype. No Next.js server layer is needed. Reconsider a heavier engine only if future gameplay needs materially outgrow this architecture.

R3F documents reuse, instancing, and adaptive rendering as performance techniques; apply these to repeated foliage and quality tiers. Avoid React state updates for every animation frame. See [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) and [performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls).

Rapier's controller handles collision-constrained translation and supports slope/step configuration, but movement tuning, gravity, jumping, and visual rotation remain application responsibilities. See [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/).

## Intended module boundaries

```text
src/
  app/              entry flow, lifecycle, error boundaries
  contracts/        IDs, schemas, typed events, validation
  game/
    input/          action mapping and input mode ownership
    player/         controller, safe spawn, animation adapter
    camera/         orbit, occlusion, recovery
    world/          zone lifecycle, terrain and collider assembly
    render/         materials, lighting, quality profiles
    audio/          ambience, user-gesture initialization
  content/
    world/          routes, water polygons, boundaries, spawns
    zones/          declarative zone manifests
    assets/         runtime asset catalog
  features/
    profile/        avatar choice and local identity
    map/            projection, landmark list, waypoint
    discoveries/    trigger state and messages
    settings/       preferences and quality
  persistence/      versioned local storage adapter
  ui/               tokens, primitives, HUD, modal shell
public/assets/      optimized runtime assets
tests/              contract and integration checks
```

Content modules cannot own render loops, global lighting, profile persistence, camera, or collision engine initialization. UI reads snapshots and sends commands; it never moves the rigid body directly.

## Shared contract baseline

Implement these concepts in F02 with runtime validation and fixtures. Keep contracts small; do not create a generic entity-component framework or quest engine.

```ts
type ZoneId = 'kodassery' | 'kadambode' | 'kurumali' | 'kodaly';
type Vec3 = readonly [number, number, number]; // x,y,z in meters
type InputMode = 'menu' | 'playing' | 'map' | 'paused' | 'loading';

interface ExplorerProfile {
  id: string; // local opaque ID, not authentication
  displayName: string;
  avatarPresetId: string;
  colors: { skin: string; hair: string; clothing: string };
}
interface Landmark {
  id: string;
  zoneId: ZoneId;
  label: string;
  position: Vec3;
  discoveryRadiusM: number;
  iconId: string;
}
interface ZoneManifest {
  id: ZoneId;
  bounds: { min: Vec3; max: Vec3 };
  entrySpawnId: string;
  neighborIds: ZoneId[];
  assetIds: string[];
  instanceGroups: string[];
  colliderAssetIds: string[];
  landmarkIds: string[];
  ambienceId: string;
  environmentPresetId: string; // approved preset; never a new global sun
}
interface SaveV1 {
  version: 1;
  worldVersion: string;
  profile: ExplorerProfile;
  position: Vec3;
  headingRad: number;
  safeSpawnId: string;
  visitedLandmarkIds: string[];
  settings: { quality: 'low' | 'medium' | 'high'; muted: boolean;
    volume: number; reducedMotion: boolean; sensitivity: number };
  updatedAt: string;
}
type ExplorationEvent =
  | { type: 'zoneEntered'; zoneId: ZoneId }
  | { type: 'landmarkDiscovered'; landmarkId: string }
  | { type: 'waypointChanged'; position: Vec3 | null };
```

F02 also defines `AssetManifest`, approved `EnvironmentPreset`, `PlayerSnapshot`, and named spawn records, using the constraints in the design bible. Cross-reference IDs must resolve; positions must be finite; color choices must belong to approved preset palettes. Names are trimmed, 1–24 Unicode characters, plain text only. Multiple zones cannot own the same boundary collider.

## Coordinates and map

- Right-handed world: X east, Y up, -Z north. Default character forward +Z is south; zero heading is north and conversion is centralized.
- Map envelope initially x ∈ [-210,210], z ∈ [-520,530]. Elevation is not part of the 2D projection.
- Normalized map position: `u=(x-xMin)/(xMax-xMin)`, `v=(z-zMin)/(zMax-zMin)`. Apply the same pan/zoom and letterbox transform to terrain, markers, and hit testing; invert it for map clicks.
- Keep world dimensions in one `WorldDefinition`; do not copy these constants into each map component. Clip to the viewport, not to a misleading nearest location.
- Scene terrain and map geometry share authored source data. A prospective hand-painted overlay is registered to that data, not the perspective concept image.
- Heightfield terrain covers ordinary land; separate colliders cover bridges, platforms, stairs, and overhangs. Canopy paths cannot be represented by a single terrain height at x/z.

## Runtime lifecycle

`menu → loading → playing ↔ map/paused`; avatar setup is within menu. Only the input owner can change modes. Losing focus or pointer lock clears held keys and pauses. Closing a modal does not automatically reacquire the pointer; Resume requires a user gesture. Map and pause freeze player simulation; ambient animation may stop as well.

Use a fixed 60 Hz physics step with a capped accumulator, maximum five catch-up steps and reset on tab resume; render with interpolation. UI location snapshots can update at 10 Hz. Input/camera/player frame updates stay outside React component state. Visual animation follows measured controller velocity, not only pressed keys.

Camera starts about 4.5 m behind the player, follows at shoulder height, has bounded pitch and adjustable sensitivity. Shape/sphere-cast against environment colliders to retract before walls; ease outward after occlusion. Do not collide the camera with leaves or the player. Tune field of view near 55° and offer a moderate adjustment range.

Pointer lock depends on browser support and user activation; include drag-to-orbit and keyboard camera alternatives, explicit lock-denial handling, and Escape behavior. See [MDN Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API).

Use native modal `dialog.showModal()` with accessible titles, visible close buttons, and focus restoration. Treat newer light-dismiss features as progressive enhancement; do not rely on them for closing the map or pause menu. Route all close paths through the same input-mode transition.

## World loading

Initially load shared essentials and the origin. Retain low-detail distant scenery. Preload neighboring detail around 80 m from a transition, then tune against measured load times. The traversable border and its collision must be ready before crossing; if not, pause safely with a short loading state rather than allowing a fall through unloaded terrain.

A transition coordinator owns shared seams/bridge collision. Keep current and adjacent detail resident as the first strategy; profile the central zones where this can mean three zones. Unload old unique assets only after references are released; never dispose shared materials/textures still in use. Asset failures offer retry and a safe return. Essential collision failures block entry; optional decorative failures can use logged placeholders.

## Save and future identity

Save at safe landmark/zone transitions, after settings/profile edits, on a debounced interval while moving, and on visibility change as a best effort. Keep writes small and outside the frame loop. A safe point must be grounded, outside water, with clearance; do not save a falling midair position as a respawn.

Validate saved position after its zone colliders load. Restore at a named safe spawn when a world update invalidates it. Preserve one last-known-good save; malformed or future-version saves show a recovery choice without silently deleting data. Handle denied storage/quota failure with a nonblocking message that this visit will not persist. Support a confirmed local reset.

`ProfileRepository` and `SaveRepository` interfaces isolate local persistence. A future account service may replace them; local display names never become trusted account identities. Multiplayer would require an authoritative server and synchronization work and is not solved by these interfaces.

## Performance targets to validate

These are provisional budgets, not measured results. Name the actual device/browser in every report.

| Measure | Initial target |
|---|---|
| Standard device | M1/M2-class laptop, 1440×900 viewport, medium tier, pixel ratio ≤1.5 |
| Frame time | Median ≤16.7 ms; p95 ≤25 ms over a warmed 60-second route |
| Lower tier | Integrated-graphics laptop, 1280×720, low tier, p95 ≤33.3 ms |
| Visible scene | ≤250 draw calls and ≤600k triangles at medium; shared instancing first |
| Initial cold download | ≤15 MB compressed essentials; first play target ≤10 s at 20 Mbps/100 ms RTT |
| Graphics memory | Estimated active texture budget ≤128 MB; investigate sustained process growth during repeated traversal |
| Quality differences | Reduce pixel ratio, shadows, foliage density, particles, and optional outlines; preserve landmarks, collision and map |

Load shell/profile controls before world assets. Cap pixel ratio; one sun shadow setup with a bounded region around the player. Avoid per-object real-time lights, heavy transparency layers, and unnecessary full-screen effects. Pause work while the page is hidden and handle WebGL context loss with recovery UI. Target current stable desktop Chrome, Edge, Firefox, and Safari at release; record actual tested versions then. Feature-detect graphics support and show an explanatory fallback instead of a blank canvas.
