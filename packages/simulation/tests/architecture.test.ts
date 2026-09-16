import { expect, it } from 'vitest';
import { buildArchitecture } from '../../../src/game/world/KeralaWorld';
import { canopyArchitectureBoxes, staticArchitectureBoxes } from '../../../src/content/world/staticArchitecture';
import { Euler, Quaternion, Vector3 } from 'three';
import { terrainHeight } from '../../../src/content/world/definition';
import { authoredForestColliderBoxes, TRAIL_POINTS } from '../../../src/game/world/KodasseryWorld';
import { CANONICAL_TRAIL_POINTS, staticForestBoxes } from '../../../src/content/world/staticForest';

it('canonical architecture preserves every existing solid box exactly', () => {
  const rendered = buildArchitecture();
  const key = (position: readonly number[], size: readonly number[], rotation: readonly number[]) => JSON.stringify([...position, ...size, ...rotation].map(v => Math.round(v * 1e8)));
  const old = rendered.colliders.map(c => key(c.position, c.size.map(v => v * 2), c.rotation)).sort();
  const canonical = staticArchitectureBoxes().map(c => key(c.position, c.size, c.rotation)).sort();
  rendered.meshes.forEach(mesh => mesh.geometry.dispose());
  expect(canonical).toEqual(old);
});
it('canopy world-space boxes retain nested yaw/pitch transforms', () => {
  const a = new Vector3(8, terrainHeight(8, -434) + .1, -434), b = new Vector3(18, terrainHeight(18, -415) + 3.2, -415);
  const d = b.clone().sub(a), yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
  const parent = new Quaternion().setFromEuler(new Euler(0, yaw, 0)).multiply(new Quaternion().setFromEuler(new Euler(pitch, 0, 0)));
  canopyArchitectureBoxes().slice(-3).forEach((box, i) => {
    const actual = new Quaternion().setFromEuler(new Euler(...box.rotation));
    expect(Math.abs(actual.dot(parent))).toBeCloseTo(1, 10);
    const offset = new Vector3(...([[0, 0, 0], [-1.12, .55, 0], [1.12, .55, 0]][i] as [number, number, number])).applyQuaternion(parent).add(a.clone().add(b).multiplyScalar(.5));
    expect(new Vector3(...box.position).distanceTo(offset)).toBeLessThan(1e-10);
  });
});
it('pure spline and seeded trunk recipes preserve visual forest collision', () => {
  CANONICAL_TRAIL_POINTS.forEach((p, i) => p.forEach((value, axis) => expect(value).toBeCloseTo(TRAIL_POINTS[i].toArray()[axis], 9)));
  const key = (box: { position: readonly number[]; size: readonly number[] }) => JSON.stringify([...box.position, ...box.size].map(v => Math.round(v * 1e8)));
  expect(staticForestBoxes().map(key).sort()).toEqual(authoredForestColliderBoxes().map(key).sort());
});
