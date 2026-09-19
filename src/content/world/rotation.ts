type V3 = [number, number, number];

/**
 * Colliders use XYZ Euler angles (browser and server alike). Converts "yaw, then pitch about the
 * turned x axis" (YXZ) into the XYZ triple for the same rotation.
 */
export function yawPitchToXyz(yaw: number, pitch: number): V3 {
  if (!pitch) return [0, yaw, 0];
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return [Math.atan2(sp, cy * cp), Math.asin(Math.max(-1, Math.min(1, sy * cp))), Math.atan2(-sy * sp, cy)];
}
