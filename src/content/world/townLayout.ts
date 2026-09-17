import type { Vec3 } from '../../contracts';
import type { TerrainChunk } from '../../game/world/expansionTerrain';
import { createTerrainSurface, planFoundation } from '../../game/world/buildingFoundation';
import { CHALAKKUDY_BUILDINGS } from './v2TownPlacements';
import { COFFEE_COLLISION_PROFILE } from '../assets/v2AssetProfiles';

type V3 = [number, number, number];
export interface TownBox { id: string; position: V3; size: V3; rotation: V3; color: string }
export interface TownDeck { center: V3; width: number; depth: number; yaw: number; frontY: number; backY: number }
export function townPoint(origin: Vec3, yaw: number, x: number, y: number, z: number): V3 {
  return [origin[0] + Math.cos(yaw) * x + Math.sin(yaw) * z, origin[1] + y, origin[2] - Math.sin(yaw) * x + Math.cos(yaw) * z];
}

/** Restrict exact triangle clipping to this street, avoiding a second full-world index. */
export function createChalakkudyStreet(center: Vec3, chunk: TerrainChunk) {
  const indices: number[] = [];
  const xmin = center[0] - 100, xmax = center[0] + 5, zmin = center[2] - 40, zmax = center[2] + 55;
  for (let i = 0; i < chunk.indices.length; i += 3) {
    const ids = chunk.indices.slice(i, i + 3), xs = ids.map(id => chunk.vertices[id * 3]), zs = ids.map(id => chunk.vertices[id * 3 + 2]);
    if (Math.max(...xs) >= xmin && Math.min(...xs) <= xmax && Math.max(...zs) >= zmin && Math.min(...zs) <= zmax) indices.push(...ids);
  }
  const surface = createTerrainSurface({ vertices: chunk.vertices, indices });
  const boxes: TownBox[] = [], decks: TownDeck[] = [];
  const buildings = CHALAKKUDY_BUILDINGS.map(item => {
    const x = center[0] + item.offsetXZ[0], z = center[2] + item.offsetXZ[1];
    const foundation = planFoundation(surface, { x, z, width: item.width, depth: item.depth, clearance: .08 });
    const origin: V3 = [x, foundation.deckY, z];
    const box = (suffix: string, p: V3, size: V3, color: string) => boxes.push({ id: `${item.id}-${suffix}`, position: townPoint(origin, item.yaw, ...p), size, rotation: [0, item.yaw, 0], color });
    boxes.push({ id: `${item.id}-foundation`, ...foundation.body, rotation: [0, 0, 0], color: '#a86046' });
    decks.push({ center: origin, width: item.width, depth: item.depth, yaw: 0, frontY: origin[1], backY: origin[1] });
    const coffee = item.kind === 'coffee';
    // These conservative coffee shell/floor bounds are measured after the reviewed extraction.
    // Interior is closed; forecourt remains traversable, not one whole-asset blocking box.
    const floorY = coffee ? COFFEE_COLLISION_PROFILE.floorSize[1] : .12;
    const floorWidth = coffee ? COFFEE_COLLISION_PROFILE.floorSize[0] : item.width;
    const floorDepth = coffee ? COFFEE_COLLISION_PROFILE.floorSize[2] : item.depth;
    box('floor', [0, floorY / 2, 0], [floorWidth, floorY, floorDepth], '#a98569');
    box('shell', coffee ? [...COFFEE_COLLISION_PROFILE.shellPosition] : [0, floorY + item.height / 2, -1], coffee ? [...COFFEE_COLLISION_PROFILE.shellSize] : [item.width - 1, item.height, item.depth - 3], item.wallColor);
    decks.push({ center: origin, width: floorWidth, depth: floorDepth, yaw: item.yaw, frontY: origin[1] + floorY, backY: origin[1] + floorY });
    const edge = floorDepth / 2, length = coffee ? 6 : 3;
    const foot = townPoint(origin, item.yaw, 0, 0, edge + length);
    const footY = surface.heightAt(foot[0], foot[2]) + .025;
    const deckY = origin[1] + floorY, rise = deckY - footY, angle = Math.atan2(rise, length), thickness = .15;
    const rampCenter = townPoint(origin, item.yaw, 0, (deckY + footY) / 2 - origin[1] - Math.cos(angle) * thickness / 2, edge + length / 2 - Math.sin(angle) * thickness / 2);
    boxes.push({ id: `${item.id}-ramp`, position: rampCenter, size: [2.8, thickness, Math.hypot(length, rise)], rotation: [angle * Math.cos(item.yaw), item.yaw, 0], color: '#bfad79' });
    decks.push({ center: townPoint(origin, item.yaw, 0, 0, edge + length / 2), width: 2.8, depth: length, yaw: item.yaw, backY: deckY, frontY: footY });
    return { ...item, origin, foundation, floorY, entrance: townPoint(origin, item.yaw, 0, floorY + .06, edge - 1), approach: [foot[0], footY + .06, foot[2]] as V3 };
  });
  const deckHeightAt = (x: number, z: number) => {
    let height: number | null = null;
    for (const d of decks) {
      const dx = x - d.center[0], dz = z - d.center[2];
      const localX = Math.cos(d.yaw) * dx - Math.sin(d.yaw) * dz;
      const localZ = Math.sin(d.yaw) * dx + Math.cos(d.yaw) * dz;
      if (Math.abs(localX) <= d.width / 2 && Math.abs(localZ) <= d.depth / 2) {
        const y = d.backY + (d.frontY - d.backY) * (localZ / d.depth + .5);
        height = Math.max(height ?? -Infinity, y);
      }
    }
    return height;
  };
  const lane: V3[] = [[center[0], surface.heightAt(center[0], center[2]), center[2]], [center[0], surface.heightAt(center[0], center[2] + 32), center[2] + 32], [center[0] - 91, surface.heightAt(center[0] - 91, center[2] + 32), center[2] + 32]];
  return { buildings, boxes, decks, deckHeightAt, lane };
}
export type TownStreet = ReturnType<typeof createChalakkudyStreet>;
