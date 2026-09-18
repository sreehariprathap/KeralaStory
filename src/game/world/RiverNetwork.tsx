import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { EXPANSION_GROUND, V2_LAYOUT, WATER_LEVEL } from '../../content/world/definition';
import { waterMaterial } from './Waterfall';

/** One source supplies these surfaces, terrain cuts, water access and the atlas. */
export function RiverNetwork({ animated, quality }: { animated: boolean; quality: 'low' | 'medium' | 'high' }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const assets = useMemo(() => {
    // Both waterfall drops are hand-authored elsewhere (AthirappillyWorld, ChalakudyDam) as cascade curtains.
    const meshes = EXPANSION_GROUND.v2!.river.meshes.filter(mesh => mesh.id !== 'athirappilly-drop' && mesh.id !== 'chalakudy-dam-spillway');
    const geometries = meshes.map(mesh => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(mesh.vertices, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(mesh.uv, 2));
      geometry.setAttribute('waterFoam', new Float32BufferAttribute(mesh.uv.filter((_, i) => i % 2 === 0).map(u => u === 0 || u === 1 ? .15 : 0), 1));
      geometry.setIndex(mesh.indices); geometry.computeVertexNormals();
      return geometry;
    });
    return { geometries, material: waterMaterial(quality === 'low', time) };
  }, [quality, time]);
  useEffect(() => () => { assets.geometries.forEach(g => g.dispose()); assets.material.dispose(); }, [assets]);
  useFrame((_, delta) => { if (animated) time.value += Math.min(delta, .05) * .25; });
  const bounds = V2_LAYOUT.bounds, shoreZ = EXPANSION_GROUND.v2!.southShoreZ;
  return <group>
    {assets.geometries.map((geometry, i) => <mesh key={i} geometry={geometry} material={assets.material}/>)}
    <mesh position={[(bounds.xMin - 78) / 2, WATER_LEVEL, (shoreZ + bounds.zMax) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[-78 - bounds.xMin, bounds.zMax - shoreZ]}/><meshStandardMaterial color="#579e9f" roughness={.6}/>
    </mesh>
  </group>;
}
