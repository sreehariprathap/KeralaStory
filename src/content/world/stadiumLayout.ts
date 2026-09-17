/**
 * Leo Messi Stadium: a levelled pitch on open slope ~100 m north of Kodakara town.
 * The site was picked with `scripts/probe-stadium.ts` (flattest open ground near a town, clear of
 * roads, buildings and stunt parks). Pure data: terrain levelling imports this, so it must not import terrain.
 *
 * Pitch frame: `v` runs along the pitch toward the "far" goal, `u` across it.
 * World = center + v·(sin yaw, cos yaw) + u·(cos yaw, −sin yaw).
 */
export const STADIUM = {
  id: 'kodakara-stadium',
  label: 'Leo Messi Stadium',
  /** Painted on the entrance arch and the stand roof. */
  banner: 'MESSI STADIUM',
  center: { x: -146, z: -370 },
  /** Levelled ground height; the pitch surface sits a few centimetres above it. */
  groundY: 62.6,
  yaw: 0,
  pitch: { halfWidth: 20, halfLength: 30 },
  /** Grass run-off around the pitch; the ball is thrown back in beyond it. */
  runoff: 4,
  /** Levelled pad (pitch, run-off and stands) and the blend to natural ground around it. */
  pad: { halfWidth: 30, halfLength: 42, blend: 15 },
  goal: { halfWidth: 3, height: 2.3, depth: 1.8 },
  /** Walk-in circle beside the halfway line, like the paragliding launch. */
  join: { u: -24, v: 0, radius: 3 },
} as const;

export function stadiumToWorld(u: number, v: number): { x: number; z: number } {
  const s = Math.sin(STADIUM.yaw), c = Math.cos(STADIUM.yaw);
  return { x: STADIUM.center.x + v * s + u * c, z: STADIUM.center.z + v * c - u * s };
}

export function worldToStadium(x: number, z: number): { u: number; v: number } {
  const s = Math.sin(STADIUM.yaw), c = Math.cos(STADIUM.yaw), dx = x - STADIUM.center.x, dz = z - STADIUM.center.z;
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}

/** Distance (m) outside the rectangle of half extents (hu, hv) in pitch space; 0 inside. */
export function stadiumRectDistance(x: number, z: number, hu: number, hv: number): number {
  const { u, v } = worldToStadium(x, z);
  return Math.hypot(Math.max(0, Math.abs(u) - hu), Math.max(0, Math.abs(v) - hv));
}

export function isInStadiumJoin(x: number, z: number): boolean {
  const p = stadiumToWorld(STADIUM.join.u, STADIUM.join.v);
  return Math.hypot(x - p.x, z - p.z) < STADIUM.join.radius;
}

/** The whole levelled pad, plus `margin`: palms, forest and animals keep off it. */
export function isStadiumGround(x: number, z: number, margin = 0): boolean {
  return stadiumRectDistance(x, z, STADIUM.pad.halfWidth, STADIUM.pad.halfLength) <= margin;
}
