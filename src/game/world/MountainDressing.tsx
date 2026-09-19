import { memo, useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import type { Vec3 } from '../../contracts';
import { FOREST_ROCKS, ForestModelSet, SHOLA_EMERGENT, SHOLA_FOREST, bucketByModel, hash01, pickModel } from './ForestModels';
import { MOUNTAIN_DRESSING, mountainDressingBoxes } from '../../content/world/mountainDressing';

type Quality = 'low' | 'medium' | 'high';

/** Boulders from the low-poly rock pack; low quality keeps only the larger rocks. */
function Boulders({ quality }: { quality: Quality }) {
  const groups = useMemo(() => bucketByModel(FOREST_ROCKS, MOUNTAIN_DRESSING.boulders.flatMap(b => {
    if (quality === 'low' && Math.max(...b.scale) <= 1.6) return [];
    const [x, y, z] = b.position, [sx, sy, sz] = b.scale;
    // Each variant was a jittered sphere reaching .35 below and 1 above its centre; the rock sits
    // on its base, so drop it to the same floor.
    return [{ model: pickModel(FOREST_ROCKS, b.variant / 4 + b.tint / 4), item: { position: [x, y - sy * .35, z] as Vec3, yaw: b.yaw, scale: [sx, sy * 1.2, sz] as Vec3, shade: b.tint } }];
  })), [quality]);
  return <ForestModelSet groups={groups} normalize="footprint" shadows={quality !== 'low'}/>;
}

/** Shola forest: dense rounded evergreen crowns, and a few tall slender trees above them. */
function HillTrees({ quality }: { quality: Quality }) {
  const trees = MOUNTAIN_DRESSING.trees, low = quality === 'low';
  const groups = useMemo(() => {
    const entries = trees.map((t, i) => {
      const model = pickModel(t.kind === 'slender' ? SHOLA_EMERGENT : SHOLA_FOREST, hash01(i, 9021), low), height = t.height * 1.1 * model.size;
      return { model, item: { position: t.position, yaw: t.yaw, scale: [height, height, height] as Vec3, shade: hash01(i, 9022) } };
    });
    return bucketByModel([...SHOLA_FOREST, ...SHOLA_EMERGENT], entries);
  }, [trees, low]);
  return <>
    <ForestModelSet groups={groups} shadows={!low}/>
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
    <HillTrees quality={quality}/>
    <RigidBody type="fixed" colliders={false}>
      {boxes.map(b => <CuboidCollider key={b.id} position={b.position} rotation={b.rotation} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}/>)}
    </RigidBody>
  </group>;
});
