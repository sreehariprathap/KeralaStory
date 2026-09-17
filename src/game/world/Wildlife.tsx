import { Component, Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import type { World } from '@dimforge/rapier3d-compat';
import { AnimationMixer, Box3, Group, LoopRepeat, Mesh, type AnimationAction } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { getAreaAt, getZoneAtPosition } from '../../content/world/definition';
import { SPECIES, homeCandidates, isHabitat, type SpeciesProfile } from './wildlifeRules';
import { bareGroundHeight, terrainCollidersReady } from './terrainProbe';

type Quality = 'low' | 'medium' | 'high';
interface Resident { key: string; species: SpeciesProfile; home: [number, number]; y: number; seed: number }

/** Low quality keeps every species but fewer of each (elephants are the expensive ones). */
const COUNT_SCALE: Record<Quality, number> = { low: .4, medium: 1, high: 1 };
const PATH_STEP = 2;
const MAX_GROUND_STEP = 1.2;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Picks homes on bare terrain, spread evenly across the areas each species can live in. */
function settle(world: World, quality: Quality): Resident[] {
  const residents: Resident[] = [];
  SPECIES.forEach((species, s) => {
    const buckets = new Map<string, Resident[]>();
    homeCandidates(species, 7000 + s * 101).forEach(([x, z], i) => {
      const y = bareGroundHeight(world, x, z);
      if (y === null) return;
      const key = getAreaAt(x, z) ?? getZoneAtPosition(x, z);
      buckets.set(key, [...(buckets.get(key) ?? []), { key: `${species.id}-${i}`, species, home: [x, z], y, seed: 9000 + s * 1000 + i }]);
    });
    const count = Math.max(1, Math.round(species.count * COUNT_SCALE[quality]));
    const lists = [...buckets.values()];
    for (let round = 0, taken = 0; taken < count && lists.some(list => list.length > round); round++) {
      for (const list of lists) if (list[round] && taken < count) { residents.push(list[round]); taken++; }
    }
  });
  return residents;
}

/** Rest-pose bounds are identical for every clone of a species; measuring skinned vertices is slow, so do it once. */
const restBounds = new WeakMap<GLTF, Box3>();

interface Walk { fromX: number; fromZ: number; toX: number; toZ: number; heights: number[]; length: number; progress: number }

/** A straight walk is allowed only if every sample stays in habitat, on bare terrain, and without a sudden drop. */
function planWalk(world: World, species: SpeciesProfile, fromX: number, fromZ: number, fromY: number, toX: number, toZ: number): Walk | null {
  const length = Math.hypot(toX - fromX, toZ - fromZ);
  if (length < 1) return null;
  const steps = Math.ceil(length / PATH_STEP), heights = [fromY];
  for (let i = 1; i <= steps; i++) {
    const x = fromX + (toX - fromX) * i / steps, z = fromZ + (toZ - fromZ) * i / steps;
    if (!isHabitat(species.id, x, z)) return null;
    const y = bareGroundHeight(world, x, z);
    if (y === null || Math.abs(y - heights[heights.length - 1]) > MAX_GROUND_STEP) return null;
    heights.push(y);
  }
  return { fromX, fromZ, toX, toZ, heights, length, progress: 0 };
}

function Animal({ resident, gltf, world }: { resident: Resident; gltf: GLTF; world: World }) {
  const { species } = resident;
  const { root, bob, mixer, walk, rest } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    const root = new Group(), bob = new Group(), sized = new Group();
    scene.rotation.y += species.rotationY;
    sized.add(scene); bob.add(sized); root.add(bob);
    sized.updateMatrixWorld(true);
    let bounds = restBounds.get(gltf);
    if (!bounds) { bounds = new Box3().setFromObject(sized, true); restBounds.set(gltf, bounds); }
    const height = Math.max(bounds.max.y - bounds.min.y, 1e-6);
    scene.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    sized.scale.setScalar(species.height / height);
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      // Skinned bounds are computed in bind pose and go stale once animated; distance culling replaces them.
      object.frustumCulled = false;
    });
    const mixer = new AnimationMixer(scene);
    const action = (name: string | null): AnimationAction | null => {
      const clip = name ? gltf.animations.find(candidate => candidate.name === name) : undefined;
      return clip ? mixer.clipAction(clip).setLoop(LoopRepeat, Infinity) : null;
    };
    return { root, bob, mixer, walk: action(species.walkClip), rest: action(species.restClip) };
  }, [gltf, species]);
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }, [mixer]);

  const body = useRef<RapierRigidBody>(null);
  const state = useRef({ x: resident.home[0], z: resident.home[1], y: resident.y, heading: 0, timer: 0, walk: null as Walk | null, phase: 0, random: rng(resident.seed), playing: null as AnimationAction | null });

  const play = (next: AnimationAction | null, timeScale: number) => {
    const s = state.current;
    if (next) next.timeScale = timeScale;
    if (s.playing === next) return;
    s.playing?.fadeOut(.3);
    next?.reset().fadeIn(.3).play();
    s.playing = next;
  };

  useEffect(() => {
    const s = state.current;
    s.heading = s.random() * Math.PI * 2;
    s.timer = s.random() * species.rest[1];
    if (rest) play(rest, .8); else play(walk, 0);
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.heading;
  // Placement is decided once per resident.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ camera }, delta) => {
    const s = state.current, dt = Math.min(delta, .1);
    const far = Math.hypot(camera.position.x - s.x, camera.position.z - s.z) > species.drawDistance;
    root.visible = !far;
    if (far) return;

    if (!s.walk) {
      s.timer -= dt;
      if (s.timer <= 0) {
        // Try a few nearby spots; animals that can't find a clear one simply rest a little longer.
        for (let attempt = 0; attempt < 5 && !s.walk; attempt++) {
          const a = s.random() * Math.PI * 2, d = species.roam * (.25 + .75 * s.random());
          s.walk = planWalk(world, species, s.x, s.z, s.y, resident.home[0] + Math.cos(a) * d, resident.home[1] + Math.sin(a) * d);
        }
        if (!s.walk) s.timer = 1 + s.random() * 2;
      }
    }

    const moving = !!s.walk;
    if (s.walk) {
      const w = s.walk;
      w.progress = Math.min(w.length, w.progress + species.speed * dt);
      const t = w.progress / w.length, sample = t * (w.heights.length - 1), i = Math.min(Math.floor(sample), w.heights.length - 2);
      s.x = w.fromX + (w.toX - w.fromX) * t;
      s.z = w.fromZ + (w.toZ - w.fromZ) * t;
      s.y = w.heights[i] + (w.heights[i + 1] - w.heights[i]) * (sample - i);
      const target = Math.atan2(w.toX - w.fromX, w.toZ - w.fromZ);
      const turn = Math.atan2(Math.sin(target - s.heading), Math.cos(target - s.heading));
      s.heading += turn * Math.min(1, dt * 4);
      if (w.progress >= w.length) { s.walk = null; s.timer = species.rest[0] + s.random() * (species.rest[1] - species.rest[0]); }
    }

    // Species with only a walk clip hold a mid-stride pose while resting instead of snapping to bind pose.
    if (moving) play(walk, species.speed / Math.max(species.speed, .8));
    else if (rest) play(rest, .8);
    else play(walk, 0);
    if (!walk && !rest) {
      // No usable clip: a small trot bounce reads as walking.
      s.phase = moving ? s.phase + dt * species.speed * 9 : 0;
      bob.position.y = Math.abs(Math.sin(s.phase)) * species.height * .05;
      bob.rotation.z = Math.sin(s.phase) * .05;
    }
    mixer.update(dt);
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.heading;
    if (body.current) {
      body.current.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z });
      body.current.setNextKinematicRotation({ x: 0, y: Math.sin(s.heading / 2), z: 0, w: Math.cos(s.heading / 2) });
    }
  });

  return <>
    <primitive object={root} dispose={null}/>
    {species.solid && (
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[resident.home[0], resident.y, resident.home[1]]}>
        <CuboidCollider args={[species.solid.halfWidth, species.solid.halfHeight, species.solid.halfLength]} position={[0, species.solid.halfHeight, 0]}/>
      </RigidBody>
    )}
  </>;
}

function Residents({ quality }: { quality: Quality }) {
  const { world } = useRapier();
  const gltfs = useLoader(GLTFLoader, SPECIES.map(s => s.url));
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const waited = useRef(0);
  useFrame(() => {
    if (residents || ++waited.current % 15) return;
    if (terrainCollidersReady(world) || waited.current > 900) setResidents(settle(world, quality));
  });
  useEffect(() => setResidents(null), [quality]);
  return <group name="wildlife">
    {residents?.map(resident => <Animal key={resident.key} resident={resident} world={world} gltf={gltfs[SPECIES.indexOf(resident.species)]}/>)}
  </group>;
}

class WildlifeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Wildlife unavailable', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Roaming elephants, cows, dogs, cats and chickens. Optional scenery: a load failure never takes the world down. */
export const Wildlife = memo(function Wildlife({ quality = 'medium' }: { quality?: Quality }) {
  return <WildlifeBoundary><Suspense fallback={null}><Residents quality={quality}/></Suspense></WildlifeBoundary>;
});
