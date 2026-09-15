import { terrainMeshData } from './traversalGeometry';
import { memo, useMemo, useRef, useLayoutEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferGeometry, Float32BufferAttribute, Color, CatmullRomCurve3, Vector3, Object3D, DoubleSide, InstancedMesh, Box3, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KODASSERY_PATH, terrainHeight } from '../../content/world/kodassery';
import { ImportedTrees, type ImportedTreeInstance } from './ImportedTrees';
import { Waterfall } from './Waterfall';
import { isWaterfallFootprint } from './waterfallGeometry';

const greens = ['#477153','#658956','#789857','#527c59','#95aa64'];
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const pathCurve = new CatmullRomCurve3(KODASSERY_PATH.map(([x,z]) => new Vector3(x,terrainHeight(x,z),z)));
export const TRAIL_POINTS = pathCurve.getPoints(150);

function terrainGeometry() {
  const g = new BufferGeometry(), {vertices:p,indices:idx,nx,nz}=terrainMeshData('north');
  const c:number[]=[],base=new Color();
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) {
    base.set(i%3===0 ? '#829361' : '#879b65'); base.multiplyScalar(0.97+Math.sin(i*1.6+j*.9)*.055); c.push(base.r,base.g,base.b);
  }
  g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function trailGeometry(points:Vector3[],width:number) {
  const g=new BufferGeometry();const p:number[]=[],idx:number[]=[];
  points.forEach((point,i)=>{const before=points[Math.max(i-1,0)],after=points[Math.min(i+1,points.length-1)];const d=after.clone().sub(before).normalize();const side=new Vector3(-d.z,0,d.x).multiplyScalar(width/2);
    [point.clone().add(side),point.clone().sub(side)].forEach(v=>p.push(v.x,terrainHeight(v.x,v.z)+.065,v.z));
    if(i<points.length-1){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  });g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

export type Instance = {position:[number,number,number];scale:[number,number,number];rotation?:[number,number,number];color:string};
function InstanceMesh({data,kind}:{data:Instance[];kind:'leaf'|'trunk'|'rock'|'cloud'|'grass'|'timber'}) {
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const obj=new Object3D();const color=new Color();data.forEach((v,i)=>{obj.position.set(...v.position);obj.scale.set(...v.scale);obj.rotation.set(...(v.rotation??[0,0,0]));obj.updateMatrix();ref.current!.setMatrixAt(i,obj.matrix);ref.current!.setColorAt(i,color.set(v.color));});ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere();},[data]);
  return <instancedMesh ref={ref} args={[undefined,undefined,data.length]} castShadow={kind!=='cloud'&&kind!=='grass'} receiveShadow={kind!=='cloud'}>
    {kind==='timber'?<boxGeometry/>:kind==='trunk'?<cylinderGeometry args={[.32,.57,1,6]}/>:kind==='grass'?<coneGeometry args={[.5,1,4]}/>:<icosahedronGeometry args={[1,kind==='cloud'?2:1]}/>}
    {kind==='cloud'?<meshBasicMaterial color="#e4ecda" transparent opacity={.82}/>:<meshStandardMaterial roughness={1} flatShading/>}
  </instancedMesh>;
}

const KODASSERY_GRASS = [
  '/assets/grass/shrub.glb',
  '/assets/grass/shrub2.glb',
] as const;
const KODASSERY_TREES = [
  '/assets/trees/anime_tree_2.glb',
  '/assets/trees/jabami_anime_tree_v4.glb',
  '/assets/trees/jabami_anime_tree_v5.glb',
] as const;

