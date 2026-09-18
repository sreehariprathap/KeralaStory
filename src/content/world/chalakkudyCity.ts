import type { MapBounds } from '../../contracts';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { TraversalBox } from '../../game/world/traversalGeometry';
import { CHALAKKUDY_STREET, EXPANSION_LAYOUT, V2_ROUTES, isWater, terrainHeight } from './definition';
import { staticArchitectureBoxes } from './staticArchitecture';
import { v2DressingBoxes } from './v2Dressing';
import {
  CHALAKKUDY_BRIDGES, CHALAKKUDY_CITY_ROADS, CHALAKKUDY_GATEWAY, CHALAKKUDY_MALL, CHALAKKUDY_SHOWROOM, CHALAKKUDY_STORES,
  CHALAKKUDY_ROAD_SIGNS, CHALAKKUDY_TOWERS, CITY_LANE_WIDTH_M, CITY_ROAD_WIDTH_M, bridgeFrame, cityBridgeDeckAt, type CityLot,
} from './chalakkudyCityPlan';
import type { CarModelId } from '../assets/models';

type V3 = [number, number, number];
/** `ground` receives shadows without casting them: road-like surfaces that would otherwise self-shadow. */
export type CityMaterial = 'solid' | 'ground' | 'glass' | 'glow';
/** One box of the city kit, turned by yaw and then tilted by pitch (Euler YXZ), merged by material. */
export interface CityPiece { position: V3; size: V3; yaw: number; pitch?: number; color: string; material: CityMaterial }
export interface CitySign { id: string; label: string; position: V3; yaw: number; width: number; height: number; background: string; ink: string }
/** Flat paint on the road surface: a strip from `a` to `b` (x, z) of `width` metres. */
export interface CityPaint { a: readonly [number, number]; b: readonly [number, number]; width: number; color: string }
export interface CityDisplayCar { id: string; modelId: CarModelId; color: string; position: V3; yaw: number }
export interface CityFootprint { id: string; x: number; z: number; width: number; depth: number; roof: string }

const WHITE = '#f4f3ee', YELLOW = '#e9b930', DARK = '#2a3038';

/** Level every corner and centre: foundations reach the lowest sample, floors sit on the highest. */
export function lotGround(lot: Pick<CityLot, 'x' | 'z' | 'width' | 'depth'>) {
  const heights = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dz => terrainHeight(lot.x + dx * lot.width / 2, lot.z + dz * lot.depth / 2)));
  return { min: Math.min(...heights), max: Math.max(...heights) };
}

/**
 * Colliders use XYZ Euler angles (browser and server alike). Converts "yaw, then pitch about the
 * turned x axis" (YXZ) into the XYZ triple for the same rotation.
 */
export function yawPitchToXyz(yaw: number, pitch: number): V3 {
  if (!pitch) return [0, yaw, 0];
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return [Math.atan2(sp, cy * cp), Math.asin(Math.max(-1, Math.min(1, sy * cp))), Math.atan2(-sy * sp, cy)];
}

function distanceToPolyline(x: number, z: number, points: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
}

