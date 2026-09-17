import { useRef, type RefObject } from 'react';
import { wheelAngle } from './wheelMath';
import { bikeModel, type BikeModelId } from '../../content/assets/bikeProfiles';
import { ModelAsset } from '../render/ModelAsset';
import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3, type Group } from 'three';
function Tube({a,b,r=.025,color='#284838'}:{a:[number,number,number];b:[number,number,number];r?:number;color?:string}){
 const from=new Vector3(...a),to=new Vector3(...b),d=to.clone().sub(from),q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.clone().normalize());
 return <mesh position={from.add(to).multiplyScalar(.5)} quaternion={q} castShadow><cylinderGeometry args={[r,r,d.length(),8]}/><meshStandardMaterial color={color} roughness={.65}/></mesh>;
}
type BikeMotion=RefObject<{speed:number;signedSpeed?:number}>;
/** GLB bikes are single static meshes for now; only the procedural roadster spins its wheels. */
export function BicycleVisual({motion,modelId}:{motion?:BikeMotion;modelId?:BikeModelId}){
 const model=bikeModel(modelId);
 if(!model.url)return <RoadsterVisual motion={motion}/>;
 return <ModelAsset key={model.id} url={model.url} length={model.length} rotationY={model.rotationY} hiddenNodes={model.hiddenNodes} name={`bike-${model.id}`}/>;
}
/** Original procedural roadster preview. */
function RoadsterVisual({motion}:{motion?:BikeMotion}){
 const front=useRef<Group>(null),rear=useRef<Group>(null);
 useFrame((_,dt)=>{const angle=wheelAngle((motion?.current.signedSpeed??motion?.current.speed??0)*Math.min(dt,.05),.35);if(front.current)front.current.rotation.x+=angle;if(rear.current)rear.current.rotation.x+=angle;});
 return <group name="roadster-bicycle-preview">
  {[-.62,.62].map((z,i)=><group key={z} position={[0,.36,z]} ref={i?front:rear}>
    <mesh rotation={[0,Math.PI/2,0]} castShadow><torusGeometry args={[.35,.035,8,24]}/><meshStandardMaterial color="#282d29" roughness={.9}/></mesh>
    <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.31,.012,5,24]}/><meshStandardMaterial color="#aaad9b" metalness={.35}/></mesh>
    {Array.from({length:8},(_,n)=><Tube key={n} a={[0,0,0]} b={[0,Math.sin(n*Math.PI/4)*.31,Math.cos(n*Math.PI/4)*.31]} r={.005} color="#aaad9b"/>)}
  </group>)}
  <Tube a={[0,.36,-.62]} b={[0,.36,-.06]}/><Tube a={[0,.36,-.62]} b={[0,.94,-.25]}/><Tube a={[0,.36,-.06]} b={[0,.94,-.25]}/>
  <Tube a={[0,.94,-.25]} b={[0,.98,.46]}/><Tube a={[0,.36,-.06]} b={[0,.98,.46]}/>
  <Tube a={[-.055,.36,.62]} b={[-.055,1.02,.45]}/><Tube a={[.055,.36,.62]} b={[.055,1.02,.45]}/>
  <Tube a={[0,.94,-.25]} b={[0,1.05,-.27]} color="#a6aa96"/>
  <mesh position={[0,1.05,-.3]} castShadow><boxGeometry args={[.26,.065,.32]}/><meshStandardMaterial color="#523e2c"/></mesh>
  <Tube a={[0,.99,.46]} b={[0,1.23,.43]} color="#a6aa96"/><Tube a={[-.32,1.23,.43]} b={[.32,1.23,.43]} color="#a6aa96"/>
  <Tube a={[-.32,1.23,.43]} b={[-.32,1.23,.29]} color="#332f26"/><Tube a={[.32,1.23,.43]} b={[.32,1.23,.29]} color="#332f26"/>
  <mesh position={[.15,1.27,.43]}><sphereGeometry args={[.055,10,8]}/><meshStandardMaterial color="#bba65e" metalness={.4}/></mesh>
  <mesh position={[0,.86,-.66]} castShadow><boxGeometry args={[.28,.035,.4]}/><meshStandardMaterial color="#284838"/></mesh>
  <Tube a={[-.1,.36,-.62]} b={[-.1,.86,-.75]}/><Tube a={[.1,.36,-.62]} b={[.1,.86,-.75]}/>
  {[-1,1].map(side=><mesh key={side} position={[side*.2,.37,-.06]}><boxGeometry args={[.17,.055,.1]}/><meshStandardMaterial color="#483f31"/></mesh>)}
 </group>;
}
