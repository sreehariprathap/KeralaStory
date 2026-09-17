import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { Box3, InstancedMesh, Mesh, Object3D, Vector3, type BufferGeometry, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GameSettings, PlayerSnapshot } from '../../contracts';
import { bareGroundHeight, terrainCollidersReady } from '../world/terrainProbe';
import { dailyCoinSpots } from './coinPlacement';
import { dailyHeartSpots } from './heartSpots';
import { buildPickupGrid, findPickup } from './pickup';
import { playCollectChime } from './collectChime';
import { todayKey } from './collectState';
import { PickupBurst, BURST_SECONDS, type Burst } from './PickupBurst';
import type { Carrier, CollectItem } from './types';

const COIN_URL = '/assets/collectables/coin.glb';
const HEART_URL = '/assets/collectables/pumping_heart_model.glb';
const DRAW_RADIUS = 150;
const COIN_SIZE = .9, HEART_SIZE = 1.4;
const SPIN_RATE = .8, BOB = .15, BOB_RATE = 2.2;
/** Parked far below the world: an instance that is collected or too far to matter. */
const HIDDEN_Y = -1000;
/** A session left running overnight should pick up the new day without a reload. */
const DATE_CHECK_SECONDS = 30;

interface Props {
  playerRef: RefObject<PlayerSnapshot>;
  settings: GameSettings;
  collectedIds: readonly string[];
  onCollect: (item: CollectItem) => void;
}

interface Parts { geometry: BufferGeometry; material: Material }

/** First mesh of a GLTF, baked to unit size and centred on the origin. */
function useNormalized(url: string): Parts | null {
  const gltf = useLoader(GLTFLoader, url);
  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    let found: Mesh | null = null;
    scene.traverse(object => { if (!found && object instanceof Mesh) found = object as Mesh; });
    if (!found) return null;
    const mesh: Mesh = found;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, .001);
    geometry.translate(-centre.x, -centre.y, -centre.z);
    geometry.scale(scale, scale, scale);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    return { geometry, material };
  }, [gltf]);
}

function CollectableField({ playerRef, settings, collectedIds, onCollect }: Props) {
  const coin = useNormalized(COIN_URL), heart = useNormalized(HEART_URL);
  const { world } = useRapier();
  const [dateKey, setDateKey] = useState(() => todayKey());
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const items = useMemo(() => [...dailyCoinSpots(dateKey), ...dailyHeartSpots()], [dateKey]);
  const coins = useMemo(() => items.filter(i => i.kind === 'coin'), [items]);
  const hearts = useMemo(() => items.filter(i => i.kind === 'heart'), [items]);
  const grid = useMemo(() => buildPickupGrid(items), [items]);
  const gone = useMemo(() => new Set([...collectedIds, ...blocked]), [collectedIds, blocked]);
  const coinMesh = useRef<InstancedMesh>(null), heartMesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const checked = useRef(false), sinceDateCheck = useRef(0);

  // A new day means a new coin set, so the building check has to run again.
  useEffect(() => { checked.current = false; setBlocked(new Set<string>()); }, [dateKey]);

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime;
    sinceDateCheck.current += delta;
    if (sinceDateCheck.current >= DATE_CHECK_SECONDS) {
      sinceDateCheck.current = 0;
      const key = todayKey();
      if (key !== dateKey) setDateKey(key);
    }
    // Coins are placed from terrain data alone, so a few land inside buildings. Physics settles it once.
    if (!checked.current && terrainCollidersReady(world)) {
      checked.current = true;
      const inside = coins.filter(item => bareGroundHeight(world, item.x, item.z) === null).map(item => item.id);
      if (inside.length) setBlocked(new Set(inside));
    }
    const player = playerRef.current;
    if (!player) return;
    const [px, py, pz] = player.position;
    const write = (mesh: InstancedMesh | null, list: CollectItem[], size: number, spin: boolean) => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const visible = !gone.has(item.id) && Math.hypot(item.x - px, item.z - pz) < DRAW_RADIUS;
        dummy.position.set(item.x, visible ? item.y + Math.sin(now * BOB_RATE + i) * BOB : HIDDEN_Y, item.z);
        dummy.rotation.set(spin ? Math.PI / 2 : 0, spin ? now * SPIN_RATE + i : Math.sin(now + i) * .3, 0);
        dummy.scale.setScalar(size * (spin ? 1 : 1 + Math.sin(now * 3 + i) * .06));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(coinMesh.current, coins, COIN_SIZE, true);
    write(heartMesh.current, hearts, HEART_SIZE, false);

    const carrier: Carrier = player.travelMode ?? 'foot';
    const hit = findPickup(grid, px, py, pz, carrier, gone);
    if (!hit) return;
    playCollectChime(hit.kind, settings);
    // One state update per pickup, never per frame.
    setBursts(list => [...list.filter(b => now - b.born < BURST_SECONDS), { id: `${hit.id}:${now}`, kind: hit.kind, x: hit.x, y: hit.y, z: hit.z, born: now }]);
    onCollect(hit);
  });

  if (!coin || !heart) return null;
  return <group>
    <instancedMesh ref={coinMesh} args={[coin.geometry, coin.material, Math.max(1, coins.length)]} frustumCulled={false}/>
    <instancedMesh ref={heartMesh} args={[heart.geometry, heart.material, Math.max(1, hearts.length)]} frustumCulled={false}/>
    <PickupBurst bursts={bursts}/>
  </group>;
}

export const Collectables = memo(CollectableField);
