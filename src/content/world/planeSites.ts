import type { Vec3 } from '../../contracts';
import { LANDMARKS, PARKING_SPOTS, terrainHeight } from './definition';
import { NEDUMBASSERY_AIRPORT_PLAN } from './airportPlan';

const { runway } = NEDUMBASSERY_AIRPORT_PLAN;
const spawnX = runway.xMin + 18, spawnZ = runway.z;

/** The biplane waits at the west end of Nedumbassery's runway, lined up for an eastward take-off. */
export const PLANE_SPAWN = { x: spawnX, y: terrainHeight(spawnX, spawnZ), z: spawnZ, headingRad: Math.PI / 2 } as const;

/** After a crash the pilot walks away from the nearest of these: every discoverable place and parking bay. */
export const CRASH_CHECKPOINTS: readonly Vec3[] = [...LANDMARKS.map(l => l.position), ...PARKING_SPOTS.map(p => p.position)];

export function checkpointsByDistance(x: number, z: number): Vec3[] {
  return [...CRASH_CHECKPOINTS].sort((a, b) => Math.hypot(a[0] - x, a[2] - z) - Math.hypot(b[0] - x, b[2] - z));
}
