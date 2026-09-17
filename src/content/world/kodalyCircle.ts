/**
 * Kodaly Banyan circle: a roundabout at the heart of Kodaly, where the city road meets two new
 * avenues. The Kodaly Banyan grows on the central island and its canopy shelters a green modern town.
 * Pure data: staticArchitecture (shared with the server) imports the solid boxes from here.
 */
import { terrainHeight } from './definition';

type V3 = [number, number, number];
export interface CityBox { id: string; position: V3; size: V3; rotation: V3 }

export const KODALY_CIRCLE = {
  id: 'kodaly-banyan-circle',
  label: 'Kodaly Banyan',
  /** On CITY_PATH, beside the historic Kodaly centre. */
  center: { x: 28, z: -18 },
  /** Raised grass island; the banyan's surface roots stay inside it. */
  islandRadius: 16,
  /** Two-lane carriageway around the island. */
  roadOuter: 23,
  /** Paved footpath ring outside the carriageway. */
  walkOuter: 26,
  /** Island lift above the terrain: lower than the character autostep. */
  islandLift: .14,
  tree: {
    url: '/assets/trees/mystical-x-tree-vi.glb',
    /** Metres. Taller than any tree on record: this is the biggest tree in the world. */
    height: 36,
    /** Trunk centre in the model, as a fraction of its height, measured from the bounding-box centre. */
    trunkOffset: { x: .01, z: -.05 },
    /** Buried a little so the root flare meets the sloping island. */
    sink: .5,
    /** Solid trunk: an octagon of this inradius (m), up to where the crown begins. */
    trunkRadius: 3.25,
    trunkHeight: 13.5,
  },
  /** East and west avenues complete the four-way circle. Straight lines at the circle's z. */
  avenues: [
    { id: 'east', from: 23, to: 76 },
    { id: 'west', from: -23, to: -37 },
  ],
  avenueHalfWidth: 3.5,
  avenueWalk: 2.5,
} as const;

/** Heritage shops that stood where the circle is now, moved to face the new avenues. */
export const KODALY_AVENUE_SHOPS = [
  { x: 60, z: -31, english: 'SREEKRISHNA STORES', malayalam: 'ശ്രീകൃഷ്ണ സ്റ്റോഴ്സ്', color: '#d8cea7', width: 8 },
  { x: 71, z: -31, english: 'ROYAL BAKERY', malayalam: 'റോയൽ ബേക്കറി', color: '#d1b879', width: 8 },
  { x: 0, z: -31, english: 'VIDYA BOOKS', malayalam: 'വിദ്യ ബുക്സ്', color: '#a7bdaf', width: 6 },
] as const;

export interface GreenBuilding { id: string; x: number; z: number; width: number; depth: number; floors: number; glass: string; accent: string }
/** Mid-rise buildings sit under the canopy; the two towers stand beyond its reach. */
export const KODALY_BUILDINGS: readonly GreenBuilding[] = [
  { id: 'nw-terraces', x: 4, z: -46, width: 8, depth: 10, floors: 6, glass: '#7fb0bf', accent: '#e9e4d6' },
  { id: 'ne-court', x: 49, z: -49, width: 12, depth: 10, floors: 7, glass: '#86b9b0', accent: '#efe8d8' },
  { id: 'ne-tower', x: 68, z: -48, width: 10, depth: 10, floors: 14, glass: '#6f9fb8', accent: '#f2efe6' },
  { id: 'se-house', x: 64, z: 2, width: 10, depth: 12, floors: 7, glass: '#8fb8c4', accent: '#e6dfcf' },
  { id: 'sw-house', x: -1, z: 3, width: 10, depth: 10, floors: 6, glass: '#80aeb5', accent: '#ece6d5' },
  { id: 'south-tower', x: 20, z: 37, width: 12, depth: 12, floors: 16, glass: '#729fb4', accent: '#f4f1ea' },
  { id: 'se-studio', x: 40, z: 18, width: 7, depth: 7, floors: 5, glass: '#93bcb9', accent: '#e8e1d0' },
];

export const FLOOR_HEIGHT = 3.5;
export const LOBBY_HEIGHT = 4.5;

/** Terrain under a footprint: lowest and highest sampled height. */
export function footprintHeights(x: number, z: number, width: number, depth: number) {
  let min = Infinity, max = -Infinity;
  for (const fx of [-.5, 0, .5]) for (const fz of [-.5, 0, .5]) {
    const y = terrainHeight(x + fx * width, z + fz * depth);
    min = Math.min(min, y); max = Math.max(max, y);
  }
  return { min, max };
}

export function buildingFrame(b: GreenBuilding) {
  const { min, max } = footprintHeights(b.x, b.z, b.width, b.depth);
  const base = min - .6, floor = max + .15, top = floor + LOBBY_HEIGHT + (b.floors - 1) * FLOOR_HEIGHT;
  return { base, floor, top };
}

/** Solid boxes: trunk octagon and each building's body. Shared by rendering and the server. */
export function kodalyCircleBoxes(): CityBox[] {
  const { center, tree } = KODALY_CIRCLE, ground = terrainHeight(center.x, center.z) - 1;
  const trunk = (id: string, yaw: number): CityBox => ({
    id, position: [center.x, ground + (tree.trunkHeight + 1) / 2, center.z],
    size: [tree.trunkRadius * 2, tree.trunkHeight + 1, tree.trunkRadius * 2], rotation: [0, yaw, 0],
  });
  return [
    trunk('kodaly-banyan-trunk-a', 0), trunk('kodaly-banyan-trunk-b', Math.PI / 4),
    ...KODALY_BUILDINGS.map(b => {
      const { base, top } = buildingFrame(b);
      return { id: `kodaly-${b.id}`, position: [b.x, (base + top) / 2, b.z] as V3, size: [b.width, top - base, b.depth] as V3, rotation: [0, 0, 0] as V3 };
    }),
  ];
}

/** Circle, avenues and building plots (plus `margin`): palms and animals keep off them. */
export function isKodalyCityGround(x: number, z: number, margin = 0): boolean {
  const { center, walkOuter, avenues, avenueHalfWidth, avenueWalk } = KODALY_CIRCLE, dx = x - center.x, dz = z - center.z;
  if (Math.hypot(dx, dz) <= walkOuter + margin) return true;
  const half = avenueHalfWidth + avenueWalk + margin;
  if (Math.abs(dz) <= half && avenues.some(a => dx >= Math.min(a.from, a.to) - margin && dx <= Math.max(a.from, a.to) + margin)) return true;
  return KODALY_BUILDINGS.some(b => Math.abs(x - b.x) <= b.width / 2 + margin && Math.abs(z - b.z) <= b.depth / 2 + margin);
}
