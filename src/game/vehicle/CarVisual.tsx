import type { RefObject } from 'react';
import { CAR_MODELS, type CarModelId } from '../../content/assets/models';
import { ModelAsset } from '../render/ModelAsset';
import { CarExhaust } from './CarExhaust';
import type { CarMotion } from './carPhysics';
import { VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';

export interface CarVisualProps {
  modelId?: CarModelId;
  motion?: RefObject<CarMotion>;
  active?: boolean;
  reducedMotion?: boolean;
  color?: string;
}
/** Shared tailpipe position for a profile that does not place its own. */
const DEFAULT_EXHAUST: [number, number, number] = [.5, .32, -1.9];

export function exhaustPosition(modelId: CarModelId): [number, number, number] {
  const exhaust = VEHICLE_PROFILES[modelId]?.exhaust;
  return exhaust ? [exhaust.x, exhaust.y, exhaust.z] : DEFAULT_EXHAUST;
}

export function CarVisual({ modelId = 'admin', motion, active = false, reducedMotion = false, color }: CarVisualProps) {
  const model = CAR_MODELS.find(candidate => candidate.id === modelId) ?? CAR_MODELS[0];
  return <group>
    <ModelAsset key={model.id} url={model.url} length={3.8} rotationY={model.rotationY} name={`car-${model.id}`} carModel={model.id} carMotion={motion} carColor={color}/>
    {motion && <CarExhaust motion={motion} active={active} reducedMotion={reducedMotion} position={exhaustPosition(model.id)}/>}
  </group>;
}
