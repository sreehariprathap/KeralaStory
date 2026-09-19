/**
 * Malakkappara hill town: pure plan data, no imports, so terrain levelling and scenery rules can read
 * it without a cycle. World metres; the town pad is levelled to the site's centre height (82 m).
 *
 * The main road climbs in from the south (x ≈ −552…−555) and turns east onto the dam road (z ≈ −695);
 * Market Road leaves it west at z = −668. Shops line both sides of all three; the bus stand, tea stop
 * and Hotel High Range fill the block inside the bend; houses fill the west and north quarters and
 * climb the north slope in terraces up to Misty Hills Resort beside the dam road.
 */

/** Where the pad stands above lower ground it drops over this short blend, faced by a dry-stone wall. */
export const MALAKKAPPARA_FILL_BLEND_M = 3.5;
/** The levelled town pad (the site footprint in v2Layout). */
export const MALAKKAPPARA_PAD = { xMin: -615, xMax: -495, zMin: -755, zMax: -625 } as const;

export type LotKind = 'shop' | 'house' | 'hotel' | 'resort-cottage' | 'resort-reception' | 'tea-stop' | 'bus-shelter';
/**
 * One building. `width` runs along its front, `depth` from front to back; `yaw` is the heading its
 * front faces (0 = +z, π/2 = +x).
 */
export interface TownLot {
  id: string; kind: LotKind; x: number; z: number; width: number; depth: number; yaw: number;
  floors: 1 | 2 | 3; wall: string; roof: 'flat' | 'tile' | 'sheet'; label?: string; accent?: string;
}

const FACE_E = Math.PI / 2, FACE_W = -Math.PI / 2, FACE_S = 0, FACE_N = Math.PI;
export const WALLS = ['#f2c230', '#e8772e', '#b5d334', '#e98aa8', '#7fc3e8', '#f1e6c8', '#c9d6b0', '#f4d9a6', '#d9e7ef'] as const;
const ACCENTS = ['#1f6f4a', '#b3261e', '#1d4e89', '#6b2d8c', '#e36414', '#0f7c7c'] as const;
const pick = <T,>(list: readonly T[], n: number) => list[((n % list.length) + list.length) % list.length];
/** The main road's centreline x through town (it drifts west from −552 at the pad edge to −555 at the bend). */
const mainRoadX = (z: number) => -552 - 3 * (-625 - z) / 55;
/** Shop lots stand 9.75 m off a road's centre: 2.75 m half-carriageway, 2.5 m footpath, 4.5 m half-depth. */
const SETBACK = 9.75;

type ShopRow = { prefix: string; labels: readonly string[]; at: readonly number[]; fixed: number | ((at: number) => number); axis: 'x' | 'z'; yaw: number; width: number; depth: number };
const shopRow = (row: ShopRow, seed: number): TownLot[] => row.labels.map((label, i) => ({
  id: `${row.prefix}-${i + 1}`, kind: 'shop', label, accent: pick(ACCENTS, seed + i * 5),
  ...(() => { const across = typeof row.fixed === 'number' ? row.fixed : row.fixed(row.at[i]); return row.axis === 'z' ? { x: across, z: row.at[i] } : { x: row.at[i], z: across }; })(),
  width: row.width, depth: row.depth, yaw: row.yaw,
  floors: (seed + i) % 3 === 0 ? 3 : 2, wall: pick(WALLS, seed + i * 4), roof: (seed + i) % 2 ? 'flat' : 'tile',
}));

const house = (id: string, x: number, z: number, yaw: number, n: number, width = 8, depth = 7, floors: 1 | 2 = 2): TownLot =>
  ({ id, kind: 'house', x, z, width, depth, yaw, floors, wall: pick(WALLS, n * 7 + 3), roof: n % 3 === 1 ? 'flat' : n % 3 === 2 ? 'sheet' : 'tile' });

