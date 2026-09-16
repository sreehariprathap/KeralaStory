import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Compass, MapTrifold, Mountains, Pause, GearSix, ArrowCounterClockwise, House, Footprints, FlagPennant, CaretDown, X, Tree, Car } from '@phosphor-icons/react';
import { CAR_MODELS, type CarModelId } from '../content/assets/models';
import { DEFAULT_SETTINGS, type ExplorerControllerProps, type ExplorerProfile, type GameSettings, type InputMode, type PlayerSnapshot, type SaveV2, type Vec3, type Preferences, type InputCommands, type BicycleSave } from '../contracts';
import { LANDMARKS, SPAWN, WORLD_REGIONS, WORLD_VERSION, getZoneAtPosition, getAreaAt, safeGroundPosition } from '../content/world/kodassery';
import { INSPECTION_DESTINATIONS } from '../dev/inspectionDestinations';
import { ProfileForm } from '../features/profile/ProfileForm';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { ExplorerMap } from '../features/map/ExplorerMap';
import { ModalShell } from '../ui/ModalShell';
import { loadLocalSave, writeLocalSave, clearLocalSave } from '../persistence/localSaveRepository';

import { LocaleProvider, translate, localizedPlace, localizedRegion, type TranslationKey, ENGLISH_CATALOG } from '../features/i18n/translate';
import { LanguageToggle } from '../features/i18n/LanguageToggle';
import { MobileControls } from '../features/controls/MobileControls';
import { loadPreferences, writePreferences } from '../persistence/preferencesRepository';
import { AudioDirector } from '../game/audio/AudioDirector';
import { LoadingView } from '../ui/LoadingView';
import { LoadError } from '../ui/LoadError';
import { needsSafeReset, FEET_TO_CENTER } from '../game/player/controllerMath';
import { bearingToWaypoint } from '../features/map/mapGeometry';

const WorldCanvas=lazy(()=>import('./WorldCanvas').then(m=>({default:m.WorldCanvas})));
const AvatarPreview=lazy(()=>import('./WorldCanvas').then(m=>({default:m.AvatarPreview})));
const defaultProfile:ExplorerProfile={id:'preview',displayName:'Traveler',avatarPresetId:'canopy',colors:{skin:'#ba805b',hair:'#292a25',clothing:'#285943'}};
const defaultSnapshot:PlayerSnapshot={position:SPAWN,headingRad:Math.PI,speed:0,grounded:true};

class SceneBoundary extends Component<{children:ReactNode;onRetry:()=>void;onError:(message:string)=>void;onExit:()=>void},{error:boolean}>{
  componentDidCatch(){this.props.onError('The trail could not load. Your saved explorer has been preserved.');}
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<div className="scene-error"><Mountains size={40}/><h2>The trail couldn’t load.</h2><p>Your saved explorer is safe. Try loading the scene again.</p><button className="button button-primary" onClick={this.props.onRetry}>Retry scene</button><button className="button button-secondary" onClick={this.props.onExit}>Return to title</button></div>:this.props.children;}
}

