import type { Vec3 } from '../../contracts';

/**
 * Tier A Chalakkudy city plan: pure data, no terrain imports, so the canonical V2 layout
 * (which drives terrain levelling) can include the four-lane roads without a cycle.
 * All coordinates are world metres on the levelled Chalakkudy town pad (y = 49).
 */
export const CITY_PAD_Y = 49;
/** Four 3.5 m lanes. */
export const CITY_LANE_WIDTH_M = 3.5;
export const CITY_ROAD_WIDTH_M = CITY_LANE_WIDTH_M * 4;

export interface CityRoadPlan { id: string; label: string; points: readonly Vec3[] }
/**
 * Four-lane network. Every road ends on dry ground: rivers are crossed by the separate bridge decks
 * below, whose ends coincide with road ends. Control-point grades stay at or below 10%.
 */
export const NH_LABEL = 'NH 544';
export const CHALAKKUDY_CITY_ROADS: readonly CityRoadPlan[] = [
  { id: 'chalakkudy-mg-road', label: 'MG Road', points: [[-548, CITY_PAD_Y, -60], [-305, CITY_PAD_Y, -60], [-276.5, 47, -57]] },
  { id: 'chalakkudy-boulevard', label: 'Chalakkudy Boulevard', points: [[-430, CITY_PAD_Y, -60], [-430, CITY_PAD_Y, -188]] },
  // National highway loop, clockwise: Chalakkudy → Kodakara → Kurumali Highway Bridge → Kodaly junction,
  // then up the ghat → Chalakkudy East → MG Road Bridge → back into Chalakkudy.
  { id: 'chalakkudy-kodakara-highway', label: `${NH_LABEL} · Chalakkudy–Kodakara–Kodaly`, points: [[-430, CITY_PAD_Y, -155], [-340, 40.5, -200], [-280, 35, -203], [-210, 32, -200], [-190, 31.62, -197.14], [-130, 26.2, -186], [-100, 22.5, -146]] },
  { id: 'chalakkudy-kodaly-highway', label: `${NH_LABEL} · Kodaly–Chalakkudy`, points: [[-209.3, 39, -0.2], [-175, 37.5, 0], [-150, 37, 0], [-150, 30, 100], [-104, 28, 110], [-100, 13.8, -58]] },
  { id: 'chalakkudy-kodaly-road', label: 'Kodaly Road', points: [[-100, 13.8, -58], [-80, 13.4, -54], [-46, 13, -48]] },
  { id: 'chalakkudy-riverside-road', label: 'Riverside Road', points: [[-202, 44, -116.5], [-275, 46.5, -120], [-292, 48.09, -58.63]] },
  { id: 'chalakkudy-east-link', label: 'Link Road', points: [[-168, 38, -48.5], [-168, 37.36, 0]] },
  // Airport Road: off MG Road, over the Chalakkudy River, then a long easy descent to Nedumbassery's forecourt.
  { id: 'chalakkudy-airport-link', label: 'Airport Road', points: [[-500, CITY_PAD_Y, -60], [-500, 48.8, -48]] },
  // Straight on off the bridge, one broad bend west, and a single even descent north of the airfield to the
  // terminal's turning circle.
  { id: 'nedumbassery-airport-road', label: 'Airport Road', points: [[-500, 40, 50], [-510, 38.59, 68], [-570, 34.5, 70], [-660, 28.34, 66], [-718, 24.3, 78]] },
];

/** Green direction boards beside the carriageway, `along` metres from the road's start, facing its traffic. */
export interface CityRoadSignPlan { route: string; along: number | 'end'; label: string }
export const CHALAKKUDY_ROAD_SIGNS: readonly CityRoadSignPlan[] = [
  { route: 'chalakkudy-kodakara-highway', along: 30, label: `${NH_LABEL} · Kodakara · Kodaly` },
  { route: 'chalakkudy-kodakara-highway', along: 175, label: `Kodakara · ${NH_LABEL} → Kodaly` },
  { route: 'chalakkudy-kodakara-highway', along: 'end', label: `${NH_LABEL} · Kurumali Bridge → Kodaly` },
  { route: 'chalakkudy-kodaly-highway', along: 40, label: `${NH_LABEL} · Kodaly ghat` },
  { route: 'chalakkudy-kodaly-highway', along: 'end', label: `Kodaly → · ${NH_LABEL} ↑ Kodakara` },
  { route: 'chalakkudy-kodaly-road', along: 'end', label: 'Welcome to Kodaly · കൊടാലി' },
  { route: 'chalakkudy-mg-road', along: 'end', label: `${NH_LABEL} → Chalakkudy East · Kodaly` },
  { route: 'nedumbassery-airport-road', along: 20, label: 'Nedumbassery Airport · നെടുമ്പാശ്ശേരി' },
];

