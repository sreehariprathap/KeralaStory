import { memo, useEffect, useMemo } from 'react';
import { RigidBody, TrimeshCollider, CuboidCollider } from '@react-three/rapier';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, V2_ROUTES, V2_LAYOUT, isClearOfRoads, terrainHeight } from '../../content/world/definition';
import { ExpansionSign } from './ExpansionSign';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { TerrainChunk } from './expansionTerrain';
import { beachSand, coastDistance } from '../../content/world/snehaTheeram';
import { isTeaEstateGround } from '../../content/world/teaEstate';
import { createCapDisc, createRouteRibbon } from './routeVisualGeometry';
import { yawPitchToXyz } from '../../content/world/rotation';

const WORLD_ROUTES = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];

const GRASS=new Color('#7d9361'),TEA_SOIL=new Color('#6c7443'),SAND=new Color('#e3cf9c'),WET_SAND=new Color('#bfa877');
const HIGHLAND=new Color('#8e9a5a'),DRY_TOPS=new Color('#a7a672'),STONY=new Color('#8b8870'),FOLD=new Color('#66804f');
const smoothstep=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
/**
 * Ground colour from the chunk's own grid: grass in the lowlands, yellower highland grass and dry tops
 * up high, stony faces where it is steep, darker folds, and Sneha Theeram's sand at the coast.
 */
