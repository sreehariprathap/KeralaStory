import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { PlayerSnapshot, Vec3 } from '../../contracts';
import { NPC_DEFINITIONS, type NpcId } from './npcDefinitions';
import { createNpcState, tickNpcWander, isPlayerInRange, rollCoinEffect, scareAway, type NpcRuntimeState } from './npcState';
import { NpcCharacter } from './NpcCharacter';

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Props {
  playerRef: RefObject<PlayerSnapshot>;
  onCoinEffect: (npcId: NpcId, coinsDelta: number) => void;
  onPositionsChange: (positions: Record<NpcId, Vec3>) => void;
  onProximity: (npcId: NpcId | null) => void;
}

export function Npcs({ playerRef, onCoinEffect, onPositionsChange, onProximity }: Props) {
  const rng = useMemo(() => seededRng(Date.now() >>> 0), []);
  const states = useRef<Record<NpcId, NpcRuntimeState>>({
    luttappi: createNpcState(NPC_DEFINITIONS.luttappi, 0, 101),
    mayavi: createNpcState(NPC_DEFINITIONS.mayavi, 0, 202),
  });
  const positionsThrottle = useRef(0);

  useFrame((_, delta) => {
    const now = performance.now();
    const dtMs = delta * 1000;
    const player = playerRef.current;
    let luttappi = tickNpcWander(states.current.luttappi, NPC_DEFINITIONS.luttappi, dtMs, rng);
    let mayavi = tickNpcWander(states.current.mayavi, NPC_DEFINITIONS.mayavi, dtMs, rng);

    if (Math.hypot(luttappi.position[0] - mayavi.position[0], luttappi.position[2] - mayavi.position[2]) <= NPC_DEFINITIONS.luttappi.scareRadiusM
      && player && isPlayerInRange(luttappi, NPC_DEFINITIONS.luttappi, player.position)) {
      luttappi = scareAway(luttappi, NPC_DEFINITIONS.luttappi, mayavi.position, rng);
    }

    let inRangeId: NpcId | null = null;
    if (player) {
      for (const [id, state, def] of [['luttappi', luttappi, NPC_DEFINITIONS.luttappi], ['mayavi', mayavi, NPC_DEFINITIONS.mayavi]] as const) {
        if (isPlayerInRange(state, def, player.position)) {
          inRangeId = id;
          const rolled = rollCoinEffect(state, def, now, rng);
          if (rolled) {
            if (id === 'luttappi') luttappi = rolled.state; else mayavi = rolled.state;
            if (rolled.coinsDelta !== 0) onCoinEffect(id, rolled.coinsDelta);
          }
        }
      }
    }
    onProximity(inRangeId);

    states.current = { luttappi, mayavi };
    positionsThrottle.current += dtMs;
    if (positionsThrottle.current >= 150) {
      positionsThrottle.current = 0;
      onPositionsChange({ luttappi: luttappi.position, mayavi: mayavi.position });
    }
  });

  return <><NpcCharacter definition={NPC_DEFINITIONS.luttappi} position={states.current.luttappi.position}/><NpcCharacter definition={NPC_DEFINITIONS.mayavi} position={states.current.mayavi.position}/></>;
}