/** A straight, evenly graded deck between two road ends (feet heights at each end). */
export interface CityBridgePlan {
  id: string; label: string; from: Vec3; to: Vec3; /** Carriageway plus walkways. */ width: number;
  /** 'cable': four-lane cable-stayed city bridge (the default). 'beam': a plain two-lane girder span. */
  style?: 'cable' | 'beam';
  /** What passes beneath: a river (the default) or a footpath cutting. */
  crosses?: 'river' | 'path';
}
export const CHALAKKUDY_BRIDGES: readonly CityBridgePlan[] = [
  // Across the Kurumalippuzha, perpendicular to the reach: MG Road to the highway at Chalakkudy East.
  { id: 'chalakkudy-mg-bridge', label: 'MG Road Bridge', from: [-276.5, 47, -57], to: [-209.3, 39, -0.2], width: 18 },
  // North crossing: the Link Road to Riverside Road, which runs along the west bank to the MG Road bridgehead.
  { id: 'chalakkudy-north-bridge', label: 'Kurumali North Bridge', from: [-168, 38, -48.5], to: [-202, 44, -116.5], width: 18 },  // National highway over the Kurumalippuzha–Kurumali confluence: Kodakara side to the Kodaly junction.
  { id: 'kurumali-highway-bridge', label: `${NH_LABEL} · Kurumali Bridge`, from: [-100, 13.8, -58], to: [-100, 22.5, -146], width: 18 },
  // Airport Road over the Chalakkudy River, south from MG Road.
  { id: 'chalakkudy-airport-bridge', label: 'Airport Road Bridge', from: [-500, 48.8, -48], to: [-500, 40, 50], width: 18 },
  // The Chokkana road on its embankment through the Athirappilly gorge floor, over the lower-view footpath.
  { id: 'athirappilly-trail-bridge', label: 'Athirappilly Trail Bridge', from: [-572.4, 74.5, -319.5], to: [-581.6, 74.5, -356.4], width: 9, style: 'beam', crosses: 'path' },
];

/** Deck frame: unit axis, length, and the local position of a point (along from `from`, across to the right). */
export function bridgeFrame(bridge: CityBridgePlan) {
  const dx = bridge.to[0] - bridge.from[0], dz = bridge.to[2] - bridge.from[2], length = Math.hypot(dx, dz);
  const ux = dx / length, uz = dz / length;
  const local = (x: number, z: number) => ({ along: (x - bridge.from[0]) * ux + (z - bridge.from[2]) * uz, across: (x - bridge.from[0]) * uz - (z - bridge.from[2]) * ux });
  const heightAt = (along: number) => bridge.from[1] + (bridge.to[1] - bridge.from[1]) * along / length;
  return { ux, uz, length, local, heightAt, yaw: Math.atan2(dx, dz), grade: (bridge.to[1] - bridge.from[1]) / length };
}

/**
 * Walkable deck height, or null. The footprint stops just short of each road end so the road's own
 * last sample stays grounded on terrain; the collider itself overlaps the road by half a metre.
 */
export function cityBridgeDeckAt(x: number, z: number): number | null {
  let height: number | null = null;
  for (const bridge of CHALAKKUDY_BRIDGES) {
    const frame = bridgeFrame(bridge), { along, across } = frame.local(x, z);
    if (along >= .75 && along <= frame.length - .75 && Math.abs(across) <= bridge.width / 2) height = Math.max(height ?? -Infinity, frame.heightAt(along));
  }
  return height;
}

/**
 * How far the ground is dug out beneath a deck, or null away from the spans. Abutment ramps fade in
 * over the first and last stretch, so only the span itself is excavated and every deck keeps air under it.
 */
