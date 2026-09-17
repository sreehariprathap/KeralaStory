import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import type { Locale } from '../../contracts';
import { EXPANSION_LAYOUT, terrainHeight } from '../../content/world/definition';
import { chokkanaForest } from './chokkanaForest';
import { ExpansionSign } from './ExpansionSign';
import { localizedPlace } from '../../features/i18n/translate';
import { ImportedTrees } from './ImportedTrees';

/** Deterministic broadleaf silhouettes stay resident at every tier, using two draw calls. */
export function ChokkanaWorld({quality,locale}:{quality:'low'|'medium'|'high';locale:Locale}) {
  const trunks=useRef<InstancedMesh>(null),canopy=useRef<InstancedMesh>(null);
  const trees=useMemo(()=>chokkanaForest(quality==='low'?450:850),[quality]);
  useLayoutEffect(()=>{
    const object=new Object3D();
    trees.forEach((tree,i)=>{
      const [x,y,z]=tree.position,h=8+tree.scale*3;
      object.position.set(x,y+h/2,z);object.scale.set(.45,h,.45);object.rotation.set(0,tree.yawRad,0);object.updateMatrix();trunks.current!.setMatrixAt(i,object.matrix);
      object.position.set(x,y+h+1.5,z);object.scale.set(4.5*tree.scale,3.1*tree.scale,4.8*tree.scale);object.updateMatrix();canopy.current!.setMatrixAt(i,object.matrix);
    });
    for(const mesh of [trunks.current,canopy.current]){mesh!.instanceMatrix.needsUpdate=true;mesh!.computeBoundingSphere();}
  },[trees]);
  const signs=EXPANSION_LAYOUT.anchors.filter(a=>['kodassery-junction','chokkana-entry','chokkana-ridge','chokkana-stream','chokkana-tea-stop'].includes(a.id));
  const tea=EXPANSION_LAYOUT.anchors.find(a=>a.id==='chokkana-tea-stop')!;
  const tx=tea.position[0]+9,tz=tea.position[2],ty=terrainHeight(tx,tz);
  const imported=useMemo(()=>trees.filter((_,i)=>i%45===0).map(t=>({position:t.position,scale:12*t.scale,rotation:[0,t.yawRad,0] as [number,number,number]})),[trees]);
  return <group>
    <instancedMesh ref={trunks} args={[undefined,undefined,trees.length]}><cylinderGeometry args={[.65,1,1,6]}/><meshStandardMaterial color="#72563d" roughness={1}/></instancedMesh>
    <instancedMesh ref={canopy} args={[undefined,undefined,trees.length]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#527c59" flatShading roughness={1}/></instancedMesh>
    {quality!=='low'&&<ImportedTrees url="/assets/trees/anime_tree_2.glb" data={imported}/>}
    {signs.map(a=><ExpansionSign key={a.id} position={[a.position[0]+6,terrainHeight(a.position[0]+6,a.position[2]),a.position[2]]} label={localizedPlace(a.id,locale)} width={3.5}/>)}
    <group position={[tx,ty,tz]}>
      <mesh position={[0,1.1,0]}><boxGeometry args={[4,2.2,3]}/><meshStandardMaterial color="#e5d7b3" roughness={1}/></mesh>
      <mesh position={[0,1.2,1.51]}><boxGeometry args={[2.7,1.2,.04]}/><meshStandardMaterial color="#285943"/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*1.2,2.7,0]} rotation={[0,0,-side*.32]}><boxGeometry args={[2.6,.2,4.4]}/><meshStandardMaterial color="#B96545" roughness={1}/></mesh>)}
      <mesh position={[0,.6,2.5]}><boxGeometry args={[3,.15,.65]}/><meshStandardMaterial color="#72563d"/></mesh>
      {[-1,0,1].map(x=><mesh key={x} position={[x,.83,2.5]}><cylinderGeometry args={[.09,.065,.3,8]}/><meshStandardMaterial color="#b8bcb0" metalness={.3} roughness={.5}/></mesh>)}
    </group>
  </group>;
}
