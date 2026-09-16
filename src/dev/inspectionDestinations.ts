import type { Vec3 } from '../contracts';
import {
  EXPANSION_LAYOUT,
  LANDMARKS,
  V2_LAYOUT,
  hasGroundAt,
  isSafeGroundSlope,
  isWater,
  terrainHeight,
  walkableDeckHeight,
} from '../content/world/definition';
import { createExpansionPlaces } from '../content/world/expansionPlaces';

export type InspectionDestination = {
  id: string;
  label: string;
  position: Vec3;
  headingRad: number;
  group: 'Existing landmarks' | 'Mountain and forest expansion' | 'V2 planned sites';
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
    label: `${label} — ${available ? 'planned site only' : 'terrain not built'}`,
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

export const INSPECTION_DESTINATIONS: InspectionDestination[] = [
  ...existingDestinations,
  ...expansionDestinations,
  ...plannedDestinations,
];
