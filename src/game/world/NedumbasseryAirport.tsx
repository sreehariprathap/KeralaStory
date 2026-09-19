import { memo, useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { NEDUMBASSERY_AIRPORT, type AirportAircraft } from '../../content/world/airport';
import { terrainHeight } from '../../content/world/definition';
import { CarVisual } from '../vehicle/CarVisual';
import { Signboard } from './ChalakkudyCity';
import { createCityGeometry, createPaintGeometry } from './chalakkudyCityGeometry';

const BODY = '#f4f5f2', METAL = '#b9bec4', DARK = '#2b3138';

/** A stylised twin-engine airliner, 30 m long at scale 1, nose along +Z, wheels on the ground at y = 0. */
function Aircraft({ plane }: { plane: AirportAircraft }) {
  const s = plane.length / 30;
  return <group position={plane.position} rotation={[0, plane.yaw, 0]} scale={s}>
    {/* Fuselage, nose and tail cone. */}
    <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[1.9, 1.9, 22, 16]}/><meshStandardMaterial color={BODY} roughness={.45}/></mesh>
    <mesh position={[0, 3.1, 12.2]} scale={[1.9, 1.8, 2.6]} castShadow><sphereGeometry args={[1, 16, 10]}/><meshStandardMaterial color={BODY} roughness={.45}/></mesh>
    <mesh position={[0, 3.6, -13.8]} rotation={[-Math.PI / 2 - .08, 0, 0]} castShadow><coneGeometry args={[1.9, 5.8, 16]}/><meshStandardMaterial color={BODY} roughness={.45}/></mesh>
    {/* Cockpit glazing, a row of cabin windows and the livery cheatline. */}
    <mesh position={[0, 4.05, 13.1]} rotation={[-.5, 0, 0]}><boxGeometry args={[1.9, .45, 1.2]}/><meshStandardMaterial color={DARK} roughness={.2}/></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 1.91, 3.7, 0]}><boxGeometry args={[.04, .32, 19]}/><meshStandardMaterial color={DARK} roughness={.3}/></mesh>
      <mesh position={[side * 1.91, 3.05, 0]}><boxGeometry args={[.04, .5, 21]}/><meshStandardMaterial color={plane.livery} roughness={.5}/></mesh>
    </group>)}
    {/* Swept wings with an engine under each, then the tailplane and fin. */}
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 7.4, 2.5, .6]} rotation={[0, side * -.32, 0]} castShadow><boxGeometry args={[13.5, .35, 3.6]}/><meshStandardMaterial color={METAL} roughness={.5}/></mesh>
      <mesh position={[side * 5.2, 1.5, 3.1]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.85, .75, 3.6, 14]}/><meshStandardMaterial color={BODY} roughness={.4}/></mesh>
      <mesh position={[side * 5.2, 1.5, 4.95]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.65, .65, .1, 14]}/><meshStandardMaterial color={DARK}/></mesh>
      <mesh position={[side * 3.4, 4, -13.5]} rotation={[0, side * -.4, 0]} castShadow><boxGeometry args={[6, .25, 2.2]}/><meshStandardMaterial color={METAL} roughness={.5}/></mesh>
    </group>)}
    <mesh position={[0, 7, -13.4]} rotation={[-.45, 0, 0]} castShadow><boxGeometry args={[.35, 5.6, 3.2]}/><meshStandardMaterial color={plane.livery} roughness={.5}/></mesh>
    {/* Landing gear: nose leg and two main bogies. */}
    {([[0, 10], [-1.6, -.5], [1.6, -.5]] as const).map(([x, z], i) => <group key={i} position={[x, 0, z]}>
      <mesh position={[0, 1, 0]}><cylinderGeometry args={[.12, .12, 1.8, 6]}/><meshStandardMaterial color={METAL}/></mesh>
      <mesh position={[0, .45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.45, .45, .5, 12]}/><meshStandardMaterial color={DARK} roughness={.9}/></mesh>
    </group>)}
  </group>;
}

/** Nedumbassery Airport: runway, apron, terminal, tower, hangar, car park and parked aircraft. */
export const NedumbasseryAirport = memo(function NedumbasseryAirport() {
  const geometry = useMemo(() => createCityGeometry(NEDUMBASSERY_AIRPORT.pieces), []);
  const paint = useMemo(() => createPaintGeometry(NEDUMBASSERY_AIRPORT.paint, terrainHeight), []);
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); paint.dispose(); }, [geometry, paint]);
  return <group name="nedumbassery-airport">
    <RigidBody type="fixed" colliders={false}>
      {NEDUMBASSERY_AIRPORT.boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
    <mesh geometry={geometry.solid} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.82}/></mesh>
    <mesh geometry={geometry.ground} receiveShadow><meshStandardMaterial vertexColors roughness={.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>
    <mesh geometry={geometry.glass}><meshStandardMaterial vertexColors metalness={.55} roughness={.08} transparent opacity={.6} depthWrite={false}/></mesh>
    <mesh geometry={geometry.glow}><meshStandardMaterial vertexColors emissive="#fff0c8" emissiveIntensity={.9} roughness={.4}/></mesh>
    <mesh geometry={paint} receiveShadow><meshStandardMaterial vertexColors roughness={.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>
    {NEDUMBASSERY_AIRPORT.signs.map(sign => <Signboard key={sign.id} sign={sign}/>)}
    {NEDUMBASSERY_AIRPORT.aircraft.map(plane => <Aircraft key={plane.id} plane={plane}/>)}
    {NEDUMBASSERY_AIRPORT.cars.map(car => <group key={car.id} position={car.position} rotation={[0, car.yaw, 0]}>
      <CarVisual modelId={car.modelId} color={car.color}/>
    </group>)}
  </group>;
});
