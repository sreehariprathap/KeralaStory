import { describe, expect, it } from 'vitest';
import { terrainMeshData } from '../src/game/world/traversalGeometry';
import { createTerrainSurface, planFoundation, planFoundationSteps } from '../src/game/world/buildingFoundation';

describe('building foundation terrain contract', () => {
  it('interpolates the exact rendered triangle and clips a footprint across its diagonal edge', () => {
    const surface = createTerrainSurface({
      vertices: [0, 0, 0, 2, 10, 0, 0, 20, 2],
      indices: [0, 1, 2],
    });

    expect(surface.heightAt(0.5, 1)).toBeCloseTo(12.5);
    expect(surface.heightRange({ xMin: 0.5, xMax: 1.5, zMin: 0.5, zMax: 1.5 })).toEqual({ min: 7.5, max: 17.5 });
  });

  it('puts a slab deck above the highest ground and buries its base below the lowest ground', () => {
    const surface = createTerrainSurface({
      vertices: [0, 1, 0, 4, 3, 0, 0, 5, 4, 4, 7, 4],
      indices: [0, 1, 2, 1, 3, 2],
    });
    const plan = planFoundation(surface, { x: 2, z: 2, width: 4, depth: 4, clearance: 0.3, burial: 0.6 });

    expect(plan.groundMin).toBe(1);
    expect(plan.groundMax).toBe(7);
    expect(plan.deckY).toBeCloseTo(7.3);
    expect(plan.body.position).toEqual([2, expect.closeTo(3.85), 2]);
    expect(plan.body.size).toEqual([4, expect.closeTo(6.9), 4]);
    expect(plan.body.position[1] - plan.body.size[1] / 2).toBeCloseTo(0.4);
    expect(plan.body.position[1] + plan.body.size[1] / 2).toBeCloseTo(plan.deckY);
  });

  it('uses an interior terrain peak when it is higher than every footprint corner', () => {
    const surface = createTerrainSurface({
      vertices: [0, 0, 0, 4, 0, 0, 4, 0, 4, 0, 0, 4, 2, 5, 2],
      indices: [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4],
    });
    const plan = planFoundation(surface, { x: 2, z: 2, width: 4, depth: 4, clearance: 0.2 });

    expect(plan.groundMin).toBe(0);
    expect(plan.groundMax).toBe(5);
    expect(plan.deckY).toBeCloseTo(5.2);
  });

  it('plans the steep south-terrain house footprint from the rendered mesh floor', () => {
    const surface = createTerrainSurface(terrainMeshData('south'));
    const plan = planFoundation(surface, { x: -25, z: -319, width: 8, depth: 6 });
    const ground = surface.heightRange(plan.bounds);

    expect(plan.groundMin).toBeCloseTo(ground.min);
    expect(plan.groundMax).toBeCloseTo(ground.max);
    expect(plan.groundMax - plan.groundMin).toBeGreaterThan(0.5);
    expect(plan.body.size[1]).toBeGreaterThan(ground.max - ground.min);
    expect(plan.body.position[1] + plan.body.size[1] / 2).toBeCloseTo(plan.deckY);
    expect(plan.deckY).toBeGreaterThanOrEqual(ground.max + 0.22 - 1e-8);
  });

  it('keeps south-facing approach risers bounded while joining the terrain', () => {
    const surface = createTerrainSurface({
      vertices: [0, 0, 0, 2, 0.4, 0, 0, 0.4, 4, 2, 0.8, 4],
      indices: [0, 1, 2, 1, 3, 2],
    });
    const steps = planFoundationSteps(surface, { x: 1, edgeZ: 0, deckY: 1, width: 2, treadDepth: 0.5, maxRise: 0.24 });

    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0].position[1] + steps[0].size[1] / 2).toBeCloseTo(1);
    for (let i = 1; i < steps.length; i++) {
      const previousTop = steps[i - 1].position[1] + steps[i - 1].size[1] / 2;
      const top = steps[i].position[1] + steps[i].size[1] / 2;
      expect(previousTop - top).toBeLessThanOrEqual(0.24 + 1e-8);
    }
    const last = steps.at(-1)!;
    const lastBounds = { xMin: 0, xMax: 2, zMin: last.position[2] - 0.25, zMax: last.position[2] + 0.25 };
    const lastGround = surface.heightRange(lastBounds);
    const lastTop = last.position[1] + last.size[1] / 2;
    expect(lastTop).toBeGreaterThanOrEqual(lastGround.max);
    expect(lastTop - lastGround.max).toBeLessThanOrEqual(0.24 + 1e-8);
  });

  it('keeps every downhill tread above and buried into its known sloping ground', () => {
    const surface = createTerrainSurface({
      // y = 1 - 0.2z, independent of x, so the approach falls toward +z.
      vertices: [0, 1, 0, 2, 1, 0, 0, 0.2, 4, 2, 0.2, 4],
      indices: [0, 1, 2, 1, 3, 2],
    });
    const steps = planFoundationSteps(surface, { x: 1, edgeZ: 0, deckY: 1.5, width: 2, treadDepth: 0.5, maxRise: 0.3 });

    expect(steps.length).toBe(3);
    for (const step of steps) {
      const bounds = { xMin: 0, xMax: 2, zMin: step.position[2] - step.size[2] / 2, zMax: step.position[2] + step.size[2] / 2 };
      const ground = surface.heightRange(bounds);
      const top = step.position[1] + step.size[1] / 2;
      const bottom = step.position[1] - step.size[1] / 2;
      expect(top).toBeGreaterThanOrEqual(ground.max - 1e-8);
      expect(bottom).toBeLessThanOrEqual(ground.min - 0.45 + 1e-8);
    }
  });
});
