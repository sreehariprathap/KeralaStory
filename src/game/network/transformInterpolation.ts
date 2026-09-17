export type Vec3 = readonly [number, number, number];

export function interpolateVec3(from: Vec3, to: Vec3, alpha: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * alpha,
    from[1] + (to[1] - from[1]) * alpha,
    from[2] + (to[2] - from[2]) * alpha,
  ];
}

export function interpolateHeading(from: number, to: number, alpha: number): number {
  const fullTurn = Math.PI * 2;
  const shortestDelta = ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  return from + shortestDelta * alpha;
}
