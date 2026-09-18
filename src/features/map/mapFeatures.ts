import type { Vec3 } from '../../contracts';
import { CHALAKKUDY_STREET, EXPANSION_LAYOUT, LANDMARKS, V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import { GLIDER_LAUNCH } from '../../content/world/gliderSites';
import { STADIUM, stadiumToWorld } from '../../content/world/stadiumLayout';
import { staticArchitectureBoxes, canopyArchitectureBoxes } from '../../content/world/staticArchitecture';
import { TOWN_BUILDINGS } from '../../content/world/v2Dressing';
import { CHALAKKUDY_CITY } from '../../content/world/chalakkudyCity';
import { stuntSites } from '../../game/world/stuntSites';
import type { TranslationKey } from '../i18n/translate';

export type HighlightKind = 'paragliding' | 'stadium' | 'stunt-park' | 'river-jump' | 'water-park' | 'waterfall';
export interface Highlight { id: string; kind: HighlightKind; label: string; position: Vec3 }

export const HIGHLIGHT_STYLE: Record<HighlightKind, { color: string; key: TranslationKey }> = {
  paragliding: { color: '#e8912d', key: 'map.paragliding' },
  stadium: { color: '#2f7d4f', key: 'map.stadium' },
  'stunt-park': { color: '#c2452d', key: 'map.stuntPark' },
  'river-jump': { color: '#b8412f', key: 'map.riverJump' },
  'water-park': { color: '#2c7fb8', key: 'map.waterPark' },
  waterfall: { color: '#3b8c9a', key: 'map.waterfall' },
};

const grounded = (x: number, z: number): Vec3 => [x, terrainHeight(x, z), z];

/** The adventure and sightseeing spots worth a detour. Landmarks already on the map are not repeated. */
export function mapHighlights(): Highlight[] {
  const join = stadiumToWorld(STADIUM.join.u, STADIUM.join.v);
  const falls = EXPANSION_LAYOUT.anchors.find(a => a.id === 'athirappilly-falls');
  const park = V2_LAYOUT.park;
  return [
    { id: 'glider-launch', kind: 'paragliding', label: 'Kodassery paragliding', position: [...GLIDER_LAUNCH.position] },
    { id: STADIUM.id, kind: 'stadium', label: STADIUM.label, position: [join.x, STADIUM.groundY, join.z] },
    ...stuntSites().map((site): Highlight => ({ id: site.id, kind: site.kind === 'park' ? 'stunt-park' : 'river-jump', label: site.label, position: [...site.start.position] })),
    { id: park.id, kind: 'water-park', label: park.label, position: grounded(park.center[0], park.center[2]) },
    ...(falls ? [{ id: 'athirappilly-falls', kind: 'waterfall' as const, label: 'Athirappilly Falls', position: [...falls.position] as Vec3 }] : []),
  ];
}

export interface Footprint { id: string; x: number; z: number; width: number; depth: number; yaw: number; roof: string }

/** Real building footprints (original village, canopy homes, towns), for drawing roofs on the map. */
export function buildingFootprints(): Footprint[] {
  const boxes = [...staticArchitectureBoxes(), ...canopyArchitectureBoxes()]
    .filter(b => /^(architecture|canopy)/.test(b.id) && b.size[0] >= 3 && b.size[2] >= 3)
    .map((b, i): Footprint => ({ id: b.id, x: b.position[0], z: b.position[2], width: b.size[0], depth: b.size[2], yaw: b.rotation[1], roof: i % 3 === 0 ? '#b8664a' : i % 3 === 1 ? '#a8573d' : '#c07a52' }));
  const towns = TOWN_BUILDINGS.map((b): Footprint => ({ id: b.id, x: b.x, z: b.z, width: b.width, depth: b.depth, yaw: 0, roof: b.roof }));
  const street = CHALAKKUDY_STREET.buildings.map((b): Footprint => ({ id: b.id, x: b.origin[0], z: b.origin[2], width: b.width, depth: b.depth, yaw: b.yaw, roof: '#a8573d' }));
  const city = CHALAKKUDY_CITY.footprints.map((b): Footprint => ({ ...b, yaw: 0 }));
  return [...boxes, ...towns, ...street, ...city];
}

export interface CityLabel { id: string; label: string; tier: 'A' | 'B' | 'C'; center: readonly [number, number]; footprint: readonly (readonly [number, number])[]; /** Part of a larger town. */ district?: boolean }

/** Towns drawn as built-up districts. Kodaly is the original harbour town. */
export function mapCities(): CityLabel[] {
  return V2_LAYOUT.towns.flatMap(t => [
    { id: t.id, label: t.label, tier: t.tier, center: [t.center[0], t.center[2]] as const, footprint: t.footprint },
    ...(t.districts ?? []).map(d => {
      const xs = d.footprint.map(p => p[0]), zs = d.footprint.map(p => p[1]);
      return { id: d.id, label: d.label, tier: t.tier, district: true, center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as const, footprint: d.footprint };
    }),
  ]);
}

/** Landmarks that sit inside a highlighted spot's circle would double up; keep the landmark list as is. */
export const LANDMARK_IDS = new Set(LANDMARKS.map(l => l.id));
