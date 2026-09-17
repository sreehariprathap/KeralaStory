import { describe, expect, it } from 'vitest';
import { terrainHeight } from '../src/content/world/kodassery';
import { FALLS, isWaterfallFootprint, streamPoint, waterfallGeometry } from '../src/game/world/waterfallGeometry';

describe('Silverthread water grounding', () => {
  it.each([false, true])('keeps the runnel on the hillside at low=%s', low => {
    const geometry = waterfallGeometry('stream', low);
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i) - terrainHeight(p.getX(i), p.getZ(i))).toBeCloseTo(FALLS.surfaceLift, 4);
    }
    geometry.dispose();
  });

  it('flows downhill along the stream, including the landing apron', () => {
    let previous = streamPoint(0, 0).y;
    for (let i = 1; i <= 200; i++) {
      const p = streamPoint(i / 200, 0);
      expect(p.y).toBeLessThan(previous);
      previous = p.y;
    }
  });

  it('lands every curtain edge on the apron surface without hovering', () => {
    const geometry = waterfallGeometry('fall');
    const p = geometry.getAttribute('position');
    for (let i = p.count - 13; i < p.count; i++) {
      expect(p.getY(i) - terrainHeight(p.getX(i), p.getZ(i))).toBeCloseTo(FALLS.surfaceLift, 4);
      expect(p.getX(i)).toBeCloseTo(44, 4);
      expect(p.getZ(i)).toBeGreaterThan(-389);
      expect(p.getZ(i)).toBeLessThan(-377);
    }
    geometry.dispose();
  });

  it('preserves water clearance for decoration while keeping the overlook clear', () => {
    for (let i = 0; i <= 50; i++) {
      const point = streamPoint(i / 50, 0);
      expect(isWaterfallFootprint(point.x, point.z)).toBe(true);
    }
    expect(isWaterfallFootprint(31, -386)).toBe(false);
    expect(isWaterfallFootprint(18, -415)).toBe(false);
  });
});
