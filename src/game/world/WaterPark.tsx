import { useMemo, useEffect } from 'react';
import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PARK_BOOTHS, PARK_BOUNDS, PARK_BUILDINGS, PARK_DECK_Y, PARK_ENTRANCE, PARK_FENCE, PARK_LOUNGERS, PARK_PALMS, PARK_POOLS, PARK_SPLASH_PAD, PARK_TOWERS } from '../../content/world/waterPark';
import { ExpansionSign } from './ExpansionSign';

type V3 = [number, number, number];

/** Collects geometry per colour so the whole park draws in a handful of meshes. */
class ParkBuilder {
  private pieces = new Map<string, BufferGeometry[]>();
  add(geometry: BufferGeometry, color: string, position: V3, rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    const matrix = new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(...scale));
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(matrix);
    this.pieces.set(color, [...(this.pieces.get(color) ?? []), g]);
    geometry.dispose();
  }
  box(position: V3, size: V3, color: string, rotation: V3 = [0, 0, 0]) { this.add(new BoxGeometry(...size), color, position, rotation); }
  cylinder(position: V3, top: number, bottom: number, height: number, color: string, rotation: V3 = [0, 0, 0], segments = 10) {
    this.add(new CylinderGeometry(top, bottom, height, segments), color, position, rotation);
  }
  merged() {
    return [...this.pieces].map(([color, list]) => ({ color, geometry: mergeGeometries(list, false) ?? list[0] }));
  }
}

/** One water slide: a spiral around the tower, then a straight chute into the splash pool. */
function flume(builder: ParkBuilder, tower: typeof PARK_TOWERS[number], index: number, y: number) {
  const pool = PARK_POOLS.find(p => p.id === tower.splashId)!;
  const color = index % 2 === 0 ? tower.color : '#f2c14e';
  const radius = tower.radius + 2.4 + index * 1.3;
  const top = y + tower.height - .8, exit = y + 2.4 + index * .45;
  // Spiral: one and a quarter turns, ending on the pool side of the tower.
  const toPool = Math.atan2(pool.z - tower.z, pool.x - tower.x);
  const turns = 1.25, segments = 8;
  const start = toPool - turns * Math.PI * 2 + index * .5;
  let last = new Vector3();
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments, t1 = (i + 1) / segments;
    const a0 = start + t0 * turns * Math.PI * 2, a1 = start + t1 * turns * Math.PI * 2;
    const p0 = new Vector3(tower.x + Math.cos(a0) * radius, top - t0 * (top - exit), tower.z + Math.sin(a0) * radius);
    const p1 = new Vector3(tower.x + Math.cos(a1) * radius, top - t1 * (top - exit), tower.z + Math.sin(a1) * radius);
    chute(builder, p0, p1, color);
    if (i % 3 === 2) builder.cylinder([p1.x, (y + p1.y) / 2, p1.z], .16, .2, p1.y - y, '#b9c0ae', [0, 0, 0], 6);
    last = p1;
  }
  // Run-out over the pool edge, landing just above the water.
  const landing = new Vector3(pool.x + Math.cos(toPool + Math.PI) * (pool.width / 2 - 2) * .35, y + .9, pool.z - pool.depth / 2 + 1.5 + index * 1.4);
  chute(builder, last, landing, color);
  builder.cylinder([last.x, (y + last.y) / 2, last.z], .16, .2, last.y - y, '#b9c0ae', [0, 0, 0], 6);
}

/** A half-open tube between two points. */
function chute(builder: ParkBuilder, from: Vector3, to: Vector3, color: string) {
  const mid = from.clone().add(to).multiplyScalar(.5), direction = to.clone().sub(from);
  const geometry = new CylinderGeometry(.62, .62, direction.length() + .3, 7, 1, true, 0, Math.PI * 1.35);
  geometry.rotateX(Math.PI);
  const matrix = new Matrix4().compose(mid, new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()), new Vector3(1, 1, 1));
  const g = geometry.toNonIndexed();
  g.deleteAttribute('uv');
  g.applyMatrix4(matrix);
  builder.add(g, color, [0, 0, 0]);
  geometry.dispose();
}

