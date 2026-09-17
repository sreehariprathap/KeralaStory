import { Component, Suspense, memo, useEffect, useMemo, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { Box3, BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY_PATH, terrainHeight } from '../../content/world/definition';
import { FLOOR_HEIGHT, KODALY_BUILDINGS, KODALY_CIRCLE, LOBBY_HEIGHT, buildingFrame, type GreenBuilding } from '../../content/world/kodalyCircle';
import { ExpansionSign } from './ExpansionSign';
import { ImportedTrees, type ImportedTreeInstance } from './ImportedTrees';

type V3 = [number, number, number];
type Finish = { color: string; metalness?: number; roughness?: number; glow?: boolean };
const C = KODALY_CIRCLE, CX = C.center.x, CZ = C.center.z;
const STREET_TREE_URL = '/assets/trees/jabami_anime_tree_v4.glb';
const ROOF_TREE_URL = '/assets/trees/jabami_anime_tree_v5.glb';
const FINISH = {
  tar: { color: '#4a4e49', roughness: 1 },
  marking: { color: '#eeeae0', roughness: .9 },
  kerb: { color: '#cdc6b5', roughness: .95 },
  walk: { color: '#c9b99c', roughness: 1 },
  grass: { color: '#6c9a45', roughness: 1 },
  marigold: { color: '#e8912d', roughness: .9 },
  jasmine: { color: '#f4efe4', roughness: .9 },
  hibiscus: { color: '#cf4f5f', roughness: .9 },
  plinth: { color: '#b9ae98', roughness: .95 },
  lobby: { color: '#5d7c85', metalness: .1, roughness: .2 },
  mullion: { color: '#5b676b', metalness: .5, roughness: .4 },
  planter: { color: '#8a7b66', roughness: 1 },
  leaf: { color: '#4d8a3b', roughness: 1 },
  leafLight: { color: '#79ab4b', roughness: 1 },
  vine: { color: '#3c7536', roughness: 1 },
  pole: { color: '#59636a', metalness: .5, roughness: .45 },
  lamp: { color: '#fff1c4', glow: true },
  solar: { color: '#2b3d56', metalness: .6, roughness: .25 },
} satisfies Record<string, Finish>;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ground = (x: number, z: number) => terrainHeight(x, z);

/** Merges all static pieces by finish, like the village builder: the whole district is a handful of draw calls. */
class CityBuilder {
  finishes = new Map<string, Finish>();
  pieces = new Map<string, BufferGeometry[]>();
  add(geometry: BufferGeometry, finish: Finish, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    const key = JSON.stringify(finish), t = new Object3D();
    t.position.set(...position); t.rotation.set(...rotation); t.scale.set(...scale); t.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    g.applyMatrix4(t.matrix); geometry.dispose();
    this.finishes.set(key, finish);
    (this.pieces.get(key) ?? this.pieces.set(key, []).get(key)!).push(g);
  }
  box(position: V3, size: V3, finish: Finish, yaw = 0) { this.add(new BoxGeometry(...size), finish, position, [0, yaw, 0]); }
  blob(position: V3, radius: number, finish: Finish, squash = .8) { this.add(new IcosahedronGeometry(radius, 0), finish, position, [0, radius * 7, 0], [1, squash, 1]); }
  /** A terrain-following annulus sector around the circle centre. */
  ring(r0: number, r1: number, lift: number, finish: Finish, a0 = 0, a1 = Math.PI * 2, radial = 2) {
    const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 64))), p: number[] = [], index: number[] = [];
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= radial; j++) {
      const a = a0 + (a1 - a0) * i / steps, r = r0 + (r1 - r0) * j / radial, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
      p.push(x, ground(x, z) + lift, z);
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
    this.surface(p, index, finish);
  }
  /** Vertical kerb face at radius r, from below the terrain to `lift`. */
  wall(r: number, lift: number, finish: Finish, a0 = 0, a1 = Math.PI * 2) {
    const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 64))), p: number[] = [], index: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r, y = ground(x, z);
      p.push(x, y - .25, z, x, y + lift, z);
    }
    for (let i = 0; i < steps; i++) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    this.surface(p, index, finish);
  }
  /** A terrain-following straight strip from (x0,z0) to (x1,z1). */
  strip(x0: number, z0: number, x1: number, z1: number, width: number, lift: number, finish: Finish) {
    const length = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(1, Math.ceil(length / 2)), nx = -(z1 - z0) / length, nz = (x1 - x0) / length;
    const p: number[] = [], index: number[] = [];
    for (let i = 0; i <= steps; i++) for (const side of [-.5, .5]) {
      const x = x0 + (x1 - x0) * i / steps + nx * width * side, z = z0 + (z1 - z0) * i / steps + nz * width * side;
      p.push(x, ground(x, z) + lift, z);
    }
    for (let i = 0; i < steps; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.surface(p, index, finish);
  }
  surface(p: number[], index: number[], finish: Finish) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setIndex(index); g.computeVertexNormals();
    this.add(g, finish);
  }
  meshes() {
    return [...this.pieces].map(([key, parts]) => {
      const geometry = mergeGeometries(parts, false)!;
      parts.forEach(part => part.dispose());
      geometry.computeBoundingSphere();
      return { key, finish: this.finishes.get(key)!, geometry };
    });
  }
}