function safeSavedPosition(save:SaveV2|null):Vec3{
  return save?safeGroundPosition(save.position):SPAWN;
}
export function App(){
  const [initial]=useState(loadLocalSave);
  const [initialPreferences]=useState(loadPreferences);
  const [preferences,setPreferences]=useState<Preferences>(()=>({...initialPreferences.preferences,locale:initialPreferences.exists?initialPreferences.preferences.locale:initial.save?.locale??'en'}));
  const locale=preferences.locale;
  const t=(key:TranslationKey)=>translate(key,locale);
  const [coarse,setCoarse]=useState(()=>matchMedia('(pointer: coarse)').matches);
  useEffect(()=>{const query=matchMedia('(pointer: coarse)');const update=()=>setCoarse(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  const touch=preferences.controls==='touch'||preferences.controls==='auto'&&coarse;
  const [commands,setCommands]=useState<InputCommands|null>(null);
  const receiveCommands=useCallback((value:InputCommands|null)=>setCommands(()=>value),[]);
  const [bicycleSpawn,setBicycleSpawn]=useState<BicycleSave|null>(null);
  const [returnBicycleToken,setReturnBicycleToken]=useState(0);
  const [carSpawnToken,setCarSpawnToken]=useState(0);
  const [carModelId,setCarModelId]=useState<CarModelId>('admin');
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const inspectMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).has('inspect');
  const [saved,setSaved]=useState(initial.save);
  const [profile,setProfile]=useState<ExplorerProfile>(initial.save?.profile??defaultProfile);
  const [preview,setPreview]=useState<ExplorerProfile>(initial.save?.profile??defaultProfile);
  const [settings,setSettings]=useState<GameSettings>(()=>initial.save?.settings??{...DEFAULT_SETTINGS,quality:coarse?'low':'medium',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const [mode,setMode]=useState<InputMode>('menu');
  const [active,setActive]=useState(false);const [menu,setMenu]=useState<'none'|'profile'|'settings'|'atlas'|'reset'|'car'>('none');
  const [ready,setReady]=useState(false);const [sceneError,setSceneError]=useState<string|null>(null);const [sceneKey,setSceneKey]=useState(0);
  const [spawn,setSpawn]=useState<Vec3>(SPAWN);const [initialHeading,setInitialHeading]=useState(Math.PI);const [resetToken,setResetToken]=useState(0);
  const [snapshot,setSnapshot]=useState<PlayerSnapshot>(defaultSnapshot);
  const snapshotRef=useRef(defaultSnapshot);const safeRef=useRef<PlayerSnapshot>(defaultSnapshot);
  const [visited,setVisited]=useState<string[]>(initial.save?.visitedLandmarkIds.filter(id=>LANDMARKS.some(l=>l.id===id))??[]);
  const visitedRef=useRef(visited);visitedRef.current=visited;
  const [discovery,setDiscovery]=useState<string|null>(null);const [waypoint,setWaypoint]=useState<Vec3|null>(null);
  const [warning,setWarning]=useState<string|null>(initial.warning??initialPreferences.warning);const [hints,setHints]=useState(true);

  const updatePreferences=(next:Preferences)=>{commands?.clear();setPreferences(next);const result=writePreferences(next);if(!result.ok)setWarning(result.warning);};
  const onSnapshot=useCallback((value:PlayerSnapshot)=>{snapshotRef.current=value;if(value.grounded&&!needsSafeReset({x:value.position[0],y:value.position[1]+FEET_TO_CENTER,z:value.position[2]}))safeRef.current=value;setSnapshot(value);},[]);
  const onPause=useCallback(()=>setMode(m=>m==='playing'?'paused':m),[]);
  const onMap=useCallback(()=>setMode(m=>m==='playing'?'map':m),[]);
  const onWorldReady=useCallback(()=>setReady(true),[]);
  const onPlayerReady=useCallback(()=>setMode(m=>m==='loading'?'playing':m),[]);
  const onSceneError=useCallback((error:string)=>{setSceneError(error);setMenu('none');setMode(m=>m==='menu'?'menu':'paused');},[]);
  const persist=useCallback(()=>{
    if(!active||profile.id==='preview')return;
    const last=safeRef.current;
    const save:SaveV2={version:2,locale,bicycle:snapshotRef.current.bicycle??bicycleSpawn,worldVersion:WORLD_VERSION,profile,position:last.position,headingRad:last.headingRad,safeSpawnId:'origin',visitedLandmarkIds:visitedRef.current,settings,updatedAt:new Date().toISOString()};
    const result=writeLocalSave(save);if(!result.ok)setWarning(result.warning);else setSaved(save);
  },[active,profile,settings,locale,bicycleSpawn]);
  useEffect(()=>{if(!active)return;persist();const timer=setInterval(persist,5000);const hide=()=>{if(document.hidden)persist();};document.addEventListener('visibilitychange',hide);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);};},[active,persist]);
  useEffect(()=>{if(mode!=='playing')return;for(const landmark of LANDMARKS){if(visitedRef.current.includes(landmark.id))continue;const distance=Math.hypot(snapshot.position[0]-landmark.position[0],snapshot.position[2]-landmark.position[2]);if(distance<landmark.discoveryRadiusM){setVisited(v=>v.includes(landmark.id)?v:[...v,landmark.id]);setDiscovery(landmark.id);break;}}},[snapshot,mode]);
  useEffect(()=>{if(!discovery)return;const t=setTimeout(()=>setDiscovery(null),5500);return()=>clearTimeout(t);},[discovery]);
  useEffect(()=>{if(active&&mode!=='playing')persist();},[mode,active,persist]);

  const start=(next:ExplorerProfile,continuing=false)=>{
    const position=continuing?safeSavedPosition(saved):SPAWN;
    const nextSnapshot={...defaultSnapshot,position,headingRad:continuing?(saved?.headingRad??Math.PI):Math.PI};
    setBicycleSpawn(continuing&&saved?.worldVersion===WORLD_VERSION?saved?.bicycle??null:null);
    setInitialHeading(nextSnapshot.headingRad);setProfile(next);setPreview(next);setSpawn(position);setSnapshot(nextSnapshot);snapshotRef.current=nextSnapshot;safeRef.current=nextSnapshot;
    if(!continuing)setVisited([]);
    setActive(true);setMenu('none');setMode('loading');setResetToken(n=>n+1);
  };
  const exit=()=>{persist();setActive(false);setMode('menu');setMenu('none');setDiscovery(null);};
  const resume=()=>{setMenu('none');setMode('playing');};
  const resetPosition=()=>{setSpawn([...SPAWN]);setResetToken(n=>n+1);setMode('playing');setMenu('none');};
  const inspectDestination=(id:string)=>{
    const destination=INSPECTION_DESTINATIONS.find(place=>place.id===id);
    if(!destination?.available)return;
    setSpawn([...destination.position]);setInitialHeading(destination.headingRad);
    setResetToken(n=>n+1);setDiscovery(null);setMenu('none');setMode('playing');
  };
  const retry=()=>{setSceneError(null);setReady(false);setSceneKey(n=>n+1);if(active)setMode('loading');};
  const openCarControls=()=>{setMode('paused');setMenu('car');};
  const closeCarControls=()=>{setMenu('none');if(active)setMode('playing');};
  const spawnCar=()=>{setCarSpawnToken(token=>token+1);closeCarControls();};
  const controller=useMemo<ExplorerControllerProps>(()=>({mode,profile,spawn,initialHeading,resetToken,inputCommands:receiveCommands,bicycleSpawn,returnBicycleToken,carSpawnToken,carModelId,sensitivity:settings.sensitivity,reducedMotion:settings.reducedMotion,onSnapshot,onPause,onMap,onReady:onPlayerReady,onError:onSceneError}),[mode,profile,spawn,initialHeading,resetToken,receiveCommands,bicycleSpawn,returnBicycleToken,carSpawnToken,carModelId,settings.sensitivity,settings.reducedMotion,onSnapshot,onPause,onMap,onPlayerReady,onSceneError]);
  const currentRegion=WORLD_REGIONS.find(r=>r.id===getZoneAtPosition(snapshot.position[0],snapshot.position[2]))??WORLD_REGIONS[0];
  const location=discovery?LANDMARKS.find(l=>l.id===discovery):null;
  const distance=waypoint?Math.round(Math.hypot(snapshot.position[0]-waypoint[0],snapshot.position[2]-waypoint[2])):null;

  return <LocaleProvider locale={locale}><main className={`experience ${active?'is-exploring':'is-entry'} ${touch?'uses-touch':''}`} data-mode={mode} data-travel-mode={snapshot.travelMode??'foot'} data-player-position={snapshot.position.map(n=>n.toFixed(3)).join(",")} data-player-grounded={snapshot.grounded}>
    <AudioDirector settings={settings} mode={mode} player={snapshot}/><div className="world-viewport" aria-label="3D Kerala exploration world">
      <SceneBoundary key={sceneKey} onRetry={retry} onError={onSceneError} onExit={exit}><Suspense fallback={null}><WorldCanvas locale={locale} active={active} settings={settings} controller={controller} onReady={onWorldReady} onError={onSceneError}/></Suspense></SceneBoundary>
    </div>
    {!active&&<div className="entry-shell">
      <header className="entry-header"><LanguageToggle value={locale} onChange={value=>updatePreferences({...preferences,locale:value})}/><a className="wordmark" href="#" onClick={e=>e.preventDefault()} aria-label="The Kerala Story home"><Tree size={29} weight="light"/><span>THE KERALA STORY</span></a><button className="entry-nav" onClick={()=>setMenu('atlas')}>Explore the world <ArrowUpRight size={17}/></button><button className="entry-settings" aria-label="Open settings" onClick={()=>setMenu('settings')}><GearSix size={21}/></button></header>
      <section className="entry-copy"><div className="entry-eyebrow"><span/> AN EXPLORER’S TALE</div><h1>Every path<br/>has a <em>story.</em></h1><p>From misty hills to familiar village roads.<br/>Step into Kerala, the way you remember it.</p><div className="entry-actions"><button className="journey-button" disabled={!ready||!!sceneError} onClick={()=>saved?start(saved.profile,true):setMenu('profile')}><span>{!ready?t('app.beginOpening'):saved?t('app.continueJourney'):t('app.createExplorer')}</span><ArrowRight size={22}/></button>{saved&&<button className="entry-secondary" onClick={()=>setMenu('profile')}>{t('app.changeExplorer')}</button>}</div><div className="entry-footnote"><Footprints size={16}/><span>Your own pace. Your own path.</span></div></section>
      <div className="scene-caption"><span className="caption-rule"/><div><small>{t('app.journeyBegins')}</small><strong>{localizedRegion('kodassery',locale)}</strong><span>{t('app.circa2000')}</span></div></div>
      <footer className="region-strip"><div className="region-strip-title"><Compass size={27} weight="light"/><span>FROM THE HILLS<br/>TO THE SEA</span></div>{WORLD_REGIONS.map(region=><button key={region.id} className={`region-stop ${region.id==='kodassery'?'is-current':''}`} onClick={()=>setMenu('atlas')}><span className="region-number">{region.number}</span><span><strong>{localizedRegion(region.id,locale)}</strong><small>{region.id==='kodassery'?t('app.beginHere'):t(('region.'+region.id+'Subtitle') as TranslationKey)}</small></span>{region.id==='kodassery'&&<ArrowUpRight size={18}/>}</button>)}</footer>
    </div>}
    {active&&<div className="hud" aria-label="Explorer heads-up display"><div className="hud-identity"><div className="identity-emblem"><Tree size={28} weight="light"/></div><div><span className="hud-name">{profile.displayName}</span><span className="hud-place">{getAreaAt(snapshot.position[0],snapshot.position[2])?t(`area.${getAreaAt(snapshot.position[0],snapshot.position[2])}` as TranslationKey):localizedRegion(currentRegion.id,locale)}</span></div></div><div className="hud-top-center"><span>N</span><span className="compass-tick"/><span>KERALA · CIRCA 2000</span><span className="compass-tick"/><span>S</span></div><div className="hud-map"><button className="minimap-button" aria-label="Open world map" onClick={onMap}><ExplorerMap compact player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint}/><div className="minimap-north">N</div></button><button className="map-open-button" onClick={onMap}><MapTrifold size={17}/> World map <kbd>M</kbd></button></div><div className="hud-actions"><button className="hud-icon" aria-label="Pause and settings" onClick={onPause}><Pause size={20}/></button><button className="hud-icon" aria-label="Open car controls" title="Car controls" onClick={openCarControls}><Car size={20}/></button></div>
      {!touch&&<div className="control-hints"><button onClick={()=>setHints(!hints)} className="hints-toggle"><Footprints size={17}/> Trail controls <CaretDown size={13} style={{transform:hints?'rotate(180deg)':'none'}}/></button>{hints&&<div className="hint-keys"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>DRAG</kbd> Look</span><span><kbd>Q E</kbd> Turn</span><span><kbd>F</kbd> {t('car.interact')}</span><span><kbd>R</kbd> Sprint lock</span></div>}</div>}
      <div className="hud-bottom-right"><span>{visited.length} / {LANDMARKS.length} {t('app.placesDiscovered')}</span><span className="save-indicator">{warning?t('app.saveAttention'):saved?t('app.savedDevice'):t('app.saving')}</span></div>
      {waypoint&&<div className="waypoint-chip"><FlagPennant size={17}/><span>{distance} m · {t('map.bearing')} · {Math.round(bearingToWaypoint(snapshot.position,waypoint))}° N</span><button aria-label="Clear waypoint" onClick={()=>setWaypoint(null)}><X size={15}/></button></div>}
      {commands&&touch&&<MobileControls enabled={mode==='playing'} commands={commands} sprintLocked={snapshot.sprintLocked??false} travelMode={snapshot.travelMode??'foot'} canInteract={snapshot.canInteract??false}/>}
      {mode==='playing'&&(snapshot.canInteract||snapshot.interactionMessage)&&<div className="bicycle-prompt" role="status">{snapshot.interactionMessage?(snapshot.interactionMessage in ENGLISH_CATALOG?t(snapshot.interactionMessage as TranslationKey):snapshot.interactionMessage):<><kbd>{touch?'●':'F'}</kbd> {t(snapshot.travelMode==='car'?'controls.exitCar':snapshot.travelMode==='bicycle'?'controls.dismount':'controls.mount')}{snapshot.travelMode!=='foot'&&<small>S / ↓ · {t('controls.brake')}</small>}</>}</div>}
      {snapshot.travelMode==='car'&&<div className={`nitro-status ${snapshot.nitroActive?'is-active':''}`} role="status"><Car size={15}/><span>SHIFT · NITRO {snapshot.nitroActive?'ACTIVE':'READY'}</span></div>}
      {location&&mode==='playing'&&<div className="discovery-toast" role="status"><div><Compass size={24}/><span>{t('app.placeDiscovered')}</span></div><h2>{localizedPlace(location.id,locale)}</h2><p>{t(({origin:'landmark.originDescription',canopy:'landmark.canopyDescription',waterfall:'landmark.waterfallDescription',paddy:'landmark.paddyDescription',temple:'landmark.templeDescription','tea-shop':'landmark.teaShopDescription','river-bridge':'landmark.riverBridgeDescription','fishing-bank':'landmark.fishingBankDescription',market:'landmark.marketDescription',lighthouse:'landmark.lighthouseDescription',harbor:'landmark.harborDescription','spice-garden':'landmark.spiceGardenDescription'} as Record<string,TranslationKey>)[location.id]??`landmark.${location.id}Description` as TranslationKey)}</p></div>}
    </div>}
    {(mode==='loading'||(!ready&&active))&&!sceneError&&<LoadingView/>}
    {sceneError&&<LoadError message={sceneError} onRetry={retry} onExit={()=>{exit();setSceneError(null);setReady(false);setSceneKey(n=>n+1);}}/>}
    {warning&&<div className="storage-notice" role="status"><p>{warning}</p><button aria-label="Dismiss save notice" onClick={()=>setWarning(null)}><X size={16}/></button></div>}
    <ModalShell open={menu==='profile'} title={t('profile.meetExplorer')} onClose={()=>setMenu('none')} className="profile-modal"><div className="profile-layout"><div className="avatar-stage"><span className="small-label">A NEW CHAPTER</span><div className="avatar-preview"><Suspense fallback={<span>Preparing your traveler…</span>}><AvatarPreview profile={preview} reducedMotion={settings.reducedMotion}/></Suspense></div><div className="avatar-stage-caption"><strong>Made for wandering.</strong><p>An early traveler preview.<br/>From the canopy to the coast.</p></div></div><div className="profile-form-wrap"><p className="profile-intro">A name, a little color, and an open trail.</p><ProfileForm onSubmit={p=>start(p,!!saved)} onPreview={setPreview} initialProfile={saved?.profile}/><p className="local-profile-note">A local explorer profile, saved in this browser.<br/>No account needed.</p></div></div></ModalShell>
    <ModalShell open={mode==='map'||menu==='atlas'} title={active?t('app.yourFieldAtlas'):t('app.atlasTitle')} onClose={()=>active?setMode('playing'):setMenu('none')} className="map-modal">{active?<ExplorerMap player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint}/>:<div className="world-atlas-overview"><img src="/assets/v2-famtasymap.jpeg" alt="Illustrated concept map showing the connected regions of Kodassery Diaries"/><div><span className="small-label">THE WORLD OF THE KERALA STORY</span><h3>Four places.<br/>One winding journey.</h3><p>{t('app.atlasDescription')}</p>{WORLD_REGIONS.map(r=><div className="atlas-region-row" key={r.id}><span>{r.number}</span><div><strong>{localizedRegion(r.id,locale)}</strong><small>{r.available?t('app.connectedPrototype'):t('app.comingLater')}</small></div></div>)}<p className="atlas-disclaimer">Illustrated world concept. The in-game field map follows actual trail coordinates.</p></div></div>}</ModalShell>
    <ModalShell open={!sceneError&&mode==='paused'&&menu!=='settings'&&menu!=='reset'} title={t('app.takeAMoment')} onClose={resume} className="pause-modal"><div className="pause-intro"><Tree size={34} weight="light"/><p>{t('app.hillsWillBeHere')}</p></div><div className="pause-options"><button className="button button-primary" onClick={resume}><ArrowRight size={19}/> Back to the trail</button><button className="button button-secondary" onClick={()=>setMode('map')}><MapTrifold size={19}/> Open field atlas</button><button className="button button-secondary" onClick={()=>setMenu('settings')}><GearSix size={19}/> Settings</button><button className="button button-secondary" onClick={exit}><House size={19}/> Save & return to title</button></div></ModalShell>
    <ModalShell open={menu==='settings'} title={t('app.makeAtHome')} onClose={()=>setMenu('none')}><SettingsPanel settings={settings} onChange={setSettings} controls={preferences.controls} onControlsChange={value=>updatePreferences({...preferences,controls:value})} locale={locale} onLocaleChange={value=>updatePreferences({...preferences,locale:value})} onResetPosition={active?resetPosition:undefined}/>{active&&snapshot.travelMode!=='bicycle'&&<button className="button button-secondary" onClick={()=>{setReturnBicycleToken(v=>v+1);resume();}}>{t('controls.returnBicycle')}</button>}{saved&&<button className="text-button reset-profile" onClick={()=>setMenu('reset')}><ArrowCounterClockwise size={16}/> Reset local explorer</button>}</ModalShell>
    <ModalShell open={menu==='car'} title={t('car.spawnerTitle')} onClose={closeCarControls} className="car-modal"><p className="car-modal__intro">Choose a car and drop it nearby. Hold <kbd>SHIFT</kbd> while driving to ignite nitrous for a short boost.</p><label htmlFor="car-model-modal">Car model</label><select id="car-model-modal" value={carModelId} onChange={event=>setCarModelId(event.target.value as CarModelId)}>{CAR_MODELS.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</select><div className="car-modal__actions"><button type="button" className="button button-secondary" onClick={closeCarControls}>Close</button><button type="button" className="button button-primary" onClick={spawnCar}><Car size={18}/> {t('car.spawn')}</button></div><small>{t('car.notSaved')}</small></ModalShell>
    <ModalShell open={menu==='reset'} title={t('app.startNewChapter')} onClose={()=>setMenu('settings')}><p>This removes your name, appearance, saved position, and discoveries from this browser.</p><div className="reset-actions"><button className="button button-secondary" onClick={()=>setMenu('settings')}>{t('app.keepExplorer')}</button><button className="button button-primary" onClick={()=>{const r=clearLocalSave();if(!r.ok){setWarning(r.warning);return;}setSaved(null);setVisited([]);setActive(false);setProfile(defaultProfile);setPreview(defaultProfile);setMode('menu');setMenu('none');}}>{t('app.resetExplorer')}</button></div></ModalShell>
    {inspectMode&&active&&<aside className="inspection-panel"><strong>Development inspection</strong><button onClick={()=>onSceneError('Simulated graphics interruption for recovery testing.')}>Test scene recovery</button>
      <select aria-label="Inspect landmark" defaultValue="" onChange={e=>{inspectDestination(e.currentTarget.value);e.currentTarget.value='';}}>
        <option value="" disabled>Fast travel to an area</option>
        {(['Existing landmarks','Mountain and forest expansion','V2 planned sites'] as const).map(group=><optgroup key={group} label={group}>{INSPECTION_DESTINATIONS.filter(place=>place.group===group).map(place=><option key={place.id} value={place.id} disabled={!place.available}>{place.landmarkId?localizedPlace(place.landmarkId,locale):place.label}</option>)}</optgroup>)}
      </select>
      <output>{snapshot.position.map(n=>n.toFixed(1)).join(', ')} · {snapshot.grounded?'grounded':'airborne'}</output><output data-render-metrics="true">Measuring renderer…</output><small>Planned sites show current terrain only. Unbuilt terrain is unavailable.</small></aside>}

  </main></LocaleProvider>;
}