/** Instanced authored foliage, normalized to the small cone-grass footprint. */
export function GrassAssetMesh({ data, url }: { data: Instance[]; url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const { geometry, material, sourceScale } = useMemo(() => {
    const source = gltf.scene;
    source.updateMatrixWorld(true);
    const mesh = source.getObjectByProperty('isMesh', true) as Mesh | undefined;
    if (!mesh) throw new Error(`Grass asset has no mesh: ${url}`);
    const bounds = new Box3().setFromObject(source, true);
    const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
    const normalized = mesh.geometry.clone();
    normalized.applyMatrix4(mesh.matrixWorld);
    const center = bounds.getCenter(new Vector3());
    normalized.translate(-center.x, -bounds.min.y, -center.z);
    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const clonedMaterial = sourceMaterial.clone();
    clonedMaterial.side = 2;
    if ('roughness' in clonedMaterial) clonedMaterial.roughness = 1;
    return { geometry: normalized, material: clonedMaterial, sourceScale: 0.82 / height };
  }, [gltf.scene, url]);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new Object3D();
    data.forEach((instance, index) => {
      object.position.set(...instance.position);
      object.rotation.set(...(instance.rotation ?? [0, 0, 0]));
      object.scale.set(instance.scale[0] * sourceScale, instance.scale[1] * sourceScale, instance.scale[2] * sourceScale);
      object.updateMatrix();
      ref.current?.setMatrixAt(index, object.matrix);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [data, sourceScale]);
  return <instancedMesh ref={ref} args={[geometry, material, data.length]} frustumCulled={false} />;
}

function generateForest(){
  const trunks:Instance[]=[], leaves:Instance[]=[], importedFallbackTrunks:Instance[]=[], importedFallbackLeaves:Instance[]=[], importedTrees:ImportedTreeInstance[][]=KODASSERY_TREES.map(()=>[]), rocks:Instance[]=[], grass:Instance[]=[],clouds:Instance[]=[];
  const r=rng(831);
  for(let i=0;i<230;i++){
    const x=(r()-.5)*148,z=-496+r()*162;
    const nearest=Math.min(...TRAIL_POINTS.map(p=>Math.hypot(p.x-x,p.z-z)));
    if(nearest<6 || (x>4&&x<37&&z>-436&&z<-400) || (x>24&&z>-405&&z<-370))continue;
    const h=6+r()*9,y=terrainHeight(x,z),s=.8+r()*.5;
    // Every seventeenth authored position uses a supplied tree. Keeping the
    // source position and height makes the replacement deterministic and
    // avoids changing the route or the forest density.
    const imported = i % 17 === 0;
    if (imported) {
      importedTrees[(i / 17) % KODASSERY_TREES.length | 0].push({ position:[x,y,z], scale:(h + 4.5) * s, rotation:[0, (i % 9) * .7, 0] });
      // Keep a low-tier stand-in at the same authored position. Consume the
      // same color RNG draws as the four procedural leaf clusters below so
      // later forest positions remain stable across quality tiers.
      importedFallbackTrunks.push({position:[x,y+h/2,z],scale:[s,h,s],color:'#6b6950'});
      for(let n=0;n<4;n++){const angle=n*2.4; importedFallbackLeaves.push({position:[x+Math.cos(angle)*2.1,y+h+(n===0?1.5:0),z+Math.sin(angle)*2.1],scale:[3.6*s,2.3*s,3.4*s],color:greens[Math.floor(r()*greens.length)]});}
    } else {
      trunks.push({position:[x,y+h/2,z],scale:[s,h,s],color:'#6b6950'});
      for(let n=0;n<4;n++){const angle=n*2.4;leaves.push({position:[x+Math.cos(angle)*2.1,y+h+(n===0?1.5:0),z+Math.sin(angle)*2.1],scale:[3.6*s,2.3*s,3.4*s],color:greens[Math.floor(r()*greens.length)]});}
    }
    if(i%4===0)rocks.push({position:[x+1,y+.5,z+2],scale:[1+r(),1+r(),1+r()],color:'#798271'});
  }
  for(let i=0;i<850;i++){
    const x=(r()-.5)*125,z=-483+r()*147;
    if(Math.min(...TRAIL_POINTS.map(p=>Math.hypot(p.x-x,p.z-z)))<3)continue;
    grass.push({position:[x,terrainHeight(x,z)+.35,z],scale:[.35+r()*.5,.4+r()*.6,.35+r()*.4],rotation:[0,r()*6,0],color:greens[Math.floor(r()*greens.length)]});
  }
  for(let i=0;i<35;i++){clouds.push({position:[-130+r()*250,88+r()*40,-500-r()*100],scale:[14+r()*20,2+r()*4,6+r()*10],color:'#e5eadb'});}
  // Filter after the seeded generation so clearing water does not shuffle the forest.
  const clearTree = (tree: {position: [number, number, number]}) => !isWaterfallFootprint(tree.position[0], tree.position[2], 2.8);
  return {
    trunks: trunks.filter(clearTree),
    leaves: leaves.filter((_, i) => clearTree(trunks[Math.floor(i / 4)])),
    importedFallbackTrunks: importedFallbackTrunks.filter(clearTree),
    importedFallbackLeaves: importedFallbackLeaves.filter((_, i) => clearTree(importedFallbackTrunks[Math.floor(i / 4)])),
    importedTrees: importedTrees.map(trees => trees.filter(clearTree)),
    rocks: rocks.filter(rock => !isWaterfallFootprint(rock.position[0], rock.position[2], .8)),
    grass: grass.filter(blade => !isWaterfallFootprint(blade.position[0], blade.position[2], .6)),
    clouds,
  };
}
const forest=generateForest();

function Timber({position,scale,color='#80684a',rotation=[0,0,0]}:{position:[number,number,number];scale:[number,number,number];color?:string;rotation?:[number,number,number]}) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow><boxGeometry/><meshStandardMaterial color={color} roughness={1}/></mesh>;
}

function Treehouse({x,z,scale=1}:{x:number;z:number;scale?:number}){
  const y=terrainHeight(x,z)+3;
  return <group position={[x,y,z]} scale={scale}>
    <mesh position={[0,2.7,1]} castShadow><cylinderGeometry args={[.65,1,13,9]}/><meshStandardMaterial color="#71644b"/></mesh>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[3.6,.18,3]} position={[0,0,0]}/><CuboidCollider args={[2.4,1.35,.16]} position={[0,1.5,2]}/><CuboidCollider args={[.16,1.35,2]} position={[-2.4,1.5,0]}/><CuboidCollider args={[.16,1.35,2]} position={[2.4,1.5,0]}/></RigidBody>
    {[-2.9,2.9].flatMap(px => [-2.3,2.3].map(pz => {
      const bottom = (terrainHeight(x + px * scale, z + pz * scale) - y) / scale - .15;
      const top = -.17;
      return <Timber key={`${px}:${pz}`} position={[px,(top+bottom)/2,pz]} scale={[.24,top-bottom,.24]} color="#71644b"/>;
    }))}
    <Timber position={[0,0,0]} scale={[7.2,.35,6]} color="#9b8057"/>
    <InstanceMesh kind="timber" data={Array.from({length:19},(_,i)=>({position:[-3.5+i*.39,.19,0] as [number,number,number],scale:[.025,.012,5.95] as [number,number,number],color:'#66553c'}))}/>
    <Timber position={[0,1.5,2]} scale={[4.8,2.8,.25]}/><Timber position={[-2.4,1.5,0]} scale={[.25,2.8,4]}/><Timber position={[2.4,1.5,0]} scale={[.25,2.8,4]}/>
    {[-1.6,1.6].map(a=><group key={a}><Timber position={[a,1.5,-2]} scale={[1.6,2.8,.22]} color="#aa8d5b"/><Timber position={[a,1.7,-2.14]} scale={[.84,.95,.04]} color="#344f43"/><Timber position={[a,1.7,-2.18]} scale={[.08,1.02,.07]} color="#dbc797"/></group>)}
    {[-1,1].map(side=><mesh key={side} position={[side*1.48,3.78,0]} rotation={[0,0,-side*.48]} castShadow><boxGeometry args={[3.65,.22,5.8]}/><meshStandardMaterial color={side>0?'#a26743':'#bd7950'}/></mesh>)}
    <Timber position={[0,4.5,0]} scale={[.22,.2,5.9]} color="#604c36"/>
    {[-3.3,3.3].map(a=><group key={a}><Timber position={[a,.75,-.3]} scale={[.11,1.5,5.4]}/>{[-2.5,0,2.5].map(b=><Timber key={b} position={[a,.6,b]} scale={[.12,1.2,.12]}/>)}</group>)}
    <mesh position={[0,10,0]} scale={[6.7,3.5,6]} castShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#688854" roughness={1}/></mesh>
    <mesh position={[-4,8.5,0]} scale={[4.5,2.7,4.5]} castShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#7c9758" roughness={1}/></mesh>
  </group>;
}

