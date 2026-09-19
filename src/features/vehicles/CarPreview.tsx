import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { CarVisual } from '../../game/vehicle/CarVisual';
import type { CarModelId } from '../../content/assets/models';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

/** The framing was hand-tuned against a 3.8 m car; longer vehicles scale off that. */
const REFERENCE_LENGTH = 3.8;
const BASE_CAMERA: [number, number, number] = [5, 3.2, 6];
const BASE_DISC_RADIUS = 3.4;

export function previewFraming(modelId: CarModelId): { camera: [number, number, number]; discRadius: number } {
  const scale = Math.max(1, VEHICLE_PROFILES[modelId].length / REFERENCE_LENGTH);
  return {
    camera: [BASE_CAMERA[0] * scale, BASE_CAMERA[1] * scale, BASE_CAMERA[2] * scale],
    discRadius: BASE_DISC_RADIUS * scale,
  };
}

/** Selected car only; physics is never mounted in the preview canvas. */
export function CarPreview({ modelId, color }: { modelId: CarModelId; color?: string }) {
  const { camera, discRadius } = previewFraming(modelId);
  return <div style={{ height: 240 }} aria-label="Selected car preview">
    <Canvas dpr={[1, 1.5]} camera={{ position: camera, fov: 38 }} onCreated={({ camera: view }) => view.lookAt(0, .7, 0)}>
      <ambientLight intensity={1.4} /><directionalLight position={[3, 6, 4]} intensity={2.2} color="#fff1d3" />
      <Suspense fallback={null}><CarVisual modelId={modelId} color={color} reducedMotion /></Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><circleGeometry args={[discRadius, 40]} /><meshStandardMaterial color="#c7c6a0" roughness={1} /></mesh>
    </Canvas>
  </div>;
}
