import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Sprite, SpriteMaterial } from 'three';
import { COLLECT_VALUE } from './collectState';
import type { CollectKind } from './types';

export const BURST_SECONDS = .45;
export interface Burst { id: string; kind: CollectKind; x: number; y: number; z: number; born: number }

/** Scale, rise and opacity for a burst of the given age, or null once it is spent. */
export function burstStep(age: number): { scale: number; rise: number; opacity: number } | null {
  if (age < 0 || age > BURST_SECONDS) return null;
  const t = age / BURST_SECONDS;
  return { scale: 1 + t * .6, rise: t * 1.1, opacity: 1 - t * t };
}

/** One "+1" texture per distinct value, drawn once and shared by every burst. */
function labelTexture(value: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.strokeStyle = 'rgba(30,26,12,.85)';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(`+${value}`, 64, 32);
  ctx.fillText(`+${value}`, 64, 32);
  return new CanvasTexture(canvas);
}

export function PickupBurst({ bursts }: { bursts: readonly Burst[] }) {
  const sprites = useRef<Map<string, Sprite>>(new Map());
  const materials = useMemo(() => {
    const byValue = new Map<number, SpriteMaterial>();
    for (const value of new Set(Object.values(COLLECT_VALUE))) {
      byValue.set(value, new SpriteMaterial({ map: labelTexture(value), transparent: true, depthTest: false }));
    }
    return byValue;
  }, []);
  useFrame(({ clock }) => {
    for (const burst of bursts) {
      const sprite = sprites.current.get(burst.id);
      if (!sprite) continue;
      const step = burstStep(clock.elapsedTime - burst.born);
      if (!step) { sprite.visible = false; continue; }
      sprite.visible = true;
      sprite.position.set(burst.x, burst.y + step.rise, burst.z);
      sprite.scale.setScalar(step.scale);
      (sprite.material as SpriteMaterial).opacity = step.opacity;
    }
  });
  return <group>
    {bursts.map(burst => <sprite
      key={burst.id}
      ref={node => { if (node) sprites.current.set(burst.id, node); else sprites.current.delete(burst.id); }}
      material={materials.get(COLLECT_VALUE[burst.kind])}
      position={[burst.x, burst.y, burst.z]}
    />)}
  </group>;
}
