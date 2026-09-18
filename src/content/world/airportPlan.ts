import type { Vec3 } from '../../contracts';
import type { PolygonXZ } from '../../contracts/worldExpansion';

/**
 * Nedumbassery Airport on the lowland south-west of Chalakkudy, across the Chalakkudy River.
 * Pure data, no terrain imports: the V2 layout levels the pad from it and the airport kit builds on it.
 * World metres; the runway runs east-west along the pad's southern half.
 */
export const AIRPORT_PAD_Y = 24;

export interface AirportLot { x: number; z: number; width: number; depth: number }

export const NEDUMBASSERY_AIRPORT_PLAN = {
  id: 'nedumbassery-airport' as const,
  label: 'Nedumbassery Airport',
  footprint: [[-800, 92], [-450, 92], [-450, 186], [-800, 186]] as PolygonXZ,
  center: [-625, AIRPORT_PAD_Y, 139] as Vec3,
  /** Asphalt strip, x from `xMin` to `xMax` along z = `z`. */
  runway: { xMin: -785, xMax: -468, z: 166, width: 28 },
  /** Concrete apron in front of the terminal, where the aircraft park. */
  apron: { xMin: -650, xMax: -470, zMin: 118, zMax: 146 },
  /** Two link taxiways from the apron's south edge to the runway. */
  taxiways: [-630, -490],
  /** Terminal faces north onto the forecourt road; its airside glass looks over the apron. */
  terminal: { x: -560, z: 106, width: 78, depth: 18 } as AirportLot,
  tower: { x: -662, z: 108 },
  hangar: { x: -742, z: 116, width: 44, depth: 30 } as AirportLot,
  carPark: { x: -492, z: 106, width: 40, depth: 22 } as AirportLot,
  /** Where visitors arrive: the end of the airport road, on the forecourt kerb. */
  forecourt: [-560, 80] as const,
} as const;
