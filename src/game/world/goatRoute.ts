import { STADIUM } from '../../content/world/stadiumLayout';

/**
 * The stadium goat's loop, in pitch space (u across, v along, y above the levelled pad; `ground` means "on the terrain").
 * It wanders the forecourt outside the west gate, slips round the end of the west stand and climbs its terraces.
 * It never steps onto the pitch or its run-off (|u| ≤ halfWidth + runoff).
 */
export interface GoatStop { u: number; v: number; y: number | 'ground'; /** Seconds spent grazing or looking about here. */ pause: number }

/** West stand terraces (see Stand in Stadium.tsx): tier tops at 0.6, 1.2 and 1.8 m, from the pitch side outward. */
const TIER_U = [-26.67, -28, -29.33], TIER_Y = [.6, 1.2, 1.8];

export const GOAT_LOOP: readonly GoatStop[] = [
  { u: -36, v: 2, y: 'ground', pause: 3 },
  { u: -38, v: 9, y: 'ground', pause: 2.5 },
  { u: -34, v: 14, y: 'ground', pause: 1 },
  // Round the north end of the stand's back wall, then up the terraces from its open end.
  { u: -31.5, v: 29, y: 'ground', pause: 0 },
  { u: TIER_U[2], v: 28.6, y: 0, pause: .6 },
  { u: TIER_U[2], v: 26, y: TIER_Y[2], pause: 2 },
  { u: TIER_U[2], v: 18, y: TIER_Y[2], pause: 3 },
  { u: TIER_U[1], v: 13, y: TIER_Y[1], pause: 1.5 },
  { u: TIER_U[1], v: 8, y: TIER_Y[1], pause: 2.5 },
  { u: TIER_U[2], v: 11, y: TIER_Y[2], pause: 1 },
  { u: TIER_U[2], v: 26, y: TIER_Y[2], pause: 1 },
  { u: TIER_U[2], v: 28.6, y: 0, pause: 0 },
  { u: -31.5, v: 29, y: 'ground', pause: 0 },
  { u: -34, v: 18, y: 'ground', pause: 1.5 },
  { u: -40, v: -2, y: 'ground', pause: 3 },
  { u: -37, v: -14, y: 'ground', pause: 2 },
];

export const GOAT_SPEED = .75;
/** Terrace edges are climbed as quick hops. */
export const GOAT_HOP_HEIGHT = .35;

/** True when a pitch-space point is on the pitch or its run-off, where the goat must never go. */
export function isOnPlayingArea(u: number, v: number): boolean {
  return Math.abs(u) <= STADIUM.pitch.halfWidth + STADIUM.runoff && Math.abs(v) <= STADIUM.pitch.halfLength + STADIUM.runoff;
}