function buildPark() {
  const solid = new ParkBuilder(), water = new ParkBuilder();
  const y = PARK_DECK_Y;

  // One paved deck, with a walkway from the gate. Pools sit on top of it inside a raised coping lip,
  // which avoids any seam between a tile grid and the pool edges.
  const width = PARK_BOUNDS.xMax - PARK_BOUNDS.xMin, depth = PARK_BOUNDS.zMax - PARK_BOUNDS.zMin;
  const cx = (PARK_BOUNDS.xMin + PARK_BOUNDS.xMax) / 2, cz = (PARK_BOUNDS.zMin + PARK_BOUNDS.zMax) / 2;
  solid.box([cx, y + .06, cz], [width - 5, .12, depth - 5], '#cfc9ae');
  solid.box([cx + (PARK_ENTRANCE.x - cx), y + .14, PARK_ENTRANCE.z - 16], [PARK_ENTRANCE.width + 4, .1, 32], '#b9b293');

  for (const pool of PARK_POOLS) {
    // Coping rim, the tiled pool floor, and the water surface between them.
    const rim = 1.3, lip = .5;
    for (const side of [-1, 1]) {
      solid.box([pool.x, y + lip / 2, pool.z + side * (pool.depth / 2 + rim / 2)], [pool.width + rim * 2, lip, rim], '#e8e2c4');
      solid.box([pool.x + side * (pool.width / 2 + rim / 2), y + lip / 2, pool.z], [rim, lip, pool.depth], '#e8e2c4');
    }
    solid.box([pool.x, y + .16, pool.z], [pool.width, .1, pool.depth], '#9ecdd8');
    water.box([pool.x, y + .3, pool.z], [pool.width - .1, .12, pool.depth - .1], '#3f9fc4');
  }

  for (const tower of PARK_TOWERS) {
    solid.cylinder([tower.x, y + tower.height / 2, tower.z], tower.radius, tower.radius + .35, tower.height, '#e9e3c6', [0, 0, 0], 8);
    solid.cylinder([tower.x, y + tower.height + .35, tower.z], tower.radius + .8, tower.radius + .8, .5, tower.color, [0, 0, 0], 8);
    // Stair rail and a thatched sun cap on the platform.
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      solid.box([tower.x + Math.cos(angle) * (tower.radius + .7), y + tower.height + 1.3, tower.z + Math.sin(angle) * (tower.radius + .7)], [.12, 1.4, .12], '#b9c0ae');
    }
    solid.add(new CylinderGeometry(0, tower.radius + 1.6, 1.5, 8), '#8d5a3b', [tower.x, y + tower.height + 2.6, tower.z]);
    for (let i = 0; i < tower.flumes; i++) flume(solid, tower, i, y);
  }

  // Splash pad: a shallow ring of water with jets that players can walk through.
  water.add(new CylinderGeometry(PARK_SPLASH_PAD.radius, PARK_SPLASH_PAD.radius, .05, 24), '#5fb6d4', [PARK_SPLASH_PAD.x, y + .18, PARK_SPLASH_PAD.z]);
  for (let i = 0; i < PARK_SPLASH_PAD.jets; i++) {
    const angle = i / PARK_SPLASH_PAD.jets * Math.PI * 2, r = PARK_SPLASH_PAD.radius - 2.5;
    const jx = PARK_SPLASH_PAD.x + Math.cos(angle) * r, jz = PARK_SPLASH_PAD.z + Math.sin(angle) * r;
    water.cylinder([jx, y + 1.1, jz], .07, .18, 2, '#9fd8e8', [0, 0, 0], 6);
    solid.add(new SphereGeometry(.22, 8, 6), '#b9c0ae', [jx, y + .2, jz]);
  }

  for (const b of PARK_BUILDINGS) {
    solid.box([b.x, y + b.height / 2, b.z], [b.width, b.height, b.depth], b.wall);
    solid.add(new CylinderGeometry(0, Math.max(b.width, b.depth) * .62, 1.9, 4), b.roof, [b.x, y + b.height + .95, b.z], [0, Math.PI / 4, 0]);
    solid.box([b.x, y + .1, b.z], [b.width + .8, .2, b.depth + .8], '#a98569');
  }

  for (const lounger of PARK_LOUNGERS) {
    solid.box([lounger.x, y + .32, lounger.z], [.7, .12, 1.9], '#f1e3bb');
    solid.box([lounger.x, y + .55, lounger.z - .75], [.7, .5, .12], '#f1e3bb', [-.35, 0, 0]);
    if (lounger.umbrella) {
      solid.cylinder([lounger.x + .9, y + 1.1, lounger.z], .05, .05, 2.2, '#b9c0ae', [0, 0, 0], 6);
      solid.add(new CylinderGeometry(0, 1.5, .55, 8), '#e2894f', [lounger.x + .9, y + 2.35, lounger.z]);
    }
  }

  for (const palm of PARK_PALMS) {
    solid.cylinder([palm.x, y + palm.height / 2, palm.z], .16, .28, palm.height, '#79563d', [0, 0, 0], 6);
    for (let i = 0; i < 5; i++) {
      const angle = i * (Math.PI * 2 / 5);
      solid.add(new SphereGeometry(1.5, 6, 4), '#5f873e', [palm.x + Math.cos(angle) * .8, y + palm.height + .3, palm.z + Math.sin(angle) * .8], [0, 0, 0], [1, .45, 1]);
    }
  }

  for (const booth of PARK_BOOTHS) {
    solid.box([booth.x, y + 1.3, booth.z], [3, 2.6, 2.6], '#f4e8cc');
    solid.add(new CylinderGeometry(0, 2.6, 1.1, 4), '#2f7f86', [booth.x, y + 3.1, booth.z], [0, Math.PI / 4, 0]);
    solid.box([booth.x, y + 1.5, booth.z + 1.35], [1.6, 1, .08], '#3c5840');
  }

  // Perimeter fence: posts every four metres with two rails, and an entrance arch.
  const f = PARK_FENCE;
  const runs: [V3, V3][] = [
    [[f.xMin, 0, f.zMin], [f.xMax, 0, f.zMin]],
    [[f.xMin, 0, f.zMin], [f.xMin, 0, f.zMax]],
    [[f.xMax, 0, f.zMin], [f.xMax, 0, f.zMax]],
    [[f.xMin, 0, f.zMax], [f.gap.x - f.gap.width / 2, 0, f.zMax]],
    [[f.gap.x + f.gap.width / 2, 0, f.zMax], [f.xMax, 0, f.zMax]],
  ];
  for (const [a, b] of runs) {
    const start = new Vector3(a[0], 0, a[2]), end = new Vector3(b[0], 0, b[2]);
    const length = start.distanceTo(end), steps = Math.max(1, Math.round(length / 4));
    for (let i = 0; i <= steps; i++) {
      const p = start.clone().lerp(end, i / steps);
      solid.box([p.x, y + f.height / 2, p.z], [.14, f.height, .14], '#8a9a72');
    }
    const mid = start.clone().lerp(end, .5), angle = Math.atan2(end.x - start.x, end.z - start.z);
    for (const railY of [1.35, .75]) solid.box([mid.x, y + railY, mid.z], [.07, .07, length], '#8a9a72', [0, angle, 0]);
  }
  for (const side of [-1, 1]) solid.box([PARK_ENTRANCE.x + side * PARK_ENTRANCE.width / 2, y + 2.2, PARK_ENTRANCE.z], [.6, 4.4, .6], '#2f7f86');
  solid.box([PARK_ENTRANCE.x, y + 4.7, PARK_ENTRANCE.z], [PARK_ENTRANCE.width + 1.2, .7, .7], '#2f7f86');

  return { solid: solid.merged(), water: water.merged() };
}

/** Silver Storm water park: authored geometry, no source model and no textures. */
export function WaterPark() {
  const { solid, water } = useMemo(buildPark, []);
  useEffect(() => () => [...solid, ...water].forEach(part => part.geometry.dispose()), [solid, water]);
  return <group name="silver-storm-water-park">
    {solid.map(part => <mesh key={part.color} geometry={part.geometry} castShadow receiveShadow>
      <meshStandardMaterial color={part.color} roughness={.92} flatShading/>
    </mesh>)}
    {water.map(part => <mesh key={part.color} geometry={part.geometry} receiveShadow>
      <meshStandardMaterial color={part.color} roughness={.15} metalness={.05} transparent opacity={.82}/>
    </mesh>)}
    <ExpansionSign position={[PARK_ENTRANCE.x, PARK_DECK_Y + 5.6, PARK_ENTRANCE.z]} label="Silver Storm · ജല തീം പാർക്ക്" width={8}/>
  </group>;
}
