import type { MapBounds } from '../../contracts';
import type { TraversalBox } from '../../game/world/traversalGeometry';
import { terrainHeight } from './definition';
import { AIRPORT_PAD_Y, NEDUMBASSERY_AIRPORT_PLAN as PLAN, type AirportLot } from './airportPlan';
import { yawPitchToXyz, type CityDisplayCar, type CityFootprint, type CityMaterial, type CityPaint, type CityPiece, type CitySign } from './chalakkudyCity';

type V3 = [number, number, number];
const WHITE = '#f4f3ee', YELLOW = '#e9b930', ASPHALT = '#43474b', CONCRETE = '#a3a49f', ROOF = '#b5532f', ROOF_DARK = '#94432a', CREAM = '#f1e8d6';

/** A parked airliner: nose toward `yaw` (world +Z turned by yaw). Drawn by the renderer; collided here. */
export interface AirportAircraft { id: string; position: V3; yaw: number; livery: string; length: number }

/**
 * Nedumbassery Airport, built from the city kit: runway, taxiways and apron as flush slabs, a long
 * terminal under tiered Kerala roofs, a control tower, a hangar and a car park. Every solid has a
 * collider shared with the multiplayer simulation.
 */
function createAirport() {
  const pieces: CityPiece[] = [], boxes: TraversalBox[] = [], signs: CitySign[] = [], paint: CityPaint[] = [];
  const cars: CityDisplayCar[] = [], footprints: CityFootprint[] = [], clearAreas: MapBounds[] = [], aircraft: AirportAircraft[] = [];
  const piece = (material: CityMaterial, position: V3, size: V3, color: string, yaw = 0, pitch = 0) => pieces.push({ position, size, yaw, pitch, color, material });
  const solid = (position: V3, size: V3, color: string, yaw = 0, pitch = 0) => piece('solid', position, size, color, yaw, pitch);
  const collide = (id: string, position: V3, size: V3, yaw = 0) => boxes.push({ id, position, size, rotation: yawPitchToXyz(yaw, 0) });
  const y0 = AIRPORT_PAD_Y;
  /** A flush slab whose top sits `top` metres above the levelled pad; overlapping slabs step up a centimetre so they never fight. */
  const slab = (xMin: number, xMax: number, zMin: number, zMax: number, color: string, top = .03) =>
    piece('ground', [(xMin + xMax) / 2, y0 + top - .08, (zMin + zMax) / 2], [xMax - xMin, .16, zMax - zMin], color);
  const line = (a: [number, number], b: [number, number], width: number, color: string) => paint.push({ a, b, width, color });

  // Runway: asphalt, piano-key thresholds, a dashed centreline, edge lines and edge lights.
  const r = PLAN.runway, half = r.width / 2;
  slab(r.xMin - 4, r.xMax + 4, r.z - half - 3, r.z + half + 3, '#8d9a73', .01);
  slab(r.xMin, r.xMax, r.z - half, r.z + half, ASPHALT, .045);
  for (const edge of [-1, 1]) line([r.xMin + 2, r.z + edge * (half - .6)], [r.xMax - 2, r.z + edge * (half - .6)], .5, WHITE);
  for (let x = r.xMin + 40; x < r.xMax - 40; x += 22) line([x, r.z], [x + 12, r.z], .7, WHITE);
  for (const [start, dir] of [[r.xMin + 4, 1], [r.xMax - 4, -1]] as const) {
    for (let o = -half + 2.5; o <= half - 2.5; o += 2.6) line([start, r.z + o], [start + dir * 22, r.z + o], 1.4, WHITE);
    // Aiming-point blocks a little further down the strip.
    for (const o of [-5, 5]) line([start + dir * 60, r.z + o], [start + dir * 80, r.z + o], 3, WHITE);
  }
  for (let x = r.xMin; x <= r.xMax; x += 20) for (const edge of [-1, 1]) {
    solid([x, y0 + .2, r.z + edge * (half + 1.2)], [.18, .4, .18], '#3a3f44');
    piece('glow', [x, y0 + .45, r.z + edge * (half + 1.2)], [.3, .16, .3], x === r.xMin || x > r.xMax - 20 ? '#ff6b5a' : '#fff1c4');
  }

  // Apron and the two link taxiways, with yellow guide lines and parking stands.
  const a = PLAN.apron;
  slab(a.xMin, a.xMax, a.zMin, a.zMax, CONCRETE, .035);
  for (const x of PLAN.taxiways) {
    slab(x - 9, x + 9, a.zMax, r.z - half, '#55595c', .02);
    line([x, a.zMax - 6], [x, r.z - half + .5], .35, YELLOW);
  }
  line([PLAN.taxiways[0], a.zMax - 6], [PLAN.taxiways[1], a.zMax - 6], .35, YELLOW);
  const stands = [-618, -562, -506];
  for (const x of stands) {
    line([x, a.zMax - 6], [x, a.zMin + 3], .3, YELLOW);
    line([x - 6, a.zMin + 3], [x + 6, a.zMin + 3], .3, YELLOW);
  }

  // Terminal: glazed hall under two tiers of sloping clay-tile roofs, entrance canopy to the north.
  const t: AirportLot = PLAN.terminal, tH = 8, north = t.z - t.depth / 2, south = t.z + t.depth / 2;
  const floor = Math.max(...[-1, 1].flatMap(dx => [-1, 1].map(dz => terrainHeight(t.x + dx * t.width / 2, t.z + dz * t.depth / 2))));
  solid([t.x, floor + tH / 2, t.z], [t.width, tH, t.depth], CREAM);
  collide('airport-terminal-shell', [t.x, floor + tH / 2, t.z], [t.width + .4, tH, t.depth + .4]);
  for (const z of [north - .06, south + .06]) piece('glass', [t.x, floor + 3.6, z], [t.width - 6, 5.6, .1], '#9cc3d5');
  for (let dx = -t.width / 2 + 3; dx <= t.width / 2 - 3; dx += 4.5) for (const z of [north - .12, south + .12]) solid([t.x + dx, floor + 3.6, z], [.22, 5.8, .14], '#6f5a44');
  // Lower tier: a broad hip roof, overhanging on every side; upper tier: a narrower, steeper crown.
  const roof = (width: number, depth: number, rise: number, baseY: number, color: string) => {
    const slope = Math.atan2(rise, depth / 2), run = Math.hypot(rise, depth / 2);
    for (const side of [-1, 1]) solid([t.x, baseY + rise / 2, t.z + side * depth / 4], [width, .35, run], color, 0, side * slope);
    // Hipped ends, turned to face east and west.
    for (const side of [-1, 1]) solid([t.x + side * (width / 2 - depth / 4), baseY + rise / 2, t.z], [depth, .35, run * .72], color, side * Math.PI / 2, slope);
  };
  roof(t.width + 5, t.depth + 5, 4.2, floor + tH, ROOF);
  solid([t.x, floor + tH + 4.3, t.z], [t.width * .6, 2.6, t.depth * .45], CREAM);
  roof(t.width * .6 + 3, t.depth * .45 + 3, 3.4, floor + tH + 5.4, ROOF_DARK);
  solid([t.x, floor + tH + 8.9, t.z], [t.width * .6 - 2, .5, .5], '#e2c88f');
  // Entrance canopy on slim pillars, and the name board above it.
  solid([t.x, floor + 5.2, north - 4], [36, .45, 8], '#e9e2d0');
  for (const dx of [-16, -8, 0, 8, 16]) { const p: V3 = [t.x + dx, floor + 2.5, north - 7.4]; solid(p, [.4, 5, .4], '#d9d2c0'); collide(`airport-canopy-pillar-${dx}`, p, [.45, 5, .45]); }
  for (const dx of [-6, 6]) solid([t.x + dx, floor + 2.4, north - .1], [3, 4.8, .12], '#26303a');
  signs.push({ id: 'airport-terminal-name', label: 'Nedumbassery Airport · നെടുമ്പാശ്ശേരി', position: [t.x, floor + 6.6, north - 8.3], yaw: Math.PI, width: 24, height: 1.8, background: '#1f3b57', ink: '#ffffff' });
  solid([t.x, floor + 6.6, north - 8.1], [24.6, 2.2, .25], '#1f3b57');
  // Jet bridges from the terminal's airside face to each aircraft's front door, beside the nose.
  for (const x of stands) {
    const bx = x - 3.8, length = a.zMin + 6 - south, p: V3 = [bx, floor + 4.6, south + length / 2];
    solid(p, [3, 3, length], '#d8dcdf'); piece('glass', [bx, floor + 4.9, south + length / 2], [3.06, 1, length - 1], '#9cc3d5');
    const leg: V3 = [bx, floor + 1.55, south + length - 1.5];
    solid(leg, [.6, 3.1, .6], '#6b7075'); collide(`airport-jet-bridge-leg-${x}`, leg, [.8, 3.1, .8]);
  }
  footprints.push({ id: 'airport-terminal', x: t.x, z: t.z, width: t.width, depth: t.depth, roof: ROOF });
  clearAreas.push({ xMin: t.x - t.width / 2 - 12, xMax: t.x + t.width / 2 + 12, zMin: north - 16, zMax: a.zMin });

  // Control tower: a tapering shaft, a glass cab with a wide roof, and a beacon.
  {
    const { x, z } = PLAN.tower, base = terrainHeight(x, z), shaft = 24;
    solid([x, base + shaft / 2, z], [5, shaft, 5], '#e6e1d6'); collide('airport-tower-shaft', [x, base + shaft / 2, z], [5.2, shaft, 5.2]);
    solid([x, base + shaft + .3, z], [9, .6, 9], '#cfc8b8');
    piece('glass', [x, base + shaft + 2.4, z], [8, 3.6, 8], '#7fb3c8');
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) solid([x + dx, base + shaft + 2.4, z + dz], [.3, 3.6, .3], '#3f464d');
    solid([x, base + shaft + 4.5, z], [10, .6, 10], '#3f464d');
    solid([x, base + shaft + 5.6, z], [.3, 2, .3], '#c9ccd0');
    piece('glow', [x, base + shaft + 6.7, z], [.5, .4, .5], '#ff6b5a');
    footprints.push({ id: 'airport-tower', x, z, width: 5, depth: 5, roof: '#3f464d' });
    clearAreas.push({ xMin: x - 8, xMax: x + 8, zMin: z - 8, zMax: z + 8 });
  }

  // Hangar: a tall shed with a barrel roof made of pitched panels, doors open onto its own apron.
  {
    const h: AirportLot = PLAN.hangar, H = 11, base = AIRPORT_PAD_Y;
    slab(h.x - h.width / 2 - 4, h.x + h.width / 2 + 4, h.z + h.depth / 2, a.zMax, CONCRETE);
    slab(h.x - 9, h.x + 9, a.zMax, r.z - half, '#55595c');
    for (const side of [-1, 1]) {
      const p: V3 = [h.x + side * (h.width / 2 - .5), base + H / 2, h.z];
      solid(p, [1, H, h.depth], '#9fb0b8'); collide(`airport-hangar-wall-${side}`, p, [1, H, h.depth]);
    }
    const back: V3 = [h.x, base + H / 2, h.z - h.depth / 2 + .5];
    solid(back, [h.width, H, 1], '#9fb0b8'); collide('airport-hangar-back', back, [h.width, H, 1]);
    // Turned a quarter so each panel's pitch tilts it across the width: low at the eaves, high at the ridge.
    for (const [offset, tilt, lift] of [[-.36, -.5, 1.6], [-.12, -.16, 3.4], [.12, .16, 3.4], [.36, .5, 1.6]] as const)
      solid([h.x + offset * h.width, base + H + lift, h.z], [h.depth + 1, .35, h.width * .27], '#7c8f97', Math.PI / 2, tilt);
    signs.push({ id: 'airport-hangar-name', label: 'KERALA AIR · HANGAR 1', position: [h.x, base + H - 1.4, h.z + h.depth / 2 + .02], yaw: 0, width: 16, height: 1.4, background: '#f1e8d6', ink: '#1f3b57' });
    footprints.push({ id: 'airport-hangar', x: h.x, z: h.z, width: h.width, depth: h.depth, roof: '#7c8f97' });
    clearAreas.push({ xMin: h.x - h.width / 2 - 6, xMax: h.x + h.width / 2 + 6, zMin: h.z - h.depth / 2 - 6, zMax: a.zMax });
  }

  // Car park east of the terminal, with a few cars waiting for arrivals.
  {
    const c: AirportLot = PLAN.carPark;
    slab(c.x - c.width / 2, c.x + c.width / 2, c.z - c.depth / 2, c.z + c.depth / 2, '#5d6163');
    for (let dx = -c.width / 2 + 3; dx <= c.width / 2 - 3; dx += 3) for (const side of [-1, 1])
      line([c.x + dx, c.z + side * 2], [c.x + dx, c.z + side * (c.depth / 2 - 1)], .12, WHITE);
    const models = ['golf-gti', 'toy-car', 'car-carton'] as const;
    ([[-13.5, -6, '#c8553d'], [-4.5, 6, '#2f6f9f'], [7.5, -6, '#e9d8a6']] as const).forEach(([dx, dz, color], i) => {
      const position: V3 = [c.x + dx, terrainHeight(c.x + dx, c.z + dz) + .06, c.z + dz];
      cars.push({ id: `airport-car-${i}`, modelId: models[i], color, position, yaw: dz < 0 ? 0 : Math.PI });
      collide(`airport-car-${i}`, [position[0], position[1] + .8, position[2]], [2, 1.6, 4.2]);
    });
    clearAreas.push({ xMin: c.x - c.width / 2 - 2, xMax: c.x + c.width / 2 + 2, zMin: c.z - c.depth / 2 - 2, zMax: c.z + c.depth / 2 + 2 });
  }

  // Windsock beside the runway's west end.
  {
    const x = r.xMin + 30, z = r.z - half - 12, base = terrainHeight(x, z);
    solid([x, base + 3, z], [.2, 6, .2], '#d9d9d9'); collide('airport-windsock', [x, base + 3, z], [.3, 6, .3]);
    for (let i = 0; i < 4; i++) solid([x + 1 + i * .9, base + 5.8 - i * .12, z], [.9, .8 - i * .12, .8 - i * .12], i % 2 ? '#ffffff' : '#f07a2b');
  }

  // Aircraft on the stands, noses toward the terminal, and a light plane by the hangar.
  stands.forEach((x, i) => {
    if (i === 1) return; // One stand stays free, so the apron reads as a working airport.
    const livery = i === 0 ? '#c8553d' : '#1f7a6a';
    aircraft.push({ id: `airport-aircraft-${i}`, position: [x, y0, a.zMin + 16], yaw: Math.PI, livery, length: 30 });
  });
  aircraft.push({ id: 'airport-aircraft-light', position: [PLAN.hangar.x + 8, y0, a.zMax - 4], yaw: Math.PI * .85, livery: '#e9b930', length: 12 });
  for (const plane of aircraft) {
    const L = plane.length, s = Math.sin(plane.yaw), c = Math.cos(plane.yaw), [x, y, z] = plane.position;
    collide(`${plane.id}-fuselage`, [x, y + L * .13, z], [L * .13, L * .13, L * .95], plane.yaw);
    collide(`${plane.id}-wings`, [x - s * L * .02, y + L * .1, z - c * L * .02], [L * .95, L * .02, L * .16], plane.yaw);
  }

  // The whole pad is kept clear of palms, flowers and stunt parks.
  const xs = PLAN.footprint.map(p => p[0]), zs = PLAN.footprint.map(p => p[1]);
  clearAreas.push({ xMin: Math.min(...xs), xMax: Math.max(...xs), zMin: Math.min(...zs), zMax: Math.max(...zs) });
  return { pieces, boxes, signs, paint, cars, footprints, clearAreas, aircraft };
}

export const NEDUMBASSERY_AIRPORT = createAirport();

/** Colliders shared by the client physics and the authoritative multiplayer simulation. */
export function airportBoxes(): TraversalBox[] {
  return NEDUMBASSERY_AIRPORT.boxes;
}
