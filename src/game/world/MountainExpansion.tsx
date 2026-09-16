import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { mountainArchitectureBoxes } from '../../content/world/staticArchitecture';
import type { Locale } from '../../contracts';
import { EXPANSION_LAYOUT, terrainHeight } from '../../content/world/definition';
import { localizedPlace } from '../../features/i18n/translate';
import { ExpansionSign } from './ExpansionSign';

/** Small fixed rails protect the exposed terrace; the southeast approach remains open. */
export function MountainExpansion({locale}:{locale:Locale}) {
  const summit=EXPANSION_LAYOUT.summitPosition;
  const trail=EXPANSION_LAYOUT.routes.find(r=>r.id==='summit-trail')!;
  const head=EXPANSION_LAYOUT.anchors.find(a=>a.id==='summit-trailhead')!;
  const pads=[.25,.5,.75].map(t=>trail.points[Math.round((trail.points.length-1)*t)]);
  const boxes=mountainArchitectureBoxes(),rails=boxes.slice(0,2),gates=boxes.slice(2).map(box=>box.position);
  return <group>
    <ExpansionSign position={[head.position[0]+5,head.position[1],head.position[2]]} label={`${localizedPlace(head.id,locale)} · ${localizedPlace('kodassery-summit',locale)}`} width={4}/>
    <ExpansionSign position={[summit[0]+5,summit[1],summit[2]+3]} label={localizedPlace('kodassery-summit',locale)} width={3.5}/>
    <RigidBody type="fixed" colliders={false}>
      {rails.map((rail,i)=><CuboidCollider key={i} position={rail.position} args={rail.size.map(v=>v/2) as [number,number,number]}/>)}
      {gates.map((position,i)=><CuboidCollider key={`gate${i}`} position={position} args={[.28,.55,.28]}/>)}
    </RigidBody>
    {rails.map((rail,i)=><mesh key={i} position={rail.position}><boxGeometry args={rail.size}/><meshStandardMaterial color="#80684a" roughness={1}/></mesh>)}
    {gates.map((position,i)=><mesh key={i} position={position}><cylinderGeometry args={[.28,.35,1.1,7]}/><meshStandardMaterial color="#939783" roughness={1}/></mesh>)}
    {pads.map((p,i)=>{
      const x=p[0]+4,z=p[2],y=terrainHeight(x,z);
      return <group key={i} position={[x,y,z]}>
        <mesh position={[0,.55,0]}><boxGeometry args={[2,.18,.6]}/><meshStandardMaterial color="#80684a" roughness={1}/></mesh>
        {[-.7,.7].map(x=><mesh key={x} position={[x,.25,0]}><boxGeometry args={[.16,.5,.5]}/><meshStandardMaterial color="#626f63" roughness={1}/></mesh>)}
      </group>;
    })}
    <group position={[head.position[0]+7,terrainHeight(head.position[0]+7,head.position[2]-8),head.position[2]-8]}>
      {[-1.5,1.5].flatMap(x=>[-1.5,1.5].map(z=><mesh key={`${x}${z}`} position={[x,1.2,z]}><boxGeometry args={[.17,2.4,.17]}/><meshStandardMaterial color="#72563d"/></mesh>))}
      {[-1,1].map(side=><mesh key={side} position={[side*.95,2.7,0]} rotation={[0,0,-side*.3]}><boxGeometry args={[2.1,.18,4]}/><meshStandardMaterial color="#B96545" roughness={1}/></mesh>)}
    </group>
  </group>;
}
