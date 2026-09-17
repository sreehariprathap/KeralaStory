import type { MapBounds } from '../../contracts';
import { hasGroundAt, isWater, terrainHeight } from '../../content/world/definition';

/** Elevation tints (metres → colour), lush lowland greens up to pale highland grass. */
const STOPS: readonly [number, [number, number, number]][] = [
  [0, [190, 214, 150]], [15, [176, 206, 136]], [35, [160, 196, 122]], [55, [142, 184, 110]],
  [75, [124, 168, 98]], [100, [118, 152, 92]], [140, [146, 158, 108]], [190, [188, 184, 150]],
];
const WATER: [number, number, number] = [124, 184, 196];
const SEA: [number, number, number] = [164, 203, 197];

export function elevationTint(height: number): [number, number, number] {
  if (height <= STOPS[0][0]) return [...STOPS[0][1]];
  for (let i = 1; i < STOPS.length; i++) {
    const [h1, c1] = STOPS[i];
    if (height <= h1) {
      const [h0, c0] = STOPS[i - 1], t = (height - h0) / (h1 - h0);
      return [0, 1, 2].map(k => c0[k] + (c1[k] - c0[k]) * t) as [number, number, number];
    }
  }
  return [...STOPS[STOPS.length - 1][1]];
}

/**
 * Lambert hillshade from the north-west, for a surface gradient (dh/dx, dh/dz) in metres per metre.
 * Returns ~1 on flat ground, brighter on slopes facing the light and darker away from it.
 */
export function hillshade(dhdx: number, dhdz: number, exaggeration = 2.2): number {
  const nx = -dhdx * exaggeration, nz = -dhdz * exaggeration, ny = 1, length = Math.hypot(nx, ny, nz);
  const lx = -.55, ly = .72, lz = -.42, ll = Math.hypot(lx, ly, lz);
  const lambert = (nx * lx + ny * ly + nz * lz) / length / ll, flat = ly / ll;
  return Math.max(.55, Math.min(1.35, lambert / flat));
}

export interface ReliefImage { url: string; width: number; height: number }
let cached: Promise<ReliefImage> | null = null;

const nextFrame = () => new Promise<void>(resolve => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => resolve()) : setTimeout(resolve, 0)));

/** Shaded relief of the whole map, rendered once and cached. Work is split across frames. */
export function reliefImage(bounds: MapBounds, metresPerPixel = 2.5): Promise<ReliefImage> {
  if (cached) return cached;
  cached = (async () => {
    const width = Math.ceil((bounds.xMax - bounds.xMin) / metresPerPixel), height = Math.ceil((bounds.zMax - bounds.zMin) / metresPerPixel);
    const heights = new Float32Array((width + 2) * (height + 2)), kind = new Uint8Array((width + 2) * (height + 2));
    const index = (i: number, j: number) => (j + 1) * (width + 2) + (i + 1);
    let started = performance.now();
    for (let j = -1; j <= height; j++) {
      for (let i = -1; i <= width; i++) {
        const x = bounds.xMin + (i + .5) * metresPerPixel, z = bounds.zMin + (j + .5) * metresPerPixel, k = index(i, j);
        if (!hasGroundAt(x, z)) { kind[k] = 2; heights[k] = 0; continue; }
        heights[k] = terrainHeight(x, z);
        kind[k] = isWater(x, z) ? 1 : 0;
      }
      if (performance.now() - started > 12) { await nextFrame(); started = performance.now(); }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable for the map relief.');
    const image = context.createImageData(width, height), data = image.data;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const k = index(i, j), o = (j * width + i) * 4;
      let rgb: readonly number[];
      if (kind[k] === 2) rgb = SEA;
      else if (kind[k] === 1) {
        // Slightly darker toward mid-channel for a sense of depth.
        const shoreline = [index(i - 1, j), index(i + 1, j), index(i, j - 1), index(i, j + 1)].some(n => kind[n] !== 1);
        rgb = shoreline ? [150, 199, 204] : WATER;
      } else {
        const left = kind[index(i - 1, j)] === 2 ? heights[k] : heights[index(i - 1, j)], right = kind[index(i + 1, j)] === 2 ? heights[k] : heights[index(i + 1, j)];
        const up = kind[index(i, j - 1)] === 2 ? heights[k] : heights[index(i, j - 1)], down = kind[index(i, j + 1)] === 2 ? heights[k] : heights[index(i, j + 1)];
        const shade = hillshade((right - left) / (2 * metresPerPixel), (down - up) / (2 * metresPerPixel));
        rgb = elevationTint(heights[k]).map(c => c * shade);
      }
      data[o] = Math.min(255, rgb[0]); data[o + 1] = Math.min(255, rgb[1]); data[o + 2] = Math.min(255, rgb[2]); data[o + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    return { url: blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'), width, height };
  })();
  cached.catch(() => { cached = null; });
  return cached;
}
