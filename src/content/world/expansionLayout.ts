import type { Vec3 } from '../../contracts';
import type { AreaId, ExpansionAnchor, ExpansionLayout, ExpansionRoute, PolygonXZ } from '../../contracts/worldExpansion';

type XZ = readonly [number, number];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

/** Boundary-inclusive winding test. Ordered areas give shared edges deterministic ownership. */
export function pointInPolygon(x: number, z: number, polygon: PolygonXZ): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const cross = (x - a[0]) * dz - (z - a[1]) * dx;
    if (Math.abs(cross) < 1e-7 && x >= Math.min(a[0], b[0]) - 1e-8 && x <= Math.max(a[0], b[0]) + 1e-8 && z >= Math.min(a[1], b[1]) - 1e-8 && z <= Math.max(a[1], b[1]) + 1e-8) return true;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function areaAt(layout: ExpansionLayout, x: number, z: number): AreaId | null {
  return layout.areas.find(area => pointInPolygon(x, z, area.footprint))?.id ?? null;
}
export function routeLength(points: readonly Vec3[], spatial = false): number {
  return points.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - points[i - 1][0], p[2] - points[i - 1][2], spatial ? p[1] - points[i - 1][1] : 0) : 0, 0);
}
export function nearestRouteSample(route: ExpansionRoute, x: number, z: number): { position: Vec3; distanceM: number; alongM: number } {
  let best = { position: [...route.points[0]] as Vec3, distanceM: Infinity, alongM: 0 }, along = 0;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (length * length || 1)));
    const position: Vec3 = [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
    const distanceM = Math.hypot(x - position[0], z - position[2]);
    if (distanceM < best.distanceM) best = { position, distanceM, alongM: along + t * length };
    along += length;
  }
  return best;
}

/** Circular horizontal fillets, sampled at <=2m; exact tangency avoids sharp car bends. */
export function roundedPath(control: readonly XZ[], radius: number): XZ[] {
  const result: XZ[] = [control[0]];
  const lineTo = (end: XZ) => {
    const start = result[result.length - 1], n = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 2));
    for (let k = 1; k <= n; k++) result.push([mix(start[0], end[0], k / n), mix(start[1], end[1], k / n)]);
  };
  for (let i = 1; i < control.length - 1; i++) {
    const a = control[i - 1], b = control[i], c = control[i + 1];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lb = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const u: XZ = [(b[0] - a[0]) / la, (b[1] - a[1]) / la], v: XZ = [(c[0] - b[0]) / lb, (c[1] - b[1]) / lb];
    const turn = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
    if (Math.abs(turn) < 1e-6) { lineTo(b); continue; }
    const tangent = Math.tan(Math.abs(turn) / 2), inset = Math.min(radius * tangent, la * .4, lb * .4), r = inset / tangent;
    const start: XZ = [b[0] - u[0] * inset, b[1] - u[1] * inset];
    lineTo(start);
    const sign = Math.sign(turn), center: XZ = [start[0] - u[1] * r * sign, start[1] + u[0] * r * sign];
    const angle = Math.atan2(start[1] - center[1], start[0] - center[0]), n = Math.ceil(Math.abs(turn) * r / 2);
    for (let k = 1; k <= n; k++) result.push([center[0] + r * Math.cos(angle + turn * k / n), center[1] + r * Math.sin(angle + turn * k / n)]);
  }
  lineTo(control[control.length - 1]);
  return result;
}
function route(id: string, controls: readonly XZ[], radius: number, height: (distance: number, total: number) => number, foot = false, options: { widthM?: number; surface?: 'paved' | 'dirt' } = {}): ExpansionRoute {
  const flat = roundedPath(controls, radius), total = flat.reduce((s, p, i) => i ? s + Math.hypot(p[0] - flat[i - 1][0], p[1] - flat[i - 1][1]) : 0, 0);
  let distance = 0;
  const points: Vec3[] = flat.map((p, i) => { if (i) distance += Math.hypot(p[0] - flat[i - 1][0], p[1] - flat[i - 1][1]); return [p[0], height(distance, total), p[1]]; });
  return { id, points, widthM: options.widthM ?? (foot ? 3 : 5.5), shoulderM: foot ? .5 : .75, allowedModes: foot ? ['foot'] : ['foot', 'bicycle', 'car'], surface: options.surface };
}

