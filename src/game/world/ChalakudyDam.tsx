import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import type { Locale } from '../../contracts';
import { localizedPlace } from '../../features/i18n/translate';
import { cascadeGeometry } from './waterfallGeometry';
import { waterMaterial } from './Waterfall';
import { ExpansionSign } from './ExpansionSign';

const HALF_SPAN = 26, ARC_RADIUS = 80, THICKNESS = 7, WALL_SEGMENTS = 8;
const GATE_OFFSETS = [-16, 0, 16], GATE_WIDTH = 7;
/** A circular arc in plan, bulging upstream (toward the reservoir) the way a real arch dam resists water pressure. */
const sag = (x: number) => Math.sqrt(Math.max(ARC_RADIUS * ARC_RADIUS - x * x, 0)) - Math.sqrt(ARC_RADIUS * ARC_RADIUS - HALF_SPAN * HALF_SPAN);
// A weathered, storybook stone palette: warm sunlit sandstone with a mossy tideline near the water,
// terracotta pagoda-style tower roofs and a cream crest, rather than cold industrial concrete.
const STONE = ['#cbbe95', '#bfae82'], MOSS = '#7c8f52', ROOF = '#b5623c', CREAM = '#eadfbd';

/** The dam impounding the Chalakkudy River's headwaters reservoir, in the hills at the map's north-west corner. */
export function ChalakudyDam({ quality, animated, locale }: { quality: 'low' | 'medium' | 'high'; animated: boolean; locale: Locale }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const assets = useMemo(() => {
    const crest = V2_LAYOUT.riverNodes.find(n => n.id === 'dam-crest')!;
    const base = V2_LAYOUT.riverNodes.find(n => n.id === 'headwaters')!;
    const [cx, topY, cz] = crest.position, bottomY = base.position[1];
    const curtains = GATE_OFFSETS.map(x => cascadeGeometry({ x: cx + x, z: cz + .3, topY, width: GATE_WIDTH, height: topY - bottomY }, quality === 'low'));
    const arcPoints = Array.from({ length: WALL_SEGMENTS + 1 }, (_, i) => {
      const x = -HALF_SPAN + (2 * HALF_SPAN) * i / WALL_SEGMENTS;
      return [cx + x, cz - sag(x)] as const;
    });
    const wallSegments = arcPoints.slice(0, -1).map(([x, z], i) => {
      const [nx, nz] = arcPoints[i + 1], dx = nx - x, dz = nz - z, length = Math.hypot(dx, dz);
      return { x: (x + nx) / 2, z: (z + nz) / 2, yaw: Math.atan2(dx, dz), length };
    });
    return { curtains, material: waterMaterial(quality === 'low', time), cx, cz, topY, bottomY, wallSegments, arcPoints };
  }, [quality, time]);
  useEffect(() => () => { assets.curtains.forEach(g => g.dispose()); assets.material.dispose(); }, [assets]);
  useFrame((_, delta) => { if (animated) time.value += Math.min(delta, .05); });

  const { cx, cz, topY, bottomY, wallSegments, arcPoints } = assets;
  const wallHeight = topY - bottomY, midY = (topY + bottomY) / 2, crestTopY = topY + 1.4;
  const mossTopY = bottomY + wallHeight * .22;

  // A pedestrian staircase up the east buttress: two straight flights around a mid-height landing,
  // each within a comfortable stair pitch. The hairpin road climbs the west hillside instead.
  const stairX = cx + HALF_SPAN + 4;
  const stairBaseZ = cz + 20, landingZ = cz + 6, stairTopZ = cz - 3;
  const landingY = bottomY + wallHeight * .45;
  const flight1 = { rise: landingY - bottomY, run: stairBaseZ - landingZ };
  const flight2 = { rise: topY - landingY, run: landingZ - stairTopZ };
  const stairSteps = (fromY: number, toY: number, fromZ: number, toZ: number, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const t = (i + 1) / count;
      return { y: fromY + (toY - fromY) * t, z: fromZ + (toZ - fromZ) * t };
    });

  return <group>
    {/* Arched stone wall: straight segments following a circular arc, bulging into the reservoir. */}
    {wallSegments.map((segment, i) => <group key={i}>
      <mesh position={[segment.x, midY, segment.z]} rotation={[0, segment.yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[segment.length + .4, wallHeight, THICKNESS]}/><meshStandardMaterial color={STONE[i % 2]} roughness={.9}/>
      </mesh>
      {/* A mossy tideline where the reservoir laps against the stone. */}
      <mesh position={[segment.x, mossTopY, segment.z + THICKNESS * .01]} rotation={[0, segment.yaw, 0]}>
        <boxGeometry args={[segment.length + .5, wallHeight * .18, THICKNESS + .12]}/><meshStandardMaterial color={MOSS} roughness={1}/>
      </mesh>
    </group>)}
    {/* Crest walkway and parapet rail. */}
    <mesh position={[cx, topY + .3, cz - sag(0) / 2]} castShadow receiveShadow><boxGeometry args={[HALF_SPAN * 2 + 2, .6, THICKNESS + 2]}/><meshStandardMaterial color={CREAM} roughness={.9}/></mesh>
    <mesh position={[cx, crestTopY, cz - sag(0) / 2 - THICKNESS / 2 - .8]}><boxGeometry args={[HALF_SPAN * 2 + 2, 1, .25]}/><meshStandardMaterial color="#f6efd8" roughness={.8}/></mesh>
    {/* Gate towers over each spillway opening: whitewashed stone with a peaked, pagoda-style roof and a small finial. */}
    {GATE_OFFSETS.map((x, i) => <group key={i} position={[cx + x, topY, cz - sag(x) / 2]}>
      <mesh position={[0, 5.5, 0]} castShadow><boxGeometry args={[3.4, 11, 3.4]}/><meshStandardMaterial color={CREAM} roughness={.85}/></mesh>
      <mesh position={[0, 11.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[3.4, 2.4, 4]}/><meshStandardMaterial color={ROOF} roughness={.7}/></mesh>
      <mesh position={[0, 13.4, 0]}><sphereGeometry args={[.28, 8, 8]}/><meshStandardMaterial color="#e2c88f" roughness={.5} metalness={.2}/></mesh>
    </group>)}
    {/* Buttress rock anchoring each end of the arc into the canyon walls. */}
    {[arcPoints[0], arcPoints.at(-1)!].map(([x, z], i) => <mesh key={i} position={[x, midY, z]} castShadow receiveShadow>
      <boxGeometry args={[10, wallHeight + 6, THICKNESS + 6]}/><meshStandardMaterial color="#7c8b5f" roughness={1}/>
    </mesh>)}
    {/* Pedestrian staircase up the east buttress, two flights around a landing. */}
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
      {[.2, .8].map((t, i) => <mesh key={i} position={[stairX + 1.7, bottomY + wallHeight * t + 1, stairBaseZ - (stairBaseZ - stairTopZ) * t]} castShadow>
        <cylinderGeometry args={[.08, .08, 2, 6]}/><meshStandardMaterial color="#6d4a30" roughness={1}/>
      </mesh>)}
      <mesh position={[stairX - 2.3, landingY + 1.6, landingZ]}><sphereGeometry args={[.22, 8, 8]}/><meshStandardMaterial color="#f4d78a" emissive="#f4d78a" emissiveIntensity={.6} roughness={.6}/></mesh>
    </group>
    {/* Spillway curtains, falling from the crest gates to the basin below. */}
    {assets.curtains.map((geometry, i) => <mesh key={i} geometry={geometry} material={assets.material}/>)}
    <mesh position={[cx, bottomY + .04, cz + 8]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[GATE_OFFSETS.length * (GATE_WIDTH + 6), 8]}/><meshBasicMaterial color="#d8e8d7" transparent opacity={.48} depthWrite={false}/></mesh>
    {quality !== 'low' && <mesh position={[cx, bottomY + 3, cz + 3]} scale={[GATE_OFFSETS.length * 5, 3, 4]}><sphereGeometry args={[1, 16, 8]}/><meshBasicMaterial color="#e3efd6" transparent opacity={.18} depthWrite={false}/></mesh>}
    {/* One simplified collider per wall third, its top matched to the crest walkway surface, so nothing
        walks or drives through the dam but the crest and stair top are walkable once you reach them. */}
    <RigidBody type="fixed" colliders={false}>
      {[wallSegments[0], wallSegments[Math.floor(wallSegments.length / 2)], wallSegments.at(-1)!].map((segment, i) =>
        <CuboidCollider key={i} args={[HALF_SPAN * 2 / 3 / 2, wallHeight / 2 + .35, THICKNESS]} position={[segment.x, midY + .35, segment.z]} rotation={[0, segment.yaw, 0]}/>)}
      {/* Ramp colliders under each stair flight, angled to match the steps. */}
      <CuboidCollider args={[1.6, .3, Math.hypot(flight1.rise, flight1.run) / 2]} position={[stairX, bottomY + flight1.rise / 2 + .3, stairBaseZ - flight1.run / 2]} rotation={[Math.atan2(flight1.rise, flight1.run), 0, 0]}/>
      <CuboidCollider args={[2, .3, 1.75]} position={[stairX, landingY + .35, landingZ]}/>
      <CuboidCollider args={[1.6, .3, Math.hypot(flight2.rise, flight2.run) / 2]} position={[stairX, landingY + flight2.rise / 2 + .3, landingZ - flight2.run / 2]} rotation={[Math.atan2(flight2.rise, flight2.run), 0, 0]}/>
    </RigidBody>
    <ExpansionSign position={[cx + 30, terrainHeight(cx + 30, cz + 6), cz + 6]} label={localizedPlace('chalakudy-dam', locale)} width={4.5}/>
  </group>;
}
