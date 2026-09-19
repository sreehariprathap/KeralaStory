import { memo, useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Object3D } from 'three';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { ExpansionSign } from './ExpansionSign';
import { TEA_ESTATE, TEA_ESTATE_PLANTING } from '../../content/world/teaEstate';
import { roadsideSpot, terrainHeight } from '../../content/world/definition';

type Quality = 'low' | 'medium' | 'high';

/** Cheap, deterministic value noise along a row, for the lumpy clipped tops. */
const lump = (s: number, seed: number) => .5 + .25 * Math.sin(s * 1.9 + seed) + .15 * Math.sin(s * 4.3 + seed * 2.1) + .1 * Math.sin(s * 9.7 + seed * .7);
/** Stable 0..1 per (row, bush), so each bush keeps its own size. */
const jitter = (a: number, b: number) => { let t = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b); t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d); return ((t ^ (t >>> 13)) >>> 0) / 4294967296; };
/** Length of one clipped tea bush along its row (metres). */
const BUSH = 1.35;

/** A row resampled every `step` metres along the ground, with distance along it. */
function resampleRow(points: readonly (readonly [number, number, number])[], step: number) {
  const out: { x: number; z: number; s: number }[] = [{ x: points[0][0], z: points[0][2], s: 0 }];
  let s = 0, next = step;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    while (next <= s + l) { const t = (next - s) / l; out.push({ x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, s: next }); next += step; }
    s += l;
  }
  const last = points.at(-1)!;
  if (s - out.at(-1)!.s > step * .3) out.push({ x: last[0], z: last[2], s });
  return out;
}

/**
 * All tea hedges as one mesh. Each row is a chain of clipped bushes: a rounded ribbon (seven points
 * across on high: foot, side, shoulder, crown, shoulder, side, foot; five below) that swells over each bush and pinches
 * in the gap to the next, dark at the foot and in the waists, bright with new leaf on top.
 */