export const MALAKKAPPARA_LOTS: readonly TownLot[] = [
  // Main road bazaar, both sides of the level street into town.
  ...shopRow({ prefix: 'mk-main-west', labels: ['Hill Top Bakery', 'Nilgiri Tea & Spices', 'Homemade Chocolates', 'Sree Krishna Textiles'], at: [-632, -641, -650, -659], fixed: z => mainRoadX(z) - SETBACK, axis: 'z', yaw: FACE_E, width: 8.6, depth: 9 }, 1),
  ...shopRow({ prefix: 'mk-main-east', labels: ['Malabar Medicals', 'STD · ISD · Xerox'], at: [-650, -659], fixed: z => mainRoadX(z) + SETBACK, axis: 'z', yaw: FACE_W, width: 8.6, depth: 9 }, 4),
  // Dam road bazaar, both sides of the street out of town.
  ...shopRow({ prefix: 'mk-dam-north', labels: ['Indian Coffee House', 'Cardamom Stores', 'Kerala Handicrafts', 'Fancy Store'], at: [-527, -518, -509, -500], fixed: -704.5, axis: 'x', yaw: FACE_S, width: 8.4, depth: 9 }, 7),
  ...shopRow({ prefix: 'mk-dam-south', labels: ['Saravana Bhavan', 'Fruits & Vegetables', 'Mobile Recharge', 'Royal Tailors'], at: [-527, -518, -509, -500], fixed: -684, axis: 'x', yaw: FACE_N, width: 8.4, depth: 9 }, 2),
  // Market Road, west from the main road towards the river.
  ...shopRow({ prefix: 'mk-market-north', labels: ['Spice Garden', 'Lucky Bakery', 'Anil Photo Studio', 'Hardwares'], at: [-566, -575, -584, -593], fixed: -677.5, axis: 'x', yaw: FACE_N, width: 8.6, depth: 9 }, 5),
  ...shopRow({ prefix: 'mk-market-south', labels: ['Kerala Sweets', 'Toys & Gifts', 'Ration Shop', 'Book Stall'], at: [-575, -584, -593, -602], fixed: -658.5, axis: 'x', yaw: FACE_S, width: 8.6, depth: 9 }, 3),
  // Inside the bend: the bus stand shelter, the tea stop facing it, and Hotel High Range.
  { id: 'mk-bus-shelter', kind: 'bus-shelter', x: -540, z: -636, width: 12, depth: 3.5, yaw: FACE_W, floors: 1, wall: '#d9d4c8', roof: 'sheet', label: 'Malakkappara Bus Stand · മലക്കപ്പാറ ബസ് സ്റ്റാൻഡ്', accent: '#b3261e' },
  { id: 'mk-tea-stop', kind: 'tea-stop', x: -532, z: -642, width: 9, depth: 7, yaw: FACE_W, floors: 1, wall: '#e7d7b2', roof: 'tile', label: 'Malakkappara Tea Stop', accent: '#1f6f4a' },
  { id: 'mk-hotel-high-range', kind: 'hotel', x: -512, z: -652, width: 16, depth: 12, yaw: FACE_W, floors: 3, wall: '#f1e6c8', roof: 'flat', label: 'Hotel High Range', accent: '#1d4e89' },
  { id: 'mk-tea-county-inn', kind: 'hotel', x: -575, z: -718, width: 16, depth: 12, yaw: FACE_S, floors: 3, wall: '#f2c230', roof: 'tile', label: 'Tea County Inn', accent: '#b3261e' },
  // West quarter, behind the main road's shops.
  house('mk-west-house-1', -583, -634, FACE_E, 1), house('mk-west-house-2', -598, -634, FACE_E, 2),
  house('mk-west-house-3', -583, -645, FACE_E, 3), house('mk-west-house-4', -598, -645, FACE_E, 4),
  // North-west quarter, round Tea County Inn.
  house('mk-nw-house-1', -603, -712, FACE_E, 5), house('mk-nw-house-2', -603, -726, FACE_E, 6),
  house('mk-nw-house-3', -603, -740, FACE_E, 7), house('mk-nw-house-4', -585, -738, FACE_S, 8), house('mk-nw-house-5', -569, -738, FACE_S, 9),
  house('mk-nw-house-6', -554, -722, FACE_S, 10), house('mk-nw-house-7', -554, -738, FACE_S, 11),
  // Behind the dam road's north shops.
  house('mk-n-house-1', -536, -722, FACE_S, 12), house('mk-n-house-2', -523, -722, FACE_S, 13), house('mk-n-house-3', -510, -722, FACE_S, 14),
  house('mk-n-house-4', -536, -736, FACE_S, 15), house('mk-n-house-5', -521, -736, FACE_S, 16), house('mk-n-house-6', -506, -736, FACE_S, 17),
  // Hillside terraces climbing the north slope, fronts to the valley.
  // Each terrace steps a little in and out, and the houses vary in width, so the slope never reads as a grid.
  ...[-598, -588, -578, -568, -558, -548, -538, -528].map((x, i) => house(`mk-hill-a-${i + 1}`, x + [0, .6, -.4, .3, -.6, .5, 0, -.3][i], -750 + [0, -.8, .5, -.4, .7, -.6, .3, .6][i], FACE_S, 20 + i, [8, 7, 8.4, 7.2, 8, 7.6, 7, 8.2][i], 6)),
  ...[-593, -583, -573, -563, -553, -543, -533].map((x, i) => house(`mk-hill-b-${i + 1}`, x + [.4, -.5, .2, -.3, .6, -.2, .3][i], -759.5 + [.6, -.5, .3, .8, -.4, .5, -.6][i], FACE_S, 30 + i, [7.4, 8.2, 7, 8, 7.6, 7.2, 8.4][i], 6)),
  ...[-548, -538, -528].map((x, i) => house(`mk-hill-c-${i + 1}`, x + [.3, -.4, .5][i], -768.5 + [-.4, .5, 0][i], FACE_S, 40 + i, [7.6, 8, 7.2][i], 6)),
  // Misty Hills Resort on the hilltop beside the dam road: cottages over the town, reception by the road.
  ...[-598, -589, -580, -571].map((x, i): TownLot => ({ id: `mk-resort-cottage-${i + 1}`, kind: 'resort-cottage', x, z: -773.5, width: 6, depth: 5, yaw: FACE_S, floors: 1, wall: pick(['#f1e6c8', '#d9e7ef', '#f4d9a6'], i), roof: 'tile' })),
  { id: 'mk-resort-reception', kind: 'resort-reception', x: -560, z: -773.5, width: 8, depth: 5, yaw: FACE_N, floors: 1, wall: '#f1e6c8', roof: 'tile', label: 'Misty Hills Resort', accent: '#1f6f4a' },
];

