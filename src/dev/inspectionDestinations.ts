import type { Vec3 } from '../contracts';
import {
  EXPANSION_LAYOUT,
  CHALAKKUDY_STREET,
  LANDMARKS,
  V2_LAYOUT,
  hasGroundAt,
  isSafeGroundSlope,
  isWater,
  terrainHeight,
  walkableDeckHeight,
} from '../content/world/definition';
import { createExpansionPlaces } from '../content/world/expansionPlaces';
import { stuntSites } from '../game/world/stuntSites';
import { GLIDER_LAUNCH } from '../content/world/gliderSites';
import { STADIUM, stadiumToWorld } from '../content/world/stadiumLayout';

export type InspectionDestination = {
  id: string;
  label: string;
  position: Vec3;
  headingRad: number;
  group: 'Existing landmarks' | 'Mountain and forest expansion' | 'V2 planned sites' | 'Stunt parks';
  available: boolean;
  landmarkId?: string;
};

const existingFrontLandmarks = new Set(['tea-shop', 'market', 'lighthouse']);

const existingDestinations: InspectionDestination[] = LANDMARKS.map((landmark) => {
  const front = existingFrontLandmarks.has(landmark.id);
  const x = landmark.position[0];
  const z = landmark.position[2] + (front ? 9 : 0);
  return {
    id: landmark.id,
    landmarkId: landmark.id,
    label: landmark.label,
    position: [x, front ? terrainHeight(x, z) + 0.1 : landmark.position[1] + 0.1, z] as Vec3,
    headingRad: landmark.id === 'temple' ? Math.PI / 2 : front ? 0 : Math.PI,
    group: 'Existing landmarks',
    available: true,
  };
});

const expansionDestinations: InspectionDestination[] = createExpansionPlaces(EXPANSION_LAYOUT).map((place) => ({
  id: place.id,
  landmarkId: place.id,
  label: place.label,
  position: [place.position[0], place.position[1] + 0.1, place.position[2]] as Vec3,
  headingRad: Math.PI,
  group: 'Mountain and forest expansion',
  available: true,
}));

function plannedDestination(id: string, label: string, proposed: Vec3): InspectionDestination {
  const [x, , z] = proposed;
  const deck = walkableDeckHeight(x, z);
  const available = hasGroundAt(x, z) && ((!isWater(x, z) && isSafeGroundSlope(x, z)) || deck !== null);
  return {
    id: `v2-site-${id}`,
    label: `${label} — ${id === 'chalakkudy' ? 'Tier A city centre' : available ? 'planned site only' : 'terrain not built'}`,
    position: available
      ? [x, Math.max(terrainHeight(x, z), deck ?? -Infinity) + 0.1, z] as Vec3
      : proposed,
    headingRad: Math.PI,
    group: 'V2 planned sites',
    available,
  };
}

const plannedDestinations: InspectionDestination[] = [
  ...V2_LAYOUT.towns
    .filter((town) => !town.existing)
    .map((town) => plannedDestination(town.id, town.label, town.center)),
  plannedDestination('silver-storm', V2_LAYOUT.park.label, V2_LAYOUT.park.center),
];

const coffeeApproach = CHALAKKUDY_STREET.buildings.find(b => b.kind === 'coffee')!.approach;

const stuntDestinations: InspectionDestination[] = stuntSites().map(site => ({
  id: `stunt-${site.id}`,
  label: site.label,
  position: [site.start.position[0], site.start.position[1] + 0.1, site.start.position[2]] as Vec3,
  headingRad: site.start.headingRad,
  group: 'Stunt parks',
  available: true,
}));

// Stand just behind the launch circle, facing out along the launch line.
const gliderBackX = GLIDER_LAUNCH.position[0] - Math.sin(GLIDER_LAUNCH.headingRad) * 5, gliderBackZ = GLIDER_LAUNCH.position[2] + Math.cos(GLIDER_LAUNCH.headingRad) * 5;
const gliderApproach: Vec3 = [gliderBackX, terrainHeight(gliderBackX, gliderBackZ) + 0.1, gliderBackZ];