function createHedges(quality: Quality) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const foot = new Color('#2c4a22'), side = new Color('#4f7f30'), shoulder = new Color('#79aa3f'), crown = new Color('#a6cf55'), waist = new Color('#3d6427'), tmp = new Color();
  const { hedgeHeightM: H, hedgeWidthM: W } = TEA_ESTATE, half = W / 2;
  const full = [[-half, 0, foot], [-half * .96, H * .6, side], [-half * .74, H * .94, shoulder], [0, H, crown], [half * .74, H * .94, shoulder], [half * .96, H * .6, side], [half, 0, foot]] as const;
  // Medium and low drop the mid-side points: 40% fewer triangles across half a million.
  const across = quality === 'high' ? full : [full[0], full[2], full[3], full[4], full[6]];
  const step = quality === 'low' ? 1 : .45;
  TEA_ESTATE_PLANTING.rows.forEach((row, r) => {
    const pts = resampleRow(row.points, step), base = positions.length / 3, total = pts.at(-1)!.s;
    pts.forEach((p, i) => {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const tx = next.x - prev.x, tz = next.z - prev.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      // Each bush domes up and the row pinches between bushes; rows taper to a rounded end.
      const bush = Math.floor(p.s / BUSH), dome = quality === 'low' ? 1 : Math.sqrt(Math.abs(Math.sin(Math.PI * p.s / BUSH))), size = .92 + .16 * jitter(r, bush);
      const end = Math.min(1, Math.min(p.s, total - p.s) / .9), shape = .35 + .65 * end;
      const wide = shape * (.84 + .16 * dome) * (.96 + .08 * jitter(bush, r)), tall = shape * (.8 + .2 * dome) * size * (.92 + .16 * lump(p.s, r));
      for (const [o, h, c] of across) {
        const x = p.x + nx * o * wide, z = p.z + nz * o * wide, y = terrainHeight(x, z) - .05 + h * tall;
        positions.push(x, y, z);
        tmp.copy(c).lerp(waist, (1 - dome) * .45).offsetHSL(0, 0, (lump(p.s * .6, r * 3.1) - .5) * .06 + (size - 1) * .2);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
      if (i) for (let k = 0; k < across.length - 1; k++) {
        const a = base + (i - 1) * across.length + k, b = base + i * across.length + k;
        // Counter-clockwise seen from above, so the hedge faces the sky.
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    });
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Silver oaks: tall, slim grey trunks with a few small, open tufts of leaf up the top third. */
const TUFTS = [[.62, -.6], [.76, .6], [.9, 0]] as const;
function ShadeTrees() {
  const trunks = useRef<InstancedMesh>(null), crowns = useRef<InstancedMesh>(null);
  const trees = TEA_ESTATE_PLANTING.shade;
  useEffect(() => {
    const o = new Object3D();
    trees.forEach((t, i) => {
      const [x, y, z] = t.position, girth = .16 + jitter(i, 3) * .1;
      o.position.set(x, y + t.height * .44, z); o.rotation.set(0, t.yaw, 0); o.scale.set(girth, t.height * .88, girth); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      TUFTS.forEach(([up, sideways], k) => {
        const size = 1.3 + jitter(i, k) * .6;
        o.position.set(x + Math.cos(t.yaw) * sideways, y + t.height * up, z + Math.sin(t.yaw) * sideways);
        o.scale.set(size, size * .7, size * .9); o.updateMatrix();
        crowns.current!.setMatrixAt(i * TUFTS.length + k, o.matrix);
      });
    });
    for (const mesh of [trunks.current, crowns.current]) { mesh!.instanceMatrix.needsUpdate = true; mesh!.computeBoundingSphere(); }
  }, [trees]);
  return <>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow><cylinderGeometry args={[.7, 1, 1, 6]}/><meshStandardMaterial color="#8d8576" roughness={1}/></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined, undefined, trees.length * TUFTS.length]} castShadow><icosahedronGeometry args={[1, 0]}/><meshStandardMaterial color="#6f8f4a" flatShading roughness={1}/></instancedMesh>
    <RigidBody type="fixed" colliders={false}>
      {trees.map((t, i) => <CylinderCollider key={i} args={[2, .3]} position={[t.position[0], t.position[1] + 2, t.position[2]]}/>)}
    </RigidBody>
  </>;
}

/** Red-earth pickers' paths winding up through the rows: one smooth ribbon per path, hugging the ground. */
function pickerPathGeometry() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], earth = new Color('#9c6a43'), dry = new Color('#b0805a'), tmp = new Color();
  for (const path of TEA_ESTATE_PLANTING.paths) {
    const base = positions.length / 3;
    path.forEach((p, i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      const nx = -(b[2] - a[2]) / l * .65, nz = (b[0] - a[0]) / l * .65;
      for (const side of [-1, 1]) {
        const x = p[0] + nx * side, z = p[2] + nz * side;
        positions.push(x, terrainHeight(x, z) + .04, z);
        tmp.copy(earth).lerp(dry, jitter(i, side + 2) * .5); colors.push(tmp.r, tmp.g, tmp.b);
      }
      if (i) { const k = base + (i - 1) * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Peringalkuthu Tea Estate on the graded slopes of the dam road. */
export const TeaEstate = memo(function TeaEstate({ quality }: { quality: Quality }) {
  const hedges = useMemo(() => createHedges(quality), [quality]);
  const paths = useMemo(pickerPathGeometry, []);
  // The estate board stands where the rows begin, just out of Malakkappara.
  const board = useMemo(() => { const p = TEA_ESTATE_PLANTING.rows[0]?.points[0]; return p ? roadsideSpot(p[0], p[2], 3) : null; }, []);
  useEffect(() => () => hedges.dispose(), [hedges]);
  useEffect(() => () => paths.dispose(), [paths]);
  return <group name="peringalkuthu-tea-estate">
    <mesh geometry={hedges} receiveShadow castShadow={quality === 'high'}><meshStandardMaterial vertexColors roughness={.95}/></mesh>
    <mesh geometry={paths} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>
    <ShadeTrees/>
    {board && <ExpansionSign position={board} label={`${TEA_ESTATE.label} · പെരിങ്ങൽക്കുത്ത് തേയിലത്തോട്ടം`} width={6}/>}
  </group>;
});
