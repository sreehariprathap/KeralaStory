import { V2_LAYOUT, terrainHeight } from './definition';
import { waterParkBoxes } from './waterPark';
import type { TraversalBox } from '../../game/world/traversalGeometry';

export type Building = { id: string; x: number; z: number; width: number; depth: number; height: number; wall: string; roof: string; label?: string };

export const TOWN_BUILDINGS: readonly Building[] = [
  { id: 'kodakara-market', x: -250, z: -184, width: 10, depth: 8, height: 3.4, wall: '#e7d7b2', roof: '#a8573d', label: 'Kodakara Market' },
  { id: 'kodakara-bakery', x: -222, z: -184, width: 9, depth: 8, height: 3.2, wall: '#d9bd8a', roof: '#bd7049', label: 'Kodakara Bakery' },
  { id: 'kodakara-house-north', x: -270, z: -228, width: 10, depth: 9, height: 3.1, wall: '#f4e8cc', roof: '#aa573c' },
  { id: 'kodakara-house-south', x: -180, z: -230, width: 10, depth: 9, height: 3.1, wall: '#d5dfb6', roof: '#9d6145' },
  // Chalakkudy's and Malakkappara's placeholder frontage was replaced by their towns (chalakkudyCity.ts, malakkapparaTown.ts).
  { id: 'kodakara-frontage-1', x: -280, z: -175, width: 9, depth: 7, height: 3.2, wall: '#e7d7b2', roof: '#a8573d', label: 'Provision Store' },
  { id: 'kodakara-frontage-2', x: -195, z: -170, width: 9, depth: 7, height: 3.2, wall: '#f4e8cc', roof: '#a8573d', label: 'Bakery' },
  { id: 'kodakara-frontage-3', x: -165, z: -170, width: 9, depth: 7, height: 3.2, wall: '#d5dfb6', roof: '#a8573d', label: 'Textiles' },
  { id: 'kodakara-frontage-4', x: -145, z: -215, width: 9, depth: 7, height: 3.2, wall: '#e7d7b2', roof: '#a8573d', label: 'Bus Shelter' },
  { id: 'kodakara-frontage-5', x: -220, z: -240, width: 9, depth: 7, height: 3.2, wall: '#f4e8cc', roof: '#a8573d', label: 'Stationery' },
  { id: 'kodakara-frontage-6', x: -250, z: -245, width: 9, depth: 7, height: 3.2, wall: '#d5dfb6', roof: '#a8573d', label: 'Tea Stop' },
];

/** Ground the full shell, including corners, rather than floating on its center sample. */
export function buildingGround(b: Building) {
  const heights = [-1, 1].flatMap(dx => [-1, 1].map(dz => terrainHeight(b.x + dx * b.width / 2, b.z + dz * b.depth / 2)));
  return { min: Math.min(...heights), max: Math.max(...heights) };
}

export function parkPoolLayout() {
  const points = V2_LAYOUT.park.poolFootprint;
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minZ = Math.min(...points.map(p => p[1])), maxZ = Math.max(...points.map(p => p[1]));
  const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
  return { x, z, y: terrainHeight(x, z), width: maxX - minX, depth: maxZ - minZ };
}

export function v2DressingBoxes(): TraversalBox[] {
  const boxes: TraversalBox[] = TOWN_BUILDINGS.map(b => { const ground = buildingGround(b); const height = b.height + ground.max - ground.min; return { id: b.id, position: [b.x, ground.min + height / 2, b.z], size: [b.width, height, b.depth], rotation: [0, 0, 0] }; });
  const pool = parkPoolLayout();
  for (const side of [-1, 1]) boxes.push({ id: `park-pool-edge-${side}`, position: [pool.x, pool.y + .42, pool.z + side * (pool.depth / 2 + .7)], size: [pool.width + 2, .7, 1.4], rotation: [0, 0, 0] });
  for (const side of [-1, 1]) boxes.push({ id: `park-pool-end-${side}`, position: [pool.x + side * (pool.width / 2 + .7), pool.y + .42, pool.z], size: [1.4, .7, pool.depth], rotation: [0, 0, 0] });
  // The whole basin remains non-enterable until swimming exists, including jumping over the rim.
  boxes.push({ id: 'park-pool-basin', position: [pool.x, pool.y + 1.4, pool.z], size: [pool.width, 2.8, pool.depth], rotation: [0, 0, 0] });
  boxes.push(...waterParkBoxes());
  const [x, , z] = V2_LAYOUT.park.center;
  // Flush with the access road that crosses it: a kerb here would stop cars dead.
  boxes.push({ id: 'park-forecourt', position: [x, terrainHeight(x, z) - .04, z + 31], size: [48, .12, 10], rotation: [0, 0, 0] });
  return boxes;
}

