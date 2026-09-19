import type { PolygonXZ } from '../../contracts/worldExpansion';
import { pointInPolygon } from './expansionLayout';

/**
 * Sneha Theeram: the curved beach between Kodaly's headland and the Chalakkudy River mouth.
 * Pure data, no terrain imports, so the ground profile can shape itself from it without a cycle.
 * Coordinates are world metres; the coast only applies west of the original world edge (x < -78).
 */
export const SNEHA_THEERAM = {
  id: 'sneha-theeram',
  label: 'Sneha Theeram',
  /** Beyond this the old world owns the coast (Kodaly's harbor and the eastern sea). */
  eastEdgeX: -78,
  /** Metres of pale, dry sand inland of the waterline before the grass takes over. */
  sandWidthM: 42,
  /** Where the beach landmark and its arch stand, inland of the widest stretch of sand. */
  landmark: [-168, 168] as const,
} as const;

type XZ = [number, number];

/** Foot of Kodaly's headland, where the bay's shore rises as a bluff rather than a beach. */
export const SNEHA_HEADLAND = [-84, 112] as const;

/** Waterline control points from Kodaly's rocky headland, round the bay, to the river mouth and on west. */
const CONTROL: readonly XZ[] = [
  [-78, 91], [-82, 112], [-90, 136], [-108, 160], [-136, 181], [-176, 198], [-226, 209], [-282, 216], [-330, 221], [-372, 222], [-2400, 222],
];

/** Chaikin corner cutting keeps both ends fixed and turns the control polygon into a soft, even curve. */
function chaikin(points: readonly XZ[], rounds: number): XZ[] {
  let result = [...points];
  for (let r = 0; r < rounds; r++) {
    const next: XZ[] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const [ax, az] = result[i], [bx, bz] = result[i + 1];
      next.push([ax * .75 + bx * .25, az * .75 + bz * .25], [ax * .25 + bx * .75, az * .25 + bz * .75]);
    }
    next.push(result.at(-1)!);
    result = next;
  }
  return result;
}

/** The waterline, ordered from the headland (east) to the far west. */
export const SNEHA_SHORELINE: readonly XZ[] = chaikin(CONTROL, 4);

/** Open sea south of the waterline and west of the old world edge; closed far beyond every map bound. */
export const SNEHA_SEA_POLYGON: PolygonXZ = [...SNEHA_SHORELINE, [-2400, 2400], [SNEHA_THEERAM.eastEdgeX, 2400]];

const cell = 40;
const segments = new Map<string, number[]>();
for (let i = 1; i < SNEHA_SHORELINE.length; i++) {
  const [ax, az] = SNEHA_SHORELINE[i - 1], [bx, bz] = SNEHA_SHORELINE[i], pad = 90;
  for (let x = Math.floor((Math.min(ax, bx) - pad) / cell); x <= Math.floor((Math.max(ax, bx) + pad) / cell); x++)
    for (let z = Math.floor((Math.min(az, bz) - pad) / cell); z <= Math.floor((Math.max(az, bz) + pad) / cell); z++) {
      const key = `${x},${z}`, list = segments.get(key) ?? [];
      list.push(i);
      segments.set(key, list);
    }
}

/** True in open sea off Sneha Theeram (x ≤ -78 only: the terrain's last column belongs to the coast too). */
export function isSnehaSea(x: number, z: number): boolean {
  return x <= SNEHA_THEERAM.eastEdgeX && pointInPolygon(x, z, SNEHA_SEA_POLYGON);
}

/**
 * Signed metres from the waterline: positive inland, negative out to sea. Null east of the old
 * world edge or further than ~90 m from the shore, where the coast has no say in the ground.
 */
export function coastDistance(x: number, z: number): number | null {
  if (x > SNEHA_THEERAM.eastEdgeX) return null;
  let best = Infinity;
  for (const i of segments.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
    const [ax, az] = SNEHA_SHORELINE[i - 1], [bx, bz] = SNEHA_SHORELINE[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  if (!Number.isFinite(best)) return null;
  return isSnehaSea(x, z) ? -best : best;
}

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

/** How sandy the ground is (0 grass, 1 beach). Only the low bay is sand: the steep headland stays green. */
export function beachSand(x: number, z: number, groundY: number): number {
  const d = coastDistance(x, z);
  if (d === null) return 0;
  return (1 - smooth((d - SNEHA_THEERAM.sandWidthM) / 12)) * (1 - smooth((groundY - 14) / 5));
}

/** A point on the waterline `along` metres from the headland, with its inland unit normal. */
export function shorePoint(along: number): { x: number; z: number; nx: number; nz: number } {
  let remaining = Math.max(0, along);
  for (let i = 1; i < SNEHA_SHORELINE.length; i++) {
    const [ax, az] = SNEHA_SHORELINE[i - 1], [bx, bz] = SNEHA_SHORELINE[i], length = Math.hypot(bx - ax, bz - az);
    if (remaining <= length || i === SNEHA_SHORELINE.length - 1) {
      const t = Math.min(1, remaining / (length || 1)), ux = (bx - ax) / (length || 1), uz = (bz - az) / (length || 1);
      // Walking from the headland round the bay, land lies to the left: (-uz, ux) points inland.
      return { x: ax + ux * length * t, z: az + uz * length * t, nx: -uz, nz: ux };
    }
    remaining -= length;
  }
  const [x, z] = SNEHA_SHORELINE.at(-1)!;
  return { x, z, nx: 0, nz: -1 };
}

/** The sandy crescent: from the foot of the headland to just short of the river mouth (metres along the shore). */
export const SNEHA_BEACH_SPAN = { from: 70, to: 300 } as const;
