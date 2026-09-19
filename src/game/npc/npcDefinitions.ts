import type { ZoneId } from '../../contracts';

export type NpcId = 'luttappi' | 'mayavi';

export interface NpcDefinition {
  id: NpcId;
  name: string;
  disposition: 'mischievous' | 'kind';
  skin: string;
  cloth: string;
  horn: string;
  zoneIds: ZoneId[];
  proximityRadiusM: number;
  scareRadiusM: number;
  effectIntervalMs: number;
  effectChance: number;
  minCoinDelta: number;
  maxCoinDelta: number;
}

export const NPC_DEFINITIONS: Record<NpcId, NpcDefinition> = {
  luttappi: {
    id: 'luttappi', name: 'Luttappi', disposition: 'mischievous',
    skin: '#c9622f', cloth: '#4c8a55', horn: '#2b2117',
    zoneIds: ['kodassery', 'kadambode', 'kurumali', 'kodaly'],
    proximityRadiusM: 4, scareRadiusM: 12,
    effectIntervalMs: 8000, effectChance: 0.35,
    minCoinDelta: -2, maxCoinDelta: -1,
  },
  mayavi: {
    id: 'mayavi', name: 'Mayavi', disposition: 'kind',
    skin: '#e0b27a', cloth: '#d7a92a', horn: '#1c1a17',
    zoneIds: ['kodassery', 'kadambode', 'kurumali', 'kodaly'],
    proximityRadiusM: 4, scareRadiusM: 12,
    effectIntervalMs: 12000, effectChance: 0.3,
    minCoinDelta: 1, maxCoinDelta: 3,
  },
};