export function cityBridgeUnderside(x: number, z: number): { target: number; weight: number } | null {
  let result: { target: number; weight: number } | null = null;
  const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  for (const bridge of CHALAKKUDY_BRIDGES) {
    const frame = bridgeFrame(bridge), { along, across } = frame.local(x, z);
    const ends = Math.min(smooth((along - 8) / 8), smooth((frame.length - 8 - along) / 8));
    const sides = 1 - smooth((Math.abs(across) - bridge.width / 2) / 10);
    const weight = ends * sides;
    if (weight <= 0) continue;
    const target = frame.heightAt(Math.max(0, Math.min(frame.length, along))) - 3.5;
    if (!result || target < result.target) result = { target, weight };
  }
  return result;
}

/**
 * Abutments: within a dozen metres of each bridge end the ground is laid exactly on the deck line
 * (a few centimetres under it), across the full deck width plus a verge. Without this the road's own
 * blend or the town pad leaves a lip above the deck that cars bump over.
 */
export function cityBridgeAbutment(x: number, z: number): { target: number; weight: number } | null {
  let result: { target: number; weight: number } | null = null;
  const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  for (const bridge of CHALAKKUDY_BRIDGES) {
    const frame = bridgeFrame(bridge), { along, across } = frame.local(x, z);
    const end = Math.min(along, frame.length - along);
    // Deck side only: beyond the end the approach road keeps its own grade.
    if (end > 12 || end < 0) continue;
    const sides = 1 - smooth((Math.abs(across) - bridge.width / 2 - 1) / 6);
    const weight = sides * (1 - smooth((end - 8) / 4)) * smooth(end / 1.5);
    if (weight <= 0) continue;
    const target = frame.heightAt(Math.max(0, Math.min(frame.length, along))) - .04;
    if (!result || weight > result.weight) result = { target, weight };
  }
  return result;
}

/** Highest the ground may reach under a deck (plus a two-metre verge), so no terrain pokes through it. */
export function cityBridgeCeiling(x: number, z: number): number | null {
  let ceiling: number | null = null;
  for (const bridge of CHALAKKUDY_BRIDGES) {
    const frame = bridgeFrame(bridge), { along, across } = frame.local(x, z);
    // From a metre onto the deck: at the very end the road's own last sample must keep its height.
    if (along < 1 || along > frame.length - 1 || Math.abs(across) > bridge.width / 2 + 2) continue;
    const line = frame.heightAt(along) - .08;
    ceiling = Math.min(ceiling ?? Infinity, line);
  }
  return ceiling;
}

/** Levelled city districts beyond the original town pad, each with its own ground height. */
export interface CityDistrictPlan { id: string; label: string; footprint: readonly (readonly [number, number])[]; /** Levelled ground height; omitted keeps the natural terrain (river valleys). */ y?: number }
export const CHALAKKUDY_DISTRICTS: readonly CityDistrictPlan[] = [
  // The Kurumalippuzha valley between the banks, with both bridges: city, but never levelled.
  { id: 'chalakkudy-riverfront', label: 'Chalakkudy Riverfront', footprint: [[-305, -135], [-128, -135], [-128, 5], [-305, 5]] },
  { id: 'chalakkudy-east', label: 'Chalakkudy East', footprint: [[-200, -45], [-128, -45], [-128, 25], [-200, 25]], y: 37 },
];

/** Axis-aligned footprint; `facing` is the world z direction of the entrance. */
export interface CityLot { x: number; z: number; width: number; depth: number; facing: 1 | -1 }

export interface CityStorePlan extends CityLot { id: string; label: string; height: number; wall: string; accent: string; ink: string }

const store = (id: string, x: number, row: 'north' | 'south', label: string, wall: string, accent: string, ink = '#ffffff', height = 5.2): CityStorePlan =>
  row === 'north'
    ? { id, x, z: -76, width: 11, depth: 10, facing: 1, label, height, wall, accent, ink }
    : { id, x, z: -44.5, width: 11, depth: 9, facing: -1, label, height, wall, accent, ink };

