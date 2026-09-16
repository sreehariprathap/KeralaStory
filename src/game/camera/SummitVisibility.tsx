import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Fog, PerspectiveCamera } from 'three';
import { EXPANSION_LAYOUT, WORLD_BOUNDS } from '../../content/world/definition';
import { requiredFarPlane, summitBlend } from './panoramaMath';

export function SummitVisibility({reducedMotion}:{reducedMotion:boolean}) {
  const blend=useRef(0);
  const far=useMemo(()=>{
    const b=WORLD_BOUNDS,s=EXPANSION_LAYOUT.summitPosition;
    const corners=[b.xMin,b.xMax].flatMap(x=>[b.zMin,b.zMax].flatMap(z=>[0,s[1]+20].map(y=>[x,y,z])));
    return requiredFarPlane([s[0],s[1]+2,s[2]],corners,1.15);
  },[]);
  useFrame(({camera,scene},delta)=>{
    const summit=EXPANSION_LAYOUT.summitPosition;
    const proximity=1-summitBlend(Math.hypot(camera.position.x-summit[0],camera.position.z-summit[2]),130,230);
    const target=summitBlend(camera.position.y,summit[1]-55,summit[1]-8)*proximity;
    blend.current=reducedMotion?target:blend.current+(target-blend.current)*(1-Math.exp(-3*Math.min(delta,.05)));
    if(camera instanceof PerspectiveCamera&&camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    if(scene.fog instanceof Fog){scene.fog.near=95+(far*.7-95)*blend.current;scene.fog.far=285+(far*1.25-285)*blend.current;}
  });
  return null;
}
