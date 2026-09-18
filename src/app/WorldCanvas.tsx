import { Suspense, memo, useEffect, useRef, useMemo, useState, type RefObject } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PCFShadowMap, Object3D, DirectionalLight, DefaultLoadingManager } from 'three';
import type { ExplorerControllerProps, ExplorerProfile, GameSettings, Locale, PlayerSnapshot } from '../contracts';
import { Collectables } from '../game/collectables/Collectables';
import type { CollectItem } from '../game/collectables/types';
import { KeralaWorld } from '../game/world/KeralaWorld';
import { ExplorerController } from '../game/player/ExplorerController';
import { PHYSICS_STEP_SECONDS } from '../game/player/controllerMath';
import { SummitVisibility } from '../game/camera/SummitVisibility';
import { ExplorerAvatar } from '../game/player/ExplorerAvatar';
import { SoccerMatch, type KickControl, type SoccerEvent } from '../game/soccer/SoccerMatch';
import { createDprGovernor, frameloopFor, renderProfile, type RenderProfile } from '../game/render/renderBudget';
import { MultiplayerRoomScene, type MultiplayerSceneProps } from '../features/multiplayer/MultiplayerRoomScene';
import { reportLoadProgress } from '../game/render/loadProgress';

// Set at module load, before any scene renders, so the first GLB request is counted.
DefaultLoadingManager.onProgress = (_url, loaded, total) => reportLoadProgress(loaded, total);

export interface SoccerSceneProps { active: boolean; kick: KickControl; onEvent: (event: SoccerEvent) => void; chargeBar: { current: HTMLElement | null } }

