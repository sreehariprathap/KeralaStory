import type { MapBounds, Vec3 } from '../../contracts';
import type { ExpansionLayout, PolygonXZ } from '../../contracts/worldExpansion';
import type { RiverNode, RiverReach, RoadProposal, TownSite, WorldV2Layout } from '../../contracts/worldV2';
import { nearestRouteSample } from './expansionLayout';
import { CHALAKKUDY_CITY_ROADS, CHALAKKUDY_DISTRICTS, CITY_ROAD_WIDTH_M } from './chalakkudyCityPlan';

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
  // The Chalakkudy Dam: an arch dam impounding a reservoir at the river's headwaters, in the
  // hills at the map's north-west corner. The lake sits behind the crest; the spillway drops
  // to the same 'headwaters' basin that already fed the river downstream, so nothing below it moves.
  // The lake bends east toward Kodassery Peaks so it reads as a real reservoir, not a pond.
  const damCrestY = base + 10 + 46;
  /**
   * A programmatic switchback climb between two fixed rails. Each leg holds a safe grade, and
   * consecutive same-side legs are spaced `2*forwardStep` apart so the rounded, terrain-carved
   * road never overlaps a nearby leg sitting at a very different elevation.
   */
  function hairpinRoad(originX: number, originZ: number, bearing: readonly [number, number], legs: number, amplitude: number, forwardStep: number, riseTotal: number, y0: number): Vec3[] {
    const length = Math.hypot(bearing[0], bearing[1]), fx = bearing[0] / length, fz = bearing[1] / length, nx = -fz, nz = fx;
    const rise = riseTotal / legs;
    return Array.from({ length: legs + 1 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return [originX + fx * forwardStep * i + nx * amplitude * side, y0 + rise * i, originZ + fz * forwardStep * i + nz * amplitude * side] as Vec3;
    });
  }
  const riverNodes: RiverNode[] = [
    { id: 'reservoir-head', kind: 'source', position: [-690, damCrestY, -812] },
    { id: 'reservoir-east-arm', kind: 'source', position: [-612, damCrestY, -802] },
    { id: 'dam-crest', kind: 'lip', position: [-690, damCrestY, -796] },
    { id: 'headwaters', kind: 'basin', position: [-690, base + 10, -790] },
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
    reach('chalakudy-reservoir', 'Chalakkudy Reservoir', 'reservoir-head', 'dam-crest', [], 60, 'pool'),
    // The eastern arm: the lake widens toward Kodassery Peaks, doubling the water's surface area.
    // Its final approach swings back onto the crest's own north-south line before narrowing, so
    // its band never passes near the spillway's lip just south of the crest.
    {
      id: 'chalakudy-reservoir-east', label: 'Chalakkudy Reservoir', from: 'reservoir-east-arm', to: 'dam-crest', kind: 'pool',
      points: [node('reservoir-east-arm'), [-655, damCrestY, -806], [-690, damCrestY, -805], node('dam-crest')],
      widthsM: [72, 72, 20, 20],
    },
    reach('chalakudy-dam-spillway', 'Chalakkudy Dam Spillway', 'dam-crest', 'headwaters', [], 28, 'waterfall'),
    reach('malakkappara-river', 'Chalakkudy River', 'headwaters', 'upper-river-join', [[-670, base + 6, -680], [-650, base + 1, -575]], 24),
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
    { id: 'kodakara-road', label: 'Kodakara–village road', widthM: 5.5, points: [[-190, 31.62, -197.14], [-160, 28.8, -200], [-105, 30, -190], input.villageRoadJoin] },
    { id: 'silver-storm-road', label: 'Silver Storm access', widthM: 5.5, points: [input.parkRoadJoin ?? [0, base + 4, -481], [0, base + 6, -515], [105, base + 5, -565], [110, base + 4, -630], [40, base + 4, -665], [40, base + 4, -685]] },
    // Tier A Chalakkudy: four-lane city roads on the levelled town pad.
    ...CHALAKKUDY_CITY_ROADS.map(road => ({ ...road, widthM: CITY_ROAD_WIDTH_M })),
    // Sixteen switchbacks up the hillside west of the dam, well clear of the reservoir and
    // its river approach, arriving level with the crest at the west buttress. The wide margin
    // below the road-grade limit absorbs how much shorter the rounded, terrain-carved corners
    // run than the straight control polyline.
    { id: 'chalakudy-dam-road', label: 'Chalakkudy Dam access road', widthM: 5.5,
      points: hairpinRoad(-756, -1081, [0, 1], 16, 40, 18, damCrestY - 78, 78) },
  ];
  const park: WorldV2Layout['park'] = {
    id: 'silver-storm', label: 'Silver Storm', footprint: rectangle(-15, -735, 90, -635),
    center: [40, base + 4, -685], poolFootprint: rectangle(52, -725, 77, -710),
  };
  const points: readonly (readonly [number, number])[] = [
    [input.existingBounds.xMin, input.existingBounds.zMin], [input.existingBounds.xMax, input.existingBounds.zMax],
    ...towns.flatMap(t => t.footprint), ...park.footprint,
    ...roads.flatMap(r => r.points.map(p => [p[0], p[2]] as const)),
    ...riverReaches.flatMap(r => r.points.flatMap((p, i) => {
      const half = r.widthsM[i] / 2;
      return [[p[0] - half, p[2] - half], [p[0] + half, p[2] + half]] as const;
    })),
  ];
  return {
    status: 'layout-approved',
    bounds: { xMin: Math.min(...points.map(p => p[0])) - 20, xMax: Math.max(...points.map(p => p[0])) + 20, zMin: Math.min(...points.map(p => p[1])) - 20, zMax: Math.max(...points.map(p => p[1])) + 20 },
    towns, riverNodes, riverReaches, roads, park,
    reviewNotes: [
      'The Chalakkudy Dam impounds the reservoir at the river headwaters, in the hills at the north-west corner.',
      'Malakkappara sits upstream, on the wooded plateau east of the river.',
      'Silver Storm is east/right of the summit, below its skyline; its pool is on the north-east side.',
      'Chalakkudy is the largest town: a Tier A city on both banks of the Kurumalippuzha, joined by two four-lane bridges, with four-lane highways to Kodakara and down the ghat to Kodaly.',
      'Kurumalippuzha joins the existing river crossing; Kodaly keeps its harbor and lighthouse.',
      'The main downstream outlet requires a new shoreline in V2-02; it is not existing sea.',
      'Footprints and control-point elevations are proposed. Grounding, rounded bends and sightlines await V2-02.',
    ],
  };
}
