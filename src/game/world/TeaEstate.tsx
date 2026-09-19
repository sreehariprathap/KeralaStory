import { memo, useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Object3D } from 'three';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { ExpansionSign } from './ExpansionSign';
import { TEA_ESTATE, TEA_ESTATE_PLANTING } from '../../content/world/teaEstate';
import { roadsideSpot, terrainHeight } from '../../content/world/definition';

type Quality = 'low' | 'medium' | 'high';

/** Cheap, deterministic value noise along a row, for the lumpy clipped tops. */
const lump = (s: number, seed: number) => .5 + .25 * Math.sin(s * 1.9 + seed) + .15 * Math.sin(s * 4.3 + seed * 2.1) + .1 * Math.sin(s * 9.7 + seed * .7);

/**
 * All tea hedges as one mesh: each row is a rounded ribbon (five points across: foot, shoulder, crown,
 * shoulder, foot) following the ground, darker at the foot and bright with new leaf on top.
 */
function createHedges(quality: Quality) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const foot = new Color('#34562a'), side = new Color('#5b8a38'), shoulder = new Color('#7fae47'), crown = new Color('#a2c95a'), tmp = new Color();
  const { hedgeHeightM: H, hedgeWidthM: W } = TEA_ESTATE, half = W / 2;
  // A clipped tea hedge: steep sides and a broad, gently domed table top of bright new leaf.
  const across = [[-half, 0, foot], [-half * .96, H * .62, side], [-half * .72, H * .95, shoulder], [0, H, crown], [half * .72, H * .95, shoulder], [half * .96, H * .62, side], [half, 0, foot]] as const;
  const step = quality === 'low' ? 2 : 1;
  TEA_ESTATE_PLANTING.rows.forEach((row, r) => {
    const pts = row.points.filter((_, i) => i % step === 0 || i === row.points.length - 1);
    let s = 0, base = positions.length / 3;
    pts.forEach((p, i) => {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const tx = next[0] - prev[0], tz = next[2] - prev[2], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      if (i) s += Math.hypot(p[0] - prev[0], p[2] - prev[2]);
      // Rows taper to a rounded end.
      const end = Math.min(1, Math.min(i, pts.length - 1 - i) / 1.5), shape = .35 + .65 * end, bump = .85 + .3 * lump(s, r);
      for (const [o, h, c] of across) {
        const x = p[0] + nx * o * shape, z = p[2] + nz * o * shape, y = terrainHeight(x, z) - .05 + h * shape * bump;
        positions.push(x, y, z);
        tmp.copy(c).offsetHSL(0, 0, (lump(s * .6, r * 3.1) - .5) * .06);
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

/** Silver oaks: tall, slim trunks under narrow, open crowns, standing over the tea for shade. */
function ShadeTrees() {
  const trunks = useRef<InstancedMesh>(null), crowns = useRef<InstancedMesh>(null);
  const trees = TEA_ESTATE_PLANTING.shade;
  useEffect(() => {
    const o = new Object3D();
    trees.forEach((t, i) => {
      const [x, y, z] = t.position;
      o.position.set(x, y + t.height * .45, z); o.rotation.set(0, t.yaw, 0); o.scale.set(.35, t.height * .9, .35); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, y + t.height * .8, z); o.scale.set(3.2, t.height * .22, 2.8); o.updateMatrix();
      crowns.current!.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [trunks.current, crowns.current]) { mesh!.instanceMatrix.needsUpdate = true; mesh!.computeBoundingSphere(); }
  }, [trees]);
  return <>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow><cylinderGeometry args={[.5, .8, 1, 6]}/><meshStandardMaterial color="#8a7f6c" roughness={1}/></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow><icosahedronGeometry args={[1, 1]}/><meshStandardMaterial color="#557a45" flatShading roughness={1}/></instancedMesh>
    <RigidBody type="fixed" colliders={false}>
      {trees.map((t, i) => <CylinderCollider key={i} args={[2, .35]} position={[t.position[0], t.position[1] + 2, t.position[2]]}/>)}
    </RigidBody>
  </>;
}

/** Peringalkuthu Tea Estate on the graded slopes of the dam road. */
export const TeaEstate = memo(function TeaEstate({ quality }: { quality: Quality }) {
  const hedges = useMemo(() => createHedges(quality), [quality]);
  // The estate board stands where the rows begin, just out of Malakkappara.
  const board = useMemo(() => { const p = TEA_ESTATE_PLANTING.rows[0]?.points[0]; return p ? roadsideSpot(p[0], p[2], 3) : null; }, []);
  useEffect(() => () => hedges.dispose(), [hedges]);
  return <group name="peringalkuthu-tea-estate">
    <mesh geometry={hedges} receiveShadow castShadow={quality === 'high'}><meshStandardMaterial vertexColors roughness={.95}/></mesh>
    <ShadeTrees/>
    {board && <ExpansionSign position={board} label={`${TEA_ESTATE.label} · പെരിങ്ങൽക്കുത്ത് തേയിലത്തോട്ടം`} width={6}/>}
  </group>;
});
