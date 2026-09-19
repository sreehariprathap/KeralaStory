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
  apron: { xMin: -760, xMax: -590, zMin: 118, zMax: 146 },
  /** Two link taxiways from the apron's south edge to the runway. */
  taxiways: [-740, -610],
  /** Terminal faces north onto the forecourt road; its airside glass looks over the apron. */
  terminal: { x: -680, z: 106, width: 78, depth: 18 } as AirportLot,
  tower: { x: -776, z: 108 },
  hangar: { x: -520, z: 116, width: 44, depth: 30 } as AirportLot,
  carPark: { x: -744, z: 98, width: 32, depth: 20 } as AirportLot,
  /** Parking stands on the apron, in front of the terminal's jet bridges. */
  stands: [-730, -680, -630],
  /** Where visitors arrive: the forecourt turning circle at the end of Airport Road. */
  forecourt: [-718, 78] as const,
} as const;
