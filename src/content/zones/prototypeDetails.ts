import { terrainHeight } from '../world/definition';

export type GroundDetail = { x: number; z: number; scale?: number; rotation?: number };

/** Prototype-only footprints. Decorative pieces stay inside these small authored plots. */
export const SPICE_GARDEN_BOUNDS = { xMin: -13, xMax: -6, zMin: -230, zMax: -222 } as const;
export const SPICE_SUPPORTS: GroundDetail[] = [
  { x: -12.2, z: -229.1, rotation: 0.08 }, { x: -10.2, z: -229.1, rotation: -0.04 }, { x: -8.1, z: -229.1, rotation: 0.05 },
  { x: -12.2, z: -225.5, rotation: -0.06 }, { x: -10.2, z: -225.5, rotation: 0.03 }, { x: -8.1, z: -225.5, rotation: -0.08 },
];
export const SPICE_VINES: GroundDetail[] = [
  { x: -11.2, z: -228.7, scale: 0.9 }, { x: -9.2, z: -228.7, scale: 1.05 }, { x: -11.2, z: -225.1, scale: 0.85 }, { x: -9.2, z: -225.1, scale: 1.1 },
];
export const CARDAMOM_GROUPS: GroundDetail[] = [
  { x: -12.4, z: -227.4, scale: 0.9 }, { x: -7.4, z: -227.2, scale: 1.1 }, { x: -12.1, z: -223.6, scale: 0.8 }, { x: -7.6, z: -223.8, scale: 1 },
];
export const BANANA_GROUPS: GroundDetail[] = [
  { x: -12.5, z: -222.2, scale: 0.8 }, { x: -7.1, z: -222.2, scale: 0.75 },
];

export const FISHING_DETAILS = [
  { id: 'north-fishing', x: 27, z: -140, facing: -0.35 },
  { id: 'south-fishing', x: -18, z: -66, facing: 2.4 },
] as const;

export function groundY(x: number, z: number): number { return terrainHeight(x, z); }
