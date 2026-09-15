import type { RefObject } from 'react';
import { CAR_MODELS, type CarModelId } from '../../content/assets/models';
import { ModelAsset } from '../render/ModelAsset';

export function CarVisual({ modelId = 'admin' }: { modelId?: CarModelId; motion?: RefObject<{ signedSpeed?: number }> }) {
  const model = CAR_MODELS.find(candidate => candidate.id === modelId) ?? CAR_MODELS[0];
  return <ModelAsset key={model.id} url={model.url} length={3.8} rotationY={model.rotationY} name={`car-${model.id}`}/>;
}
