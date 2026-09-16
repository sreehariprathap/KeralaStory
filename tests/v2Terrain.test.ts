import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { EXPANSION_GROUND, V2_LAYOUT, V2_ROUTES, hasGroundAt, isTravelAllowed, isWater, safeGroundPosition, terrainHeight, WORLD_BOUNDS } from '../src/content/world/definition';
import { resolveClearFeet } from '../src/game/vehicle/clearance';
import type { TerrainChunk } from '../src/game/world/expansionTerrain';

describe('V2 terrain and travel profile', () => {
  beforeAll(async () => { await RAPIER.init(); });
  it('grounds every new-road sample on dry, traversable terrain with a reasonable grade', () => {
    for (const route of V2_ROUTES) {
      for (let i = 0; i < route.points.length; i++) {
        const [x, y, z] = route.points[i];
        expect(hasGroundAt(x, z)).toBe(true);
        expect(isWater(x, z)).toBe(false);
        expect(terrainHeight(x, z)).toBeCloseTo(y, 5);
        expect(isTravelAllowed('bicycle', x, z), `${route.id} point ${i} (${x},${z})`).toBe(true);
        expect(isTravelAllowed('car', x, z), `${route.id} point ${i} (${x},${z})`).toBe(true);
        if (i) {
          const [px, py, pz] = route.points[i - 1];
          const distance = Math.hypot(x - px, z - pz);
          if (distance > 0) expect(Math.abs(y - py) / distance).toBeLessThanOrEqual(.101);
        }
      }
    }
  });

  it('keeps every town and Silver Storm park center dry and safely grounded', () => {
    for (const site of [...V2_LAYOUT.towns, V2_LAYOUT.park]) {
      const [x, authoredY, z] = site.center;
      expect(hasGroundAt(x, z)).toBe(true);
      expect(isWater(x, z)).toBe(false);
      const safe = safeGroundPosition(site.center);
      expect(safe[0]).toBe(x);
      expect(safe[2]).toBe(z);
      expect(safe[1]).toBeCloseTo(terrainHeight(x, z) + .05, 5);
      expect(Number.isFinite(authoredY)).toBe(true);
    }
  });

  it('allows cars to leave the ribbons on supported dry terrain while rejecting water', () => {
    expect(isTravelAllowed('car', -555, -680)).toBe(true);
    expect(isTravelAllowed('car', -210, -220)).toBe(true);
    expect(isTravelAllowed('car', 0, -100)).toBe(false);
  });

  it('keeps sampled new-river water triangles well above the surrounding bed', () => {
    const meshes = EXPANSION_GROUND.v2!.river.meshes.filter(mesh => mesh.id !== 'athirappilly-drop');
    for (const mesh of meshes) for (let i = 0; i < mesh.indices.length; i += 3) {
      const vertices = mesh.indices.slice(i, i + 3).map(index => mesh.vertices.slice(index * 3, index * 3 + 3));
      const x = vertices.reduce((sum, p) => sum + p[0], 0) / 3;
      const z = vertices.reduce((sum, p) => sum + p[2], 0) / 3;
      if (x >= -78) continue;
      const waterY = vertices.reduce((sum, p) => sum + p[1], 0) / 3;
      expect(waterY - terrainHeight(x, z)).toBeGreaterThanOrEqual(1);
    }
  });

  it('supports one vehicle probe at each new-road midpoint using shared terrain meshes', () => {
    const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    try {
      const chunks: TerrainChunk[] = [EXPANSION_GROUND.originalNorthChunk, ...EXPANSION_GROUND.chunks];
      for (const chunk of chunks) {
        world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(chunk.vertices), new Uint32Array(chunk.indices)));
      }
      world.step();
      for (const route of V2_ROUTES) {
        const i = Math.floor(route.points.length / 2);
        const p = route.points[i], previous = route.points[Math.max(0, i - 1)], next = route.points[Math.min(route.points.length - 1, i + 1)];
        const heading = Math.atan2(next[0] - previous[0], -(next[2] - previous[2]));
        const ray = new RAPIER.Ray({ x: p[0], y: p[1] + 10, z: p[2] }, { x: 0, y: -1, z: 0 });
        const hit = world.castRayAndGetNormal(ray, 20, true);
        expect(hit, `${route.id} midpoint ${i} (${p[0]},${p[1]},${p[2]})`).not.toBeNull();
        expect(hit!.normal.y).toBeGreaterThan(.7);
        expect(p[1] + 10 - hit!.timeOfImpact).toBeCloseTo(terrainHeight(p[0], p[2]), 2);
        const feet = resolveClearFeet(world, null, p[0], p[2], p[1], 'car', heading);
        expect(feet).not.toBeNull();
        expect(feet![1]).toBeGreaterThanOrEqual(terrainHeight(p[0], p[2]) + .05);
        expect(feet![1]).toBeLessThanOrEqual(terrainHeight(p[0], p[2]) + .4);
      }
    } finally {
      world.free();
    }
  });

  it('keeps the expanded world bounds finite and ordered', () => {
    expect(WORLD_BOUNDS.xMin).toBeLessThan(WORLD_BOUNDS.xMax);
    expect(WORLD_BOUNDS.zMin).toBeLessThan(WORLD_BOUNDS.zMax);
    expect(Object.values(WORLD_BOUNDS).every(Number.isFinite)).toBe(true);
  });
});
