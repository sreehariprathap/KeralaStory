import type { TraversalBox } from '../../game/world/traversalGeometry';
import { isClearOfRoads, isWater, terrainHeight } from './definition';
import { SNEHA_BEACH_SPAN, SNEHA_THEERAM, coastDistance, shorePoint } from './snehaTheeram';
import { yawPitchToXyz, type CityMaterial, type CityPiece, type CitySign } from './chalakkudyCity';

type V3 = [number, number, number];

export interface BeachUmbrella { position: V3; color: string; tilt: number }
export interface BeachPalm { x: number; z: number; /** Lean toward the sea, radians. */ lean: number; yaw: number; height: number }

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const UMBRELLA_COLORS = ['#e2553f', '#f2b63d', '#2f8fb0', '#f4efe4', '#3f9a6a', '#d9487a'];

/**
 * Beach life along Sneha Theeram: umbrellas and loungers above the tideline, fishing vallams drawn up
 * on the sand, a lifeguard tower, a snack stall and an arch over the path down from the grass.
 * Deterministic, and every solid has a collider shared with the multiplayer simulation.
 */
function createDressing() {
  const pieces: CityPiece[] = [], boxes: TraversalBox[] = [], signs: CitySign[] = [];
  const umbrellas: BeachUmbrella[] = [], palms: BeachPalm[] = [];
  const piece = (material: CityMaterial, position: V3, size: V3, color: string, yaw = 0, pitch = 0) => pieces.push({ position, size, yaw, pitch, color, material });
  const solid = (position: V3, size: V3, color: string, yaw = 0, pitch = 0) => piece('solid', position, size, color, yaw, pitch);
  const collide = (id: string, position: V3, size: V3, yaw = 0) => boxes.push({ id, position, size, rotation: yawPitchToXyz(yaw, 0) });
  const r = rng(52021);
  /** A point `inland` metres up the beach from the waterline, `along` metres round the bay. */
  const at = (along: number, inland: number) => {
    const p = shorePoint(along), x = p.x + p.nx * inland, z = p.z + p.nz * inland;
    return { x, z, y: terrainHeight(x, z), nx: p.nx, nz: p.nz, yaw: Math.atan2(p.nx, p.nz) };
  };
  const open = (x: number, z: number) => !isWater(x, z) && isClearOfRoads(x, z, 4);

  // Umbrellas in a loose line above the tideline, each with a pair of loungers facing the sea.
  for (let along = SNEHA_BEACH_SPAN.from + 20, i = 0; along < SNEHA_BEACH_SPAN.to - 20; along += 15 + r() * 6, i++) {
    const p = at(along, 11 + r() * 5);
    if (!open(p.x, p.z)) continue;
    umbrellas.push({ position: [p.x, p.y, p.z], color: UMBRELLA_COLORS[i % UMBRELLA_COLORS.length], tilt: (r() - .5) * .25 });
    for (const side of [-1, 1]) {
      // Loungers sit either side of the pole, their backs raised toward the land.
      const x = p.x + p.nz * side * 1.4 - p.nx * .6, z = p.z - p.nx * side * 1.4 - p.nz * .6, y = terrainHeight(x, z);
      solid([x, y + .25, z], [.7, .12, 1.9], '#f4efe4', p.yaw);
      solid([x + p.nx * .75, y + .5, z + p.nz * .75], [.7, .1, .7], '#f4efe4', p.yaw, -.7);
      for (const leg of [-.7, .7]) solid([x + p.nx * leg, y + .1, z + p.nz * leg], [.66, .2, .08], '#9b7b55', p.yaw);
    }
  }

  // Fishing vallams drawn up on the sand, bows to the sea.
  for (const [along, inland, color] of [[96, 5, '#2f6f9f'], [118, 4.5, '#c8553d'], [210, 5.5, '#3f9a6a'], [232, 4, '#e9b930']] as const) {
    const p = at(along, inland), id = `beach-vallam-${along}`;
    const hull: V3 = [p.x, p.y + .45, p.z];
    solid(hull, [1.5, .7, 7], color, p.yaw);
    solid([p.x, p.y + .82, p.z], [1.7, .1, 6.6], '#6d4a30', p.yaw);
    // Raised, pointed bow and stern.
    for (const end of [-1, 1]) solid([p.x + p.nx * end * 3.8, p.y + .9, p.z + p.nz * end * 3.8], [.9, .9, 1.6], color, p.yaw, -end * .5);
    solid([p.x + p.nz * .5, p.y + .95, p.z - p.nx * .5], [.12, .12, 4.4], '#b58a5a', p.yaw);
    collide(id, hull, [1.6, .9, 7.4], p.yaw);
  }

  // Lifeguard tower: stilts, a platform with a hut, and a red-and-yellow flag.
  {
    const p = at(165, 14), id = 'beach-lifeguard';
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const leg: V3 = [p.x + dx, p.y + 1.6, p.z + dz];
      solid(leg, [.25, 3.2, .25], '#f4efe4'); collide(`${id}-leg-${dx}-${dz}`, leg, [.3, 3.2, .3]);
    }
    solid([p.x, p.y + 3.3, p.z], [3.2, .25, 3.2], '#b58a5a');
    solid([p.x, p.y + 4.4, p.z], [2.4, 2, 2.4], '#e2553f', p.yaw);
    solid([p.x, p.y + 5.6, p.z], [3, .3, 3], '#f4efe4', p.yaw);
    solid([p.x + 1.8, p.y + 6.2, p.z], [.08, 3, .08], '#d9d9d9');
    solid([p.x + 2.3, p.y + 7.3, p.z], [1, .6, .05], '#f2b63d', Math.PI / 2);
    solid([p.x + 2.3, p.y + 7.3, p.z], [1, .3, .06], '#e2553f', Math.PI / 2);
    signs.push({ id, label: 'LIFEGUARD', position: [p.x - p.nx * 1.22, p.y + 4.4, p.z - p.nz * 1.22], yaw: p.yaw + Math.PI, width: 2, height: .5, background: '#e2553f', ink: '#ffffff' });
  }

  // A thatched snack stall on the grass edge: tender coconut, sarbath and pazhampori.
  {
    const p = at(140, 30), id = 'beach-stall', yaw = p.yaw;
    const body: V3 = [p.x, p.y + 1.3, p.z];
    solid(body, [4.4, 2.6, 3], '#e7c98c', yaw); collide(id, body, [4.6, 2.6, 3.2], yaw);
    solid([p.x - p.nx * 2.1, p.y + 1, p.z - p.nz * 2.1], [4.4, .15, 1.2], '#8b5a36', yaw);
    for (const side of [-1, 1]) solid([p.x + p.nx * side * 1.1, p.y + 3.1, p.z + p.nz * side * 1.1], [5.4, .3, 3], '#b99a57', yaw, side * .45);
    // Green tender coconuts heaped by the counter.
    for (let k = 0; k < 6; k++) solid([p.x - p.nx * 2.6 + p.nz * (k - 2.5) * .5, p.y + .25 + (k % 2) * .3, p.z - p.nz * 2.6 - p.nx * (k - 2.5) * .5], [.45, .45, .45], '#6f9a3a', k);
    signs.push({ id, label: 'Sneha Tea & Snacks', position: [p.x - p.nx * 1.52, p.y + 2.35, p.z - p.nz * 1.52], yaw: yaw + Math.PI, width: 3.8, height: .55, background: '#2f6f5a', ink: '#fbe8c8' });
  }

  // An arch where the path from the grass meets the sand, facing arrivals from inland.
  {
    const [lx, lz] = SNEHA_THEERAM.landmark, d = coastDistance(lx, lz) ?? 30;
    const p = at(158, Math.max(26, d)), id = 'beach-arch', span = 6;
    for (const side of [-1, 1]) {
      const post: V3 = [p.x + p.nz * side * span / 2, p.y + 2.4, p.z - p.nx * side * span / 2];
      solid(post, [.6, 4.8, .6], '#f4efe4', p.yaw); collide(`${id}-post-${side}`, post, [.7, 4.8, .7], p.yaw);
    }
    solid([p.x, p.y + 5.1, p.z], [span + 1.4, 1.3, .5], '#2f8fb0', p.yaw);
    signs.push({ id, label: 'Sneha Theeram · സ്നേഹതീരം', position: [p.x + p.nx * .27, p.y + 5.1, p.z + p.nz * .27], yaw: p.yaw, width: span + 1, height: 1.1, background: '#2f8fb0', ink: '#ffffff' });
  }

  // Coconut palms along the top of the beach, leaning out over the sand toward the sea.
  for (let along = SNEHA_BEACH_SPAN.from - 30; along < SNEHA_BEACH_SPAN.to + 20; along += 7 + r() * 5) {
    const p = at(along, 22 + r() * 18);
    palms.push({ x: p.x, z: p.z, lean: .12 + r() * .16, yaw: Math.atan2(-p.nx, -p.nz), height: 10 + r() * 5 });
  }
  return { pieces, boxes, signs, umbrellas, palms };
}

export const SNEHA_THEERAM_DRESSING = createDressing();

/** Colliders shared by the client physics and the authoritative multiplayer simulation. */
export function snehaTheeramBoxes(): TraversalBox[] {
  return SNEHA_THEERAM_DRESSING.boxes;
}
