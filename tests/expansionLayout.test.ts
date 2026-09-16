import { describe, expect, it } from 'vitest';
import { areaAt, createExpansionLayout, nearestRouteSample, pointInPolygon, routeLength } from '../src/content/world/expansionLayout';
const junction: [number, number, number] = [-7, 74.5, -446];
const layout = createExpansionLayout({ junction, panoramaTargets: [[65, 25, 54]] });
const get = (id: string) => layout.routes.find(r => r.id === id)!;
describe('authored expansion layout', () => {
  it('rejects nonfinite and malformed input positions before building route geometry', () => {
    for (const invalid of [[NaN, 0, 0], [0, Infinity, 0], [0, 0, -Infinity], [0, 0], [0, 0, 0, 0]]) {
      const vector = invalid as [number, number, number];
      expect(() => createExpansionLayout({ junction: vector, panoramaTargets: [] })).toThrow(RangeError);
      expect(() => createExpansionLayout({ junction, panoramaTargets: [vector] })).toThrow(RangeError);
    }
  });
  it('keeps every authored coordinate, bound and dimension finite', () => {
    const inspect = (value: unknown): void => {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      else if (Array.isArray(value)) value.forEach(inspect);
      else if (value && typeof value === 'object') Object.values(value).forEach(inspect);
    };
    inspect(layout);
  });
  it('keeps construction deterministic and preserves the exact original junction', () => {
    expect(createExpansionLayout({ junction, panoramaTargets: [[65, 25, 54]] })).toEqual(layout);
    expect(get('chokkana-main-road').points[0]).toEqual(junction);
    expect(layout.anchors).toHaveLength(9);
    expect(new Set(layout.anchors.map(a => a.id)).size).toBe(9);
    expect(layout.anchors.every(a => a.position.every(Number.isFinite))).toBe(true);
  });
  it('authors a meaningful climb and road journey with viable segment grades', () => {
    const trail = get('summit-trail'), road = get('chokkana-main-road');
    expect(routeLength(trail.points, true)).toBeGreaterThanOrEqual(550);
    expect(routeLength(trail.points, true)).toBeLessThanOrEqual(700);
    expect(trail.points.at(-1)![1] - trail.points[0][1]).toBe(110);
    expect(routeLength(road.points, true)).toBeGreaterThanOrEqual(900);
    expect(routeLength(road.points, true)).toBeLessThanOrEqual(1200);
    for (const r of layout.routes) {
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1], b = r.points[i], run = Math.hypot(a[0] - b[0], a[2] - b[2]);
        expect(run).toBeGreaterThan(0);
        expect(run).toBeLessThanOrEqual(2.001);
        expect(Math.abs(a[1] - b[1]) / run).toBeLessThanOrEqual(r.allowedModes.includes('car') ? .1001 : .4);
      }
    }
    let flat = 0, longest = 0;
    road.points.slice(1).forEach((b, i) => { const a = road.points[i], run = Math.hypot(a[0]-b[0],a[2]-b[2]); flat = Math.abs(a[1]-b[1])/run < .02 ? flat + run : 0; longest = Math.max(longest, flat); });
    expect(longest).toBeGreaterThanOrEqual(120);
    expect(routeLength(get('athirappilly-view-trail').points, true)).toBeGreaterThanOrEqual(120);
    expect(routeLength(get('athirappilly-view-trail').points, true)).toBeLessThanOrEqual(180);
  });
  it('rounds every drivable bend to at least a fourteen meter radius', () => {
    for (const r of layout.routes.filter(r => r.allowedModes.includes('car'))) {
      for (let i=1;i<r.points.length-1;i++) {
        const [a,b,c]=r.points.slice(i-1,i+2), ab=Math.hypot(a[0]-b[0],a[2]-b[2]),bc=Math.hypot(b[0]-c[0],b[2]-c[2]),ac=Math.hypot(a[0]-c[0],a[2]-c[2]);
        const twiceArea=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]));
        if(twiceArea>1e-7) expect(ab*bc*ac/(2*twiceArea)).toBeGreaterThanOrEqual(14);
      }
    }
  });
  it('resolves polygon edges, old corridor separation and finite queries', () => {
    expect(pointInPolygon(0, 5, [[0,0],[10,0],[10,10],[0,10]])).toBe(true);
    expect(pointInPolygon(NaN, 5, [[0,0],[10,0],[10,10],[0,10]])).toBe(false);
    expect(areaAt(layout, -330, -446)).toBe('chokkana');
    expect(areaAt(layout, 0, -446)).toBeNull();
    for(const a of layout.anchors) expect(areaAt(layout,...[a.position[0],a.position[2]] as [number,number])).toBe(a.areaId);
  });
  it('connects branch endpoints and keeps water independently dry at viewpoints', () => {
    for (const id of ['summit-access-road', 'chokkana-return-loop']) {
      const r=get(id); expect(nearestRouteSample(get('chokkana-main-road'),r.points[0][0],r.points[0][2]).distanceM).toBeLessThan(1e-7);
    }
    const loop=get('chokkana-return-loop').points.at(-1)!;
    expect(nearestRouteSample(get('chokkana-main-road'),loop[0],loop[2]).distanceM).toBeLessThan(1e-7);
    for(const a of layout.anchors) expect(layout.waterBodies.some(w=>pointInPolygon(a.position[0],a.position[2],w.footprint))).toBe(false);
  });
});