/** MG Road retail: the north row leaves a driveway into the mall car park. */
export const CHALAKKUDY_STORES: readonly CityStorePlan[] = [
  store('city-store-fresh-mart', -413, 'north', 'Fresh Mart', '#f2efe8', '#2f8f5b'),
  store('city-store-mobile-zone', -401, 'north', 'Mobile Zone', '#e4e7ea', '#1f5fae', '#ffffff', 7),
  store('city-store-pharmacy', -389, 'north', 'City Pharmacy', '#f4f6f3', '#19a07a'),
  store('city-store-kerala-silks', -357, 'north', 'Kerala Silks', '#efe3cf', '#9b1f3a', '#f6d77a', 7),
  store('city-store-tech-hub', -345, 'north', 'Tech Hub', '#2d3339', '#f08a24'),
  store('city-store-gold-palace', -333, 'north', 'Gold Palace', '#f5ecd6', '#6b1b1b', '#f2c94c', 7),
  store('city-store-sports-arena', -321, 'north', 'Sports Arena', '#e8ecef', '#d6402b'),
  store('city-store-bakes-cakes', -480, 'south', 'Bakes & Cakes', '#fbeee6', '#c2577a'),
  store('city-store-book-nook', -468, 'south', 'Book Nook', '#efe9dc', '#3c5a8a', '#ffffff', 7),
  store('city-store-chai-co', -456, 'south', 'Chai & Co', '#f1e6d2', '#7a4a2a', '#f6e3b8'),
  store('city-store-style-studio', -444, 'south', 'Style Studio', '#2b2b30', '#c9a24a', '#1b1b1e', 7),
  store('city-store-footwear', -412, 'south', 'Footwear Gallery', '#eceae6', '#5b4b8a'),
  store('city-store-optical', -400, 'south', 'Optical World', '#f3f5f7', '#0f7c8c', '#ffffff', 7),
  store('city-store-toy-town', -388, 'south', 'Toy Town', '#fff3d9', '#e35b2c'),
  store('city-store-handlooms', -376, 'south', 'Kerala Handlooms', '#f3ead8', '#2f6b3a', '#f3e2a8', 7),
  // Chalakkudy East: shops on the south side of East Avenue.
  { id: 'city-store-east-mart', x: -194, z: 16.5, width: 11, depth: 10, facing: -1, label: 'East Mart', height: 5.2, wall: '#eef1ee', accent: '#2d7d9a', ink: '#ffffff' },
  { id: 'city-store-east-cafe', x: -182, z: 16.5, width: 11, depth: 10, facing: -1, label: 'River Café', height: 7, wall: '#f4ebdd', accent: '#8a5a2b', ink: '#fbe8c8' },
  { id: 'city-store-east-clinic', x: -170, z: 16.5, width: 11, depth: 10, facing: -1, label: 'City Clinic', height: 5.2, wall: '#f7f8f8', accent: '#1f9a8a', ink: '#ffffff' },
];

/** Glass towers that give Chalakkudy its skyline. */
export interface CityTowerPlan { id: string; label: string; x: number; z: number; width: number; depth: number; height: number; glass: string; frame: string; accent: string; facing: 1 | -1 }
export const CHALAKKUDY_TOWERS: readonly CityTowerPlan[] = [
  { id: 'city-tower-river-view', label: 'River View Towers', x: -187, z: -33, width: 14, depth: 16, height: 42, glass: '#6f9fb8', frame: '#e7e3da', accent: '#2f6f73', facing: 1 },
  { id: 'city-tower-east-plaza', label: 'East Plaza', x: -187, z: -16.5, width: 14, depth: 11, height: 26, glass: '#7cabbd', frame: '#d8d3c8', accent: '#c8553d', facing: 1 },
  { id: 'city-tower-tech-park', label: 'Chalakkudy Tech Park', x: -144, z: -27, width: 22, depth: 18, height: 50, glass: '#5f8fb0', frame: '#eceae4', accent: '#1f5fae', facing: 1 },
];

export const CHALAKKUDY_MALL = {
  id: 'city-central-mall', label: 'Chalakkudy Central Mall',
  x: -352, z: -138, width: 70, depth: 36, height: 16, facing: 1 as const,
  /** Car park between the mall and the MG Road shops, reached by the driveway between the store rows. */
  lot: { x: -350, z: -97, width: 64, depth: 22 },
};

export const CHALAKKUDY_SHOWROOM = {
  id: 'city-car-showroom', label: 'Chalakkudy Motors',
  x: -532, z: -160, width: 32, depth: 20, height: 7, facing: 1 as const,
  /** Walk-in doorway through the glass front, centred. */
  doorWidth: 6,
  forecourtDepth: 12,
};

/** Where arrivals from the forest road and Kodakara first see the city. */
export const CHALAKKUDY_GATEWAY = { x: -441, z: -172, label: 'Welcome to Chalakkudy · ചാലക്കുടി' };