/** A1 authored profiles; A2 must conform ground/collision before activating these places. */
export function createExpansionLayout(input: { junction: Vec3; panoramaTargets: readonly Vec3[] }): ExpansionLayout {
  const finiteVector = (value: readonly number[]) => value.length === 3 && value.every(Number.isFinite);
  if (!finiteVector(input.junction) || !input.panoramaTargets.every(finiteVector)) {
    throw new RangeError('Expansion junction and panorama targets must be finite three-component positions');
  }
  const { junction } = input, base = junction[1];
  const road = route('chokkana-main-road', [[junction[0], junction[2]], [-180, -446], [-260, -545], [-380, -575], [-470, -500], [-430, -400], [-320, -345], [-410, -280], [-565, -290], [-600, -430]], 28,
    s => base + 16 * smooth((s - 170) / 300) - 16 * smooth((s - 470) / 300));
  const trailhead: Vec3 = [-65, base + 2, -490];
  const spur = route('summit-access-road', [[-65, -446], [-65, -490]], 28, (s, total) => base + 2 * smooth(s / total));
  const summit = route('summit-trail', [[-65, -490], [-150, -505], [-55, -550], [-175, -570], [-65, -610], [-195, -630], [-130, -690]], 5,
    (s, total) => base + 2 + 110 * (s / total), true);
  const loopStart = nearestRouteSample(road, -430, -400).position;
  const loopEnd = nearestRouteSample(road, -180, -446).position;
  const loop = route('chokkana-return-loop', [[loopStart[0], loopStart[2]], [-330, -440], [-260, -390], [loopEnd[0], loopEnd[2]]], 28,
    (s, total) => mix(loopStart[1], loopEnd[1], smooth(s / total)));
  const falls = route('athirappilly-view-trail', [[-600, -430], [-567, -434], [-543, -390], [-554, -348], [-580, -335]], 8,
    (s, total) => base - 26 * smooth(s / total), true);
  const summitPosition = [...summit.points[summit.points.length - 1]] as Vec3;
  // Straight graded track up the open south face, clear of the walking trail's switchbacks. It is
  // steep (about half a metre climbed per metre) but hugs the slope, so every vehicle can drive it.
  // Bearing and length chosen so the straight line hugs the south face: about six metres of cut and
  // eight of fill, 23 m clear of the walking trail, at the gentlest grade a straight climb allows here.
  const trackFoot: XZ = [-325, -803];
  const trackFootY = 75;
  // The summit anchor levels a cap around the peak, so the track climbs to the cap's edge and the
  // flat top carries it the rest of the way; ending inside the cap would leave a step.
  const trackRun = Math.hypot(summitPosition[0] - trackFoot[0], summitPosition[2] - trackFoot[1]);
  const trackTop: XZ = [
    summitPosition[0] - (summitPosition[0] - trackFoot[0]) / trackRun * 12,
    summitPosition[2] - (summitPosition[2] - trackFoot[1]) / trackRun * 12,
  ];
  const track = route('summit-offroad-track', [trackFoot, trackTop], 28,
    (s, total) => trackFootY + (summitPosition[1] - trackFootY) * (s / total), false, { widthM: 6, surface: 'dirt' });
  const anchor = (id: string, areaId: AreaId, position: Vec3, iconId: string, discoveryRadiusM = 10): ExpansionAnchor => ({ id, areaId, position, iconId, discoveryRadiusM });
  const anchors = [
    anchor('kodassery-junction', 'chokkana', [...junction], 'signpost'),
    anchor('summit-trailhead', 'kodassery-summit', trailhead, 'mountain'),
    anchor('kodassery-summit', 'kodassery-summit', summitPosition, 'mountain'),
    anchor('chokkana-entry', 'chokkana', nearestRouteSample(road, -160, -446).position, 'tree'),
    anchor('chokkana-ridge', 'chokkana', nearestRouteSample(road, -380, -565).position, 'mountain'),
    anchor('chokkana-stream', 'chokkana', loopStart, 'bridge'),
    anchor('chokkana-tea-stop', 'chokkana', nearestRouteSample(loop, -275, -401).position, 'tea'),
    anchor('athirappilly-falls', 'athirappilly', [...falls.points[0]], 'waves'),
    anchor('athirappilly-lower-view', 'athirappilly', [...falls.points[falls.points.length - 1]], 'waves'),
    anchor('summit-track-foot', 'kodassery-summit', [...track.points[0]], 'mountain'),
  ];
  const areas: ExpansionLayout['areas'] = [
    { id: 'kodassery-summit', zoneId: 'kodassery', footprint: [[-225,-740],[-25,-740],[-25,-485],[-100,-485],[-190,-530],[-225,-610]], labelPosition: [-135,-663] },
    { id: 'athirappilly', zoneId: 'kodassery', footprint: [[-680,-500],[-510,-500],[-510,-240],[-680,-240]], labelPosition: [-610,-355] },
    { id: 'chokkana', zoneId: 'kodassery', footprint: [[-510,-620],[-225,-620],[-190,-530],[-100,-485],[-7,-485],[-7,-425],[-80,-405],[-180,-340],[-280,-240],[-510,-240]], labelPosition: [-330,-475] },
  ];
  return {
    bounds: { xMin: Math.min(...areas.flatMap(a => a.footprint.map(p => p[0]))), xMax: 96.5, zMin: Math.min(...areas.flatMap(a => a.footprint.map(p => p[1]))), zMax: 92 },
    areas, routes: [road, spur, summit, loop, falls, track], anchors, summitPosition,
    panoramaTargets: [...input.panoramaTargets.map(p => [...p] as Vec3), anchors[4].position, [-625, base - 12, -395]],
    waterBodies: [
      { id: 'chalakudy-upstream', kind: 'river', surfaceY: base - 2, footprint: [[-659,-493],[-615,-493],[-612,-400],[-659,-400]] },
      { id: 'athirappilly-pool', kind: 'pool', surfaceY: base - 28, footprint: [[-659,-398],[-595,-398],[-589,-366],[-610,-346],[-658,-357]] },
      { id: 'chalakudy-downstream', kind: 'river', surfaceY: base - 28, footprint: [[-643,-356],[-610,-346],[-619,-241],[-650,-241]] },
    ],
  };
}
