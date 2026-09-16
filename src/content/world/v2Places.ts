import type { Landmark, Vec3, ZoneId } from '../../contracts';

/** A position sampled from the active terrain/deck surfaces by the caller. */
export interface GroundedV2PlaceAnchor {
  id: string;
  zoneId: ZoneId;
  position: Vec3;
}

export interface V2PlaceAnchors {
  /** Existing landmarks are carried through unchanged so saves and discoveries remain valid. */
  legacy: readonly Landmark[];
  towns: readonly GroundedV2PlaceAnchor[];
  silverStorm: GroundedV2PlaceAnchor;
  fuelStation: GroundedV2PlaceAnchor;
  coffeeShop: GroundedV2PlaceAnchor;
  malakkapparaTeaStop: GroundedV2PlaceAnchor;
}

type PlaceCopy = Pick<Landmark, 'label' | 'description' | 'iconId' | 'discoveryRadiusM'>;

const TOWN_COPY: Record<string, PlaceCopy> = {
  chalakkudy: {
    label: 'Chalakkudy',
    description: 'A broad river town of tiled shopfronts, busy lanes, and warm evening light.',
    iconId: 'town',
    discoveryRadiusM: 18,
  },
  kodakara: {
    label: 'Kodakara',
    description: 'A compact road-junction town where provision shops and bakery windows face the shade.',
    iconId: 'town',
    discoveryRadiusM: 15,
  },
  malakkappara: {
    label: 'Malakkappara',
    description: 'A small wooded river town upstream, with tiled homes, a narrow bridge, and tea on the bend.',
    iconId: 'town',
    discoveryRadiusM: 14,
  },
};

const PLACE_COPY: Record<'silverStorm' | 'fuelStation' | 'coffeeShop' | 'malakkapparaTeaStop', PlaceCopy> = {
  silverStorm: {
    label: 'Silver Storm',
    description: 'A bright hillside park sits on a broad terrace, with a cool pool below the forest skyline.',
    iconId: 'sparkle',
    discoveryRadiusM: 16,
  },
  fuelStation: {
    label: 'Chalakkudy Fuel Station',
    description: 'A roadside canopy, humming pumps, and a place to pause before the river road climbs.',
    iconId: 'fuel',
    discoveryRadiusM: 12,
  },
  coffeeShop: {
    label: 'Chalakkudy Coffee Shop',
    description: 'A little coffee shop opens onto the street with a shaded veranda and room for a bicycle.',
    iconId: 'coffee',
    discoveryRadiusM: 10,
  },
  malakkapparaTeaStop: {
    label: 'Malakkappara Tea Stop',
    description: 'A tiled roof, timber bench, and steel tumblers offer a quiet chaya break in the hills.',
    iconId: 'tea',
    discoveryRadiusM: 10,
  },
};

function place(anchor: GroundedV2PlaceAnchor, copy: PlaceCopy): Landmark {
  return { ...anchor, position: [...anchor.position] as Vec3, ...copy };
}

/**
 * Build V2 discovery records from already-grounded anchors. Keeping grounding
 * outside this module avoids a dependency cycle with canonical world assembly.
 */
export function createV2Places(input: V2PlaceAnchors): Landmark[] {
  const townPlaces = input.towns.map((anchor) => {
    const copy = TOWN_COPY[anchor.id];
    if (!copy) throw new RangeError(`No copy registered for V2 town ${anchor.id}`);
    return place(anchor, copy);
  });
  const specialPlaces = [
    place(input.silverStorm, PLACE_COPY.silverStorm),
    place(input.fuelStation, PLACE_COPY.fuelStation),
    place(input.coffeeShop, PLACE_COPY.coffeeShop),
    place(input.malakkapparaTeaStop, PLACE_COPY.malakkapparaTeaStop),
  ];
  const result = [...input.legacy, ...townPlaces, ...specialPlaces];
  const ids = new Set<string>();
  for (const landmark of result) {
    if (ids.has(landmark.id)) throw new RangeError(`Duplicate V2 landmark id ${landmark.id}`);
    ids.add(landmark.id);
  }
  return result;
}
