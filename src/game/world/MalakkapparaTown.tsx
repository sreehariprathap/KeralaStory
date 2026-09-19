import { memo, useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { MALAKKAPPARA_TOWN } from '../../content/world/malakkapparaTown';
import { terrainHeight } from '../../content/world/definition';
import { createCityGeometry, createPaintGeometry } from './chalakkudyCityGeometry';
import { Signboard } from './ChalakkudyCity';

/** Malakkappara hill town: bazaar, bus stand, hotels, hillside homes, resort and pad walls. */
export const MalakkapparaTown = memo(function MalakkapparaTown() {
  const geometry = useMemo(() => createCityGeometry(MALAKKAPPARA_TOWN.pieces), []);
  const paint = useMemo(() => createPaintGeometry(MALAKKAPPARA_TOWN.paint, terrainHeight), []);
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); paint.dispose(); }, [geometry, paint]);
  return <group name="malakkappara-town">
    <RigidBody type="fixed" colliders={false}>
      {MALAKKAPPARA_TOWN.boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
    <mesh geometry={geometry.solid} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh>
    <mesh geometry={geometry.ground} receiveShadow><meshStandardMaterial vertexColors roughness={.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>
    <mesh geometry={geometry.glass}><meshStandardMaterial vertexColors metalness={.3} roughness={.2}/></mesh>
    <mesh geometry={geometry.glow}><meshStandardMaterial vertexColors emissive="#fff0c8" emissiveIntensity={.9} roughness={.4}/></mesh>
    <mesh geometry={paint} receiveShadow><meshStandardMaterial vertexColors roughness={.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>
    {MALAKKAPPARA_TOWN.signs.map(sign => <Signboard key={sign.id} sign={sign}/>)}
  </group>;
});
