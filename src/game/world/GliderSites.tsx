import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DoubleSide, Group, type MeshBasicMaterial, type Points } from 'three';
import { GLIDER_LAUNCH, THERMALS } from '../../content/world/gliderSites';
import { terrainHeight } from '../../content/world/definition';
import { ExpansionSign } from './ExpansionSign';
import type { Thermal } from '../vehicle/gliderMotor';

const SAFFRON = '#e8912d';
/** Thermal columns beyond this distance are not drawn. */
const THERMAL_DRAW_DISTANCE = 260;
const COLUMN_HEIGHT = 70;
const PARTICLES = 70;

/** Walk-through launch circle on the summit: no collider. */
function LaunchPad({ animated }: { animated: boolean }) {
  const [x, y, z] = GLIDER_LAUNCH.position, h = GLIDER_LAUNCH.headingRad;
  const ring = useRef<MeshBasicMaterial>(null), sock = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) ring.current.opacity = animated ? .55 + Math.sin(t * 2.4) * .25 : .7;
    if (sock.current && animated) sock.current.rotation.y = Math.sin(t * .7) * .25;
  });
  // Beside the circle, off the launch line.
  const side = GLIDER_LAUNCH.radiusM + 1.6;
  const sideX = Math.cos(h) * side, sideZ = Math.sin(h) * side;
  // The sign stands on the windsock side, a little behind the circle, clear of the summit board.
  const signX = Math.cos(h) * (side + .6) - Math.sin(h) * 3.5, signZ = Math.sin(h) * (side + .6) + Math.cos(h) * 3.5;
  return <group position={[x, y, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .06, 0]}>
      <ringGeometry args={[GLIDER_LAUNCH.radiusM - .35, GLIDER_LAUNCH.radiusM, 48]}/>
      <meshBasicMaterial ref={ring} color={SAFFRON} transparent opacity={.7} side={DoubleSide} depthWrite={false}/>
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, -h]} position={[0, .05, 0]}>
      {/* Arrow pointing along the launch heading. */}
      <circleGeometry args={[.9, 3]}/>
      <meshBasicMaterial color={SAFFRON} transparent opacity={.5} depthWrite={false}/>
    </mesh>
    <group position={[sideX, terrainHeight(x + sideX, z + sideZ) - y, sideZ]}>
      <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[.04, .05, 3.2, 6]}/><meshStandardMaterial color="#6b5a45"/></mesh>
      <group ref={sock} position={[0, 3.05, 0]} rotation={[0, Math.PI - h, 0]}>
        <mesh position={[0, 0, -.6]} rotation={[-Math.PI / 2 - .15, 0, 0]}><coneGeometry args={[.22, 1.2, 8, 1, true]}/><meshStandardMaterial color={SAFFRON} side={DoubleSide}/></mesh>
      </group>
    </group>
    <group position={[signX, terrainHeight(x + signX, z + signZ) - y, signZ]} rotation={[0, Math.PI - h, 0]}>
      <ExpansionSign position={[0, 0, 0]} label="Paragliding" width={3.4}/>
    </group>
  </group>;
}

/** Drifting motes spiralling up a thermal, plus two kites circling its top. */
function ThermalColumn({ thermal, animated }: { thermal: Thermal; animated: boolean }) {
  const group = useRef<Group>(null), points = useRef<Points>(null), birds = useRef<Group>(null);
  const base = terrainHeight(thermal.x, thermal.z);
  const { geometry, seeds } = useMemo(() => {
    const seeds = Array.from({ length: PARTICLES }, (_, i) => ({ angle: i * 2.39996, radius: thermal.radiusM * Math.sqrt((i + .5) / PARTICLES) * .8, height: (i * 37 % PARTICLES) / PARTICLES }));
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    return { geometry, seeds };
  }, [thermal]);
  useFrame(({ camera, clock }) => {
    if (!group.current) return;
    const visible = Math.hypot(camera.position.x - thermal.x, camera.position.z - thermal.z) < THERMAL_DRAW_DISTANCE;
    group.current.visible = visible;
    if (!visible || !points.current) return;
    const t = animated ? clock.elapsedTime : 0, position = geometry.getAttribute('position') as BufferAttribute;
    seeds.forEach((seed, i) => {
      const rise = (seed.height + t * .045) % 1, angle = seed.angle + t * .5;
      position.setXYZ(i, Math.cos(angle) * seed.radius, 2 + rise * COLUMN_HEIGHT, Math.sin(angle) * seed.radius);
    });
    position.needsUpdate = true;
    if (birds.current) birds.current.rotation.y = t * .35;
  });
  return <group ref={group} position={[thermal.x, base, thermal.z]}>
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#e8b35c" size={1.1} transparent opacity={.75} depthWrite={false}/>
    </points>
    <group ref={birds} position={[0, COLUMN_HEIGHT * .8, 0]}>
      {[0, Math.PI].map((angle, i) => <mesh key={angle} position={[Math.cos(angle) * thermal.radiusM * .7, i * 4, Math.sin(angle) * thermal.radiusM * .7]} rotation={[0, -angle, 0]}>
        {/* A Brahminy kite silhouette: a flat, swept wing. */}
        <coneGeometry args={[.9, .5, 3]}/>
        <meshStandardMaterial color="#5b3a26"/>
      </mesh>)}
    </group>
  </group>;
}

export const GliderSites = memo(function GliderSites({ animated }: { animated: boolean }) {
  return <>
    <LaunchPad animated={animated}/>
    {THERMALS.map(thermal => <ThermalColumn key={thermal.id} thermal={thermal} animated={animated}/>)}
  </>;
});