/** Arms leaving the circle, as angles in the xz plane (atan2(dz, dx)). */
function armAngles() {
  const north = [...CITY_PATH].reverse().find(([, z]) => z < CZ - C.roadOuter)!, south = CITY_PATH.find(([, z]) => z > CZ + C.roadOuter)!;
  return [0, Math.PI, Math.atan2(north[1] - CZ, north[0] - CX), Math.atan2(south[1] - CZ, south[0] - CX)];
}

function buildRoundabout(b: CityBuilder) {
  const { islandRadius: R, roadOuter: RO, walkOuter: RW, islandLift: lift } = C, arms = armAngles();
  // Island: lawn, a marigold/jasmine/hibiscus bed inside a dressed kerb.
  b.ring(0, R - .4, lift, FINISH.grass, 0, Math.PI * 2, 8);
  const beds = [FINISH.marigold, FINISH.jasmine, FINISH.hibiscus];
  for (let i = 0; i < 36; i++) b.ring(R - 1.7, R - .5, lift + .06, beds[i % 3], i * Math.PI / 18, (i + 1) * Math.PI / 18, 1);
  b.ring(R - .4, R, lift + .06, FINISH.kerb, 0, Math.PI * 2, 1);
  b.wall(R, lift + .06, FINISH.kerb);
  // Carriageway with edge lines and a dashed lane divider.
  b.ring(R, RO, .09, FINISH.tar, 0, Math.PI * 2, 3);
  for (const r of [R + .45, RO - .45]) b.ring(r - .08, r + .08, .1, FINISH.marking, 0, Math.PI * 2, 1);
  const mid = (R + RO) / 2;
  for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24; b.ring(mid - .09, mid + .09, .1, FINISH.marking, a, a + Math.PI / 60, 1); }
  // Footpath ring, open where each arm joins.
  const gap = Math.asin((C.avenueHalfWidth + .5) / RO);
  const openings = arms.map(a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((p, q) => p - q);
  openings.forEach((a, i) => {
    const next = i + 1 < openings.length ? openings[i + 1] : openings[0] + Math.PI * 2;
    const from = a + gap, to = next - gap;
    b.ring(RO, RO + .3, .2, FINISH.kerb, from, to, 1);
    b.wall(RO, .2, FINISH.kerb, from, to);
    b.ring(RO + .3, RW, .18, FINISH.walk, from, to, 1);
    // Lamps along the footpath, arms facing the carriageway.
    const count = Math.floor((to - from) / (Math.PI / 9));
    for (let k = 1; k < count; k++) {
      const t = from + (to - from) * k / count;
      streetLamp(b, CX + Math.cos(t) * (RW - .6), CZ + Math.sin(t) * (RW - .6), t + Math.PI);
    }
  });
  // Zebra crossings across each arm, just outside the carriageway.
  for (const a of arms) {
    const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux, d = RO + 1.6;
    for (let s = -3; s <= 3; s += .9) {
      const x = CX + ux * d + vx * s, z = CZ + uz * d + vz * s;
      b.box([x, ground(x, z) + .1, z], [2.4, .02, .45], FINISH.marking, -a);
    }
  }
}