// West of the football join circle, facing east into it (heading π/2 walks +x).
const stadiumApproach = stadiumToWorld(STADIUM.join.u - 5, STADIUM.join.v);

export const INSPECTION_DESTINATIONS: InspectionDestination[] = [
  ...existingDestinations,
  ...expansionDestinations,
  ...plannedDestinations,
  ...stuntDestinations,
  { id: 'glider-launch', label: 'Kodassery Summit — paragliding launch', position: gliderApproach, headingRad: GLIDER_LAUNCH.headingRad, group: 'Mountain and forest expansion', available: true },
  { id: 'kodakara-stadium', label: `${STADIUM.label} — join circle`, position: [stadiumApproach.x, terrainHeight(stadiumApproach.x, stadiumApproach.z) + 0.1, stadiumApproach.z], headingRad: Math.PI / 2, group: 'V2 planned sites', available: true },
  // South road, facing north up to the banyan (heading 0 walks −z).
  { id: 'kodaly-banyan', label: 'Kodaly — Banyan circle', position: [30, terrainHeight(30, 30) + 0.1, 30], headingRad: 0, group: 'Existing landmarks', available: true },
  { id: 'kodaly-banyan-far', label: 'Kodaly — Banyan from the harbour road', position: [36, terrainHeight(36, 58) + 0.1, 58], headingRad: 0, group: 'Existing landmarks', available: true },
  { id: 'kodaly-banyan-east', label: 'Kodaly — Banyan from the east avenue', position: [75, terrainHeight(75, -18) + 0.1, -18], headingRad: -Math.PI / 2, group: 'Existing landmarks', available: true },
  { id: 'v2-chalakkudy-coffee', label: 'Chalakkudy — coffee street', position: coffeeApproach, headingRad: Math.PI, group: 'V2 planned sites', available: true },
  // Heading 0 walks −z: the mall and showroom fronts face +z.
  { id: 'v2-chalakkudy-mall', label: 'Chalakkudy — Central Mall and car park', position: [-373, terrainHeight(-373, -90) + 0.1, -90], headingRad: 0, group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-showroom', label: 'Chalakkudy — Motors car showroom', position: [-532, terrainHeight(-532, -128) + 0.1, -128], headingRad: 0, group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-mg-road', label: 'Chalakkudy — four-lane MG Road', position: [-540, terrainHeight(-540, -62) + 0.1, -62], headingRad: Math.PI / 2, group: 'V2 planned sites', available: true },
  // West bridgehead facing the MG Road bridge (heading = atan2(dx, -dz) toward the far end).
  { id: 'v2-chalakkudy-mg-bridge', label: 'Chalakkudy — MG Road bridge over the Kurumalippuzha', position: [-290, terrainHeight(-290, -68) + 0.1, -68], headingRad: Math.atan2(67.2, -56.8), group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-east', label: 'Chalakkudy East — towers and East Avenue', position: [-160, terrainHeight(-160, 8) + 0.1, 8], headingRad: -Math.PI / 2, group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-north-bridge', label: 'Chalakkudy — Kurumali North Bridge', position: [-168, terrainHeight(-168, -38) + 0.1, -38], headingRad: Math.atan2(-34, 68), group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-kodaly-ghat', label: 'Chalakkudy–Kodaly Highway — ghat descent', position: [-104, terrainHeight(-104, 60) + 0.1, 60], headingRad: 0, group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-kurumali-bridge', label: 'NH 544 — Kurumali Bridge (Kodaly junction)', position: [-100, terrainHeight(-100, -52) + 0.1, -52], headingRad: 0, group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-nh-kodakara', label: 'NH 544 — Kodakara junction', position: [-196, terrainHeight(-196, -185) + 0.1, -185], headingRad: Math.atan2(60, -19), group: 'V2 planned sites', available: true },
  { id: 'v2-chalakkudy-mg-junction', label: 'Chalakkudy — MG Road / Boulevard junction', position: [-450, terrainHeight(-450, -62) + 0.1, -62], headingRad: Math.PI / 2, group: 'V2 planned sites', available: true },
];
