import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { BufferGeometry, Color, Float32BufferAttribute, Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three';
import { V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import { DAM_POOL_RADIUS } from '../../content/world/v2Layout';
import { BOAT_DOCKS } from '../../content/world/boatDocks';
import type { Locale } from '../../contracts';
import { localizedPlace } from '../../features/i18n/translate';
import { waterMaterial } from './Waterfall';
import { ExpansionSign } from './ExpansionSign';

const HALF_SPAN = 26, ARC_RADIUS = 80, THICKNESS = 7, WALL_SEGMENTS = 8;
/** Three sluice gates, close enough together that every jet lands well inside the round plunge pool. */
const GATE_OFFSETS = [-10, 0, 10], GATE_WIDTH = 5.5;
/** Crest walkway: a little wider than the wall, overhanging both faces. */
const WALKWAY_WIDTH = THICKNESS + 1, WALKWAY_TOP = .6;
/** Sluice mouth on the downstream face: how far below the crest the jets leave, and how far the lip juts out. */
const MOUTH_DROP = 3.4, LIP_REACH = 1.3;
/** How far out from the lip each jet has travelled by the time it reaches the pool. */
const JET_THROW = 8.5;
/** A circular arc in plan, bulging upstream (toward the reservoir) the way a real arch dam resists water pressure. */
const sag = (x: number) => Math.sqrt(Math.max(ARC_RADIUS * ARC_RADIUS - x * x, 0)) - Math.sqrt(ARC_RADIUS * ARC_RADIUS - HALF_SPAN * HALF_SPAN);
/** Plan slope dz/dx of the wall's centreline at offset x. */
const slope = (x: number) => x / Math.sqrt(ARC_RADIUS * ARC_RADIUS - x * x);
// A weathered, storybook stone palette: warm sunlit sandstone with a mossy tideline near the water,
// terracotta pagoda-style tower roofs and a cream crest, rather than cold industrial concrete.
const STONE = ['#cbbe95', '#bfae82'], MOSS = '#7c8f52', ROOF = '#b5623c', CREAM = '#eadfbd', RAIL = '#f6efd8';
const ROCK_COLORS = ['#7d8474', '#8c8f7c', '#6f7a64', '#959683'];

/**
 * A spillway jet: water shoots off the sluice lip and falls in a ballistic arc, its horizontal reach growing
 * with the square root of the drop, fanning a little wider as it falls. It ends just under the pool surface.
 */
function jetGeometry(x: number, topY: number, z0: number, bottomY: number, width: number, low: boolean) {
  const positions: number[] = [], uv: number[] = [], foam: number[] = [], indices: number[] = [];
  const columns = low ? 10 : 22, rows = low ? 14 : 30, height = topY - bottomY + .4;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, t = row / rows, spread = width * (1 + .32 * t);
    // A slight belly across the sheet, so it reads as a thick tongue of water rather than a flat card.
    const belly = Math.sin(u * Math.PI) * .35 * (1 - t * .5);
    positions.push(x + (u - .5) * spread, topY - t * height, z0 + JET_THROW * Math.sqrt(t) + belly);
    uv.push(u, t * height);
    foam.push(Math.min(.95, Math.pow(t, 5) * .95 + Math.exp(-t * 18) * .4));
    if (row < rows && col < columns) { const a = row * (columns + 1) + col, b = a + columns + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('waterFoam', new Float32BufferAttribute(foam, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic 0..1 noise, so the rim rocks and lily pads never move between loads. */
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Peringalkuthu Dam, impounding the Chalakkudy River's headwaters reservoir in the hills at the map's north-west corner. */
export function ChalakudyDam({ quality, animated, locale }: { quality: 'low' | 'medium' | 'high'; animated: boolean; locale: Locale }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const low = quality === 'low';
  const assets = useMemo(() => {
    const crest = V2_LAYOUT.riverNodes.find(n => n.id === 'dam-crest')!;
    const pool = V2_LAYOUT.riverNodes.find(n => n.id === 'plunge-pool')!;
    const [cx, topY, cz] = crest.position, bottomY = pool.position[1];
    const poolCenter = { x: pool.position[0], z: pool.position[2] + DAM_POOL_RADIUS };
    const arcPoints = Array.from({ length: WALL_SEGMENTS + 1 }, (_, i) => {
      const x = -HALF_SPAN + (2 * HALF_SPAN) * i / WALL_SEGMENTS;
      return [cx + x, cz - sag(x)] as const;
    });
    const wallSegments = arcPoints.slice(0, -1).map(([x, z], i) => {
      const [nx, nz] = arcPoints[i + 1], dx = nx - x, dz = nz - z, length = Math.hypot(dx, dz);
      // Yaw that turns the box's local x axis along the segment.
      return { x: (x + nx) / 2, z: (z + nz) / 2, yaw: -Math.atan2(dz, dx), length };
    });
    const gates = GATE_OFFSETS.map(offset => {
      const faceZ = cz - sag(offset) + THICKNESS / 2, yaw = -Math.atan(slope(offset));
      const jetTop = topY - MOUTH_DROP, jetZ = faceZ + LIP_REACH;
      return { x: cx + offset, faceZ, yaw, jetTop, jetZ, landingZ: jetZ + JET_THROW };
    });
    const jets = gates.map(g => jetGeometry(g.x, g.jetTop, g.jetZ, bottomY, GATE_WIDTH, low));
    // Mossy boulders ringing the pool, leaving the outlet (south) and the wall's foot (north) open.
    const rocks = Array.from({ length: low ? 18 : 30 }, (_, i) => {
      const angle = i / (low ? 18 : 30) * Math.PI * 2 + hash(i) * .15, dirZ = Math.sin(angle);
      if (dirZ > .8 || dirZ < -.55) return null;
      const r = DAM_POOL_RADIUS + .6 + hash(i + 40) * 2.2, x = poolCenter.x + Math.cos(angle) * r, z = poolCenter.z + dirZ * r;
      if (BOAT_DOCKS.some(dock => Math.hypot(dock.x - x, dock.z - z) < 8)) return null;
      const size = .7 + hash(i + 80) * 1.5;
      return { x, y: Math.min(terrainHeight(x, z), bottomY + .6) - size * .25, z, sx: size * (1 + hash(i + 7) * .5), sy: size * (.6 + hash(i + 9) * .4), sz: size, yaw: hash(i + 3) * Math.PI };
    }).filter(r => r !== null);
    // Lily pads drift in the calm south-east of the pool, away from the churning jets.
    const pads = Array.from({ length: low ? 6 : 11 }, (_, i) => {
      const angle = .15 + hash(i + 200) * 1.25, r = DAM_POOL_RADIUS * (.45 + hash(i + 230) * .42);
      return { x: poolCenter.x + Math.cos(angle) * r, z: poolCenter.z + Math.sin(angle) * r, size: .55 + hash(i + 260) * .5, yaw: hash(i + 290) * Math.PI * 2, flower: i % 3 === 0 };
    });
    return { jets, material: waterMaterial(low, time), cx, cz, topY, bottomY, wallSegments, arcPoints, gates, poolCenter, rocks, pads };
  }, [low, time]);
  useEffect(() => () => { assets.jets.forEach(g => g.dispose()); assets.material.dispose(); }, [assets]);

  const rockMesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = rockMesh.current; if (!mesh) return;
    const object = new Object3D(), color = new Color();
    assets.rocks.forEach((rock, i) => {
      object.position.set(rock.x, rock.y, rock.z); object.scale.set(rock.sx, rock.sy, rock.sz); object.rotation.set(0, rock.yaw, 0); object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix); mesh.setColorAt(i, color.set(ROCK_COLORS[i % ROCK_COLORS.length]));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assets]);

  // Splash rings spreading out from where each jet lands.
  const rings = useRef<(Mesh | null)[]>([]);
  useFrame((_, delta) => {
    if (!animated) return;
    time.value += Math.min(delta, .05);
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (time.value * .55 + i * .37) % 1;
      ring.scale.setScalar(.5 + phase * 1.6);
      (ring.material as MeshBasicMaterial).opacity = .55 * (1 - phase);
    });
  });

  const { cx, cz, topY, bottomY, wallSegments, arcPoints, gates } = assets;
  const wallHeight = topY - bottomY + 1, wallBase = bottomY - 1, midY = wallBase + wallHeight / 2, buttressTopY = topY + WALKWAY_TOP;
  const mossTopY = wallBase + wallHeight * .22;

  // A pedestrian staircase up the west buttress: two straight flights around a mid-height landing,
  // each within a comfortable stair pitch. The road from Malakkappara arrives at the east end.
  const stairX = cx - HALF_SPAN - 6.8;
  const stairBaseZ = cz + 20, landingZ = cz + 6, stairTopZ = cz - 3;
  const landingY = bottomY + (topY - bottomY) * .45;
  const flight1 = { rise: landingY - bottomY, run: stairBaseZ - landingZ };
  const flight2 = { rise: topY - landingY, run: landingZ - stairTopZ };
  const stairSteps = (fromY: number, toY: number, fromZ: number, toZ: number, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const t = (i + 1) / count;
      return { y: fromY + (toY - fromY) * t, z: fromZ + (toZ - fromZ) * t };
    });

  return <group>
    {/* Arched stone wall: straight segments following a circular arc, bulging into the reservoir. Each carries
        its own stretch of crest walkway and both parapet rails, so the crest follows the curve exactly. */}
    {wallSegments.map((segment, i) => <group key={i} position={[segment.x, 0, segment.z]} rotation={[0, segment.yaw, 0]}>
      <mesh position={[0, midY, 0]} castShadow receiveShadow>
        <boxGeometry args={[segment.length + .4, wallHeight, THICKNESS]}/><meshStandardMaterial color={STONE[i % 2]} roughness={.9}/>
      </mesh>
      {/* A mossy tideline where the pool's spray keeps the foot of the stone wet. */}
      <mesh position={[0, mossTopY, 0]}>
        <boxGeometry args={[segment.length + .5, wallHeight * .18, THICKNESS + .12]}/><meshStandardMaterial color={MOSS} roughness={1}/>
      </mesh>
      <mesh position={[0, topY + WALKWAY_TOP / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[segment.length + .45, WALKWAY_TOP, WALKWAY_WIDTH]}/><meshStandardMaterial color={CREAM} roughness={.9}/>
      </mesh>
      {[-1, 1].map(side => <mesh key={side} position={[0, topY + WALKWAY_TOP + .5, side * (WALKWAY_WIDTH / 2 - .15)]} castShadow>
        <boxGeometry args={[segment.length + .45, 1, .25]}/><meshStandardMaterial color={RAIL} roughness={.8}/>
      </mesh>)}
    </group>)}
    {/* Gate towers straddling the crest over each sluice: whitewashed stone with a pagoda-style roof and finial. */}
    {gates.map((gate, i) => <group key={i} position={[gate.x, topY + WALKWAY_TOP, gate.faceZ - THICKNESS / 2]} rotation={[0, gate.yaw, 0]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * (GATE_WIDTH / 2 + .2), 3, 0]} castShadow><boxGeometry args={[.9, 6, 3]}/><meshStandardMaterial color={CREAM} roughness={.85}/></mesh>)}
      <mesh position={[0, 6.6, 0]} castShadow><boxGeometry args={[GATE_WIDTH + 1.6, 1.4, 3.4]}/><meshStandardMaterial color={CREAM} roughness={.85}/></mesh>
      <mesh position={[0, 8.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[(GATE_WIDTH + 1.6) * .75, 2.4, 4]}/><meshStandardMaterial color={ROOF} roughness={.7}/></mesh>
      <mesh position={[0, 9.9, 0]}><sphereGeometry args={[.28, 8, 8]}/><meshStandardMaterial color="#e2c88f" roughness={.5} metalness={.2}/></mesh>
    </group>)}
    {/* Sluice mouths on the downstream face: a dark opening above a jutting stone lip the jets pour off. */}
    {gates.map((gate, i) => <group key={i} position={[gate.x, gate.jetTop, gate.faceZ]} rotation={[0, gate.yaw, 0]}>
      <mesh position={[0, 1.3, .06]}><boxGeometry args={[GATE_WIDTH, 2.4, .2]}/><meshStandardMaterial color="#34423c" roughness={1}/></mesh>
      <mesh position={[0, -.2, LIP_REACH / 2]} castShadow receiveShadow><boxGeometry args={[GATE_WIDTH + .8, .4, LIP_REACH]}/><meshStandardMaterial color={CREAM} roughness={.9}/></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * (GATE_WIDTH / 2 + .4), 1.1, LIP_REACH / 2]} castShadow><boxGeometry args={[.5, 3, LIP_REACH]}/><meshStandardMaterial color={CREAM} roughness={.9}/></mesh>)}
    </group>)}
    {/* Buttress rock anchoring each end of the arc into the gorge walls, trimmed flush with the crest
        walkway and paved on top: the dam road drives straight on at the east end, the stairs arrive at the west. */}
    {[arcPoints[0], arcPoints.at(-1)!].map(([x, z], i) => <group key={i}>
      <mesh position={[x, (buttressTopY + wallBase) / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[10, buttressTopY - wallBase, THICKNESS + 6]}/><meshStandardMaterial color="#7c8b5f" roughness={1}/>
      </mesh>
      <mesh position={[x, buttressTopY + .01, z]} receiveShadow><boxGeometry args={[10.2, .1, THICKNESS + 6.2]}/><meshStandardMaterial color={CREAM} roughness={.9}/></mesh>
    </group>)}
    {/* Pedestrian staircase up the west buttress, two flights around a landing. */}
    <group>
      <mesh position={[stairX, bottomY + flight1.rise / 2, stairBaseZ - flight1.run / 2]} rotation={[Math.atan2(flight1.rise, flight1.run), 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, .5, Math.hypot(flight1.rise, flight1.run)]}/><meshStandardMaterial color={CREAM} roughness={.9}/>
      </mesh>
      {stairSteps(bottomY, landingY, stairBaseZ, landingZ, 16).map((step, i) => <mesh key={i} position={[stairX, step.y + .12, step.z]}>
        <boxGeometry args={[3.2, .12, flight1.run / 16 * .85]}/><meshStandardMaterial color={i % 4 === 0 ? MOSS : '#dccf9e'} roughness={1}/>
      </mesh>)}
      <mesh position={[stairX, landingY + .1, landingZ]} castShadow receiveShadow><boxGeometry args={[4, .5, 3.5]}/><meshStandardMaterial color={CREAM} roughness={.9}/></mesh>
      <mesh position={[stairX, landingY + flight2.rise / 2, landingZ - flight2.run / 2]} rotation={[Math.atan2(flight2.rise, flight2.run), 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, .5, Math.hypot(flight2.rise, flight2.run)]}/><meshStandardMaterial color={CREAM} roughness={.9}/>
      </mesh>
      {stairSteps(landingY, topY, landingZ, stairTopZ, 18).map((step, i) => <mesh key={i} position={[stairX, step.y + .12, step.z]}>
        <boxGeometry args={[3.2, .12, flight2.run / 18 * .85]}/><meshStandardMaterial color={i % 4 === 0 ? MOSS : '#dccf9e'} roughness={1}/>
      </mesh>)}
      {/* Timber rail posts along the outer edge, a lantern at the landing. */}
      {[.2, .8].map((t, i) => <mesh key={i} position={[stairX - 1.7, bottomY + (topY - bottomY) * t + 1, stairBaseZ - (stairBaseZ - stairTopZ) * t]} castShadow>
        <cylinderGeometry args={[.08, .08, 2, 6]}/><meshStandardMaterial color="#6d4a30" roughness={1}/>
      </mesh>)}
      <mesh position={[stairX + 2.3, landingY + 1.6, landingZ]}><sphereGeometry args={[.22, 8, 8]}/><meshStandardMaterial color="#f4d78a" emissive="#f4d78a" emissiveIntensity={.6} roughness={.6}/></mesh>
    </group>
    {/* Spillway jets arcing off the sluice lips into the plunge pool. */}
    {assets.jets.map((geometry, i) => <mesh key={i} geometry={geometry} material={assets.material}/>)}
    {/* White water where each jet strikes the pool, with rings spreading out across it. */}
    {gates.map((gate, i) => <group key={i} position={[gate.x, bottomY, gate.landingZ]}>
      <mesh position={[0, .07, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[GATE_WIDTH * .85, 24]}/><meshBasicMaterial color="#eef6ef" transparent opacity={.72} depthWrite={false}/></mesh>
      {[0, 1].map(k => <mesh key={k} ref={m => { rings.current[i * 2 + k] = m; }} position={[0, .09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[GATE_WIDTH * .9, GATE_WIDTH * 1.15, 32]}/><meshBasicMaterial color="#e6f2ea" transparent opacity={.4} depthWrite={false}/>
      </mesh>)}
    </group>)}
    {/* Mossy boulders around the pool's rim. */}
    <instancedMesh ref={rockMesh} args={[undefined, undefined, assets.rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial roughness={1} flatShading/>
    </instancedMesh>
    {/* Lily pads, some in flower, on the calm side of the pool. */}
    {assets.pads.map((pad, i) => <group key={i} position={[pad.x, bottomY + .04, pad.z]} rotation={[0, pad.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[pad.size, 10, .35, Math.PI * 2 - .35]}/><meshStandardMaterial color={i % 2 ? '#5f8f3e' : '#6e9d45'} roughness={.8}/></mesh>
      {pad.flower && <mesh position={[pad.size * .2, .12, 0]}><coneGeometry args={[.18, .22, 6]}/><meshStandardMaterial color="#f2b8c8" roughness={.7}/></mesh>}
    </group>)}
    {/* One collider per wall segment, its top matched to the crest walkway surface, so nothing walks or
        drives (or sails) through the dam but the crest and stair top are walkable once you reach them. */}
    <RigidBody type="fixed" colliders={false}>
      {wallSegments.map((segment, i) =>
        <CuboidCollider key={i} args={[segment.length / 2 + .25, (topY + WALKWAY_TOP - wallBase) / 2, WALKWAY_WIDTH / 2]} position={[segment.x, (topY + WALKWAY_TOP + wallBase) / 2, segment.z]} rotation={[0, segment.yaw, 0]}/>)}
      {/* Parapet rails on both edges of the crest keep walkers from stepping off the curve. */}
      {wallSegments.flatMap((segment, i) => [-1, 1].map(side => {
        const offset = side * (WALKWAY_WIDTH / 2 - .15);
        return <CuboidCollider key={`rail-${i}-${side}`} args={[segment.length / 2 + .22, .5, .125]} position={[segment.x + Math.sin(segment.yaw) * offset, topY + WALKWAY_TOP + .5, segment.z + Math.cos(segment.yaw) * offset]} rotation={[0, segment.yaw, 0]}/>;
      }))}
      {/* Both buttresses, walkable at crest level. */}
      {[arcPoints[0], arcPoints.at(-1)!].map(([x, z], i) => <CuboidCollider key={`buttress-${i}`} args={[5, (buttressTopY - wallBase) / 2, THICKNESS / 2 + 3]} position={[x, (buttressTopY + wallBase) / 2, z]}/>)}
      {/* Ramp colliders under each stair flight, angled to match the steps. */}
      <CuboidCollider args={[1.6, .3, Math.hypot(flight1.rise, flight1.run) / 2]} position={[stairX, bottomY + flight1.rise / 2 + .3, stairBaseZ - flight1.run / 2]} rotation={[Math.atan2(flight1.rise, flight1.run), 0, 0]}/>
      <CuboidCollider args={[2, .3, 1.75]} position={[stairX, landingY + .35, landingZ]}/>
      <CuboidCollider args={[1.6, .3, Math.hypot(flight2.rise, flight2.run) / 2]} position={[stairX, landingY + flight2.rise / 2 + .3, landingZ - flight2.run / 2]} rotation={[Math.atan2(flight2.rise, flight2.run), 0, 0]}/>
    </RigidBody>
    <ExpansionSign position={[cx + 45, terrainHeight(cx + 45, cz + 18), cz + 18]} label={localizedPlace('chalakudy-dam', locale)} width={5.5}/>
  </group>;
}
