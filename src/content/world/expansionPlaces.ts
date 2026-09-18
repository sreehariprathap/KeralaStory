import type { Landmark, Vec3 } from '../../contracts';
import type { ExpansionLayout } from '../../contracts/worldExpansion';

type PlaceCopy = Pick<Landmark, 'label' | 'description' | 'iconId' | 'discoveryRadiusM'>;

const COPY: Record<string, PlaceCopy> = {
  'kodassery-junction': {
    label: 'Kodassery Forest Junction',
    description: 'A painted direction board marks the branch from the old Kodassery road into the forest.',
    iconId: 'signpost',
    discoveryRadiusM: 10,
  },
  'summit-trailhead': {
    label: 'Summit Trailhead',
    description: 'A small shelter and flat parking mark the clear walking entrance to the mountain trail.',
    iconId: 'mountain',
    discoveryRadiusM: 10,
  },
  'kodassery-summit': {
    label: 'Kodassery Summit',
    description: 'A high grass-and-rock terrace opens a broad view from the forest ridge.',
    iconId: 'mountain',
    discoveryRadiusM: 10,
  },
  'chokkana-entry': {
    label: 'Chokkana Forest',
    description: 'A shaded avenue begins beneath broadleaf canopy and dappled light.',
    iconId: 'tree',
    discoveryRadiusM: 10,
  },
  'chokkana-ridge': {
    label: 'Chokkana Ridge Bend',
    description: 'The uphill road opens at a bend with a clear valley sightline and a pull-off.',
    iconId: 'mountain',
    discoveryRadiusM: 10,
  },
  'chokkana-stream': {
    label: 'Chokkana Stream Bridge',
    description: 'A short bridge crosses the stream where the forest road turns toward the falls.',
    iconId: 'bridge',
    discoveryRadiusM: 10,
  },
  'chokkana-tea-stop': {
    label: 'Chokkana Tea Stop',
    description: 'A tiled roof, timber bench, and steel tumblers offer a pause on the return loop.',
    iconId: 'tea',
    discoveryRadiusM: 10,
  },
  'athirappilly-falls': {
    label: 'Athirappilly Upper View',
    description: 'The upper overlook reveals the broad waterfall from dry ground beside the forest road.',
    iconId: 'waves',
    discoveryRadiusM: 10,
  },
  'summit-track-foot': {
    label: 'Summit Track',
    description: 'A graded earth track leaves the plateau and runs dead straight up the open south face to the peak.',
    iconId: 'mountain',
    discoveryRadiusM: 12,
  },
  'athirappilly-lower-view': {
    label: 'Athirappilly Lower View',
    description: 'A separate footpath ends at a dry side-on terrace below the falling water.',
    iconId: 'waves',
    discoveryRadiusM: 10,
  },
};

/** Derive localized landmark records from the frozen layout without importing canonical world assembly. */
export function createExpansionPlaces(layout: ExpansionLayout): Landmark[] {
  return layout.anchors.map((anchor) => {
    const copy = COPY[anchor.id];
    if (!copy) throw new RangeError(`No copy registered for expansion anchor ${anchor.id}`);
    const position: Vec3 = [...anchor.position];
    return { id: anchor.id, zoneId: 'kodassery', position, ...copy };
  });
}
