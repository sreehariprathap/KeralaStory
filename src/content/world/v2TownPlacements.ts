/**
 * First-street Chalakkudy blockout placements.
 *
 * These offsets are relative to the canonical V2_LAYOUT Chalakkudy town
 * center. They describe a prototype street frontage, not the complete Tier A
 * town dressing pass.
 */
export interface TownBuildingPlacement {
  id: string;
  townId: 'chalakkudy';
  kind: 'coffee' | 'shop' | 'house';
  offsetXZ: readonly [number, number];
  width: number;
  depth: number;
  height: number;
  yaw: number;
  label: string;
  wallColor: string;
}

export const CHALAKKUDY_BUILDINGS: readonly TownBuildingPlacement[] = [
  {
    id: 'chalakkudy-coffee',
    townId: 'chalakkudy',
    kind: 'coffee',
    offsetXZ: [-42, 40],
    width: 10,
    depth: 10,
    height: 5.6,
    yaw: Math.PI,
    label: 'Chalakkudy Coffee',
    wallColor: '#F4E8CC',
  },
  {
    id: 'chalakkudy-town-tea-shop',
    townId: 'chalakkudy',
    kind: 'shop',
    offsetXZ: [-84, 40],
    width: 9,
    depth: 8,
    height: 3.2,
    yaw: Math.PI,
    label: 'Town Tea Shop',
    wallColor: '#E7D7B2',
  },
  {
    id: 'chalakkudy-provision-store',
    townId: 'chalakkudy',
    kind: 'shop',
    offsetXZ: [-62, 40],
    width: 9,
    depth: 8,
    height: 3.2,
    yaw: Math.PI,
    label: 'Provision Store',
    wallColor: '#82A952',
  },
  {
    id: 'chalakkudy-bakery',
    townId: 'chalakkudy',
    kind: 'shop',
    offsetXZ: [-20, 40],
    width: 9,
    depth: 8,
    height: 3.2,
    yaw: Math.PI,
    label: 'Bakery',
    wallColor: '#C8A96B',
  },
  {
    id: 'chalakkudy-house-west',
    townId: 'chalakkudy',
    kind: 'house',
    offsetXZ: [-70, -22],
    width: 10,
    depth: 9,
    height: 3.2,
    yaw: 0,
    label: '',
    wallColor: '#F4E8CC',
  },
  {
    id: 'chalakkudy-house-east',
    townId: 'chalakkudy',
    kind: 'house',
    offsetXZ: [-45, -24],
    width: 10,
    depth: 9,
    height: 3.2,
    yaw: 0,
    label: '',
    wallColor: '#F4E8CC',
  },
] as const;
