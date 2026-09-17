import { KODASSERY_PATH, terrainHeight } from './definition';
import type { TraversalBox } from '../../game/world/traversalGeometry';
type Point = [number, number, number];

/** Open centripetal Catmull-Rom, in meters; independent of rendering math objects. */
export function sampleCentripetal(points: readonly Point[], t: number): Point {
  const u = Math.max(0, Math.min(1, t)) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(u)), f = u - i;
  const b = points[i], c = points[i + 1];
  const a = points[i - 1] ?? b.map((v, k) => 2 * v - c[k]);
  const d = points[i + 2] ?? c.map((v, k) => 2 * v - b[k]);
  const interval = (p: readonly number[], q: readonly number[]) => ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2) ** .25;
  let ab = interval(a, b), bc = interval(b, c), cd = interval(c, d);
  if (bc < 1e-4) bc = 1;
  if (ab < 1e-4) ab = bc;
  if (cd < 1e-4) cd = bc;
  return b.map((value, k) => {
    const m0 = bc * ((value - a[k]) / ab - (c[k] - a[k]) / (ab + bc) + (c[k] - value) / bc);
    const m1 = bc * ((c[k] - value) / bc - (d[k] - value) / (bc + cd) + (d[k] - c[k]) / cd);
    return value + m0 * f + (-3 * value + 3 * c[k] - 2 * m0 - m1) * f * f + (2 * value - 2 * c[k] + m0 + m1) * f * f * f;
  }) as Point;
}
export const CANONICAL_TRAIL_POINTS = Array.from({ length: 151 }, (_, i) => sampleCentripetal(KODASSERY_PATH.map(([x, z]): Point => [x, terrainHeight(x, z), z]), i / 150));
const stream: Point[] = [[44, 0, -389], [44, 0, -383], [44, 0, -377], [46, 0, -369], [49, 0, -361], [51, 0, -353]];
function waterfallClear(x: number, z: number) {
  const margin = 2.8;
  if (x > 43 - margin && x < 59 + margin && z > -394 - margin && z < -375 + margin) return false;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, p = sampleCentripetal(stream, t), halfWidth = (5.25 * (1 - t) ** 1.7 + .15) / 2;
    if (Math.hypot(p[0] - x, p[2] - z) < halfWidth + margin + .45) return false;
  }
  return true;
}
/** Same seed and random draws as the visual forest, including skipped decoration draws. */
export function staticForestBoxes(): TraversalBox[] {
  const boxes: TraversalBox[] = [];
  let seed = 831;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 230; i++) {
    const x = (random() - .5) * 148, z = -496 + random() * 162;
    const nearest = Math.min(...CANONICAL_TRAIL_POINTS.map(p => Math.hypot(p[0] - x, p[2] - z)));
    if (nearest < 6 || (x > 4 && x < 37 && z > -436 && z < -400) || (x > 24 && z > -405 && z < -370)) continue;
    const h = 6 + random() * 9, y = terrainHeight(x, z); random();
    for (let leaf = 0; leaf < 4; leaf++) random();
    if (i % 4 === 0) { random(); random(); random(); }
    if (nearest < 15 && waterfallClear(x, z)) boxes.push({ id: `forest-trunk-${i}`, position: [x, y + h / 2, z], size: [1, h, 1], rotation: [0, 0, 0] });
  }
  return boxes;
}
