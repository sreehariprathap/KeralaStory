import type { CollectItem, CollectKind, CollectState } from './types';

/** A heart is worth ten coins; a money bundle (spawned by activity rewards) twenty-five. */
export const COLLECT_VALUE: Record<CollectKind, number> = { coin: 1, heart: 10, money: 25 };

const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar day, so the reset lands at the player's own midnight. */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createCollectState(now?: Date): CollectState {
  return { coins: 0, dateKey: todayKey(now), collectedIds: [] };
}

export function isCollected(state: CollectState, id: string): boolean {
  return state.collectedIds.includes(id);
}

/** New day: today's finds are forgotten, the wallet is not. */
export function rollOver(state: CollectState, dateKey: string): CollectState {
  if (state.dateKey === dateKey) return state;
  return { coins: state.coins, dateKey, collectedIds: [] };
}

export function collect(state: CollectState, item: CollectItem): CollectState {
  if (isCollected(state, item.id)) return state;
  return { ...state, coins: state.coins + COLLECT_VALUE[item.kind], collectedIds: [...state.collectedIds, item.id] };
}
