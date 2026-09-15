import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Compass, MapTrifold, Mountains, Pause, GearSix, ArrowCounterClockwise, House, Footprints, FlagPennant, CaretDown, X, Tree } from '@phosphor-icons/react';
import { DEFAULT_SETTINGS, type ExplorerControllerProps, type ExplorerProfile, type GameSettings, type InputMode, type PlayerSnapshot, type SaveV1, type Vec3 } from '../contracts';
import { LANDMARKS, SPAWN, SLICE_BOUNDS, WORLD_REGIONS, WORLD_VERSION, terrainHeight, getZoneAt, BRIDGE_X, BRIDGE_DECK_Y, BRIDGE_NORTH_Z, BRIDGE_SOUTH_Z, isWater } from '../content/world/kodassery';
import { ProfileForm } from '../features/profile/ProfileForm';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { ExplorerMap } from '../features/map/ExplorerMap';
import { ModalShell } from '../ui/ModalShell';
import { loadLocalSave, writeLocalSave, clearLocalSave } from '../persistence/localSaveRepository';

const WorldCanvas=lazy(()=>import('./WorldCanvas').then(m=>({default:m.WorldCanvas})));
const AvatarPreview=lazy(()=>import('./WorldCanvas').then(m=>({default:m.AvatarPreview})));
const defaultProfile:ExplorerProfile={id:'preview',displayName:'Traveler',avatarPresetId:'canopy',colors:{skin:'#ba805b',hair:'#292a25',clothing:'#285943'}};
const defaultSnapshot:PlayerSnapshot={position:SPAWN,headingRad:Math.PI,speed:0,grounded:true};

class SceneBoundary extends Component<{children:ReactNode;onRetry:()=>void},{error:boolean}>{
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<div className="scene-error"><Mountains size={40}/><h2>The trail couldn’t load.</h2><p>Your saved explorer is safe. Try loading the scene again.</p><button className="button button-primary" onClick={this.props.onRetry}>Retry scene</button></div>:this.props.children;}
}

