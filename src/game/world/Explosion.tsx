import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial, PointLight } from 'three';
import type { Vec3 } from '../../contracts';

const DURATION = 3.2;
const hash = (n: number) => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

/** A crash fireball: a flash, a swelling ball of fire, a shock ring, flying debris and a column of smoke. */
export function Explosion({ position, water = false }: { position: Vec3; water?: boolean }) {
  const age = useRef(0);
  const fire = useRef<Mesh>(null), core = useRef<Mesh>(null), ring = useRef<Mesh>(null), light = useRef<PointLight>(null);
  const smoke = useRef<(Mesh | null)[]>([]), debris = useRef<(Group | null)[]>([]);
  const puffs = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ dx: (hash(i) - .5) * 5, dz: (hash(i + 9) - .5) * 5, rise: 3 + hash(i + 3) * 4, size: 2 + hash(i + 5) * 2.5, delay: hash(i + 7) * .5 })), []);
  const shards = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const a = i / 12 * Math.PI * 2 + hash(i + 20), up = 8 + hash(i + 30) * 10, out = 6 + hash(i + 40) * 8;
    return { vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out, spin: hash(i + 50) * 10 };
  }), []);
  useFrame((_, delta) => {
    const t = age.current = Math.min(DURATION, age.current + Math.min(delta, .05));
    const burst = Math.min(1, t / .45), fade = Math.max(0, 1 - (t - .35) / 1.1);
    if (fire.current) { fire.current.scale.setScalar(1 + burst * 7); (fire.current.material as MeshBasicMaterial).opacity = .9 * fade; }
    if (core.current) { core.current.scale.setScalar(1 + burst * 4); (core.current.material as MeshBasicMaterial).opacity = Math.max(0, 1 - t / .6); }
    if (ring.current) { ring.current.scale.setScalar(1 + t * 22); (ring.current.material as MeshBasicMaterial).opacity = Math.max(0, .6 - t * .7); }
    if (light.current) light.current.intensity = Math.max(0, 1 - t / .8) * 400;
    puffs.forEach((p, i) => {
      const m = smoke.current[i]; if (!m) return;
      const s = Math.max(0, t - p.delay);
      m.position.set(p.dx * (1 + s * .3), 1 + s * p.rise, p.dz * (1 + s * .3));
      m.scale.setScalar(p.size * (.4 + Math.min(1.6, s * .8)));
      (m.material as MeshBasicMaterial).opacity = s > 0 ? Math.max(0, .55 * (1 - s / (DURATION - p.delay))) : 0;
    });
    shards.forEach((d, i) => {
      const g = debris.current[i]; if (!g) return;
      g.position.set(d.vx * t, Math.max(-.5, d.vy * t - 10 * t * t), d.vz * t);
      g.rotation.set(d.spin * t, d.spin * t * .7, 0);
    });
  });
  const fireColor = water ? '#e8f4f2' : '#ff9a2e', coreColor = water ? '#ffffff' : '#fff1b0';
  return <group position={position}>
    <pointLight ref={light} color="#ffb257" distance={60} decay={2} intensity={400} position={[0, 3, 0]}/>
    <mesh ref={fire} position={[0, 1.5, 0]}><icosahedronGeometry args={[1, 2]}/><meshBasicMaterial color={fireColor} transparent opacity={.9} depthWrite={false}/></mesh>
    <mesh ref={core} position={[0, 1.5, 0]}><icosahedronGeometry args={[1, 1]}/><meshBasicMaterial color={coreColor} transparent depthWrite={false}/></mesh>
    <mesh ref={ring} position={[0, .3, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.8, 1, 40]}/><meshBasicMaterial color="#fff4d6" transparent opacity={.6} depthWrite={false}/></mesh>
    {puffs.map((_, i) => <mesh key={i} ref={m => { smoke.current[i] = m; }}><icosahedronGeometry args={[1, 1]}/><meshBasicMaterial color={water ? '#dfe9ea' : '#3b3733'} transparent opacity={0} depthWrite={false}/></mesh>)}
    {!water && shards.map((_, i) => <group key={i} ref={g => { debris.current[i] = g; }}><mesh castShadow><boxGeometry args={[.5, .15, .9]}/><meshStandardMaterial color={i % 3 ? '#4a4038' : '#b8322a'} roughness={.9}/></mesh></group>)}
  </group>;
}