function createCity() {
  const pieces: CityPiece[] = [], boxes: TraversalBox[] = [], signs: CitySign[] = [], paint: CityPaint[] = [];
  const cars: CityDisplayCar[] = [], footprints: CityFootprint[] = [], clearAreas: MapBounds[] = [];
  const piece = (material: CityMaterial, position: V3, size: V3, color: string, yaw = 0, pitch = 0) => pieces.push({ position, size, yaw, pitch, color, material });
  const solid = (position: V3, size: V3, color: string, yaw = 0) => piece('solid', position, size, color, yaw);
  const collide = (id: string, position: V3, size: V3, yaw = 0, pitch = 0) => boxes.push({ id, position, size, rotation: yawPitchToXyz(yaw, pitch) });
  const clear = (x: number, z: number, width: number, depth: number, margin = 3) =>
    clearAreas.push({ xMin: x - width / 2 - margin, xMax: x + width / 2 + margin, zMin: z - depth / 2 - margin, zMax: z + depth / 2 + margin });
  /** A slab from the lowest ground up to the floor so no building floats on the pad's edge. */
  const plinth = (id: string, lot: CityLot, color: string) => {
    const ground = lotGround(lot), top = ground.max + .15, height = top - ground.min + .3;
    const position: V3 = [lot.x, top - height / 2, lot.z], size: V3 = [lot.width + .4, height, lot.depth + .4];
    solid(position, size, color); collide(`${id}-plinth`, position, size);
    return top;
  };

  for (const s of CHALAKKUDY_STORES) {
    const floor = plinth(s.id, s, '#b9b3a8'), f = s.facing, front = s.z + f * s.depth / 2, yaw = f > 0 ? 0 : Math.PI;
    const body: V3 = [s.x, floor + s.height / 2, s.z];
    solid(body, [s.width, s.height, s.depth], s.wall); collide(`${s.id}-shell`, body, [s.width, s.height, s.depth]);
    // Full-height glass shopfront with a dark door and mullions.
    piece('glass', [s.x, floor + 1.65, front + f * .04], [s.width - 1.2, 3.1, .08], '#9cc3d5');
    solid([s.x, floor + 1.25, front + f * .07], [1.9, 2.5, .06], '#26303a');
    for (const dx of [-1, 1]) solid([s.x + dx * (s.width / 2 - .45), floor + 1.65, front + f * .06], [.18, 3.3, .1], DARK);
    for (const dx of [-2.6, 2.6]) solid([s.x + dx, floor + 1.65, front + f * .09], [.08, 3.1, .06], DARK);
    // Canopy, fascia and signboard.
    solid([s.x, floor + 3.45, front + f * .75], [s.width - .2, .16, 1.5], s.accent);
    solid([s.x, floor + 4.25, front + f * .08], [s.width - .4, 1.3, .14], s.accent);
    signs.push({ id: s.id, label: s.label, position: [s.x, floor + 4.25, front + f * .16], yaw, width: s.width - 1.2, height: 1.05, background: s.accent, ink: s.ink });
    if (s.height > 6) {
      // Upper floor: a ribbon window with a slim band.
      piece('glass', [s.x, floor + 5.7, front + f * .04], [s.width - 1.6, 1.3, .08], '#8fb3c6');
      solid([s.x, floor + 5, front + f * .1], [s.width, .2, .2], '#d9d4ca');
    }
    solid([s.x, floor + s.height + .25, s.z], [s.width + .2, .5, s.depth + .2], '#8b8f94');
    solid([s.x - s.width * .2, floor + s.height + .9, s.z - f * 2], [2.2, .9, 1.4], '#c9ccd0');
    footprints.push({ id: s.id, x: s.x, z: s.z, width: s.width, depth: s.depth, roof: '#8b8f94' });
    clear(s.x, s.z, s.width, s.depth);
  }

  {
    const m = CHALAKKUDY_MALL, floor = plinth(m.id, m, '#b5afa3'), front = m.z + m.depth / 2, H = m.height;
    const body: V3 = [m.x, floor + H / 2, m.z];
    solid(body, [m.width, H, m.depth], '#ece7de');
    // The shell collider also covers the facade fins and feature panels.
    collide(`${m.id}-shell`, [m.x, floor + H / 2, m.z + .5], [m.width, H, m.depth + 1]);
    // Glass curtain wall with floor bands and vertical fins.
    piece('glass', [m.x, floor + H / 2 + .4, front + .05], [m.width - 2, H - 1.6, .1], '#7fa9c0');
    for (const y of [5.3, 10.6]) solid([m.x, floor + y, front + .25], [m.width + .4, .6, .5], '#d6d0c4');
    for (let dx = -m.width / 2 + 2.5; dx <= m.width / 2 - 2.5; dx += 5) solid([m.x + dx, floor + H / 2, front + .3], [.3, H, .5], '#c9c2b5');
    // Corner feature panels.
    const panels = [{ dx: -m.width / 2 + 4, color: '#c8553d', label: 'Food Court' }, { dx: m.width / 2 - 4, color: '#2f6f73', label: 'Cinemas' }];
    for (const p of panels) {
      solid([m.x + p.dx, floor + H / 2 + .5, front + .6], [7, H - 1, .5], p.color);
      signs.push({ id: `${m.id}-${p.label}`, label: p.label, position: [m.x + p.dx, floor + H - 3, front + .9], yaw: 0, width: 6, height: 1.4, background: p.color, ink: '#ffffff' });
    }
    // Central glass atrium, entrance doors, header sign and canopy.
    const atriumZ = front + 2.5, atriumH = H + 3;
    piece('glass', [m.x, floor + atriumH / 2, atriumZ], [18, atriumH, 5], '#8dbbd0');
    collide(`${m.id}-atrium`, [m.x, floor + atriumH / 2, atriumZ], [18, atriumH, 5]);
    solid([m.x, floor + atriumH + .4, atriumZ], [18.6, .8, 5.6], '#3a4450');
    for (const dx of [-9, 9]) solid([m.x + dx, floor + atriumH / 2, atriumZ], [.4, atriumH, 5.4], '#3a4450');
    solid([m.x, floor + atriumH - 1.9, front + 5.1], [18, 3, .3], '#1f2a36');
    signs.push({ id: m.id, label: m.label, position: [m.x, floor + atriumH - 1.9, front + 5.3], yaw: 0, width: 16.5, height: 2.4, background: '#1f2a36', ink: '#ffd88a' });
    solid([m.x, floor + 1.7, front + 5.05], [10, 3.4, .1], '#27313a');
    const canopyZ = front + 5 + 3.5;
    solid([m.x, floor + 5.2, canopyZ], [22, .4, 7], '#e2ddd3'); collide(`${m.id}-canopy`, [m.x, floor + 5.2, canopyZ], [22, .4, 7]);
    piece('glow', [m.x, floor + 4.97, canopyZ], [20, .06, 5.5], '#fff1cf');
    for (const dx of [-10.5, 10.5]) {
      const p: V3 = [m.x + dx, floor + 2.5, canopyZ + 3]; solid(p, [.4, 5, .4], '#9aa1a8'); collide(`${m.id}-column-${dx}`, p, [.4, 5, .4]);
    }
    // Ground-floor anchor store boards.
    for (const [dx, label, color] of [[-22, 'Hypermarket', '#2f8f5b'], [22, 'Fashion', '#5a3d8a']] as const) {
      signs.push({ id: `${m.id}-${label}`, label, position: [m.x + dx, floor + 4.2, front + .6], yaw: 0, width: 7, height: 1.2, background: color, ink: '#ffffff' });
    }
    // Roof: parapet, plant rooms and an LED edge strip.
    for (const dz of [-1, 1]) solid([m.x, floor + H + .5, m.z + dz * (m.depth / 2 - .2)], [m.width, 1, .4], '#b9b3a7');
    for (const dx of [-1, 1]) solid([m.x + dx * (m.width / 2 - .2), floor + H + .5, m.z], [.4, 1, m.depth], '#b9b3a7');
    for (const [dx, dz, w] of [[-18, -6, 8], [14, -8, 6], [24, 4, 5]] as const) solid([m.x + dx, floor + H + 1.1, m.z + dz], [w, 2.2, 4], '#c7cacd');
    piece('glow', [m.x, floor + H - .3, front + .56], [m.width - 2, .18, .12], '#bfe6ff');
    footprints.push({ id: m.id, x: m.x, z: m.z, width: m.width, depth: m.depth, roof: '#c7c2b8' });
    clear(m.x, m.z + 5, m.width, m.depth + 10);

    // Car park: asphalt, stall lines and two planted islands.
    const l = m.lot, lotY = (x: number, z: number) => terrainHeight(x, z) + .04;
    solid([l.x, lotY(l.x, l.z), l.z], [l.width, .08, l.depth], '#4d5250');
    for (const row of [-1, 1]) for (let dx = -l.width / 2 + 3; dx <= l.width / 2 - 3; dx += 3) {
      const z = l.z + row * (l.depth / 2 - 2.8);
      solid([l.x + dx, lotY(l.x + dx, z) + .045, z], [.12, .02, 5], WHITE);
    }
    for (const dx of [-16, 16]) {
      const x = l.x + dx, y = terrainHeight(x, l.z);
      solid([x, y + .2, l.z], [8, .4, 2.4], '#a7a197'); collide(`${m.id}-island-${dx}`, [x, y + .2, l.z], [8, .4, 2.4]);
      solid([x, y + .42, l.z], [7.6, .06, 2], '#5f873e');
      for (const tx of [-2.4, 2.4]) {
        solid([x + tx, y + 1.6, l.z], [.28, 2.8, .28], '#6f5038');
        solid([x + tx, y + 3.6, l.z], [2.4, 1.8, 2.4], '#4f7d3a');
        collide(`${m.id}-tree-${dx}-${tx}`, [x + tx, y + 1.6, l.z], [.4, 2.8, .4]);
      }
    }
    clear(l.x, l.z, l.width, l.depth);
  }

  {
    const s = CHALAKKUDY_SHOWROOM, floor = plinth(s.id, s, '#aeb3b8'), H = s.height, front = s.z + s.depth / 2, back = s.z - s.depth / 2;
    const left = s.x - s.width / 2, right = s.x + s.width / 2, wall = '#f2f2ef', frame = '#2a2f36';
    solid([s.x, floor + .01, s.z], [s.width - .8, .02, s.depth - .8], '#dfe3e6');
    const wallBox = (id: string, position: V3, size: V3, color = wall) => { solid(position, size, color); collide(`${s.id}-${id}`, position, size); };
    wallBox('back', [s.x, floor + H / 2, back + .2], [s.width, H, .4]);
    wallBox('left', [left + .2, floor + H / 2, s.z], [.4, H, s.depth]);
    wallBox('right', [right - .2, floor + H / 2, s.z], [.4, H, s.depth]);
    solid([s.x, floor + 2.2, back + .42], [s.width - 1, .6, .04], '#c8252f');
    solid([s.x, floor + H + .25, s.z], [s.width + 1, .5, s.depth + 1], '#e8e8e4'); collide(`${s.id}-roof`, [s.x, floor + H + .25, s.z], [s.width + 1, .5, s.depth + 1]);
    solid([s.x, floor + H - .4, front + .55], [s.width + 1, 1.4, .3], '#1d2a44');
    signs.push({ id: s.id, label: s.label, position: [s.x, floor + H - .4, front + .72], yaw: 0, width: 14, height: 1.2, background: '#1d2a44', ink: '#ffffff' });
    piece('glow', [s.x, floor + H - .02, s.z], [s.width - 2, .06, s.depth - 2], '#f7fbff');
    // Glass front either side of a walk-in doorway.
    const half = s.doorWidth / 2, paneWidth = (s.width - .8) / 2 - half;
    for (const side of [-1, 1]) {
      const cx = s.x + side * (half + paneWidth / 2), p: V3 = [cx, floor + (H - 1.1) / 2, front - .1];
      piece('glass', p, [paneWidth, H - 1.1, .1], '#a9cfe0'); collide(`${s.id}-glass-${side}`, p, [paneWidth, H - 1.1, .12]);
      for (let k = 0; k <= 4; k++) solid([s.x + side * (half + paneWidth * k / 4), floor + (H - 1.1) / 2, front - .1], [.14, H - 1.1, .16], frame);
    }
    solid([s.x, floor + H - 1.3, front - .1], [s.doorWidth, .3, .18], frame);
    for (const [dx, dz] of [[-9.5, -1], [0, -3], [9.5, -1]] as const) solid([s.x + dx, floor + .05, s.z + dz], [5.4, .1, 5.4], '#c9ced3');
    // Forecourt and a pylon sign for the road.
    const courtZ = front + s.forecourtDepth / 2;
    solid([s.x, terrainHeight(s.x, courtZ) + .03, courtZ], [s.width, .06, s.forecourtDepth], '#b7b1a4');
    const pylon: V3 = [right + 2.5, terrainHeight(right + 2.5, front + 9) + 4, front + 9];
    solid(pylon, [1.2, 8, .6], '#1d2a44'); collide(`${s.id}-pylon`, pylon, [1.2, 8, .6]);
    for (const [dz, yaw] of [[.32, 0], [-.32, Math.PI]] as const) signs.push({ id: `${s.id}-pylon-${yaw}`, label: 'MOTORS', position: [pylon[0], pylon[1] + 2.4, pylon[2] + dz], yaw, width: 1.05, height: 2.6, background: '#1d2a44', ink: '#ffffff' });
    const display: [CarModelId, string, number, number, number][] = [
      ['mazda-rx7', '#b3121f', -9.5, -1, .6], ['fennec', '#1f4fa8', 0, -3, 0], ['bronco', '#eef0f2', 9.5, -1, -.6],
    ];
    display.forEach(([modelId, color, dx, dz, yaw], i) => cars.push({ id: `${s.id}-car-${i}`, modelId, color, position: [s.x + dx, floor + .1, s.z + dz], yaw }));
    const outside: [CarModelId, string, number, number][] = [['muscle', '#e7b416', -8, .4], ['cyberpunk', '#16181c', 8, -.4]];
    outside.forEach(([modelId, color, dx, yaw], i) => {
      const x = s.x + dx, z = front + 6;
      cars.push({ id: `${s.id}-forecourt-${i}`, modelId, color, position: [x, terrainHeight(x, z) + .06, z], yaw });
    });
    for (const car of cars) collide(`${car.id}-body`, [car.position[0], car.position[1] + .75, car.position[2]], [2.1, 1.5, 4.6], car.yaw);
    footprints.push({ id: s.id, x: s.x, z: s.z, width: s.width, depth: s.depth, roof: '#e8e8e4' });
    clear(s.x, s.z + s.forecourtDepth / 2 + 4, s.width + 6, s.depth + s.forecourtDepth + 8);
  }

  // Towers: dark glass bodies wrapped by floor bands and vertical fins, with a lit crown and name board.
  for (const t of CHALAKKUDY_TOWERS) {
    const floor = plinth(t.id, t, '#b5afa3'), f = t.facing, front = t.z + f * t.depth / 2, H = t.height;
    const body: V3 = [t.x, floor + H / 2, t.z];
    solid(body, [t.width, H, t.depth], t.glass); collide(`${t.id}-shell`, body, [t.width + .4, H, t.depth + .4]);
    for (let y = 4.5; y < H - 1; y += 3.6) solid([t.x, floor + y, t.z], [t.width + .2, .32, t.depth + .2], t.frame);
    for (let dx = -t.width / 2 + 1.5; dx <= t.width / 2 - 1.5; dx += 3) for (const side of [-1, 1]) solid([t.x + dx, floor + H / 2, t.z + side * (t.depth / 2 + .1)], [.2, H, .25], t.frame);
    for (let dz = -t.depth / 2 + 1.5; dz <= t.depth / 2 - 1.5; dz += 3) for (const side of [-1, 1]) solid([t.x + side * (t.width / 2 + .1), floor + H / 2, t.z + dz], [.25, H, .2], t.frame);
    solid([t.x, floor + H + 1.4, t.z], [t.width - 3, 2.8, t.depth - 3], t.frame);
    piece('glow', [t.x, floor + H + .1, t.z], [t.width + .3, .2, t.depth + .3], '#cfe9ff');
    solid([t.x, floor + H + 1.4, front - f * 1.4], [t.width - 4, 2, .2], t.accent);
    signs.push({ id: t.id, label: t.label, position: [t.x, floor + H + 1.4, front - f * 1.28], yaw: f > 0 ? 0 : Math.PI, width: t.width - 4.6, height: 1.6, background: t.accent, ink: '#ffffff' });
    // Lobby: a lower glass storey behind a canopy.
    piece('glass', [t.x, floor + 2.1, front + f * .18], [t.width - 4, 3.8, .1], '#b6d6e3');
    solid([t.x, floor + 4.3, front + f * 1.4], [t.width - 2, .3, 2.8], t.frame);
    solid([t.x, floor + 1.5, front + f * .24], [2.4, 3, .08], '#26303a');
    footprints.push({ id: t.id, x: t.x, z: t.z, width: t.width, depth: t.depth, roof: t.frame });
    clear(t.x, t.z, t.width, t.depth);
  }

  // Bridges: deck, walkways, parapets, piers, and a cable-stayed pylon pair at mid-span.
  for (const b of CHALAKKUDY_BRIDGES) {
    const frame = bridgeFrame(b), L = frame.length, pitch = -Math.atan(frame.grade), cos = Math.cos(pitch);
    const px = frame.uz, pz = -frame.ux; // across, to the right of travel
    const at = (along: number, across: number, lift = 0): V3 => [b.from[0] + frame.ux * along + px * across, frame.heightAt(along) + lift, b.from[2] + frame.uz * along + pz * across];
    const deckPiece = (material: CityMaterial, across: number, lift: number, size: V3, color: string, id?: string) => {
      const p = at(L / 2, across, lift), s: V3 = [size[0], size[1], size[2] / cos];
      piece(material, p, s, color, frame.yaw, pitch);
      if (id) collide(id, p, s, frame.yaw, pitch);
    };
    // The collider's top is the deck line; the visible slab sits a little lower under a non-casting surface.
    { const p = at(L / 2, 0, -.6), s: V3 = [b.width, 1.2, (L + 1) / cos]; collide(`${b.id}-deck`, p, s, frame.yaw, pitch); }
    deckPiece('solid', 0, -.9, [b.width, 1.2, L + 1], '#b9b5ab');
    deckPiece('ground', 0, -.14, [b.width, .3, L + 1], '#595e5b');
    for (const side of [-1, 1]) {
      deckPiece('ground', side * (b.width / 2 - 1), -.13, [2, .3, L + 1], '#cfc8ba');
      deckPiece('solid', side * (b.width / 2 - .25), .55, [.5, 1.1, L + 1], '#e4e0d8', `${b.id}-parapet-${side}`);
    }
    // Piers down to the river bed or bank, beneath each deck edge.
    for (let along = 14; along < L - 10; along += 20) {
      if (Math.abs(along - L / 2) < 6) continue;
      for (const across of [-5, 5]) {
        const top = at(along, across, -1.2), ground = terrainHeight(top[0], top[2]) - 1, h = top[1] - ground;
        if (h < 1) continue;
        const p: V3 = [top[0], ground + h / 2, top[2]];
        solid(p, [2, h, 2.6], '#a9a498', frame.yaw); collide(`${b.id}-pier-${along}-${across}`, p, [2, h, 2.6], frame.yaw);
      }
      solid(at(along, 0, -1.6), [b.width - 2, .8, 2.2], '#a9a498', frame.yaw);
    }
    // Pylons outside each parapet, joined by a crossbeam high above the road.
    const mid = L / 2, deckY = frame.heightAt(mid), topY = deckY + 26, pylonAcross = b.width / 2 + 1.3;
    for (const side of [-1, 1]) {
      const base = at(mid, side * pylonAcross), ground = terrainHeight(base[0], base[2]) - 1, h = topY - ground;
      const p: V3 = [base[0], ground + h / 2, base[2]];
      solid(p, [2, h, 2.4], '#e9e6df', frame.yaw); collide(`${b.id}-pylon-${side}`, p, [2, h, 2.4], frame.yaw);
      // Fan of stay cables to the deck edge, both ways along the span.
      for (const dir of [-1, 1]) for (const k of [1, 2, 3, 4]) {
        const anchor = at(mid + dir * k * 8.5, side * (b.width / 2 - .4), 1.1), top: V3 = [base[0], topY - 2 - k * 2.2, base[2]];
        const dx = anchor[0] - top[0], dy = anchor[1] - top[1], dz = anchor[2] - top[2], horizontal = Math.hypot(dx, dz), length = Math.hypot(horizontal, dy);
        piece('solid', [(anchor[0] + top[0]) / 2, (anchor[1] + top[1]) / 2, (anchor[2] + top[2]) / 2], [.14, .14, length], '#f2f0ea', Math.atan2(dx, dz), -Math.atan2(dy, horizontal));
      }
      piece('glow', [base[0], topY + .3, base[2]], [1.2, .4, 1.2], '#ffb4a0');
    }
    solid(at(mid, 0, 24.5), [b.width + 4.6, 1.6, 1.8], '#e9e6df', frame.yaw);
    for (const [dir, yaw] of [[-1, frame.yaw + Math.PI], [1, frame.yaw]] as const) {
      const p = at(mid + dir * .95, 0, 24.5);
      signs.push({ id: `${b.id}-${dir}`, label: b.label, position: p, yaw, width: 11, height: 1.2, background: '#1f2a36', ink: '#ffffff' });
    }
    // Lamps along the parapets.
    for (let along = 10; along < L - 5; along += 20) for (const side of [-1, 1]) {
      const base = at(along, side * (b.width / 2 - .25), 1.1), arm = at(along, side * (b.width / 2 - 1.6), 7.2);
      solid([base[0], base[1] + 3, base[2]], [.16, 6, .16], '#4a4f55');
      piece('glow', arm, [.35, .14, .6], '#fff4d6', frame.yaw);
    }
    // Lane paint on the deck, following its grade.
    const deckAt = (along: number, across: number): [number, number] => { const p = at(along, across); return [p[0], p[2]]; };
    for (let along = 1; along < L - 1; along += 3) {
      const end = Math.min(L - 1, along + 3);
      for (const o of [-.18, .18]) paint.push({ a: deckAt(along, o), b: deckAt(end, o), width: .12, color: YELLOW });
      for (const o of [-CITY_ROAD_WIDTH_M / 2 + .35, CITY_ROAD_WIDTH_M / 2 - .35]) paint.push({ a: deckAt(along, o), b: deckAt(end, o), width: .15, color: WHITE });
      if (Math.floor(along / 3) % 3 === 0) for (const o of [-CITY_LANE_WIDTH_M, CITY_LANE_WIDTH_M]) paint.push({ a: deckAt(along, o), b: deckAt(end, o), width: .14, color: WHITE });
    }
    const xs = [b.from[0], b.to[0]], zs = [b.from[2], b.to[2]];
    clearAreas.push({ xMin: Math.min(...xs) - 14, xMax: Math.max(...xs) + 14, zMin: Math.min(...zs) - 14, zMax: Math.max(...zs) + 14 });
  }

  // Four-lane markings along each road's grounded samples: double yellow centre, dashed lanes, solid edges.
  const cityRoutes = CHALAKKUDY_CITY_ROADS.map(plan => V2_ROUTES.find(r => r.id === plan.id)!);
  const carRoutes: ExpansionRoute[] = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES].filter(r => r.allowedModes.includes('car'));
  const existingBoxes = [...staticArchitectureBoxes(), ...v2DressingBoxes(), ...CHALAKKUDY_STREET.boxes];
  const inJunction = (route: ExpansionRoute, x: number, z: number) => cityRoutes.some(other => other !== route && distanceToPolyline(x, z, other.points) < CITY_ROAD_WIDTH_M / 2 + 2);
  const overlapsBox = (x: number, z: number, margin: number) => [...boxes, ...existingBoxes].some(b => {
    const dx = x - b.position[0], dz = z - b.position[2], yaw = b.rotation[1];
    return Math.abs(Math.cos(yaw) * dx - Math.sin(yaw) * dz) < b.size[0] / 2 + margin && Math.abs(Math.sin(yaw) * dx + Math.cos(yaw) * dz) < b.size[2] / 2 + margin;
  });
  for (const route of cityRoutes) {
    const pts = route.points, n = pts.length, dist = [0];
    for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
    const normal = (i: number): [number, number] => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      return [-(b[2] - a[2]) / l, (b[0] - a[0]) / l];
    };
    const off = (i: number, o: number): [number, number] => { const [nx, nz] = normal(i); return [pts[i][0] + nx * o, pts[i][2] + nz * o]; };
    const junction = pts.map(p => inJunction(route, p[0], p[2]));
    for (let i = 1; i < n; i++) {
      if (junction[i] || junction[i - 1]) continue;
      const strip = (o: number, width: number, color: string) => paint.push({ a: off(i - 1, o), b: off(i, o), width, color });
      for (const o of [-.18, .18]) strip(o, .12, YELLOW);
      for (const o of [-CITY_ROAD_WIDTH_M / 2 + .35, CITY_ROAD_WIDTH_M / 2 - .35]) strip(o, .15, WHITE);
      if (Math.floor((dist[i - 1] + dist[i]) / 6) % 3 === 0) for (const o of [-CITY_LANE_WIDTH_M, CITY_LANE_WIDTH_M]) strip(o, .14, WHITE);
    }
    // Zebra crossings just outside each junction, striped along the direction of travel.
    for (let i = 1; i < n; i++) {
      if (junction[i] === junction[i - 1]) continue;
      const outside = junction[i] ? i - 1 : i, step = junction[i] ? -1 : 1;
      const far = Math.max(0, Math.min(n - 1, outside + step * 2));
      for (let o = -CITY_ROAD_WIDTH_M / 2 + 1; o <= CITY_ROAD_WIDTH_M / 2 - 1; o += 1.2) paint.push({ a: off(outside, o), b: off(far, o), width: .6, color: WHITE });
    }

    // Street lights on both kerbs, clear of other roads and buildings, and only on level shoulders.
    for (let s = 12, i = 0; s < dist[n - 1] - 4; s += 24) {
      while (i < n - 1 && dist[i] < s) i++;
      for (const side of [-1, 1]) {
        const [nx, nz] = normal(i), o = side * (CITY_ROAD_WIDTH_M / 2 + 1.4), [x, z] = off(i, o);
        if (carRoutes.some(r => r !== route && distanceToPolyline(x, z, r.points) < r.widthM / 2 + 1.5)) continue;
        if (overlapsBox(x, z, .6) || cityBridgeDeckAt(x, z) !== null || isWater(x, z)) continue;
        const y = terrainHeight(x, z);
        if (Math.abs(y - pts[i][1]) > .4) continue;
        const yaw = Math.atan2(-nx * side, -nz * side);
        solid([x, y + 3.5, z], [.18, 7, .18], '#4a4f55');
        solid([x - nx * side * .8, y + 6.95, z - nz * side * .8], [.1, .1, 1.7], '#4a4f55', yaw);
        piece('glow', [x - nx * side * 1.55, y + 6.85, z - nz * side * 1.55], [.35, .14, .6], '#fff4d6', yaw);
        collide(`city-light-${route.id}-${s}-${side}`, [x, y + 3.5, z], [.3, 7, .3]);
      }
    }
  }

  // NH 544 direction boards on the kerb, facing oncoming traffic; the end boards stand before the road's end.
  for (const plan of CHALAKKUDY_ROAD_SIGNS) {
    const route = cityRoutes.find(r => r.id === plan.route)!, pts = route.points;
    let total = 0; const dist = pts.map((p, i) => (total += i ? Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) : 0));
    const target = plan.along === 'end' ? total - 28 : plan.along;
    const i = Math.max(1, dist.findIndex(d => d >= target)), a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const tx = (b[0] - a[0]) / l, tz = (b[2] - a[2]) / l;
    const side = [-1, 1].find(side => {
      const x = b[0] - tz * side * (CITY_ROAD_WIDTH_M / 2 + 3), z = b[2] + tx * side * (CITY_ROAD_WIDTH_M / 2 + 3);
      return !overlapsBox(x, z, 4) && !carRoutes.some(r => distanceToPolyline(x, z, r.points) < r.widthM / 2 + 1) && !isWater(x, z) && Math.abs(terrainHeight(x, z) - b[1]) < 1.5;
    });
    if (side === undefined) continue;
    const x = b[0] - tz * side * (CITY_ROAD_WIDTH_M / 2 + 3), z = b[2] + tx * side * (CITY_ROAD_WIDTH_M / 2 + 3), y = terrainHeight(x, z), yaw = Math.atan2(-tx, -tz);
    const id = `city-nh-sign-${plan.route}-${plan.along}`;
    for (const o of [-2.6, 2.6]) {
      const p: V3 = [x + Math.cos(yaw) * o, y + 2.6, z - Math.sin(yaw) * o];
      solid(p, [.22, 5.2, .22], '#6b7075'); collide(`${id}-post-${o}`, p, [.3, 5.2, .3]);
    }
    solid([x, y + 5.3, z], [6, 1.9, .16], '#1d6b3c', yaw);
    signs.push({ id, label: plan.label, position: [x + Math.sin(yaw) * .1, y + 5.3, z + Math.cos(yaw) * .1], yaw, width: 5.8, height: 1.7, background: '#1d6b3c', ink: '#ffffff' });
  }

  // Gateway board for arrivals from the forest road and Kodakara.
  {
    const g = CHALAKKUDY_GATEWAY, y = terrainHeight(g.x, g.z);
    for (const dx of [-3.4, 3.4]) { const p: V3 = [g.x + dx, y + 2.6, g.z]; solid(p, [.35, 5.2, .35], '#3a4450'); collide(`city-gateway-post-${dx}`, p, [.35, 5.2, .35]); }
    solid([g.x, y + 4.4, g.z], [7.4, 1.8, .3], '#1f2a36');
    signs.push({ id: 'city-gateway', label: g.label, position: [g.x, y + 4.4, g.z - .17], yaw: Math.PI, width: 7, height: 1.6, background: '#1f2a36', ink: '#ffd88a' });
  }

  return { pieces, boxes, signs, paint, cars, footprints, clearAreas };
}

export const CHALAKKUDY_CITY = createCity();

/** Colliders shared by the client physics and the authoritative multiplayer simulation. */
export function chalakkudyCityBoxes(): TraversalBox[] {
  return CHALAKKUDY_CITY.boxes;
}