function buildAvenues(b: CityBuilder) {
  const half = C.avenueHalfWidth;
  for (const avenue of C.avenues) {
    const x0 = CX + avenue.from, x1 = CX + avenue.to, dir = Math.sign(x1 - x0);
    b.strip(x0, CZ, x1, CZ, half * 2, .09, FINISH.tar);
    for (let x = x0 + dir * 3; dir * (x1 - x) > 3; x += dir * 4) b.strip(x, CZ, x + dir * 2, CZ, .16, .1, FINISH.marking);
    for (const side of [-1, 1]) {
      const kz = CZ + side * (half + .15), wz = CZ + side * (half + .3 + C.avenueWalk / 2);
      b.strip(x0 + dir * 2.5, kz, x1, kz, .3, .2, FINISH.kerb);
      b.strip(x0 + dir * 2.5, wz, x1, wz, C.avenueWalk, .18, FINISH.walk);
      for (let x = x0 + dir * 6; dir * (x1 - x) > 2; x += dir * 12) streetLamp(b, x, CZ + side * (half + .7), side > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }
}

/** Slim modern lamp: pole, forward arm and a glowing head. `facing` is the arm's xz angle. */
function streetLamp(b: CityBuilder, x: number, z: number, facing: number) {
  const y = ground(x, z) + .18, ax = Math.cos(facing), az = Math.sin(facing);
  b.add(new CylinderGeometry(.07, .11, 7, 8), FINISH.pole, [x, y + 3.5, z]);
  b.box([x + ax * .8, y + 7, z + az * .8], [1.7, .1, .12], FINISH.pole, -facing);
  b.box([x + ax * 1.5, y + 6.88, z + az * 1.5], [.7, .12, .3], FINISH.lamp, -facing);
}

function buildGreenBuilding(b: CityBuilder, building: GreenBuilding, roofTrees: ImportedTreeInstance[]) {
  const { x, z, width: w, depth: d, floors } = building, { base, floor, top } = buildingFrame(building);
  const r = rng(building.x * 131 + building.z * 17 + floors);
  const glass: Finish = { color: building.glass, metalness: .08, roughness: .22 };
  const slab: Finish = { color: building.accent, roughness: .85 };
  const upper = floor + LOBBY_HEIGHT;
  b.box([x, (base + floor) / 2, z], [w + .8, floor - base, d + .8], FINISH.plinth);
  b.box([x, floor + LOBBY_HEIGHT / 2, z], [w - 1.2, LOBBY_HEIGHT, d - 1.2], FINISH.lobby);
  if (top > upper) b.box([x, (upper + top) / 2, z], [w - .8, top - upper, d - .8], glass);
  // Mullions on each glass face.
  for (const side of [-1, 1]) {
    for (let u = -w / 2 + 1.6; u < w / 2 - .8; u += 2.2) b.box([x + u, (floor + top) / 2, z + side * (d / 2 - .38)], [.1, top - floor, .1], FINISH.mullion);
    for (let u = -d / 2 + 1.6; u < d / 2 - .8; u += 2.2) b.box([x + side * (w / 2 - .38), (floor + top) / 2, z + u], [.1, top - floor, .1], FINISH.mullion);
  }
  // Every floor: a deep balcony slab ringed with planters, shrubs spilling over and vines hanging down.
  for (let level = 0; level < floors; level++) {
    const y = upper + level * FLOOR_HEIGHT, sw = w + 1.4, sd = d + 1.4;
    b.box([x, y, z], [sw, .32, sd], slab);
    if (level === floors - 1) break;
    for (const side of [-1, 1]) {
      b.box([x, y + .38, z + side * (sd / 2 - .3)], [sw, .45, .5], FINISH.planter);
      b.box([x + side * (sw / 2 - .3), y + .38, z], [.5, .45, sd - 1], FINISH.planter);
    }
    const shrubs = 4 + Math.floor(r() * 4);
    for (let i = 0; i < shrubs; i++) {
      const alongX = r() < w / (w + d), side = r() < .5 ? -1 : 1, t = r() - .5;
      const px = alongX ? x + t * (sw - 1) : x + side * (sw / 2 - .3), pz = alongX ? z + side * (sd / 2 - .3) : z + t * (sd - 1);
      b.blob([px, y + .85, pz], .45 + r() * .45, r() < .5 ? FINISH.leaf : FINISH.leafLight);
      if (r() < .6) {
        const length = 1 + r() * 2.2;
        b.box([px + (alongX ? 0 : side * .35), y - length / 2, pz + (alongX ? side * .35 : 0)], [alongX ? .5 + r() * .6 : .12, length, alongX ? .12 : .5 + r() * .6], FINISH.vine);
      }
    }
  }
  // Towers carry a full-height living wall on their south face.
  if (floors >= 10) {
    const wz = z + d / 2 + .35;
    b.box([x - w * .22, (upper + top) / 2, wz], [w * .3, top - upper, .3], FINISH.vine);
    for (let y = upper + 1; y < top - 1; y += 1.6) b.blob([x - w * .22 + (r() - .5) * w * .26, y, wz + .2], .5 + r() * .3, r() < .5 ? FINISH.leaf : FINISH.leafLight, .6);
  }
  // Roof garden: parapet, lawn, trees, and solar panels on the taller blocks.
  const roof = top + .16;
  for (const side of [-1, 1]) {
    b.box([x, roof + .45, z + side * (d / 2 + .6)], [w + 1.4, .9, .15], slab);
    b.box([x + side * (w / 2 + .6), roof + .45, z], [.15, .9, d + 1.4], slab);
  }
  b.box([x, roof + .2, z], [w, .4, d], FINISH.grass);
  const trees = Math.max(2, Math.round(w * d / 40));
  for (let i = 0; i < trees; i++) {
    const tx = x + (r() - .5) * (w - 3), tz = z + (r() - .5) * (d - 3);
    roofTrees.push({ position: [tx, roof + .38, tz], scale: 3 + r() * 2.2, rotation: [0, r() * Math.PI * 2, 0] });
  }
  if (floors >= 7) for (let i = 0; i < 3; i++) b.box([x + (i - 1) * 2.4, roof + 1.1, z - d / 2 + 1.6], [2, .08, 1.3], FINISH.solar, 0);
}

function buildDistrict() {
  const b = new CityBuilder(), roofTrees: ImportedTreeInstance[] = [];
  buildRoundabout(b); buildAvenues(b);
  for (const building of KODALY_BUILDINGS) buildGreenBuilding(b, building, roofTrees);
  return { meshes: b.meshes(), roofTrees };
}

/** Street trees on open verges; picked clear of roads, shops and the green buildings. */
const STREET_TREES: [number, number, number][] = [
  [56, -10, 8], [72, -10, 7.5], [78, -9, 7], [-5, -10, 7], [36, -46, 7], [16, 8, 8], [22, 16, 7], [54, 16, 7.5],
];

function BanyanModel() {
  const gltf = useLoader(GLTFLoader, C.tree.url);
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true), inner = new Group(), scaled = new Group();
    inner.add(scene); scaled.add(inner);
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(scene), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const scale = C.tree.height / Math.max(size.y, 1e-3);
    inner.position.set(-center.x, -bounds.min.y, -center.z);
    scaled.scale.setScalar(scale);
    scaled.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    return scaled;
  }, [gltf]);
  const { trunkOffset, height, sink } = C.tree;
  return <primitive object={model} position={[CX - trunkOffset.x * height, terrainHeight(CX, CZ) + C.islandLift - sink, CZ - trunkOffset.z * height]}/>;
}

class BanyanFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    // Without the model the circle still reads: a broad trunk under a dark crown.
    if (!this.state.failed) return this.props.children;
    const y = terrainHeight(CX, CZ), { trunkRadius, height } = C.tree;
    return <group position={[CX, y, CZ]}>
      <mesh position={[0, height * .22, 0]} castShadow><cylinderGeometry args={[trunkRadius * .8, trunkRadius, height * .44, 12]}/><meshStandardMaterial color="#6b5641" roughness={1}/></mesh>
      <mesh position={[0, height * .68, 0]} scale={[1.5, .5, 1]} castShadow><sphereGeometry args={[height * .5, 16, 10]}/><meshStandardMaterial color="#3f7a3a" roughness={1}/></mesh>
    </group>;
  }
}

/** Kodaly Banyan circle: roundabout, the banyan, avenues and the green modern town around it. */
export const KodalyCircle = memo(function KodalyCircle({ quality = 'medium' }: { quality?: 'low' | 'medium' | 'high' }) {
  const district = useMemo(buildDistrict, []);
  useEffect(() => () => district.meshes.forEach(mesh => mesh.geometry.dispose()), [district]);
  const streetTrees = useMemo<ImportedTreeInstance[]>(() => STREET_TREES.map(([x, z, h], i) => ({ position: [x, terrainHeight(x, z) - .05, z], scale: h, rotation: [0, i * 1.7, 0] })), []);
  const arms = armAngles(), south = arms[3], north = arms[2];
  const signAt = (a: number) => {
    const r = C.islandRadius - 1.1, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
    return { position: [x, terrainHeight(x, z) + C.islandLift, z] as V3, yaw: Math.PI / 2 - a };
  };
  return <group name={C.id}>
    {district.meshes.map(({ key, finish, geometry }) => <mesh key={key} geometry={geometry} castShadow={!finish.glow} receiveShadow>
      {finish.glow
        ? <meshBasicMaterial color={finish.color} toneMapped={false}/>
        : <meshStandardMaterial color={finish.color} metalness={finish.metalness ?? 0} roughness={finish.roughness ?? .9} side={DoubleSide}/>}
    </mesh>)}
    <BanyanFallback><Suspense fallback={null}><BanyanModel/></Suspense></BanyanFallback>
    {[south, north].map(a => { const sign = signAt(a); return <group key={a} position={sign.position} rotation={[0, sign.yaw, 0]}>
      <ExpansionSign position={[0, 0, 0]} label={C.label} width={4.4}/>
    </group>; })}
    {quality !== 'low' && <Suspense fallback={null}>
      <ImportedTrees url={STREET_TREE_URL} data={streetTrees}/>
      <ImportedTrees url={ROOF_TREE_URL} data={district.roofTrees}/>
    </Suspense>}
  </group>;
});
