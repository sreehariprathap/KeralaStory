import { CHALAKKUDY_STREET, EXPANSION_GROUND, SAFE_SPAWNS, WORLD_VERSION, hasGroundAt, terrainHeight, walkableDeckHeight, waterLevelAt } from '../../../src/content/world/definition';
import { terrainMeshData } from '../../../src/game/world/traversalGeometry';
import { staticArchitectureBoxes, canopyArchitectureBoxes, mountainArchitectureBoxes, waterfallBarrierBox } from '../../../src/content/world/staticArchitecture';
import { staticForestBoxes } from '../../../src/content/world/staticForest';
import type { Vec3 } from '@kerala-story/protocol';

export interface StaticBox { id: string; position: readonly number[]; size: readonly number[]; rotation: readonly number[] }
export interface StaticMesh { id: string; vertices: readonly number[]; indices: readonly number[] }
export interface SimulationWorldDefinition {
  version: string;
  meshes: readonly StaticMesh[];
  boxes: readonly StaticBox[];
  safeSpawns: readonly { id: string; position: readonly [number, number, number]; headingRad: number }[];
  groundHeight(x: number, z: number): number | null;
  waterHeight(x: number, z: number): number | null;
  collisionGaps: readonly string[];
}
/** Data/geometry helpers only: no rendering module or browser dependency. */
export function createCanonicalWorldDefinition(): SimulationWorldDefinition {
  return {
    version: WORLD_VERSION,
    meshes: [{ ...terrainMeshData('north'), id: 'terrain-north' }, { ...terrainMeshData('south'), id: 'terrain-south' }, ...EXPANSION_GROUND.chunks],
    boxes: [...staticArchitectureBoxes(), ...canopyArchitectureBoxes(), ...mountainArchitectureBoxes(), waterfallBarrierBox(), ...staticForestBoxes(), ...CHALAKKUDY_STREET.boxes],
    safeSpawns: SAFE_SPAWNS,
    groundHeight: (x, z) => {
      const ground = hasGroundAt(x, z) ? terrainHeight(x, z) : null;
      const deck = walkableDeckHeight(x, z);
      return ground === null ? deck : Math.max(ground, deck ?? -Infinity);
    },
    waterHeight: waterLevelAt,
    collisionGaps: [],
  };
}
export const toVector = (position: readonly number[]) => ({ x: position[0], y: position[1], z: position[2] });
export const toTuple = (position: { x: number; y: number; z: number }): Vec3 => [position.x, position.y, position.z];