function safeSavedPosition(save:SaveV1|null):Vec3{
  if(!save||save.worldVersion!==WORLD_VERSION)return SPAWN;
  const [x,y,z]=save.position;
  const onBridge=Math.abs(x-BRIDGE_X)<1.8&&z>=BRIDGE_NORTH_Z&&z<=BRIDGE_SOUTH_Z&&Math.abs(y-BRIDGE_DECK_Y)<1;
  if(onBridge)return [x,Math.max(y,BRIDGE_DECK_Y+.04),z];
  if(isWater(x,z))return SPAWN;
  if(x<SLICE_BOUNDS.xMin+2||x>SLICE_BOUNDS.xMax-2||z<SLICE_BOUNDS.zMin+2||z>SLICE_BOUNDS.zMax-2||Math.abs(y-terrainHeight(x,z))>5)return SPAWN;
  return [x,Math.max(y,terrainHeight(x,z)+.04),z];
}
export function App(){
  const [initial]=useState(loadLocalSave);
  const inspectMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).has('inspect');
  const [saved,setSaved]=useState(initial.save);
  const [profile,setProfile]=useState<ExplorerProfile>(initial.save?.profile??defaultProfile);
  const [preview,setPreview]=useState<ExplorerProfile>(initial.save?.profile??defaultProfile);
  const [settings,setSettings]=useState<GameSettings>(()=>initial.save?.settings??{...DEFAULT_SETTINGS,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const [mode,setMode]=useState<InputMode>('menu');
  const [active,setActive]=useState(false);const [menu,setMenu]=useState<'none'|'profile'|'settings'|'atlas'|'reset'>('none');
  const [ready,setReady]=useState(false);const [sceneError,setSceneError]=useState<string|null>(null);const [sceneKey,setSceneKey]=useState(0);
  const [spawn,setSpawn]=useState<Vec3>(SPAWN);const [initialHeading,setInitialHeading]=useState(Math.PI);const [resetToken,setResetToken]=useState(0);
  const [snapshot,setSnapshot]=useState<PlayerSnapshot>(defaultSnapshot);
  const snapshotRef=useRef(defaultSnapshot);const safeRef=useRef<PlayerSnapshot>(defaultSnapshot);
  const [visited,setVisited]=useState<string[]>(initial.save?.visitedLandmarkIds.filter(id=>LANDMARKS.some(l=>l.id===id))??[]);
  const visitedRef=useRef(visited);visitedRef.current=visited;
  const [discovery,setDiscovery]=useState<string|null>(null);const [waypoint,setWaypoint]=useState<Vec3|null>(null);
  const [warning,setWarning]=useState<string|null>(initial.warning);const [hints,setHints]=useState(true);

  const onSnapshot=useCallback((value:PlayerSnapshot)=>{snapshotRef.current=value;if(value.grounded)safeRef.current=value;setSnapshot(value);},[]);
  const onPause=useCallback(()=>setMode(m=>m==='playing'?'paused':m),[]);
  const onMap=useCallback(()=>setMode(m=>m==='playing'?'map':m),[]);
  const onWorldReady=useCallback(()=>setReady(true),[]);
  const onPlayerReady=useCallback(()=>setMode(m=>m==='loading'?'playing':m),[]);
  const onSceneError=useCallback((error:string)=>{setSceneError(error);setMode(m=>m==='menu'?'menu':'paused');},[]);
  const persist=useCallback(()=>{
    if(!active||profile.id==='preview')return;
    const last=safeRef.current;
    const save:SaveV1={version:1,worldVersion:WORLD_VERSION,profile,position:last.position,headingRad:last.headingRad,safeSpawnId:'origin',visitedLandmarkIds:visitedRef.current,settings,updatedAt:new Date().toISOString()};
    const result=writeLocalSave(save);if(!result.ok)setWarning(result.warning);else setSaved(save);
  },[active,profile,settings]);
  useEffect(()=>{if(!active)return;persist();const timer=setInterval(persist,5000);const hide=()=>{if(document.hidden)persist();};document.addEventListener('visibilitychange',hide);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);};},[active,persist]);
  useEffect(()=>{if(mode!=='playing')return;for(const landmark of LANDMARKS){if(visitedRef.current.includes(landmark.id))continue;const distance=Math.hypot(snapshot.position[0]-landmark.position[0],snapshot.position[2]-landmark.position[2]);if(distance<landmark.discoveryRadiusM){setVisited(v=>v.includes(landmark.id)?v:[...v,landmark.id]);setDiscovery(landmark.id);break;}}},[snapshot,mode]);
  useEffect(()=>{if(!discovery)return;const t=setTimeout(()=>setDiscovery(null),5500);return()=>clearTimeout(t);},[discovery]);
  useEffect(()=>{if(active&&mode!=='playing')persist();},[mode,active,persist]);

  const start=(next:ExplorerProfile,continuing=false)=>{
    const position=continuing?safeSavedPosition(saved):SPAWN;
    const nextSnapshot={...defaultSnapshot,position,headingRad:continuing?(saved?.headingRad??Math.PI):Math.PI};
    setInitialHeading(nextSnapshot.headingRad);setProfile(next);setPreview(next);setSpawn(position);setSnapshot(nextSnapshot);snapshotRef.current=nextSnapshot;safeRef.current=nextSnapshot;
    if(!continuing)setVisited([]);
    setActive(true);setMenu('none');setMode('loading');setResetToken(n=>n+1);
  };
  const exit=()=>{persist();setActive(false);setMode('menu');setMenu('none');setDiscovery(null);};
  const resume=()=>{setMenu('none');setMode('playing');};
  const resetPosition=()=>{setSpawn([...SPAWN]);setResetToken(n=>n+1);setMode('playing');setMenu('none');};
  const retry=()=>{setSceneError(null);setReady(false);setSceneKey(n=>n+1);if(active)setMode('loading');};
  const controller=useMemo<ExplorerControllerProps>(()=>({mode,profile,spawn,initialHeading,resetToken,sensitivity:settings.sensitivity,reducedMotion:settings.reducedMotion,onSnapshot,onPause,onMap,onReady:onPlayerReady}),[mode,profile,spawn,initialHeading,resetToken,settings.sensitivity,settings.reducedMotion,onSnapshot,onPause,onMap,onPlayerReady]);
  const currentRegion=WORLD_REGIONS.find(r=>r.id===getZoneAt(snapshot.position[2]))??WORLD_REGIONS[0];
  const location=discovery?LANDMARKS.find(l=>l.id===discovery):null;
  const distance=waypoint?Math.round(Math.hypot(snapshot.position[0]-waypoint[0],snapshot.position[2]-waypoint[2])):null;

  return <main className={`experience ${active?'is-exploring':'is-entry'}`} data-mode={mode} data-player-position={snapshot.position.map(n=>n.toFixed(3)).join(",")} data-player-grounded={snapshot.grounded}>
    <div className="world-viewport" aria-label="3D Kerala exploration world">
      <SceneBoundary key={sceneKey} onRetry={retry}><Suspense fallback={null}><WorldCanvas active={active} settings={settings} controller={controller} onReady={onWorldReady} onError={onSceneError}/></Suspense></SceneBoundary>
    </div>
    {!active&&<div className="entry-shell">
      <header className="entry-header"><a className="wordmark" href="#" onClick={e=>e.preventDefault()} aria-label="The Kerala Story home"><Tree size={29} weight="light"/><span>THE KERALA STORY</span></a><button className="entry-nav" onClick={()=>setMenu('atlas')}>Explore the world <ArrowUpRight size={17}/></button><button className="entry-settings" aria-label="Open settings" onClick={()=>setMenu('settings')}><GearSix size={21}/></button></header>
      <section className="entry-copy"><div className="entry-eyebrow"><span/> AN EXPLORER’S TALE</div><h1>Every path<br/>has a <em>story.</em></h1><p>From misty hills to familiar village roads.<br/>Step into Kerala, the way you remember it.</p><div className="entry-actions"><button className="journey-button" disabled={!ready||!!sceneError} onClick={()=>saved?start(saved.profile,true):setMenu('profile')}><span>{!ready?'Opening the trail…':saved?'Continue your journey':'Create your explorer'}</span><ArrowRight size={22}/></button>{saved&&<button className="entry-secondary" onClick={()=>setMenu('profile')}>Change explorer</button>}</div><div className="entry-footnote"><Footprints size={16}/><span>Your own pace. Your own path.</span></div></section>
      <div className="scene-caption"><span className="caption-rule"/><div><small>YOUR JOURNEY BEGINS IN</small><strong>Kodassery Peaks</strong><span>Kerala, circa 2000</span></div></div>
      <footer className="region-strip"><div className="region-strip-title"><Compass size={27} weight="light"/><span>FROM THE HILLS<br/>TO THE SEA</span></div>{WORLD_REGIONS.map(region=><button key={region.id} className={`region-stop ${region.id==='kodassery'?'is-current':''}`} onClick={()=>setMenu('atlas')}><span className="region-number">{region.number}</span><span><strong>{region.name}</strong><small>{region.id==='kodassery'?'Begin here':region.subtitle}</small></span>{region.id==='kodassery'&&<ArrowUpRight size={18}/>}</button>)}</footer>
    </div>}
    {active&&<div className="hud" aria-label="Explorer heads-up display"><div className="hud-identity"><div className="identity-emblem"><Tree size={28} weight="light"/></div><div><span className="hud-name">{profile.displayName}</span><span className="hud-place">{currentRegion.name}</span></div></div><div className="hud-top-center"><span>N</span><span className="compass-tick"/><span>KERALA · CIRCA 2000</span><span className="compass-tick"/><span>S</span></div><div className="hud-map"><button className="minimap-button" aria-label="Open world map" onClick={onMap}><ExplorerMap compact player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint}/><div className="minimap-north">N</div></button><button className="map-open-button" onClick={onMap}><MapTrifold size={17}/> World map <kbd>M</kbd></button></div><div className="hud-actions"><button className="hud-icon" aria-label="Pause and settings" onClick={onPause}><Pause size={20}/></button></div>
      <div className="control-hints"><button onClick={()=>setHints(!hints)} className="hints-toggle"><Footprints size={17}/> Trail controls <CaretDown size={13} style={{transform:hints?'rotate(180deg)':'none'}}/></button>{hints&&<div className="hint-keys"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>DRAG</kbd> Look</span><span><kbd>Q E</kbd> Turn</span></div>}</div>
      <div className="hud-bottom-right"><span>{visited.length} / {LANDMARKS.length} places discovered</span><span className="save-indicator">{warning?"Save needs attention":saved?"Saved on this device":"Saving your explorer…"}</span></div>
      {waypoint&&<div className="waypoint-chip"><FlagPennant size={17}/><span>{distance} m · straight-line distance</span><button aria-label="Clear waypoint" onClick={()=>setWaypoint(null)}><X size={15}/></button></div>}
      {location&&mode==='playing'&&<div className="discovery-toast" role="status"><div><Compass size={24}/><span>PLACE DISCOVERED</span></div><h2>{location.label}</h2><p>{location.description}</p></div>}
    </div>}
    {(mode==='loading'||(!ready&&active))&&!sceneError&&<div className="loading-cover" role="status"><Compass size={38} weight="light"/><h2>Somewhere above the clouds…</h2><p>Preparing your trail.</p></div>}
    {sceneError&&<div className="loading-cover" role="alert"><Mountains size={38}/><h2>The scene needs a moment.</h2><p>{sceneError}</p><button className="button button-primary" onClick={retry}>Reload scene</button></div>}
    {warning&&<div className="storage-notice" role="status"><p>{warning}</p><button aria-label="Dismiss save notice" onClick={()=>setWarning(null)}><X size={16}/></button></div>}
    <ModalShell open={menu==='profile'} title="Meet your explorer" onClose={()=>setMenu('none')} className="profile-modal"><div className="profile-layout"><div className="avatar-stage"><span className="small-label">A NEW CHAPTER</span><div className="avatar-preview"><Suspense fallback={<span>Preparing your traveler…</span>}><AvatarPreview profile={preview} reducedMotion={settings.reducedMotion}/></Suspense></div><div className="avatar-stage-caption"><strong>Made for wandering.</strong><p>An early traveler preview.<br/>From the canopy to the coast.</p></div></div><div className="profile-form-wrap"><p className="profile-intro">A name, a little color, and an open trail.</p><ProfileForm onSubmit={p=>start(p,!!saved)} onPreview={setPreview} initialProfile={saved?.profile}/><p className="local-profile-note">A local explorer profile, saved in this browser.<br/>No account needed.</p></div></div></ModalShell>
    <ModalShell open={mode==='map'||menu==='atlas'} title={active?'Your field atlas':'A journey from the hills to the sea'} onClose={()=>active?setMode('playing'):setMenu('none')} className="map-modal">{active?<ExplorerMap player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint}/>:<div className="world-atlas-overview"><img src="/assets/world-reference-2000s.jpeg" alt="Illustrated concept map showing a winding journey from Kodassery Peaks through Kadambode and Kurumali Puzha to Kodaly harbor"/><div><span className="small-label">THE WORLD OF THE KERALA STORY</span><h3>Four places.<br/>One winding journey.</h3><p>Eleven places along a connected trail: canopy homes, paddy fields, a temple village, the river crossing, and a small-town harbor.</p>{WORLD_REGIONS.map(r=><div className="atlas-region-row" key={r.id}><span>{r.number}</span><div><strong>{r.name}</strong><small>{r.available?'Connected exploration prototype':'Coming in a later chapter'}</small></div></div>)}<p className="atlas-disclaimer">Illustrated world concept. The in-game field map follows actual trail coordinates.</p></div></div>}</ModalShell>
    <ModalShell open={mode==='paused'&&menu!=='settings'&&menu!=='reset'} title="Take a moment" onClose={resume} className="pause-modal"><div className="pause-intro"><Tree size={34} weight="light"/><p>The hills will be here.</p></div><div className="pause-options"><button className="button button-primary" onClick={resume}><ArrowRight size={19}/> Back to the trail</button><button className="button button-secondary" onClick={()=>setMode('map')}><MapTrifold size={19}/> Open field atlas</button><button className="button button-secondary" onClick={()=>setMenu('settings')}><GearSix size={19}/> Settings</button><button className="button button-secondary" onClick={exit}><House size={19}/> Save & return to title</button></div></ModalShell>
    <ModalShell open={menu==='settings'} title="Make yourself at home" onClose={()=>setMenu('none')}><SettingsPanel settings={settings} onChange={setSettings} onResetPosition={active?resetPosition:undefined}/>{saved&&<button className="text-button reset-profile" onClick={()=>setMenu('reset')}><ArrowCounterClockwise size={16}/> Reset local explorer</button>}</ModalShell>
    <ModalShell open={menu==='reset'} title="Start a new chapter?" onClose={()=>setMenu('settings')}><p>This removes your name, appearance, saved position, and discoveries from this browser.</p><div className="reset-actions"><button className="button button-secondary" onClick={()=>setMenu('settings')}>Keep my explorer</button><button className="button button-primary" onClick={()=>{const r=clearLocalSave();if(!r.ok){setWarning(r.warning);return;}setSaved(null);setVisited([]);setActive(false);setProfile(defaultProfile);setPreview(defaultProfile);setMode('menu');setMenu('none');}}>Reset explorer</button></div></ModalShell>
    {inspectMode&&active&&<aside className="inspection-panel"><strong>Development inspection</strong><select aria-label="Inspect landmark" defaultValue="" onChange={e=>{const l=LANDMARKS.find(p=>p.id===e.target.value);if(l){const front=['tea-shop','market','lighthouse'].includes(l.id);const x=l.position[0],z=l.position[2]+(front?9:0);setSpawn([x,front?terrainHeight(x,z)+.1:l.position[1]+.1,z]);setInitialHeading(l.id==='temple'?Math.PI/2:front?0:Math.PI);setResetToken(n=>n+1);setMode('playing');}}}><option value="" disabled>Choose a landmark</option>{LANDMARKS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select><output>{snapshot.position.map(n=>n.toFixed(1)).join(', ')} · {snapshot.grounded?'grounded':'airborne'}</output><output data-render-metrics="true">Measuring renderer…</output><small>Dev only: navigation and terrain review</small></aside>}
    <div className="touch-notice">Best explored with a keyboard and mouse. Touch gameplay is coming later.</div>
  </main>;
}