function Bridge(){
  const a=new Vector3(8,terrainHeight(8,-434)+.1,-434),b=new Vector3(18,terrainHeight(18,-415)+3.2,-415);
  const d=b.clone().sub(a),len=d.length(),mid=a.clone().add(b).multiplyScalar(.5);const yaw=Math.atan2(d.x,d.z),pitch=-Math.atan2(d.y,Math.hypot(d.x,d.z));
  return <group position={mid.toArray()} rotation={[0,yaw,0]}><group rotation={[pitch,0,0]}>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.1,.12,len/2]}/><CuboidCollider args={[.08,.5,len/2]} position={[-1.12,.55,0]}/><CuboidCollider args={[.08,.5,len/2]} position={[1.12,.55,0]}/></RigidBody>
    <InstanceMesh kind="timber" data={Array.from({length:44},(_,i)=>({position:[0,0,-len/2+i*len/43] as [number,number,number],scale:[2.3,.18,.39] as [number,number,number],color:i%3===0?'#b49566':'#9a7b51'}))}/>
    {[-1.13,1.13].map(x=><group key={x}>{Array.from({length:9},(_,i)=><Timber key={i} position={[x,.55,-len/2+i*len/8]} scale={[.09,1.2,.09]} color="#705c3e"/>)}{[.55,1.05].map(y=><mesh key={y} position={[x,y,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.035,.035,len,5]}/><meshStandardMaterial color="#c1aa7a"/></mesh>)}</group>)}
  </group></group>;
}

