import { QueryFilterFlags, Ray, ShapeType, type World } from '@dimforge/rapier3d-compat';
import { SPAWN, V2_LAYOUT, terrainHeight } from '../../content/world/definition';

/** Height of bare terrain straight below, or null if a building, deck, trunk or nothing is hit first. */
export function bareGroundHeight(world: World, x: number, z: number): number | null {
  const top = terrainHeight(x, z) + 30;
  const hit = world.castRay(new Ray({ x, y: top, z }, { x: 0, y: -1, z: 0 }), 70, true, QueryFilterFlags.EXCLUDE_SENSORS | QueryFilterFlags.ONLY_FIXED);
  // Every terrain chunk is a triangle mesh; every structure is a box or cylinder.
  if (!hit || hit.collider.shapeType() !== ShapeType.TriMesh) return null;
  return top - hit.timeOfImpact;
}

/** True once both the original and the V2 terrain colliders answer rays. */
export function terrainCollidersReady(world: World) {
  // Road ribbons have no colliders of their own, so a V2 road point is always bare expansion terrain.
  const v2Ground = V2_LAYOUT.roads[0].points[1];
  return bareGroundHeight(world, SPAWN[0], SPAWN[2]) !== null && bareGroundHeight(world, v2Ground[0], v2Ground[2]) !== null;
}
