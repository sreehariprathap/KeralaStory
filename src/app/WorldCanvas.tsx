import { Suspense, memo, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PCFShadowMap, Object3D, DirectionalLight } from 'three';
import type { ExplorerControllerProps, ExplorerProfile, GameSettings, Locale } from '../contracts';
import { KeralaWorld } from '../game/world/KeralaWorld';
import { ExplorerController } from '../game/player/ExplorerController';
import { SummitVisibility } from '../game/camera/SummitVisibility';
import { ExplorerAvatar } from '../game/player/ExplorerAvatar';

function EstablishingCamera(){const {camera}=useThree();useEffect(()=>{camera.position.set(-31,99,-457);camera.lookAt(16,79,-411);},[camera]);return null;}
function Ready({onReady}:{onReady:()=>void}){const once=useRef(false);useEffect(()=>{if(!once.current){once.current=true;onReady();}},[onReady]);return null;}
function ContextRecovery({onError}:{onError:(error:string)=>void}){const {gl}=useThree();useEffect(()=>{const canvas=gl.domElement;const handle=(e:Event)=>{e.preventDefault();onError('The graphics connection was interrupted. Reload the scene to continue.');};canvas.addEventListener('webglcontextlost',handle);return()=>canvas.removeEventListener('webglcontextlost',handle);},[gl,onError]);return null;}
function SunRig(){
  const light=useRef<DirectionalLight>(null);const target=useMemo(()=>new Object3D(),[]);
  useFrame(({camera})=>{if(!light.current)return;target.position.set(camera.position.x,camera.position.y-5,camera.position.z);light.current.position.set(camera.position.x-55,camera.position.y+85,camera.position.z-35);target.updateMatrixWorld();});
  return <><primitive object={target}/><directionalLight ref={light} target={target} intensity={2.2} color="#fff0cd" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-near={1} shadow-camera-far={230} shadow-bias={-.0002}/></>;
}
function RenderMeter(){
  const times=useRef<number[]>([]);const elapsed=useRef(0);
  useFrame(({gl},delta)=>{if(!import.meta.env.DEV)return;times.current.push(delta*1000);if(times.current.length>180)times.current.shift();elapsed.current+=delta;if(elapsed.current<2)return;elapsed.current=0;const sorted=[...times.current].sort((a,b)=>a-b);const node=document.querySelector<HTMLElement>('[data-render-metrics]');if(node){node.dataset.median=String(sorted[Math.floor(sorted.length*.5)]?.toFixed(1));node.dataset.p95=String(sorted[Math.floor(sorted.length*.95)]?.toFixed(1));node.textContent=`Frame ${node.dataset.median}ms / p95 ${node.dataset.p95}ms · ${gl.info.render.calls} calls · ${gl.info.render.triangles.toLocaleString()} tris`;}});
  return null;
}
function SceneCanvas({active,settings,controller,onReady,onError,locale='en'}:{locale?:Locale;active:boolean;settings:GameSettings;controller:ExplorerControllerProps;onReady:()=>void;onError:(error:string)=>void}){
  return <Canvas shadows={settings.quality!=='low'?{type:PCFShadowMap}:false} dpr={settings.quality==='low'?1:settings.quality==='high'?[1,2]:[1,1.5]} camera={{position:[-31,99,-457],fov:52,near:.1,far:480}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.shadowMap.type=PCFShadowMap;gl.setClearColor('#c6dbd2');}} fallback={<div className="canvas-fallback">Your browser could not start the 3D scene. Try a desktop browser with hardware acceleration enabled.</div>}>
    <fog attach="fog" args={['#c6dbd2',95,285]}/><ambientLight intensity={.7} color="#dbe5d6"/><hemisphereLight args={['#e3efd6','#657952',1.35]}/><SunRig/><RenderMeter/>
    <ContextRecovery onError={onError}/><SummitVisibility reducedMotion={settings.reducedMotion}/>
    <Suspense fallback={null}><Physics timeStep={1/60} paused={active&&controller.mode!=='playing'&&controller.mode!=='loading'} gravity={[0,-20,0]} colliders={false}>
      <KeralaWorld locale={locale} quality={settings.quality} animated={!settings.reducedMotion&&(!active||controller.mode==='playing')}/>
      {active?<ExplorerController {...controller}/>:<EstablishingCamera/>}<Ready onReady={onReady}/>
    </Physics></Suspense>
  </Canvas>;
}
export function AvatarPreview({profile,reducedMotion}:{profile:ExplorerProfile;reducedMotion:boolean}){
  return <Canvas dpr={[1,1.5]} camera={{position:[2.5,1.8,4.3],fov:28}} onCreated={({camera})=>camera.lookAt(0,.9,0)} gl={{alpha:true}}>
    <ambientLight intensity={1.4}/><directionalLight position={[3,5,4]} intensity={2.2} color="#fff1d3"/><hemisphereLight args={['#ecf0d2','#486851',1]}/>
    <group rotation={[0,.25,0]}><ExplorerAvatar profile={profile} reducedMotion={reducedMotion}/></group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]}><circleGeometry args={[.8,50]}/><meshBasicMaterial color="#cfceaa" transparent opacity={.6}/></mesh>
  </Canvas>;
}

export const WorldCanvas = memo(SceneCanvas);