function groundColors(chunk:TerrainChunk){
  const {vertices,nx}=chunk,colors=new Float32Array(vertices.length),color=new Color(),stride=nx+1;
  const y=(i:number)=>vertices[i*3+1];
  for(let i=0,v=0;i<vertices.length;i+=3,v++){
    const x=vertices[i],h=vertices[i+1],z=vertices[i+2],col=v%stride,row=Math.floor(v/stride);
    // Slope from the neighbouring grid vertices (edges fall back to the vertex itself).
    const l=col?v-1:v,r=col<nx?v+1:v,u=row?v-stride:v,d=row<chunk.nz?v+stride:v;
    const dx=(vertices[r*3]-vertices[l*3])||1,dz=(vertices[d*3+2]-vertices[u*3+2])||1;
    const slope=Math.hypot((y(r)-y(l))/dx,(y(d)-y(u))/dz);
    // Concavity: lower than the neighbours' average means a fold or gully.
    const fold=Math.max(0,Math.min(1,((y(l)+y(r)+y(u)+y(d))/4-h)*1.5));
    color.copy(isTeaEstateGround(x,z)?TEA_SOIL:GRASS);
    color.lerp(HIGHLAND,smoothstep((h-95)/60)).lerp(DRY_TOPS,smoothstep((h-165)/35)*(1-smoothstep((slope-.6)/.3)));
    color.lerp(FOLD,fold*.6).lerp(STONY,smoothstep((slope-.55)/.45)*.85);
    color.offsetHSL(0,0,(Math.sin(x*.11)*Math.sin(z*.13)+Math.sin(x*.043+z*.037))*.012);
    const sand=beachSand(x,z,h);
    if(sand>0){const c=coastDistance(x,z)??99;color.lerp(c<5?WET_SAND.clone().lerp(SAND,Math.max(0,c)/5):SAND,sand);}
    colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;
  }
  return colors;
}
function Chunk({chunk}:{chunk:TerrainChunk}) {
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(chunk.vertices,3));g.setAttribute('color',new Float32BufferAttribute(groundColors(chunk),3));g.setIndex(chunk.indices);g.computeVertexNormals();return g;
  },[chunk]);
  const collision=useMemo(()=>[new Float32Array(chunk.vertices),new Uint32Array(chunk.indices)] as const,[chunk]);
  return <RigidBody type="fixed" colliders={false}>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1}/></mesh>
    <TrimeshCollider args={[collision[0],collision[1]]} friction={.9}/>
  </RigidBody>;
}
/** Whichever is higher, deck or ground: bridge ends never leave a lip of terrain above the road. */
const surfaceHeight=(x:number,z:number)=>Math.max(EXPANSION_GROUND.deckHeightAt(x,z)??-Infinity,terrainHeight(x,z));
const rgb=(hex:string)=>{const c=new Color(hex);return [c.r,c.g,c.b] as const;};
const CAR_COLORS={surface:rgb('#686d5e'),shoulder:rgb('#8e8b72')},TRAIL_COLORS={surface:rgb('#c4b387'),shoulder:rgb('#c4b387')};
// Unsealed tracks are graded earth, dusty at the edges.
// Turning circles are fresh asphalt: a touch darker than the weathered carriageways they finish.
const CAP_COLORS={surface:rgb('#595d55'),shoulder:rgb('#7f7d68')};
const DIRT_COLORS={surface:rgb('#9a8560'),shoulder:rgb('#8e8256')};
/** Dense, ground-hugging road surface with flared junction corners (see createRouteRibbon). */
function RouteRibbon({route,routes}:{route:ExpansionRoute;routes:readonly ExpansionRoute[]}) {
  const geometry=useMemo(()=>{
    const mesh=createRouteRibbon(route,routes,surfaceHeight,route.surface==='dirt'?DIRT_COLORS:route.allowedModes.includes('car')?CAR_COLORS:TRAIL_COLORS);
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(mesh.positions,3));g.setAttribute('color',new Float32BufferAttribute(mesh.colors,3));g.setIndex(mesh.indices);g.computeVertexNormals();return g;
  },[route,routes]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>;
}
/** A road's paved turning circle, in the same asphalt as the carriageway. */
function CapDisc({cap}:{cap:{center:readonly [number,number,number];radius:number}}) {
  const geometry=useMemo(()=>{
    const mesh=createCapDisc(cap.center,cap.radius,surfaceHeight,CAP_COLORS);
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(mesh.positions,3));g.setAttribute('color',new Float32BufferAttribute(mesh.colors,3));g.setIndex(mesh.indices);g.computeVertexNormals();return g;
  },[cap]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  // Drawn just under the road ribbons, so a carriageway running into the circle reads as continuous.
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-.5} polygonOffsetUnits={-.5}/></mesh>;
}
/** Original north ground is rendered by KodasseryWorld; these chunks share only its edges. */
export const ExpansionGround=memo(function ExpansionGround(){return <>
  <RigidBody type="fixed" colliders={false} position={[EXPANSION_GROUND.streamBridge.position[0],EXPANSION_GROUND.streamBridge.position[1]-.3,EXPANSION_GROUND.streamBridge.position[2]]} rotation={yawPitchToXyz(EXPANSION_GROUND.streamBridge.yawRad,EXPANSION_GROUND.streamBridge.pitchRad)}>
    <mesh receiveShadow><boxGeometry args={[7,.6,18/Math.cos(EXPANSION_GROUND.streamBridge.pitchRad)]}/><meshStandardMaterial color="#9a9884" roughness={1}/></mesh>
    <CuboidCollider args={[3.5,.3,9/Math.cos(EXPANSION_GROUND.streamBridge.pitchRad)]}/>
  </RigidBody>
  {EXPANSION_GROUND.chunks.map(chunk=><Chunk key={chunk.id} chunk={chunk}/>)}
  {WORLD_ROUTES.map(route=><RouteRibbon key={route.id} route={route} routes={WORLD_ROUTES}/>)}
  {V2_LAYOUT.roadCaps.map(cap=><CapDisc key={cap.id} cap={cap}/>)}
  {/* Chalakkudy has its own city gateway board. */}
  {[...V2_LAYOUT.towns.filter(t=>!t.existing&&t.id!=='chalakkudy'),V2_LAYOUT.park].map(site=>{
    // First spot beside the centre that is clear of every road (Kodakara's centre is on NH 544).
    const [dx,dz]=([[7,0],[0,14],[0,-14],[-14,0],[14,14]] as const).find(([dx,dz])=>isClearOfRoads(site.center[0]+dx,site.center[2]+dz,1))??[7,0];
    const x=site.center[0]+dx,z=site.center[2]+dz;
    return <ExpansionSign key={site.id} position={[x,terrainHeight(x,z),z]} label={`${site.label} · site`} width={4}/>;
  })}
</>;});
