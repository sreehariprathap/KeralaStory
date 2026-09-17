import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { CarVisual } from '../../game/vehicle/CarVisual';
import type { CarModelId } from '../../content/assets/models';

/** Selected car only; physics is never mounted in the preview canvas. */
export function CarPreview({ modelId, color }: { modelId: CarModelId; color?: string }) {
  return <div style={{ height: 240 }} aria-label="Selected car preview">
    <Canvas dpr={[1, 1.5]} camera={{ position: [5, 3.2, 6], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, .7, 0)}>
      <ambientLight intensity={1.4} /><directionalLight position={[3, 6, 4]} intensity={2.2} color="#fff1d3" />
      <Suspense fallback={null}><CarVisual modelId={modelId} color={color} reducedMotion /></Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><circleGeometry args={[3.4, 40]} /><meshStandardMaterial color="#c7c6a0" roughness={1} /></mesh>
    </Canvas>
  </div>;
}
