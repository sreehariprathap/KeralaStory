import { memo, useEffect, useMemo } from 'react';
import { RigidBody, TrimeshCollider, CuboidCollider } from '@react-three/rapier';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, V2_ROUTES, V2_LAYOUT, isClearOfRoads, terrainHeight } from '../../content/world/definition';
import { ExpansionSign } from './ExpansionSign';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { TerrainChunk } from './expansionTerrain';
import { beachSand, coastDistance } from '../../content/world/snehaTheeram';
import { createRouteRibbon } from './routeVisualGeometry';

const WORLD_ROUTES = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];

const GRASS=new Color('#7d9361'),SAND=new Color('#e3cf9c'),WET_SAND=new Color('#bfa877');
/** Grass everywhere, but Sneha Theeram's crescent reads as pale dry sand darkening to wet sand at the waterline. */
function groundColors(vertices:readonly number[]){
  const colors=new Float32Array(vertices.length),color=new Color();
  for(let i=0;i<vertices.length;i+=3){
    const x=vertices[i],y=vertices[i+1],z=vertices[i+2],sand=beachSand(x,z,y);
    color.copy(GRASS);
    if(sand>0){const d=coastDistance(x,z)??99;color.lerp(d<5?WET_SAND.clone().lerp(SAND,Math.max(0,d)/5):SAND,sand);}
    colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;
  }
  return colors;
}
function Chunk({chunk}:{chunk:TerrainChunk}) {
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(chunk.vertices,3));g.setAttribute('color',new Float32BufferAttribute(groundColors(chunk.vertices),3));g.setIndex(chunk.indices);g.computeVertexNormals();return g;
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
/** Original north ground is rendered by KodasseryWorld; these chunks share only its edges. */
export const ExpansionGround=memo(function ExpansionGround(){return <>
  <RigidBody type="fixed" colliders={false} position={[EXPANSION_GROUND.streamBridge.position[0],EXPANSION_GROUND.streamBridge.position[1]-.3,EXPANSION_GROUND.streamBridge.position[2]]} rotation={[0,EXPANSION_GROUND.streamBridge.yawRad,0]}>
    <mesh receiveShadow><boxGeometry args={[7,.6,18]}/><meshStandardMaterial color="#9a9884" roughness={1}/></mesh>
    <CuboidCollider args={[3.5,.3,9]}/>
  </RigidBody>
  {EXPANSION_GROUND.chunks.map(chunk=><Chunk key={chunk.id} chunk={chunk}/>)}
  {WORLD_ROUTES.map(route=><RouteRibbon key={route.id} route={route} routes={WORLD_ROUTES}/>)}
  {/* Chalakkudy has its own city gateway board. */}
  {[...V2_LAYOUT.towns.filter(t=>!t.existing&&t.id!=='chalakkudy'),V2_LAYOUT.park].map(site=>{
    // First spot beside the centre that is clear of every road (Kodakara's centre is on NH 544).
    const [dx,dz]=([[7,0],[0,14],[0,-14],[-14,0],[14,14]] as const).find(([dx,dz])=>isClearOfRoads(site.center[0]+dx,site.center[2]+dz,1))??[7,0];
    const x=site.center[0]+dx,z=site.center[2]+dz;
    return <ExpansionSign key={site.id} position={[x,terrainHeight(x,z),z]} label={`${site.label} · site`} width={4}/>;
  })}
</>;});
