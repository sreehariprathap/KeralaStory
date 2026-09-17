import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, BufferGeometry, Float32BufferAttribute } from 'three';
import { EXPANSION_LAYOUT } from '../../content/world/definition';
import type { Locale } from '../../contracts';
import { localizedPlace } from '../../features/i18n/translate';
import { cascadeGeometry } from './waterfallGeometry';
import { waterMaterial } from './Waterfall';
import { ExpansionSign } from './ExpansionSign';

export function AthirappillyWorld({ quality, animated, locale }: { quality: 'low'|'medium'|'high'; animated: boolean; locale: Locale }) {
  const time=useMemo(()=>({value:0}),[]);
  const assets=useMemo(()=>{
    const upstream=EXPANSION_LAYOUT.waterBodies.find(w=>w.id==='chalakudy-upstream')!;
    const pool=EXPANSION_LAYOUT.waterBodies.find(w=>w.id==='athirappilly-pool')!;
    const curtains=[{x:-649,width:17},{x:-628,width:20},{x:-606,width:15}].map(({x,width})=>cascadeGeometry({x,z:-399.7,topY:upstream.surfaceY,width,height:upstream.surfaceY-pool.surfaceY},quality==='low'));
    const water=EXPANSION_LAYOUT.waterBodies.filter(body=>body.id==='chokkana-stream-water').map(body=>{
      const geometry=new BufferGeometry(),vertices:number[]=[],indices:number[]=[];
      for(const [x,z] of body.footprint)vertices.push(x,body.surfaceY,z);
      for(let i=1;i<body.footprint.length-1;i++)indices.push(0,i+1,i);
      geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
    });
    return {curtains,water,material:waterMaterial(quality==='low',time),top:upstream.surfaceY,bottom:pool.surfaceY};
  },[quality,time]);
  useEffect(()=>()=>{assets.curtains.forEach(g=>g.dispose());assets.water.forEach(g=>g.dispose());assets.material.dispose();},[assets]);
  useFrame((_,delta)=>{if(animated)time.value+=Math.min(delta,.05);});
  const upper=EXPANSION_LAYOUT.anchors.find(a=>a.id==='athirappilly-falls')!;
  const lower=EXPANSION_LAYOUT.anchors.find(a=>a.id==='athirappilly-lower-view')!;
  return <group>
    {assets.water.map((geometry,i)=><mesh key={i} geometry={geometry}><meshStandardMaterial color="#4BA6B2" roughness={.65} side={DoubleSide}/></mesh>)}
    <mesh position={[-627,(assets.top+assets.bottom)/2,-403]}><boxGeometry args={[67,assets.top-assets.bottom,6]}/><meshStandardMaterial color="#626f63" roughness={1}/></mesh>
    {assets.curtains.map((geometry,i)=><mesh key={i} geometry={geometry} material={assets.material}/>)}
    {[[-658,5],[-638,3],[-616,3],[-596,4]].map(([x,width],i)=><mesh key={i} position={[x,(assets.top+assets.bottom)/2,-398.5]}><boxGeometry args={[width,assets.top-assets.bottom+1,4]}/><meshStandardMaterial color={i%2?'#838977':'#717c6b'} roughness={1}/></mesh>)}
    <mesh position={[-626,assets.bottom+.04,-389]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[57,4]}/><meshBasicMaterial color="#d8e8d7" transparent opacity={.48} depthWrite={false}/></mesh>
    {quality!=='low'&&<mesh position={[-627,assets.bottom+1,-394]} scale={[26,1.6,3]}><sphereGeometry args={[1,16,8]}/><meshBasicMaterial color="#e3efd6" transparent opacity={.18} depthWrite={false}/></mesh>}
    <ExpansionSign position={[upper.position[0]+5,upper.position[1],upper.position[2]-3]} label={localizedPlace(upper.id,locale)} width={4}/>
    <ExpansionSign position={[lower.position[0]+4,lower.position[1],lower.position[2]+1]} label={localizedPlace(lower.id,locale)} width={3.8}/>
  </group>;
}
