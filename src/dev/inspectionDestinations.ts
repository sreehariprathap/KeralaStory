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
    label: `${label} — ${id === 'chalakkudy' ? 'first street blockout' : available ? 'planned site only' : 'terrain not built'}`,
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

export const INSPECTION_DESTINATIONS: InspectionDestination[] = [
  ...existingDestinations,
  ...expansionDestinations,
  ...plannedDestinations,
  ...stuntDestinations,
  { id: 'glider-launch', label: 'Kodassery Summit — paragliding launch', position: gliderApproach, headingRad: GLIDER_LAUNCH.headingRad, group: 'Mountain and forest expansion', available: true },
  { id: 'v2-chalakkudy-coffee', label: 'Chalakkudy — coffee street', position: coffeeApproach, headingRad: Math.PI, group: 'V2 planned sites', available: true },
];