/**
 * The west bank across the river: homestays and a resort north of the road, the botanical garden south
 * of it. The district is levelled to 77 m (see the town site's districts in v2Layout).
 */
export const MALAKKAPPARA_WEST_LOTS: readonly TownLot[] = [
  { id: 'mk-riverside-resort', kind: 'hotel', x: -708, z: -693, width: 18, depth: 12, yaw: FACE_E, floors: 2, wall: '#f1e6c8', roof: 'tile', label: 'Riverside Retreat', accent: '#0f7c7c' },
  ...[-724, -733, -742, -751].map((x, i): TownLot => ({ id: `mk-riverside-cottage-${i + 1}`, kind: 'resort-cottage', x, z: -694, width: 6, depth: 5, yaw: FACE_S, floors: 1, wall: pick(['#f4d9a6', '#d9e7ef', '#f1e6c8'], i), roof: 'tile' })),
  house('mk-west-bank-house-1', -712, -678, FACE_S, 50), house('mk-west-bank-house-2', -726, -678, FACE_S, 51),
  house('mk-west-bank-house-3', -740, -678, FACE_S, 52), house('mk-west-bank-house-4', -754, -678, FACE_S, 53),
  { id: 'mk-homestay', kind: 'hotel', x: -767, z: -680, width: 12, depth: 10, yaw: FACE_S, floors: 2, wall: '#b5d334', roof: 'tile', label: 'Sky View Homestay', accent: '#1f6f4a' },
];

/** The botanical garden: a small, walled tourist garden south of the west-bank road. */
export const MALAKKAPPARA_GARDEN = {
  id: 'malakkappara-botanical-garden',
  label: 'Malakkappara Botanical Garden · സസ്യോദ്യാനം',
  xMin: -752, xMax: -708, zMin: -662, zMax: -632,
  /** Where the gate opens onto the road (world x). */
  gateX: -730,
} as const;

/** The north slope above the pad where the terraces and the resort stand (x, z polygon). */
export const MALAKKAPPARA_HILLSIDE: readonly (readonly [number, number])[] = [[-612, -779], [-512, -779], [-512, -745], [-612, -745]];

/** Pad edges that stand above lower ground: faced with dry-stone walls wherever the drop is real. */
export const MALAKKAPPARA_WALL_EDGES: readonly { id: string; a: readonly [number, number]; b: readonly [number, number]; out: readonly [number, number] }[] = [
  { id: 'south', a: [-615, -625], b: [-495, -625], out: [0, 1] },
  { id: 'east', a: [-495, -625], b: [-495, -755], out: [1, 0] },
  { id: 'west', a: [-615, -755], b: [-615, -625], out: [-1, 0] },
];

/** The bus bay beside the main road, and where the KSRTC bus stands in it. */
export const MALAKKAPPARA_BUS_BAY = { x: -546, z: -636, length: 18, width: 7, yaw: FACE_N } as const;

/** Every building in the town, both banks. */
export const ALL_LOTS: readonly TownLot[] = [...MALAKKAPPARA_LOTS, ...MALAKKAPPARA_WEST_LOTS];

/** Corners of a lot, in world x/z. */
export function lotCorners(l: Pick<TownLot, 'x' | 'z' | 'width' | 'depth' | 'yaw'>, margin = 0): [number, number][] {
  const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const ax = u * (l.width / 2 + margin), az = v * (l.depth / 2 + margin);
    return [l.x + c * ax + s * az, l.z - s * ax + c * az];
  });
}

const inside = (x: number, z: number, poly: readonly (readonly [number, number])[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};

/** Whether (x, z) is taken by a town building (within `margin` metres) or the hillside quarter. */
export function isMalakkapparaBuilt(x: number, z: number, margin = 1): boolean {
  if (inside(x, z, MALAKKAPPARA_HILLSIDE)) return true;
  const g = MALAKKAPPARA_GARDEN;
  if (x > g.xMin - margin && x < g.xMax + margin && z > g.zMin - margin && z < g.zMax + margin) return true;
  return ALL_LOTS.some(l => Math.hypot(x - l.x, z - l.z) < Math.hypot(l.width, l.depth) / 2 + margin && inside(x, z, lotCorners(l, margin)));
}
