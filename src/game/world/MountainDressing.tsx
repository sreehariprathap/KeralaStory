import { memo, useEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Object3D } from 'three';
import { MOUNTAIN_DRESSING, mountainDressingBoxes } from '../../content/world/mountainDressing';

type Quality = 'low' | 'medium' | 'high';
const ROCK_VARIANTS = 4;

/** A lumpy boulder: a jittered icosahedron, grey-brown stone with moss on its upper faces. */
function boulderGeometry(seed: number) {
  const g = new IcosahedronGeometry(1, 1).toNonIndexed();
  const p = g.attributes.position, jitter = new Map<string, number>();
  let s = seed * 9301 + 49297;
  const next = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < p.count; i++) {
    // Shared corners move together so the rock stays closed.
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, .72 + next() * .5);
    const k = jitter.get(key)!;
    p.setXYZ(i, p.getX(i) * k, Math.max(-.35, p.getY(i)) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const stone = new Color('#8b877a'), dark = new Color('#6f6b5f'), moss = new Color('#6f8a4a'), c = new Color(), colors: number[] = [];
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    const up = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    c.copy(up > .55 ? moss : up < -.1 ? dark : stone).offsetHSL(0, 0, (next() - .5) * .06);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g as BufferGeometry;
}

function Boulders({ quality }: { quality: Quality }) {
  const geometries = useMemo(() => Array.from({ length: ROCK_VARIANTS }, (_, i) => boulderGeometry(i + 1)), []);
  useEffect(() => () => geometries.forEach(g => g.dispose()), [geometries]);
  // Low quality keeps only the larger rocks.
  const byVariant = useMemo(() => geometries.map((_, v) => MOUNTAIN_DRESSING.boulders.filter(b => b.variant === v && (quality !== 'low' || Math.max(...b.scale) > 1.6))), [geometries, quality]);
  const refs = useRef<(InstancedMesh | null)[]>([]);
  useEffect(() => {
    const o = new Object3D(), tint = new Color();
    byVariant.forEach((list, v) => {
      const mesh = refs.current[v]; if (!mesh) return;
      list.forEach((b, i) => {
        o.position.set(...b.position); o.rotation.set(0, b.yaw, 0); o.scale.set(...b.scale); o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, tint.setScalar(.88 + b.tint * .24));
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
    });
  }, [byVariant]);
  return <>{byVariant.map((list, v) => list.length > 0 && <instancedMesh key={`${v}-${list.length}`} ref={m => { refs.current[v] = m; }} args={[geometries[v], undefined, list.length]} castShadow={quality !== 'low'} receiveShadow>
    <meshStandardMaterial vertexColors flatShading roughness={1}/>
  </instancedMesh>)}</>;
}

/** Shola forest: dense rounded evergreen crowns, and a few tall slender trees above them. */
function HillTrees() {
  const trees = MOUNTAIN_DRESSING.trees;
  const trunks = useRef<InstancedMesh>(null), crowns = useRef<InstancedMesh>(null), tops = useRef<InstancedMesh>(null);
  useEffect(() => {
    const o = new Object3D(), shade = new Color();
    trees.forEach((t, i) => {
      const [x, y, z] = t.position, h = t.height;
      o.position.set(x, y + h * .35, z); o.rotation.set(0, t.yaw, 0); o.scale.set(.35 + t.spread * .06, h * .7, .35 + t.spread * .06); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      const slender = t.kind === 'slender';
      o.position.set(x, y + h * (slender ? .72 : .62), z); o.scale.set(t.spread, h * (slender ? .34 : .3), t.spread * .9); o.updateMatrix();
      crowns.current!.setMatrixAt(i, o.matrix);
      o.position.set(x + t.spread * .25, y + h * (slender ? .9 : .82), z - t.spread * .2); o.scale.set(t.spread * .62, h * .18, t.spread * .6); o.updateMatrix();
      tops.current!.setMatrixAt(i, o.matrix);
      shade.setHSL(.28 + (i % 7) * .006, .42, .2 + (i % 5) * .022);
      crowns.current!.setColorAt(i, shade); tops.current!.setColorAt(i, shade.offsetHSL(0, 0, .05));
    });
    for (const mesh of [trunks.current, crowns.current, tops.current]) { mesh!.instanceMatrix.needsUpdate = true; if (mesh!.instanceColor) mesh!.instanceColor.needsUpdate = true; mesh!.computeBoundingSphere(); }
  }, [trees]);
  return <>
    <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow><cylinderGeometry args={[.5, .8, 1, 6]}/><meshStandardMaterial color="#5f4a36" roughness={1}/></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow><icosahedronGeometry args={[1, 1]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>
    <instancedMesh ref={tops} args={[undefined, undefined, trees.length]} castShadow><icosahedronGeometry args={[1, 0]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>
    <RigidBody type="fixed" colliders={false}>
      {trees.map((t, i) => <CylinderCollider key={i} args={[2, .45]} position={[t.position[0], t.position[1] + 2, t.position[2]]}/>)}
    </RigidBody>
  </>;
}

/** Rocks and shola forest across the hill country. */
export const MountainDressing = memo(function MountainDressing({ quality }: { quality: Quality }) {
  const boxes = useMemo(mountainDressingBoxes, []);
  return <group name="mountain-dressing">
    <Boulders quality={quality}/>
    <HillTrees/>
    <RigidBody type="fixed" colliders={false}>
      {boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
  </group>;
});
