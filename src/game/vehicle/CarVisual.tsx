import type { RefObject } from 'react';
import { CAR_MODELS, type CarModelId } from '../../content/assets/models';
import { ModelAsset } from '../render/ModelAsset';
import { CarExhaust } from './CarExhaust';
import type { CarMotion } from './carPhysics';

export interface CarVisualProps {
  modelId?: CarModelId;
  motion?: RefObject<CarMotion>;
  active?: boolean;
  reducedMotion?: boolean;
}
export function CarVisual({ modelId = 'admin', motion, active = false, reducedMotion = false }: CarVisualProps) {
  const model = CAR_MODELS.find(candidate => candidate.id === modelId) ?? CAR_MODELS[0];
  return <group>
    <ModelAsset key={model.id} url={model.url} length={3.8} rotationY={model.rotationY} name={`car-${model.id}`} carModel={model.id} carMotion={motion}/>
    {motion && <CarExhaust motion={motion} active={active} reducedMotion={reducedMotion} position={[.5,.32,model.id === 'admin' ? -1.5 : -1.9]}/>}
  </group>;
}
