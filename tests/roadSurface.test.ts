import { describe, expect, it } from 'vitest';
import { surfaceAt } from '../src/content/world/roadSurface';
import { MAIN_PATH } from '../src/content/world/definition';
import { stuntSites } from '../src/game/world/stuntSites';

describe('surfaceAt', () => {
  it('is paved on the original MAIN_PATH corridor near spawn', () => {
    const [x, z] = MAIN_PATH[0];
    const sample = surfaceAt(x, z);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBe(1);
    expect(sample.topSpeedFactor).toBe(1);
  });

  it('is dirt on the summit off-road track', () => {
    const sample = surfaceAt(-223.86061114968692, -732.7363076784491);
    expect(sample.kind).toBe('dirt');
    expect(sample.gripFactor).toBeCloseTo(0.75);
    expect(sample.topSpeedFactor).toBeCloseTo(0.85);
  });

  it('is full grip inside a stunt site even though it is far from any route', () => {
    const site = stuntSites()[0];
    const sample = surfaceAt(site.clear[0].x, site.clear[0].z);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBe(1);
    expect(sample.topSpeedFactor).toBe(1);
  });

  it('is off-road far from every route and stunt site', () => {
    const sample = surfaceAt(-835, -935);
    expect(sample.kind).toBe('offroad');
    expect(sample.gripFactor).toBeCloseTo(0.55);
    expect(sample.topSpeedFactor).toBeCloseTo(0.7);
  });

  it('blends smoothly in the shoulder just past a route edge, never snapping', () => {
    // 4m from MAIN_PATH's centerline: 1m past its 3m half-width, inside the 2m shoulder.
    const sample = surfaceAt(-4, -470.5);
    expect(sample.kind).toBe('paved');
    expect(sample.gripFactor).toBeLessThan(1);
    expect(sample.gripFactor).toBeGreaterThan(0.55);
    expect(sample.topSpeedFactor).toBeLessThan(1);
    expect(sample.topSpeedFactor).toBeGreaterThan(0.7);
  });
});