function EstablishingCamera(){const {camera}=useThree();useEffect(()=>{camera.position.set(-31,99,-457);camera.lookAt(16,79,-411);},[camera]);return null;}
function Ready({onReady}:{onReady:()=>void}){const once=useRef(false);useEffect(()=>{if(!once.current){once.current=true;onReady();}},[onReady]);return null;}
function ContextRecovery({onError}:{onError:(error:string)=>void}){const {gl}=useThree();useEffect(()=>{const canvas=gl.domElement;const handle=(e:Event)=>{e.preventDefault();onError('The graphics connection was interrupted. Reload the scene to continue.');};canvas.addEventListener('webglcontextlost',handle);return()=>canvas.removeEventListener('webglcontextlost',handle);},[gl,onError]);return null;}
function SunRig({profile}:{profile:RenderProfile}){
  const light=useRef<DirectionalLight>(null);const target=useMemo(()=>new Object3D(),[]);const frame=useRef(0);
  const gl=useThree(state=>state.gl);
  // Medium quality redraws the shadow map every other frame; the scene is lit identically.
  useEffect(()=>{gl.shadowMap.autoUpdate=profile.shadowInterval<=1;gl.shadowMap.needsUpdate=true;return()=>{gl.shadowMap.autoUpdate=true;};},[gl,profile.shadowInterval]);
  useFrame(({camera})=>{
    if(!light.current)return;target.position.set(camera.position.x,camera.position.y-5,camera.position.z);light.current.position.set(camera.position.x-55,camera.position.y+85,camera.position.z-35);target.updateMatrixWorld();
    if(profile.shadowInterval>1&&++frame.current%profile.shadowInterval===0)gl.shadowMap.needsUpdate=true;
  });
  const size=profile.shadowMapSize||1024;
  return <><primitive object={target}/><directionalLight key={size} ref={light} target={target} intensity={2.2} color="#fff0cd" castShadow={profile.shadows} shadow-mapSize={[size,size]} shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-near={1} shadow-camera-far={230} shadow-bias={-.0002}/></>;
}
/** Lowers render resolution when frames run slow and raises it again when there is headroom. */
function AdaptiveResolution({profile}:{profile:RenderProfile}){
  const setDpr=useThree(state=>state.setDpr);
  const governor=useMemo(()=>createDprGovernor(profile.dprMin,profile.dprMax),[profile.dprMin,profile.dprMax]);
  useEffect(()=>{setDpr(governor.dpr);},[governor,setDpr]);
  useFrame((_,delta)=>{const next=governor.sample(delta*1000);if(next!==null)setDpr(next);});
  return null;
}
function usePageHidden(){
  const [hidden,setHidden]=useState(()=>typeof document!=='undefined'&&document.hidden);
  useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  return hidden;
}
function RenderMeter(){
  const times=useRef<number[]>([]);const elapsed=useRef(0);
  useFrame(({gl},delta)=>{if(!import.meta.env.DEV)return;times.current.push(delta*1000);if(times.current.length>180)times.current.shift();elapsed.current+=delta;if(elapsed.current<2)return;elapsed.current=0;const sorted=[...times.current].sort((a,b)=>a-b);const node=document.querySelector<HTMLElement>('[data-render-metrics]');if(node){node.dataset.median=String(sorted[Math.floor(sorted.length*.5)]?.toFixed(1));node.dataset.p95=String(sorted[Math.floor(sorted.length*.95)]?.toFixed(1));node.textContent=`Frame ${node.dataset.median}ms / p95 ${node.dataset.p95}ms · dpr ${gl.getPixelRatio().toFixed(2)} · ${gl.info.render.calls} calls · ${gl.info.render.triangles.toLocaleString()} tris`;}});
  return null;
}
function SceneCanvas({active,settings,controller,onReady,onError,locale='en',playerRef,collectedIds,onCollect,soccer,multiplayer}:{soccer?:SoccerSceneProps;multiplayer?:MultiplayerSceneProps;locale?:Locale;active:boolean;settings:GameSettings;controller:ExplorerControllerProps;onReady:()=>void;onError:(error:string)=>void;playerRef:RefObject<PlayerSnapshot>;collectedIds:readonly string[];onCollect:(item:CollectItem)=>void}){
  const mobile=useMemo(()=>matchMedia('(pointer: coarse)').matches,[]);
  const profile=useMemo(()=>renderProfile(settings.quality,mobile,window.devicePixelRatio||1),[settings.quality,mobile]);
  // Antialiasing is fixed when the WebGL context is created; later quality changes apply it on the next load.
  const [antialias]=useState(profile.antialias);
  const hidden=usePageHidden();
  return <Canvas frameloop={frameloopFor(hidden,active,controller.mode)} shadows={profile.shadows?{type:PCFShadowMap}:false} dpr={profile.dprMax} camera={{position:[-31,99,-457],fov:52,near:.1,far:480}} gl={{antialias,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.shadowMap.type=PCFShadowMap;gl.setClearColor('#c6dbd2');}} fallback={<div className="canvas-fallback">Your browser could not start the 3D scene. Try a desktop browser with hardware acceleration enabled.</div>}>
    <fog attach="fog" args={['#c6dbd2',95,285]}/><ambientLight intensity={.7} color="#dbe5d6"/><hemisphereLight args={['#e3efd6','#657952',1.35]}/><SunRig profile={profile}/><AdaptiveResolution profile={profile}/><RenderMeter/>
    <ContextRecovery onError={onError}/><SummitVisibility reducedMotion={settings.reducedMotion}/>
    <Suspense fallback={null}><Physics timeStep={PHYSICS_STEP_SECONDS}paused={active&&controller.mode!=='playing'&&controller.mode!=='loading'} gravity={[0,-20,0]} colliders={false}>
      <KeralaWorld locale={locale} quality={settings.quality} animated={!settings.reducedMotion&&(!active||controller.mode==='playing')}/>
      {active
        ? multiplayer
          ? <MultiplayerRoomScene {...multiplayer} controller={controller}/>
          : <ExplorerController {...controller}/>
        : <EstablishingCamera/>}<Ready onReady={onReady}/>
      {active&&!multiplayer&&soccer?.active&&<SoccerMatch active playing={controller.mode==='playing'} kick={soccer.kick} onEvent={soccer.onEvent} chargeBar={soccer.chargeBar}/>}
      {active&&!multiplayer&&<Suspense fallback={null}><Collectables playerRef={playerRef} settings={settings} collectedIds={collectedIds} onCollect={onCollect}/></Suspense>}
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
