import { BRIDGE_DECK_Y, BRIDGE_NORTH_Z, BRIDGE_RAMPS, BRIDGE_SOUTH_Z, BRIDGE_X, JETTY_DECK_Y, JETTY_RAMP, QUAY_SOUTH_RAMP, WATER_LEVEL, riverCenter, terrainHeight } from '../../content/world/definition';
import type { Vec3 } from '../../contracts';

export interface TraversalBox { id: string; position: Vec3; size: Vec3; rotation: Vec3 }
const box = (id: string, position: Vec3, size: Vec3, rotation: Vec3 = [0,0,0]): TraversalBox => ({id,position,size,rotation});
export function traversalBoxes(): TraversalBox[] {
  const length = BRIDGE_SOUTH_Z - BRIDGE_NORTH_Z;
  const boxes = [box('bridge-deck', [BRIDGE_X,BRIDGE_DECK_Y-.25,(BRIDGE_NORTH_Z+BRIDGE_SOUTH_Z)/2], [4,.5,length])];
  for (const side of [-1,1]) boxes.push(box(`bridge-rail-${side}`, [BRIDGE_X+side*2.12,BRIDGE_DECK_Y+.6,(BRIDGE_NORTH_Z+BRIDGE_SOUTH_Z)/2], [.2,1.4,length]));
  for (const [i,ramp] of BRIDGE_RAMPS.entries()) {
    const dz = ramp.landZ-ramp.deckZ, dy = ramp.landY-BRIDGE_DECK_Y;
    const angle = -Math.atan(dy/dz), thickness = .3;
    // Offset along the surface normal, so authored endpoints describe the top.
    boxes.push(box(`bridge-ramp-${i}`, [BRIDGE_X,(ramp.landY+BRIDGE_DECK_Y)/2-Math.cos(angle)*thickness/2,(ramp.landZ+ramp.deckZ)/2-Math.sin(angle)*thickness/2], [4,thickness,Math.hypot(dz,dy)], [angle,0,0]));
  }
  const quayY=terrainHeight(48,77);
  const quayAngle=-Math.atan((QUAY_SOUTH_RAMP.landY-quayY)/(QUAY_SOUTH_RAMP.landZ-QUAY_SOUTH_RAMP.deckZ));
  boxes.push(box('harbor-south-ramp',[47,(quayY+QUAY_SOUTH_RAMP.landY)/2-Math.cos(quayAngle)*.15,(QUAY_SOUTH_RAMP.landZ+QUAY_SOUTH_RAMP.deckZ)/2-Math.sin(quayAngle)*.15],[4,.3,Math.hypot(QUAY_SOUTH_RAMP.landZ-QUAY_SOUTH_RAMP.deckZ,QUAY_SOUTH_RAMP.landY-quayY)],[quayAngle,0,0]));
  boxes.push(box('harbor-quay',[62,quayY-.25,79],[38,.5,14]));
  // Leave a 4.6m gate for the pedestrian pier approach.
  boxes.push(box('harbor-wall-north',[78,quayY-.7,(71+73.7)/2],[2,2.5,2.7]));
  boxes.push(box('harbor-wall-south',[78,quayY-.7,(78.3+89)/2],[2,2.5,10.7]));
  boxes.push(box('jetty',[87,WATER_LEVEL+.25,76],[19,.5,3.5]));
  const dy=JETTY_DECK_Y-JETTY_RAMP.landY, dx=JETTY_RAMP.deckX-JETTY_RAMP.landX;
  const angle=Math.atan2(dy,dx), thickness=.3;
  boxes.push(box('jetty-ramp',[(JETTY_RAMP.landX+JETTY_RAMP.deckX)/2+Math.sin(angle)*thickness/2,(JETTY_RAMP.landY+JETTY_DECK_Y)/2-Math.cos(angle)*thickness/2,76],[Math.hypot(dx,dy),thickness,3.5],[0,0,angle]));
  return boxes;
}

/** The exact mesh arrays used by both scene terrain colliders and route tests. */
export function terrainMeshData(region: 'north' | 'south') {
  const nx=region==='north'?54:83,nz=region==='north'?66:213;
  const vertices:number[]=[],indices:number[]=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++) {
    const x=region==='north'?-78+i/nx*166:-78+i*2;
    let z:number;
    if(region==='north') z=-499+j/nz*165;
    else if(j<=102)z=-334+j*2;
    else if(j<=110)z=-130+(riverCenter(x)-21+130)*(j-102)/8;
    else if(j<=131)z=riverCenter(x)-21+42*(j-110)/21;
    else if(j<=135)z=riverCenter(x)+21+(-64-riverCenter(x)-21)*(j-131)/4;
    else z=-64+(j-135)*2;
    vertices.push(x,terrainHeight(x,z),z);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  return {vertices,indices,nx,nz};
}
