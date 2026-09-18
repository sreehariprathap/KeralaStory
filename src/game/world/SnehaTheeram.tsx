import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferGeometry, Float32BufferAttribute, type MeshBasicMaterial } from 'three';
import { SNEHA_THEERAM_DRESSING } from '../../content/world/snehaTheeramDressing';
import { SNEHA_BEACH_SPAN, shorePoint } from '../../content/world/snehaTheeram';
import { WATER_LEVEL } from '../../content/world/definition';
import { Signboard } from './ChalakkudyCity';
import { createCityGeometry } from './chalakkudyCityGeometry';

/** A band of surf just off the waterline, `from`..`to` metres out to sea. */
function surfBand(from: number, to: number, lift: number) {
  const vertices: number[] = [], indices: number[] = [];
  const start = SNEHA_BEACH_SPAN.from - 60, end = SNEHA_BEACH_SPAN.to + 40;
  for (let along = start, i = 0; along <= end; along += 2, i++) {
    const p = shorePoint(along);
    for (const d of [from, to]) vertices.push(p.x - p.nx * d, WATER_LEVEL + lift, p.z - p.nz * d);
    if (i) indices.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Sneha Theeram's beach life: umbrellas, loungers, vallams, a lifeguard tower, the stall, the arch and the surf. */
export const SnehaTheeram = memo(function SnehaTheeram({ animated }: { animated: boolean }) {
  const geometry = useMemo(() => createCityGeometry(SNEHA_THEERAM_DRESSING.pieces), []);
  const surf = useMemo(() => ({ near: surfBand(-.5, 2.5, .04), far: surfBand(6, 7.6, .03) }), []);
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); surf.near.dispose(); surf.far.dispose(); }, [geometry, surf]);
  const materials: { near: MeshBasicMaterial | null; far: MeshBasicMaterial | null } = useMemo(() => ({ near: null, far: null }), []);
  // The surf breathes in and out with the waves.
  useFrame(({ clock }) => {
    if (!animated) return;
    const t = clock.elapsedTime;
    if (materials.near) materials.near.opacity = .5 + .2 * Math.sin(t * 1.3);
    if (materials.far) materials.far.opacity = .3 + .2 * Math.sin(t * 1.3 + 1.8);
  });
  return <group name="sneha-theeram">
    <RigidBody type="fixed" colliders={false}>
      {SNEHA_THEERAM_DRESSING.boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
    <mesh geometry={geometry.solid} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh>
    {SNEHA_THEERAM_DRESSING.signs.map(sign => <Signboard key={sign.id} sign={sign}/>)}
    {SNEHA_THEERAM_DRESSING.umbrellas.map((u, i) => <group key={i} position={u.position} rotation={[u.tilt, 0, u.tilt * .6]}>
      <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[.05, .05, 2.8, 6]}/><meshStandardMaterial color="#e9e4d8" roughness={.7}/></mesh>
      <mesh position={[0, 2.75, 0]} castShadow><coneGeometry args={[1.9, .75, 12, 1, true]}/><meshStandardMaterial color={u.color} roughness={.8} side={2}/></mesh>
      <mesh position={[0, 3.15, 0]}><sphereGeometry args={[.08, 6, 6]}/><meshStandardMaterial color="#e9e4d8"/></mesh>
    </group>)}
    <mesh geometry={surf.near}><meshBasicMaterial ref={m => { materials.near = m; }} color="#f4fbf6" transparent opacity={.6} depthWrite={false}/></mesh>
    <mesh geometry={surf.far}><meshBasicMaterial ref={m => { materials.far = m; }} color="#e6f5f0" transparent opacity={.4} depthWrite={false}/></mesh>
  </group>;
});
