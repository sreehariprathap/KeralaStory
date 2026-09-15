import type { RefObject } from 'react';
import type { AvatarMotion } from './ExplorerAvatar';
import { CHARACTER_MODELS } from '../../content/assets/models';
import { ModelAsset } from '../render/ModelAsset';

interface ImportedAvatarProps {
  modelId: string;
  motion?: RefObject<AvatarMotion>;
}

/** Runtime character asset selected from the profile model catalog. */
export function ImportedAvatar({ modelId, motion }: ImportedAvatarProps) {
  const model = CHARACTER_MODELS.find((candidate) => candidate.id === modelId);
  if (!model) return null;
  return (
    <ModelAsset
      url={model.url}
      name={model.name}
      height={1.7}
      motion={motion}
      animation={model.rig}
      rotationY={model.rotationY}
    />
  );
}

export type { ImportedAvatarProps };
