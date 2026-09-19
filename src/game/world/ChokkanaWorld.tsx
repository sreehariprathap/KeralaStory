import { useMemo } from 'react';
import type { Locale } from '../../contracts';
import { EXPANSION_LAYOUT, roadsideSpot } from '../../content/world/definition';
import { chokkanaForest } from './chokkanaForest';
import { ExpansionSign } from './ExpansionSign';
import { localizedPlace } from '../../features/i18n/translate';
import { ImportedTrees } from './ImportedTrees';
import { BROADLEAF_FOREST, ForestModelSet, bucketByModel, hash01, pickModel } from './ForestModels';

/** Every 45th spot holds an authored anime tree on medium and high; the rest use the low-poly pack. */
const ANIME_EVERY=45;

/** Deterministic mixed broadleaf forest, one instanced draw call per tree shape. */
export function ChokkanaWorld({quality,locale}:{quality:'low'|'medium'|'high';locale:Locale}) {
  const trees=useMemo(()=>chokkanaForest(quality==='low'?450:850),[quality]);
  const low=quality==='low';
  const packed=useMemo(()=>bucketByModel(BROADLEAF_FOREST,trees.flatMap((tree,i)=>{
    if(!low&&i%ANIME_EVERY===0)return [];
    const [x,y,z]=tree.position,model=pickModel(BROADLEAF_FOREST,hash01(i,2000),low);
    const height=(10.5+tree.scale*6)*model.size;
    return [{model,item:{position:[x,y-.15,z] as [number,number,number],yaw:tree.yawRad,scale:[height,height,height] as [number,number,number],shade:hash01(i,2001)}}];
  })),[trees,low]);
  const signs=EXPANSION_LAYOUT.anchors.filter(a=>['kodassery-junction','chokkana-entry','chokkana-ridge','chokkana-stream','chokkana-tea-stop'].includes(a.id));
  const tea=EXPANSION_LAYOUT.anchors.find(a=>a.id==='chokkana-tea-stop')!;
  // The tea hut stands on clear ground beside the road, with room for its roof overhang.
  const [tx,ty,tz]=roadsideSpot(tea.position[0],tea.position[2],8,3.5);
  const imported=useMemo(()=>trees.filter((_,i)=>i%ANIME_EVERY===0).map(t=>({position:t.position,scale:12*t.scale,rotation:[0,t.yawRad,0] as [number,number,number]})),[trees]);
  return <group>
    <ForestModelSet groups={packed} shadows={false}/>
    {quality!=='low'&&<ImportedTrees url="/assets/trees/anime_tree_2.glb" data={imported}/>}
    {signs.map(a=><ExpansionSign key={a.id} position={roadsideSpot(a.position[0],a.position[2])} label={localizedPlace(a.id,locale)} width={3.5}/>)}
    <group position={[tx,ty,tz]}>
      <mesh position={[0,1.1,0]}><boxGeometry args={[4,2.2,3]}/><meshStandardMaterial color="#e5d7b3" roughness={1}/></mesh>
      <mesh position={[0,1.2,1.51]}><boxGeometry args={[2.7,1.2,.04]}/><meshStandardMaterial color="#285943"/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*1.2,2.7,0]} rotation={[0,0,-side*.32]}><boxGeometry args={[2.6,.2,4.4]}/><meshStandardMaterial color="#B96545" roughness={1}/></mesh>)}
      <mesh position={[0,.6,2.5]}><boxGeometry args={[3,.15,.65]}/><meshStandardMaterial color="#72563d"/></mesh>
      {[-1,0,1].map(x=><mesh key={x} position={[x,.83,2.5]}><cylinderGeometry args={[.09,.065,.3,8]}/><meshStandardMaterial color="#b8bcb0" metalness={.3} roughness={.5}/></mesh>)}
    </group>
  </group>;
}
