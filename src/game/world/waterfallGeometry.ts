import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';
import { terrainHeight } from '../../content/world/kodassery';

export const FALLS = { x: 47, z: -385, height: 18, surfaceLift: 0.09 } as const;
const datum = terrainHeight(FALLS.x, FALLS.z);
// A continuous rocky chute, then a shallow runnel on the hillside. No flat
// pool is placed above the sloping terrain and the river's sea-level datum is
// deliberately not reused for this upland water feature.
const profile = [
  [50.4, 18, 3.2], [49, 18, 3.2], [48.4, 17.55, 3.5],
  [47.5, 12, 3.9], [46.4, 10.8, 4.2], [46, 10.55, 4.5],
  [45.6, 4.2, 4.8], [44, 0, 5.4],
];
export const FALL_STREAM_PATH = [[44, -389], [44, -383], [44, -377], [46, -369], [49, -361], [51, -353]] as const;
const streamCurve = new CatmullRomCurve3(FALL_STREAM_PATH.map(([x,z]) => new Vector3(x, 0, z)), false, 'centripetal');

export function streamPoint(t: number, across: number) {
  const center = streamCurve.getPoint(t), tangent = streamCurve.getTangent(t);
  const width = 5.25 * (1 - t) ** 1.7 + 0.15;
  const x = center.x - tangent.z * across * width / 2;
  const z = center.z + tangent.x * across * width / 2;
  return new Vector3(x, terrainHeight(x, z) + FALLS.surfaceLift, z);
}

/** Subdivided across the width as well as along the flow to track the hillside. */
export function waterfallGeometry(kind: 'fall' | 'stream', low = false) {
  const positions: number[] = [], uv: number[] = [], foam: number[] = [], indices: number[] = [];
  const columns = low ? 6 : 12;
  const rows = kind === 'fall' ? (profile.length - 1) * 6 : low ? 48 : 96;
  let distance = 0;
  let previous: Vector3 | undefined;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    let center: Vector3;
    let width = 0, upper = 0, blend = 0;
    if (kind === 'fall') {
      const section = t * (profile.length - 1);
      upper = Math.min(profile.length - 2, Math.floor(section));
      blend = section - upper;
      const a = profile[upper], b = profile[upper + 1];
      width = a[2] + (b[2] - a[2]) * blend;
      const x = a[0] + (b[0] - a[0]) * blend;
      const y = datum + a[1] + (b[1] - a[1]) * blend;
      center = new Vector3(x, y, FALLS.z);
    } else center = streamPoint(t, 0);
    if (previous) distance += center.distanceTo(previous);
    previous = center;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns, across = u * 2 - 1;
      const point = kind === 'stream' ? streamPoint(t, across) : center.clone();
      if (kind === 'fall') {
        point.z += across * width / 2;
        // The final cascade fans onto the same ground-relative
        // surface as the runnel apron underneath its landing line. Ripple geometry tapers out at every seam.
        if (upper === profile.length - 2) {
          point.y += (terrainHeight(point.x, point.z) + FALLS.surfaceLift - datum) * blend;
        }
        point.x += Math.sin(u * Math.PI * 6) * Math.sin(blend * Math.PI) * .055;
      }
      positions.push(point.x, point.y, point.z);
      uv.push(u, distance);
      foam.push(kind === 'stream' ? Math.exp(-(((t - .12) * 12) ** 2)) : Math.max(Math.exp(-(((t - .57) * 25) ** 2)) * .65, t ** 12, Math.exp(-t * 35) * .5));
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('waterFoam', new Float32BufferAttribute(foam, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Decoration clearance only: the shallow feature does not change traversal. */
export function isWaterfallFootprint(x: number, z: number, margin = 0) {
  if (x > 43 - margin && x < 59 + margin && z > -394 - margin && z < -375 + margin) return true;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, p = streamCurve.getPoint(t);
    const halfWidth = (5.25 * (1 - t) ** 1.7 + .15) / 2;
    if (Math.hypot(p.x - x, p.z - z) < halfWidth + margin + .45) return true;
  }
  return false;
}