function MountainBackdrop(){return <group>{Array.from({length:14},(_,i)=>{const h=40+(Math.sin(i*2.4)+1)*38;return <mesh key={i} position={[-170+i*27,62+h/2,-570-(i%3)*30]} scale={[1,1,.8]}><coneGeometry args={[38+(i%3)*8,h,7]}/><meshStandardMaterial color={i%2?'#89a293':'#719183'} flatShading roughness={1}/></mesh>;})}</group>;}

function WorldGeometry({quality='medium',animated=true}:{quality?:'low'|'medium'|'high';animated?:boolean}){
  const ground=useMemo(terrainGeometry,[]);const path=useMemo(()=>trailGeometry(TRAIL_POINTS,3.8),[]);
  const pathBranch=useMemo(()=>trailGeometry(new CatmullRomCurve3([new Vector3(7,0,-396),new Vector3(21,0,-391),new Vector3(31,0,-386)]).getPoints(35),2.4),[]);
  const treeTrunks=useMemo(()=>quality==='low'?[...forest.trunks,...forest.importedFallbackTrunks].filter((_,i)=>i%2===0):forest.trunks,[quality]);
  const treeLeaves=useMemo(()=>quality==='low'?[...forest.leaves,...forest.importedFallbackLeaves].filter((_,i)=>Math.floor(i/4)%2===0):forest.leaves,[quality]);
  const colliderTrunks=[...forest.trunks,...forest.importedFallbackTrunks];
  return <>
    <MountainBackdrop/><InstanceMesh data={forest.clouds} kind="cloud"/>
    <RigidBody type="fixed" colliders="trimesh"><mesh geometry={ground} receiveShadow><meshStandardMaterial vertexColors roughness={1}/></mesh></RigidBody>
    <mesh geometry={path} receiveShadow><meshStandardMaterial color="#d5c396" roughness={1} side={DoubleSide}/></mesh>
    <mesh geometry={pathBranch} receiveShadow><meshStandardMaterial color="#c8b58b" roughness={1} side={DoubleSide}/></mesh>
    <InstanceMesh data={treeTrunks} kind="trunk"/><InstanceMesh data={treeLeaves} kind="leaf"/><InstanceMesh data={forest.rocks} kind="rock"/>
    {quality!=='low'&&KODASSERY_TREES.map((url,index)=><ImportedTrees key={url} url={url} data={forest.importedTrees[index]}/>) }
    {quality!=='low'&&KODASSERY_GRASS.map((url,index)=><GrassAssetMesh key={url} url={url} data={forest.grass.filter((_,i)=>i%KODASSERY_GRASS.length===index)}/>)}
    <Treehouse x={18} z={-415}/><Treehouse x={32} z={-425} scale={.8}/><Bridge/><Waterfall animated={animated} quality={quality}/>
    <RigidBody type="fixed" colliders={false}>
      {colliderTrunks.filter(t=>Math.min(...TRAIL_POINTS.map(p=>Math.hypot(p.x-t.position[0],p.z-t.position[2])))<15).map((t,i)=><CuboidCollider key={i} position={[t.position[0],t.position[1],t.position[2]]} args={[.5,t.scale[1]/2,.5]}/>)}
    </RigidBody>
    {[-465,-348].map(z=><group key={z} position={[4,terrainHeight(4,z),z]}><Timber position={[0,1,0]} scale={[.15,2,.15]} color="#776244"/><Timber position={[0,1.75,0]} scale={[1.7,.5,.15]} color="#b69a6a"/><Timber position={[.4,1.75,-.095]} scale={[.5,.06,.025]} color="#3c5840"/></group>)}
  </>;
}

export const KodasseryWorld = memo(WorldGeometry);
