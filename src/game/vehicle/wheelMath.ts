/** Return wheel rotation in radians for a signed travel distance. */
export function wheelAngle(distanceM: number, radiusM: number): number {
  if (!Number.isFinite(distanceM)) throw new RangeError('Distance must be finite');
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError('Wheel radius must be positive and finite');
  return distanceM / radiusM;
}
