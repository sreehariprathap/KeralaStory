import type { MapBounds, Vec3 } from '../../contracts';
import type { ExpansionLayout, PolygonXZ } from '../../contracts/worldExpansion';
import type { RiverNode, RiverReach, RoadProposal, TownSite, WorldV2Layout } from '../../contracts/worldV2';
import { SUMMIT_TRACK_FOOT, nearestRouteSample } from './expansionLayout';
import { CHALAKKUDY_CITY_ROADS, CHALAKKUDY_DISTRICTS, CITY_ROAD_WIDTH_M } from './chalakkudyCityPlan';
import { NEDUMBASSERY_AIRPORT_PLAN } from './airportPlan';

/** Radius of the round plunge pool at the foot of Peringalkuthu Dam. */
export const DAM_POOL_RADIUS = 22;
const MALAKKAPPARA_RIVER_WIDTH = 24;

const rectangle = (xMin: number, zMin: number, xMax: number, zMax: number): PolygonXZ =>
  [[xMin, zMin], [xMax, zMin], [xMax, zMax], [xMin, zMax]];

/** Review-only blueprint. Does not activate terrain, collision, travel permissions or saves. */
export function createV2Layout(input: {
  expansion: ExpansionLayout;
  existingBounds: MapBounds;
  legacyRiver: readonly Vec3[];
  kodalyCenter: Vec3;
  villageRoadJoin: Vec3;
  parkRoadJoin?: Vec3;
}): WorldV2Layout {
  const { expansion } = input;
  const junction = expansion.anchors.find(a => a.id === 'kodassery-junction')?.position;
  const fallsParking = expansion.routes.find(r => r.id === 'chokkana-main-road')?.points.at(-1);
  const upstream = expansion.waterBodies.find(w => w.id === 'chalakudy-upstream');
  const pool = expansion.waterBodies.find(w => w.id === 'athirappilly-pool');
  if (!junction || !fallsParking || !upstream || !pool || input.legacyRiver.length < 2) {
    throw new RangeError('V2 layout requires the existing junction, falls, water levels and river');
  }
  const base = junction[1];
  const forestJoin = nearestRouteSample(expansion.routes.find(r => r.id === 'chokkana-main-road')!, -565, -290).position;
  const legacyStart = input.legacyRiver[0], legacyEnd = input.legacyRiver.at(-1)!;
  const towns: TownSite[] = [
    { id: 'chalakkudy', label: 'Chalakkudy', tier: 'A', regionId: 'kadambode', footprint: rectangle(-555, -195, -305, -45), center: [-430, 49, -120], existing: false, districts: CHALAKKUDY_DISTRICTS },
    { id: 'kodakara', label: 'Kodakara', tier: 'B', regionId: 'kadambode', footprint: rectangle(-295, -265, -125, -145), center: [-210, 32, -200], existing: false },
    { id: 'kodaly', label: 'Kodaly', tier: 'C', regionId: 'kodaly', footprint: rectangle(-10, -54, 77, 65), center: input.kodalyCenter, existing: true },
    { id: 'malakkappara', label: 'Malakkappara', tier: 'C', regionId: 'kodassery', footprint: rectangle(-615, -755, -495, -625), center: [-555, base + 7, -680], existing: false },
  ];
  // Peringalkuthu Dam: an arch dam in a gorge at the river's headwaters, in the hills at the
  // map's north-west corner. Its lake fills a highland basin behind the crest, with long arms
  // reaching west and east; the spillway drops to the same 'headwaters' basin that already fed
  // the river downstream, so nothing below it moves.
  const damCrestY = base + 10 + 36;
  /**
   * Heights along a road at one even grade from `y0` to `y1`, so no stretch of the climb is steeper
   * than the rest (rounding the bends later shortens the path a little, steepening it evenly).
   */
  function gradedRoad(points: readonly (readonly [number, number])[], y0: number, y1: number): Vec3[] {
    const lengths = points.map((p, i) => i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0);
    const total = lengths.reduce((a, b) => a + b, 0);
    let along = 0;
    return points.map((p, i) => { along += lengths[i]; return [p[0], y0 + (y1 - y0) * along / total, p[1]] as Vec3; });
  }
  const riverNodes: RiverNode[] = [
    { id: 'reservoir-head', kind: 'source', position: [-690, damCrestY, -848] },
    { id: 'reservoir-west-arm', kind: 'source', position: [-818, damCrestY, -838] },
    { id: 'reservoir-east-arm', kind: 'source', position: [-566, damCrestY, -838] },
    { id: 'dam-crest', kind: 'lip', position: [-690, damCrestY, -796] },
    // The spillway lands in a round plunge pool at the foot of the wall, which drains south into the river.
    { id: 'plunge-pool', kind: 'basin', position: [-690, base + 10, -795] },
    { id: 'headwaters', kind: 'basin', position: [-690, base + 10, -795 + 2 * DAM_POOL_RADIUS] },
    { id: 'upper-river-join', kind: 'join', position: [-637, upstream.surfaceY, -493] },
    { id: 'falls-lip', kind: 'lip', position: [-627, upstream.surfaceY, -400] },
    { id: 'falls-base', kind: 'basin', position: [-627, pool.surfaceY, -399] },
    { id: 'pool-exit', kind: 'join', position: [-630, pool.surfaceY, -350] },
    { id: 'river-fork', kind: 'fork', position: [-275, 16, 0] },
    { id: 'main-outlet', kind: 'outlet', position: [-340, 8, 220] },
    { id: 'kurumali-join', kind: 'join', position: legacyStart },
    { id: 'kodaly-estuary', kind: 'outlet', position: legacyEnd },
  ];
  const node = (id: string): Vec3 => riverNodes.find(n => n.id === id)!.position;
  const reach = (id: string, label: string, from: string, to: string, middle: readonly Vec3[], width: number, kind: RiverReach['kind'] = 'channel'): RiverReach => {
    const points = [node(from), ...middle, node(to)];
    return { id, label, from, to, kind, points, widthsM: points.map(() => width) };
  };
  const riverReaches: RiverReach[] = [
    // One broad lake behind the crest: a deep middle and two long, rounded arms west and east. Every band
    // narrows onto the crest's own north-south line, so none passes the spillway lip just south of it.
    {
      id: 'chalakudy-reservoir', label: 'Peringalkuthu Reservoir', from: 'reservoir-head', to: 'dam-crest', kind: 'pool',
      points: [node('reservoir-head'), [-690, damCrestY, -826], [-690, damCrestY, -812], node('dam-crest')],
      widthsM: [92, 84, 60, 44],
    },
    {
      id: 'chalakudy-reservoir-west', label: 'Peringalkuthu Reservoir', from: 'reservoir-west-arm', to: 'dam-crest', kind: 'pool',
      points: [node('reservoir-west-arm'), [-790, damCrestY, -842], [-748, damCrestY, -846], [-712, damCrestY, -838], [-690, damCrestY, -812], node('dam-crest')],
      widthsM: [34, 62, 76, 80, 50, 40],
    },
    {
      id: 'chalakudy-reservoir-east', label: 'Peringalkuthu Reservoir', from: 'reservoir-east-arm', to: 'dam-crest', kind: 'pool',
      points: [node('reservoir-east-arm'), [-592, damCrestY, -842], [-632, damCrestY, -846], [-668, damCrestY, -838], [-690, damCrestY, -812], node('dam-crest')],
      widthsM: [34, 62, 76, 80, 50, 40],
    },
    reach('chalakudy-dam-spillway', 'Peringalkuthu Dam Spillway', 'dam-crest', 'plunge-pool', [], 28, 'waterfall'),
    // A round pool traced as a band along its north-south diameter: each width is the circle's chord there,
    // except the southern half never narrows below the river it feeds, so the outlet opens without a seam.
    (() => {
      const [x, y, z] = node('plunge-pool'), steps = 16;
      const along = Array.from({ length: steps + 1 }, (_, i) => i / steps * 2 * DAM_POOL_RADIUS);
      const points = along.map((d): Vec3 => [x, y, z + d]);
      const widthsM = along.map(d => Math.max(2, 2 * Math.sqrt(Math.max(0, DAM_POOL_RADIUS ** 2 - (d - DAM_POOL_RADIUS) ** 2)), d > DAM_POOL_RADIUS ? MALAKKAPPARA_RIVER_WIDTH : 0));
      return { id: 'chalakudy-plunge-pool', label: 'Peringalkuthu plunge pool', from: 'plunge-pool', to: 'headwaters', kind: 'pool' as const, points, widthsM };
    })(),
    reach('malakkappara-river', 'Chalakkudy River', 'headwaters', 'upper-river-join', [[-670, base + 6, -680], [-650, base + 1, -575]], MALAKKAPPARA_RIVER_WIDTH),
    reach('chalakudy-upstream', 'Chalakkudy River', 'upper-river-join', 'falls-lip', [], 44),
    reach('athirappilly-drop', 'Athirappilly Waterfalls', 'falls-lip', 'falls-base', [], 58, 'waterfall'),
    reach('athirappilly-pool', 'Athirappilly plunge pool', 'falls-base', 'pool-exit', [[-626, pool.surfaceY, -375]], 52, 'pool'),
    reach('chalakudy-downstream', 'Chalakkudy River', 'pool-exit', 'river-fork', [[-635, pool.surfaceY, -245], [-630, 42, -150], [-575, 35, -25], [-435, 24, 5]], 32),
    reach('chalakkudy-outlet', 'Chalakkudy River', 'river-fork', 'main-outlet', [[-310, 11, 100]], 36),
    reach('kurumalippuzha-branch', 'Kurumalippuzha', 'river-fork', 'kurumali-join', [[-220, 12, -65], [-150, legacyStart[1], -100]], 30),
    reach('kurumali-existing', 'Kurumalippuzha', 'kurumali-join', 'kodaly-estuary', input.legacyRiver.slice(1, -1), 42),
  ];
  const roads: RoadProposal[] = [
    { id: 'malakkappara-road', label: 'Malakkappara forest road', widthM: 5.5, points: [fallsParking, [-565, base, -495], [-550, base + 2, -570], [-555, base + 7, -680]] },
    { id: 'chalakkudy-road', label: 'Forest–Chalakkudy road', widthM: 5.5, // Gentler control grades: rounding a corner shortens the path, which steepens the sampled grade.
    points: [forestJoin, [-595, 67, -195], [-565, 58, -100], [-430, 49, -120], [-430, 49, -155]] },
    // Branches off the NH 544 loop east of Kodakara, falling with it through the fork, then on to the village.
    // Joins the village road north of Rajan's tea shop, clear of its steps and bench.
    { id: 'kodakara-road', label: 'Kodakara–village road', widthM: 5.5, points: [[-190, 31.62, -197.14], [-160, 28.8, -200], [-105, 30, -190], [-40, 25.6, -180], [-5, 24.4, -168], input.villageRoadJoin] },
    { id: 'silver-storm-road', label: 'Silver Storm access', widthM: 5.5, points: [input.parkRoadJoin ?? [0, base + 4, -481], [0, base + 6, -515], [105, base + 5, -565], [102, base + 4, -612], [74, base + 4, -625], [38, base + 4, -626]] },
    // Tier A Chalakkudy: four-lane city roads on the levelled town pad.
    ...CHALAKKUDY_CITY_ROADS.map(road => ({ ...road, widthM: CITY_ROAD_WIDTH_M })),
    // Kodaly Road's last stretch narrows to two lanes and threads between the houses into the west
    // avenue of the Banyan circle, so NH 544 runs on into Kodaly instead of stopping at its edge.
    { id: 'kodaly-avenue-link', label: 'Kodaly Road', widthM: 7, points: [[-46, 13, -48], [-22, 12.1, -26], [-9, 11.7, -18]] },
    // Malakkappara to the top of the dam: level out of town between the shops, a wide swing round the
    // valley head to the summit track junction, then back west along the lake's southern shoulder onto
    // the east end of the crest walkway, each leg at one even grade.
    { id: 'chalakudy-dam-road', label: 'Peringalkuthu Dam road', widthM: 5.5,
      points: [[-555, base + 7, -680], [-540, base + 7, -696],
        // A broad U-turn at the valley head. The summit track leaves from the middle of its eastern straight,
        // heading away up the mountain, so the rounded bends never pull the road off the junction.
        ...gradedRoad([[-470, -692], [-365, -716], [-305, -742], [...SUMMIT_TRACK_FOOT.position]], base + 8, SUMMIT_TRACK_FOOT.y),
        ...gradedRoad([[...SUMMIT_TRACK_FOOT.position], [-309, -805], [-478, -812], [-556, -782], [-610, -784], [-658, -797]], SUMMIT_TRACK_FOOT.y, damCrestY + .6).slice(1)] },
  ];
  const park: WorldV2Layout['park'] = {
    id: 'silver-storm', label: 'Silver Storm', footprint: rectangle(-15, -735, 90, -635),
    center: [40, base + 4, -685], poolFootprint: rectangle(52, -725, 77, -710),
  };
  /** Height of a road's surface at the point on it nearest (x, z). */
  const roadHeightAt = (id: string, x: number, z: number) => {
    const road = roads.find(r => r.id === id)!;
    let best = Infinity, height = road.points[0][1];
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
      if (d < best) { best = d; height = a[1] + (b[1] - a[1]) * t; }
    }
    return height;
  };
  const cap = (id: string, road: string, x: number, z: number, radius: number) => ({ id, center: [x, roadHeightAt(road, x, z), z] as Vec3, radius });
  // Turning circles at the roads that end without meeting another; each sits level with its road.
  const roadCaps: WorldV2Layout['roadCaps'] = [
    cap('chalakkudy-mg-road-west-cap', 'chalakkudy-mg-road', -551, -60, 11),
    cap('chalakkudy-boulevard-north-cap', 'chalakkudy-boulevard', -430, -191, 11),
    // Silver Storm's forecourt sits outside the south gate; the park fills its whole footprint.
    cap('silver-storm-forecourt-cap', 'silver-storm-road', 38, -626, 9),
    { id: 'summit-trailhead-cap', center: [-65, base + 2, -482.5], radius: 8 },
    // A lay-by beside the dam road where it tops out, looking over the lake to the dam.
    cap('peringalkuthu-viewpoint-cap', 'chalakudy-dam-road', -626, -781.6, 9),
    cap('nedumbassery-forecourt-cap', 'nedumbassery-airport-road', NEDUMBASSERY_AIRPORT_PLAN.forecourt[0], NEDUMBASSERY_AIRPORT_PLAN.forecourt[1], 12),
  ];
  const airport: WorldV2Layout['airport'] = {
    id: NEDUMBASSERY_AIRPORT_PLAN.id, label: NEDUMBASSERY_AIRPORT_PLAN.label,
    footprint: NEDUMBASSERY_AIRPORT_PLAN.footprint, center: NEDUMBASSERY_AIRPORT_PLAN.center,
  };
  const points: readonly (readonly [number, number])[] = [
    [input.existingBounds.xMin, input.existingBounds.zMin], [input.existingBounds.xMax, input.existingBounds.zMax],
    ...towns.flatMap(t => t.footprint), ...park.footprint, ...airport.footprint,
    // The hills behind the reservoir, so the lake is framed by a skyline rather than the map edge.
    [-690, -935],
    ...roads.flatMap(r => r.points.map(p => [p[0], p[2]] as const)),
    ...riverReaches.flatMap(r => r.points.flatMap((p, i) => {
      const half = r.widthsM[i] / 2;
      return [[p[0] - half, p[2] - half], [p[0] + half, p[2] + half]] as const;
    })),
  ];
  return {
    status: 'layout-approved',
    bounds: { xMin: Math.min(...points.map(p => p[0])) - 20, xMax: Math.max(...points.map(p => p[0])) + 20, zMin: Math.min(...points.map(p => p[1])) - 20, zMax: Math.max(...points.map(p => p[1])) + 20 },
    towns, riverNodes, riverReaches, roads, park, airport,
    roadCaps,
    reviewNotes: [
      'Peringalkuthu Dam impounds the reservoir at the river headwaters, in the hills at the north-west corner; a graded road climbs to its crest from Malakkappara.',
      'Nedumbassery Airport lies on the lowland south-west of Chalakkudy, reached by Airport Road over the Chalakkudy River.',
      'Sneha Theeram is the curved beach between Kodaly\'s headland and the Chalakkudy River mouth.',
      'Malakkappara sits upstream, on the wooded plateau east of the river.',
      'Silver Storm is east/right of the summit, below its skyline; its pool is on the north-east side.',
      'Chalakkudy is the largest town: a Tier A city on both banks of the Kurumalippuzha, joined by two four-lane bridges, with four-lane highways to Kodakara and down the ghat to Kodaly.',
      'Kurumalippuzha joins the existing river crossing; Kodaly keeps its harbor and lighthouse.',
      'The main downstream outlet requires a new shoreline in V2-02; it is not existing sea.',
      'Footprints and control-point elevations are proposed. Grounding, rounded bends and sightlines await V2-02.',
    ],
  };
}
