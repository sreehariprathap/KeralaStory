import { memo, useMemo } from 'react';
import { RigidBody, TrimeshCollider, CuboidCollider } from '@react-three/rapier';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, V2_ROUTES, V2_LAYOUT, terrainHeight } from '../../content/world/definition';
import { ExpansionSign } from './ExpansionSign';
import type { ExpansionRoute } from '../../contracts/worldExpansion';
import type { TerrainChunk } from './expansionTerrain';
import { routeSurfaceHeight, visibleRoutePoints } from './routeVisualGeometry';

const WORLD_ROUTES = [...EXPANSION_LAYOUT.routes, ...V2_ROUTES];

function Chunk({chunk}:{chunk:TerrainChunk}) {
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(chunk.vertices,3));g.setIndex(chunk.indices);g.computeVertexNormals();return g;
  },[chunk]);
  const collision=useMemo(()=>[new Float32Array(chunk.vertices),new Uint32Array(chunk.indices)] as const,[chunk]);
  return <RigidBody type="fixed" colliders={false}>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#7d9361" roughness={1}/></mesh>
    <TrimeshCollider args={[collision[0],collision[1]]} friction={.9}/>
  </RigidBody>;
}
function RouteRibbon({route,routes}:{route:ExpansionRoute;routes:readonly ExpansionRoute[]}) {
  const geometry=useMemo(()=>{
    const vertices:number[]=[],indices:number[]=[],across=6,points=visibleRoutePoints(route,routes);
    points.forEach((p,i)=>{
      const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
      const dx=after[0]-before[0],dz=after[2]-before[2],length=Math.hypot(dx,dz)||1;
      const centerTerrainHeight=EXPANSION_GROUND.deckHeightAt(p[0],p[2])??terrainHeight(p[0],p[2]);
      for(let j=0;j<=across;j++){
        const offset=(j/across-.5)*route.widthM,x=p[0]-dz/length*offset,z=p[2]+dx/length*offset;
        const sampledTerrainHeight=EXPANSION_GROUND.deckHeightAt(x,z)??terrainHeight(x,z);
        vertices.push(x,routeSurfaceHeight(p,centerTerrainHeight,sampledTerrainHeight)+.045,z);
        if(i<route.points.length-1&&j<across){const a=i*(across+1)+j;indices.push(a,a+1,a+across+1,a+1,a+across+2,a+across+1);}
      }
    });
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },[route,routes]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color={route.allowedModes.includes('car')?'#686d5e':'#c4b387'} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>;
}
/** Original north ground is rendered by KodasseryWorld; these chunks share only its edges. */
export const ExpansionGround=memo(function ExpansionGround(){return <>
  <RigidBody type="fixed" colliders={false} position={[EXPANSION_GROUND.streamBridge.position[0],EXPANSION_GROUND.streamBridge.position[1]-.3,EXPANSION_GROUND.streamBridge.position[2]]} rotation={[0,EXPANSION_GROUND.streamBridge.yawRad,0]}>
    <mesh receiveShadow><boxGeometry args={[7,.6,18]}/><meshStandardMaterial color="#9a9884" roughness={1}/></mesh>
    <CuboidCollider args={[3.5,.3,9]}/>
  </RigidBody>
  {EXPANSION_GROUND.chunks.map(chunk=><Chunk key={chunk.id} chunk={chunk}/>)}
  {WORLD_ROUTES.map(route=><RouteRibbon key={route.id} route={route} routes={WORLD_ROUTES}/>)}
  {[...V2_LAYOUT.towns.filter(t=>!t.existing),V2_LAYOUT.park].map(site=>{
    const x=site.center[0]+7,z=site.center[2];
    return <ExpansionSign key={site.id} position={[x,terrainHeight(x,z),z]} label={`${site.label} · ${site.id==='chalakkudy'?'first street':'site'}`} width={4}/>;
  })}
</>;});
