import type { Vec3 } from '../../contracts';
import { EXPANSION_LAYOUT, V2_LAYOUT, WORLD_BOUNDS, hasGroundAt, terrainHeight } from './definition';
import { headingToward, liftAt, type Thermal } from '../../game/vehicle/gliderMotor';

const summit = EXPANSION_LAYOUT.summitPosition;
const anchor = (id: string) => EXPANSION_LAYOUT.anchors.find(a => a.id === id)!.position;
const junction = anchor('kodassery-junction');

/** Launch faces down the valley toward Kodassery junction. */
const launchHeading = headingToward(summit[0], summit[2], junction[0], junction[2]);
const LAUNCH_OFFSET_M = 4;
const launchX = summit[0] + Math.sin(launchHeading) * LAUNCH_OFFSET_M, launchZ = summit[2] - Math.cos(launchHeading) * LAUNCH_OFFSET_M;

export const GLIDER_LAUNCH: { position: Vec3; radiusM: number; headingRad: number } = {
  position: [launchX, terrainHeight(launchX, launchZ), launchZ],
  radiusM: 4,
  headingRad: launchHeading,
};

export function isInGliderLaunch(x: number, z: number): boolean {
  return Math.hypot(x - GLIDER_LAUNCH.position[0], z - GLIDER_LAUNCH.position[2]) < GLIDER_LAUNCH.radiusM;
}

/** Near the map edge a glider turns back toward this point. */
export const GLIDER_TURN_BACK = { x: (WORLD_BOUNDS.xMin + WORLD_BOUNDS.xMax) / 2, z: (WORLD_BOUNDS.zMin + WORLD_BOUNDS.zMax) / 2 };

/** Players cannot climb higher than this above the summit. */
export const THERMAL_CEILING_ABOVE_SUMMIT = 70;
const thermalAt = (id: string, position: readonly number[]): Thermal => ({
  id, x: position[0], z: position[2], radiusM: 22, liftMps: 4, ceilingY: summit[1] + THERMAL_CEILING_ABOVE_SUMMIT,
});
const summitTrail = EXPANSION_LAYOUT.routes.find(r => r.id === 'summit-trail')!;
const town = (id: string) => V2_LAYOUT.towns.find(t => t.id === id)!.center;

/** A chain of rising air from the summit out to Chokkana, Malakkappara and back toward Kodakara. */
export const THERMALS: readonly Thermal[] = [
  thermalAt('summit-shoulder', summitTrail.points[Math.round((summitTrail.points.length - 1) * .5)]),
  thermalAt('chokkana-ridge', anchor('chokkana-ridge')),
  thermalAt('chokkana-tea-stop', anchor('chokkana-tea-stop')),
  thermalAt('malakkappara', town('malakkappara')),
  thermalAt('kodakara', town('kodakara')),
];

export function thermalLift(x: number, y: number, z: number): number {
  return liftAt(THERMALS, x, y, z);
}

/** A parachute drop opens the glider this far above the highest ground around the player. */
export const PARACHUTE_DROP_CLEARANCE_M = 120;
const DROP_SCAN_RADIUS_M = 80, DROP_SCAN_STEP_M = 10, DROP_SCAN_BEARINGS = 16;

/** Height a parachute drop at (x, z) starts from, clear of the hills nearby. `feetY` covers roofs and decks. */
export function parachuteDropHeight(x: number, z: number, feetY: number): number {
  let top = Math.max(feetY, hasGroundAt(x, z) ? terrainHeight(x, z) : feetY);
  for (let r = DROP_SCAN_STEP_M; r <= DROP_SCAN_RADIUS_M; r += DROP_SCAN_STEP_M) {
    for (let i = 0; i < DROP_SCAN_BEARINGS; i++) {
      const a = i / DROP_SCAN_BEARINGS * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (hasGroundAt(px, pz)) top = Math.max(top, terrainHeight(px, pz));
    }
  }
  return top + PARACHUTE_DROP_CLEARANCE_M;
}
