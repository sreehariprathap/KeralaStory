import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/content/world/definition';
import { createExpansionLayout, pointInPolygon } from '../src/content/world/expansionLayout';
import { FALLS, cascadeGeometry, waterfallGeometry } from '../src/game/world/waterfallGeometry';

const shape = { x: -620, z: -400, topY: 90, width: 24, height: 28 };

describe('Athirappilly cascade geometry', () => {
  it.each([false, true])('keeps finite positions and normals at low=%s', low => {
    const geometry = cascadeGeometry(shape, low);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    expect(positions.count).toBeGreaterThan(0);
    for (let i = 0; i < positions.count; i++) {
      expect(Number.isFinite(positions.getX(i))).toBe(true);
      expect(Number.isFinite(positions.getY(i))).toBe(true);
      expect(Number.isFinite(positions.getZ(i))).toBe(true);
      expect(Number.isFinite(normals.getX(i))).toBe(true);
      expect(Number.isFinite(normals.getY(i))).toBe(true);
      expect(Number.isFinite(normals.getZ(i))).toBe(true);
    }
    geometry.dispose();
  });

  it('preserves the requested curtain width and vertical drop at every quality tier', () => {
    const geometries = [cascadeGeometry(shape), cascadeGeometry(shape, true)];
    for (const geometry of geometries) {
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(shape.width);
      expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(shape.height);
      geometry.dispose();
    }
  });

  it('reduces vertex count at low quality while preserving world bounds', () => {
    const full = cascadeGeometry(shape);
    const low = cascadeGeometry(shape, true);
    full.computeBoundingBox();
    low.computeBoundingBox();
    expect(low.getAttribute('position').count).toBeLessThan(full.getAttribute('position').count);
    expect(low.boundingBox!.min.toArray()).toEqual(full.boundingBox!.min.toArray());
    expect(low.boundingBox!.max.toArray()).toEqual(full.boundingBox!.max.toArray());
    full.dispose();
    low.dispose();
  });

  it('rejects non-finite and non-positive dimensions', () => {
    expect(() => cascadeGeometry({ ...shape, x: Number.NaN })).toThrow(RangeError);
    expect(() => cascadeGeometry({ ...shape, z: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => cascadeGeometry({ ...shape, topY: Number.NEGATIVE_INFINITY })).toThrow(RangeError);
    expect(() => cascadeGeometry({ ...shape, width: 0 })).toThrow(RangeError);
    expect(() => cascadeGeometry({ ...shape, height: -1 })).toThrow(RangeError);
  });

  it('preserves the Silverthread defaults and existing geometry contract', () => {
    expect(FALLS).toEqual({ x: 47, z: -385, height: 18, surfaceLift: 0.09 });
    const geometry = waterfallGeometry('fall');
    expect(geometry.getAttribute('position').count).toBe(559);
    geometry.dispose();
    expect(LANDMARKS.find(landmark => landmark.id === 'waterfall')?.id).toBe('waterfall');
  });
});

describe('Athirappilly layout separation', () => {
  it('keeps upper and lower views distinct, dry, and separate from Silverthread', () => {
    const layout = createExpansionLayout({ junction: [-7, 74.5, -446], panoramaTargets: [[65, 25, 54]] });
    const upper = layout.anchors.find(anchor => anchor.id === 'athirappilly-falls')!;
    const lower = layout.anchors.find(anchor => anchor.id === 'athirappilly-lower-view')!;
    expect(upper.position).not.toEqual(lower.position);
    expect(Math.hypot(upper.position[0] - lower.position[0], upper.position[2] - lower.position[2])).toBeGreaterThan(1);
    for (const view of [upper, lower]) {
      expect(layout.waterBodies.some(water => pointInPolygon(view.position[0], view.position[2], water.footprint))).toBe(false);
    }
    expect(layout.waterBodies.map(water => water.id)).not.toContain('waterfall');
    expect(LANDMARKS.some(landmark => landmark.id === 'waterfall')).toBe(true);
  });
});
