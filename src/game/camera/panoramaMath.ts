function assertVector(vector: readonly number[], name: string): void {
  if (
    vector.length !== 3 ||
    !Number.isFinite(vector[0]) ||
    !Number.isFinite(vector[1]) ||
    !Number.isFinite(vector[2])
  ) {
    throw new RangeError(`${name} must contain exactly three finite components`);
  }
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export function requiredFarPlane(
  eye: readonly number[],
  targets: readonly (readonly number[])[],
  margin: number,
): number {
  assertVector(eye, 'eye');
  if (targets.length === 0) {
    throw new RangeError('targets must not be empty');
  }
  assertFinite(margin, 'margin');
  if (margin < 1) {
    throw new RangeError('margin must be at least 1');
  }

  let maximumDistance = 0;
  for (const target of targets) {
    assertVector(target, 'target');
    const dx = target[0] - eye[0];
    const dy = target[1] - eye[1];
    const dz = target[2] - eye[2];
    maximumDistance = Math.max(maximumDistance, Math.hypot(dx, dy, dz));
  }

  return Math.max(1, maximumDistance * margin);
}

export function summitBlend(height: number, start: number, end: number): number {
  assertFinite(height, 'height');
  assertFinite(start, 'start');
  assertFinite(end, 'end');
  if (end <= start) {
    throw new RangeError('end must be greater than start');
  }

  const t = Math.min(1, Math.max(0, (height - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
