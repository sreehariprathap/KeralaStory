import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector2 } from 'three';
import { SNEHA_SHORELINE, SNEHA_THEERAM } from '../../content/world/snehaTheeram';
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
      // The reservoir's overlapping arms are one lake: no foam lines where their bands cross.
      const foam = mesh.id.startsWith('chalakudy-reservoir') ? 0 : .15;
      geometry.setAttribute('waterFoam', new Float32BufferAttribute(mesh.uv.filter((_, i) => i % 2 === 0).map(u => u === 0 || u === 1 ? foam : 0), 1));
      geometry.setIndex(mesh.indices); geometry.computeVertexNormals();
      return geometry;
    });
    return { geometries, material: waterMaterial(quality === 'low', time) };
  }, [quality, time]);
  useEffect(() => () => { assets.geometries.forEach(g => g.dispose()); assets.material.dispose(); }, [assets]);
  useFrame((_, delta) => { if (animated) time.value += Math.min(delta, .05) * .25; });
  // The sea off Sneha Theeram, cut to the curved waterline and the map's west and south edges.
  const sea = useMemo(() => {
    const b = V2_LAYOUT.bounds, east = SNEHA_THEERAM.eastEdgeX, margin = 60;
    const coast = SNEHA_SHORELINE.filter(([x]) => x >= b.xMin - margin);
    const outline = [...coast, [b.xMin - margin, coast.at(-1)![1]], [b.xMin - margin, b.zMax + margin], [east, b.zMax + margin]] as const;
    // Shape space is x, -z so that turning the shape flat keeps world z.
    const shape = new Shape(outline.map(([x, z]) => new Vector2(x, -z)));
    const geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);
  useEffect(() => () => sea.dispose(), [sea]);
  return <group>
    {assets.geometries.map((geometry, i) => <mesh key={i} geometry={geometry} material={assets.material}/>)}
    {/* A hair below the old sea plane, so the two never fight where they meet at Kodaly. */}
    <mesh geometry={sea} position={[0, WATER_LEVEL - .02, 0]} receiveShadow><meshStandardMaterial color="#579e9f" roughness={.45}/></mesh>
  </group>;
}
