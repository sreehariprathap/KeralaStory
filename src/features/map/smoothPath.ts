export type Point2 = readonly [number, number];

const f = (n: number) => Math.round(n * 100) / 100;

/** Drop points closer than `minGap` to the previous kept point (keeps the ends). */
export function simplify(points: readonly Point2[], minGap: number): Point2[] {
  if (points.length <= 2) return [...points];
  const kept: Point2[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = kept[kept.length - 1];
    if (Math.hypot(points[i][0] - last[0], points[i][1] - last[1]) >= minGap) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

/**
 * SVG path through every point using a centripetal-free Catmull-Rom spline converted to cubic Béziers.
 * `tension` 0 gives straight segments, 1 the classic spline. Closed paths wrap their neighbours.
 */
export function smoothPath(points: readonly Point2[], { closed = false, tension = 1 }: { closed?: boolean; tension?: number } = {}): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${f(points[0][0])} ${f(points[0][1])}`;
  if (n === 2 && !closed) return `M${f(points[0][0])} ${f(points[0][1])}L${f(points[1][0])} ${f(points[1][1])}`;
  const at = (i: number): Point2 => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const k = tension / 6;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) * k, c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k, c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Straight polygon path (for already-dense outlines). */
export function polygonPath(points: readonly Point2[]): string {
  return points.length ? `M${points.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}Z` : '';
}
