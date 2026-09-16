export interface ForestInstance {
  position: [number, number, number];
  yawRad: number;
  scale: number;
}

export interface ForestInstanceInput {
  seed: number;
  count: number;
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  heightAt: (x: number, z: number) => number;
  allowedAt: (x: number, z: number) => boolean;
}

/** Create deterministic decoration instances while leaving placement policy to the caller. */
export function createForestInstances(input: ForestInstanceInput): ForestInstance[] {
  const { seed, count, bounds, heightAt, allowedAt } = input;
  if (!Number.isInteger(count) || count < 0 || !Number.isFinite(count)) {
    throw new RangeError('count must be a finite non-negative integer');
  }
  if (
    !Number.isFinite(seed) || !Number.isInteger(seed) ||
    !Number.isFinite(bounds.xMin) || !Number.isFinite(bounds.xMax) ||
    !Number.isFinite(bounds.zMin) || !Number.isFinite(bounds.zMax) ||
    bounds.xMin >= bounds.xMax || bounds.zMin >= bounds.zMax
  ) {
    throw new RangeError('seed and bounds must define a finite non-empty region');
  }

  // Mulberry32 accepts zero and keeps all state local to this invocation.
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const instances: ForestInstance[] = [];
  const maxAttempts = count * 20;
  for (let attempt = 0; attempt < maxAttempts && instances.length < count; attempt++) {
    const x = bounds.xMin + random() * (bounds.xMax - bounds.xMin);
    const z = bounds.zMin + random() * (bounds.zMax - bounds.zMin);
    const y = heightAt(x, z);
    if (!Number.isFinite(y) || !allowedAt(x, z)) continue;
    instances.push({
      position: [x, y, z],
      yawRad: random() * Math.PI * 2,
      scale: 0.85 + random() * 0.3,
    });
  }
  return instances;
}
