/**
 * Development view of the Silver Storm water park, on its real terrain.
 * Run `npx vite` and open /park-review.html?view=aerial|entrance|slides|pools.
 */
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { DoubleSide } from 'three';
import { WaterPark } from '../game/world/WaterPark';
import { PARK_BOUNDS, PARK_DECK_Y, PARK_ENTRANCE, PARK_SPLASH_PAD, PARK_TOWERS } from '../content/world/waterPark';
import { terrainHeight } from '../content/world/definition';

const cx = (PARK_BOUNDS.xMin + PARK_BOUNDS.xMax) / 2, cz = (PARK_BOUNDS.zMin + PARK_BOUNDS.zMax) / 2;
const VIEWS: Record<string, { position: [number, number, number]; target: [number, number, number] }> = {
  aerial: { position: [cx + 55, PARK_DECK_Y + 95, cz + 95], target: [cx, PARK_DECK_Y, cz] },
  entrance: { position: [PARK_ENTRANCE.x + 2, PARK_DECK_Y + 6, PARK_ENTRANCE.z + 34], target: [cx, PARK_DECK_Y + 6, cz] },
  slides: { position: [PARK_TOWERS[0].x + 26, PARK_DECK_Y + 14, PARK_TOWERS[0].z + 26], target: [PARK_TOWERS[0].x, PARK_DECK_Y + 7, PARK_TOWERS[0].z] },
  pools: { position: [PARK_SPLASH_PAD.x + 30, PARK_DECK_Y + 18, PARK_SPLASH_PAD.z + 34], target: [PARK_SPLASH_PAD.x, PARK_DECK_Y, PARK_SPLASH_PAD.z] },
};
const view = VIEWS[new URLSearchParams(location.search).get('view') ?? 'aerial'] ?? VIEWS.aerial;

/** The park's own patch of ground, sampled from the real terrain. */
function Ground() {
  const size = 140, steps = 40;
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
    const x = cx - size / 2 + (i / steps) * size, z = cz - size / 2 + (j / steps) * size;
    positions.push(x, terrainHeight(x, z), z);
    if (i < steps && j < steps) { const a = i * (steps + 1) + j; indices.push(a, a + 1, a + steps + 1, a + 1, a + steps + 2, a + steps + 1); }
  }
  return <mesh receiveShadow>
    <bufferGeometry onUpdate={g => g.computeVertexNormals()}>
      <bufferAttribute attach="attributes-position" args={[new Float32Array(positions), 3]}/>
      <bufferAttribute attach="index" args={[new Uint32Array(indices), 1]}/>
    </bufferGeometry>
    <meshStandardMaterial color="#86a165" roughness={1} side={DoubleSide}/>
  </mesh>;
}

createRoot(document.getElementById('app')!).render(
  <div style={{ position: 'fixed', inset: 0, background: '#c6dbd2' }}>
    <Canvas shadows camera={{ position: view.position, fov: 50, near: .5, far: 900 }} onCreated={({ camera }) => camera.lookAt(...view.target)}>
      <ambientLight intensity={.75} color="#dbe5d6"/>
      <hemisphereLight args={['#e3efd6', '#657952', 1.3]}/>
      <directionalLight position={[cx - 55, PARK_DECK_Y + 85, cz - 35]} intensity={2.2} color="#fff0cd" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-far={300}/>
      <Suspense fallback={null}><Ground/><WaterPark/></Suspense>
    </Canvas>
  </div>,
);
