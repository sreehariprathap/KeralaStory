import { describe, expect, it } from 'vitest';
import type { RiverReach } from '../src/contracts/worldV2';
import { createRiverField, createRiverMesh } from '../src/game/world/riverGeometry';

const reach = (id: string, points: RiverReach['points'], widthsM: number[] = points.map(() => 4)): RiverReach => ({
  id, label: id, from: `${id}-from`, to: `${id}-to`, kind: 'channel', points, widthsM,
});

const triangleNormalY = (vertices: number[], indices: number[], triangle: number) => {
  const at = (i: number) => vertices.slice(indices[triangle * 3 + i] * 3, indices[triangle * 3 + i] * 3 + 3);
  const a = at(0), b = at(1), c = at(2);
  return (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
};

describe('river geometry', () => {
  it('creates finite, nondegenerate, upward-facing triangles with matching UVs', () => {
    const mesh = createRiverMesh(reach('slope', [[0, 23, 0], [0, 24, 10], [4, 25, 20]]));
    expect(mesh.vertices.length).toBe(mesh.uv.length / 2 * 3);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
    expect(mesh.uv.every(Number.isFinite)).toBe(true);
    expect(mesh.indices.length).toBe(12);
    for (let i = 0; i < mesh.indices.length / 3; i++) expect(triangleNormalY(mesh.vertices, mesh.indices, i)).toBeGreaterThan(0);
  });

  it('shares a continuous cross-section through a sloped 90-degree bend', () => {
    const mesh = createRiverMesh(reach('bend', [[0, 12, 0], [10, 11, 0], [10, 10, 10], [10, 9, 20]], [4, 5, 6, 6]));
    // The bend section is one shared pair of vertices, referenced by both adjoining quads.
    expect(mesh.indices.slice(0, 6)).toEqual([0, 1, 2, 1, 3, 2]);
    expect(mesh.indices.slice(6, 12)).toEqual([2, 3, 4, 3, 5, 4]);
    const bendLeft = mesh.vertices.slice(6, 9), bendRight = mesh.vertices.slice(9, 12);
    expect(Math.hypot(bendLeft[0] - bendRight[0], bendLeft[2] - bendRight[2])).toBeGreaterThan(0);
    expect([...bendLeft, ...bendRight].every(Number.isFinite)).toBe(true);
  });

  it('matches surfaceAt to the authored barycentric height at a triangle center', () => {
    const field = createRiverField([reach('rising', [[0, 20, 0], [0, 30, 12]])]);
    const mesh = field.meshes[0];
    const a = mesh.vertices.slice(0, 3), b = mesh.vertices.slice(3, 6), c = mesh.vertices.slice(6, 9);
    const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3;
    expect(field.surfaceAt(x, z)).toBeCloseTo((a[1] + b[1] + c[1]) / 3, 8);
  });

  it('returns null away from the river and does not impose a global water level', () => {
    const field = createRiverField([reach('high', [[0, 23, 0], [0, 23, 12]])]);
    expect(field.surfaceAt(30, 30)).toBeNull();
    expect(field.surfaceAt(0, 6)).toBeCloseTo(23, 8);
    expect(field.meshes[0].vertices.some((value, i) => i % 3 === 1 && value === 8)).toBe(false);
  });

  it('keeps disconnected reaches at their own altitudes and joined endpoints continuous', () => {
    const field = createRiverField([
      reach('west', [[-20, 4, 0], [-10, 5, 0]]),
      reach('east', [[10, 19, 0], [20, 20, 0]]),
      reach('joined-a', [[30, 31, 0], [40, 33, 0]]),
      reach('joined-b', [[40, 33, 0], [50, 34, 0]]),
    ]);
    expect(field.nearest(-15, 0)?.height).toBeCloseTo(4.5, 8);
    expect(field.nearest(15, 0)?.height).toBeCloseTo(19.5, 8);
    expect(field.nearest(40, 0)?.height).toBeCloseTo(33, 8);
    expect(field.surfaceAt(40, 0)).toBeCloseTo(33, 8);
  });
});
