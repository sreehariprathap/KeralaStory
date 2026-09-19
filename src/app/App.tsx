import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Compass, MapTrifold, Pause, ArrowCounterClockwise, Footprints, FlagPennant, CaretDown, X, Tree, Car, Motorcycle, Wind, SoccerBall, Parachute } from '@phosphor-icons/react';
import { CAR_MODELS, CAR_PICKER_CATALOG, type CarModelId } from '../content/assets/models';
import { BIKE_MODELS, BIKE_PICKER_CATALOG, type BikeModelId } from '../content/assets/bikeProfiles';
import { CarPicker } from '../features/vehicles/CarPicker';
import { CAR_PAINT_COLORS, VEHICLE_PROFILES } from '../content/assets/vehicleProfiles';
import { DEFAULT_SETTINGS, type ExplorerControllerProps, type ExplorerProfile, type GameSettings, type InputMode, type PlayerSnapshot, type SaveV3, type Vec3, type Preferences, type InputCommands, type BicycleSave } from '../contracts';
import { LANDMARKS, SPAWN, WORLD_REGIONS, WORLD_VERSION, getZoneAtPosition, getAreaAt, safeGroundPosition } from '../content/world/kodassery';
import { INSPECTION_DESTINATIONS } from '../dev/inspectionDestinations';
import { FullscreenButton, OfflineSettings, UpdateToast } from '../features/app-shell/PwaControls';
import { useWakeLock, vibrate } from '../pwa/device';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { ExplorerMap } from '../features/map/ExplorerMap';
import { ModalShell } from '../ui/ModalShell';
import { loadLocalSave, writeLocalSave, clearLocalSave } from '../persistence/localSaveRepository';
import { collect as applyCollect, createCollectState, rollOver, todayKey } from '../game/collectables/collectState';
import type { CollectItem } from '../game/collectables/types';
import { WalletHud, heartsFoundToday } from '../features/wallet/WalletHud';
import { shouldPersistSave } from '../features/multiplayer/roomSessionModel';
import { useRoomSession } from './useRoomSession';
import { Shell } from '../features/shell/Shell';
import { PauseMenu } from '../features/shell/PauseMenu';
import { createShellState, reduceShell } from '../features/shell/shellFlow';
import { applyEquippedCharacter, isUnlocked, resolveEquipped, type CharacterChoiceId } from '../content/store/catalog';
import { resetLoadProgress } from '../game/render/loadProgress';
import type { Equipped, Locale } from '../contracts';
import { RoomStatus } from '../features/multiplayer/RoomStatus';
import { useAccount } from './useAccount';
import { chooseSave, type CloudRecord } from '../account/cloudSave';
import type { AccountUser } from '../account/accountService';

import { LocaleProvider, translate, localizedPlace, localizedRegion, type TranslationKey, ENGLISH_CATALOG } from '../features/i18n/translate';
import { MobileControls } from '../features/controls/MobileControls';
import { loadPreferences, writePreferences } from '../persistence/preferencesRepository';
import { AudioDirector } from '../game/audio/AudioDirector';
import { needsSafeReset, FEET_TO_CENTER } from '../game/player/controllerMath';
import { bearingToWaypoint } from '../features/map/mapGeometry';
import type { SoccerSceneProps } from './WorldCanvas';
import type { KickControl, SoccerEvent } from '../game/soccer/SoccerMatch';
import type { NpcId } from '../game/npc/npcDefinitions';
import { NpcChatPanel } from '../features/npc/NpcChatPanel';

const WorldCanvas=lazy(()=>import('./WorldCanvas').then(m=>({default:m.WorldCanvas})));
const CarPreview=lazy(()=>import('../features/vehicles/CarPreview').then(m=>({default:m.CarPreview})));
const defaultProfile:ExplorerProfile={id:'preview',displayName:'Traveler',avatarPresetId:'canopy',colors:{skin:'#ba805b',hair:'#292a25',clothing:'#285943'}};
const defaultSnapshot:PlayerSnapshot={position:SPAWN,headingRad:Math.PI,speed:0,grounded:true};

class SceneBoundary extends Component<{children:ReactNode;onRetry:()=>void;onError:(message:string)=>void;onExit:()=>void},{error:boolean}>{
  componentDidCatch(){this.props.onError('The trail could not load. Your saved explorer has been preserved.');}
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?null:this.props.children;}
}

// The shell's load screen waits on the player, not the world, so world readiness is not tracked.
const noop=()=>undefined;

function formatNpcToast(key:'npc.toast.stolen'|'npc.toast.blessed',n:number,locale:Locale):string{
  return translate(key,locale).replace('{n}',String(n)).replace('{s}',n===1?'':'s');
}

function safeSavedPosition(save:SaveV3|null):Vec3{
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
  const [carModelId,setCarModelId]=useState<CarModelId>(()=>resolveEquipped(initialPreferences.preferences.equipped,false).carId);
  const [carColor,setCarColor]=useState<string>(()=>resolveEquipped(initialPreferences.preferences.equipped,false).carColor);
  const [bikeSpawnToken,setBikeSpawnToken]=useState(0);
  const [gliderLaunchToken,setGliderLaunchToken]=useState(0);const [parachuteDropToken,setParachuteDropToken]=useState(0);const [gliderDismissed,setGliderDismissed]=useState(false);
  const [bikeModelId,setBikeModelId]=useState<BikeModelId>(()=>resolveEquipped(initialPreferences.preferences.equipped,false).bikeId);
  const [soccerActive,setSoccerActive]=useState(false);const [soccerDismissed,setSoccerDismissed]=useState(false);
  const [soccerScore,setSoccerScore]=useState({north:0,south:0});const [soccerBanner,setSoccerBanner]=useState<{text:TranslationKey;id:number}|null>(null);
  const kick=useRef<KickControl>({held:false}).current;const chargeBar=useRef<HTMLElement|null>(null);
  const carPaintable=Boolean(VEHICLE_PROFILES[carModelId].paint);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const haptic=useCallback((pattern:number|number[])=>{if(preferences.haptics&&touch)vibrate(pattern);},[preferences.haptics,touch]);
  const inspectMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).has('inspect');
  const setDeveloperMode=(enabled:boolean)=>{const url=new URL(window.location.href);if(enabled)url.searchParams.set('inspect','');else url.searchParams.delete('inspect');window.location.replace(url.toString().replace('inspect=','inspect'));};
  const [saved,setSaved]=useState(initial.save);
  const room=useRoomSession();
  const inRoom=room.inRoom;
  const [shell,dispatchShell]=useReducer(reduceShell,undefined,()=>createShellState({hasSave:!!initial.save,inviteCode:room.initialCode}));
  // Accounts: signing in unlocks the whole store and keeps the save, coins and loadout in Firestore.
  const savedRef=useRef(saved);savedRef.current=saved;
  const preferencesRef=useRef(preferences);preferencesRef.current=preferences;
  const activeRef=useRef(false);
  const adoptSave=(save:SaveV3)=>{setSaved(save);setProfile(save.profile);setSettings(save.settings);setVisited(save.visitedLandmarkIds.filter(id=>LANDMARKS.some(l=>l.id===id)));setCollectState(rollOver(save.collect,todayKey()));};
  const adoptRef=useRef(adoptSave);adoptRef.current=adoptSave;
  const onSignedIn=useCallback((_user:AccountUser,cloud:CloudRecord):Partial<CloudRecord>=>{
    const local=savedRef.current,send:Partial<CloudRecord>={};
    // A run already under way keeps going: it is newer than anything the account holds.
    const choice=activeRef.current?(local?'local':'none'):chooseSave(local,cloud.save);
    if(choice==='cloud'&&cloud.save){const result=writeLocalSave(cloud.save);if(!result.ok)setWarning(result.warning);adoptRef.current(cloud.save);}
    else if(choice==='local'&&local)send.save=local;
    if(cloud.equipped){const next={...preferencesRef.current,equipped:cloud.equipped};setPreferences(next);writePreferences(next);}
    else send.equipped=preferencesRef.current.equipped;
    return send;
  },[]);
  const account=useAccount(onSignedIn);
  const signedIn=account.status==='signedIn';
  // Guests see the rest of the garage, locked, in the in-game spawners.
  const lockFor=(kind:'car'|'bike')=>(entry:{id:string;name:string;available:boolean;reason:string})=>entry.available&&!isUnlocked(kind,entry.id,signedIn)?{...entry,available:false,reason:t('account.lockedReason'),badge:t('account.locked')}:entry;
  const equipped=resolveEquipped(preferences.equipped,signedIn);
  const [profile,setProfile]=useState<ExplorerProfile>(initial.save?.profile??defaultProfile);
  const [settings,setSettings]=useState<GameSettings>(()=>initial.save?.settings??{...DEFAULT_SETTINGS,quality:coarse?'low':'medium',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const [mode,setMode]=useState<InputMode>('menu');
  const [active,setActive]=useState(false);activeRef.current=active;const [menu,setMenu]=useState<'none'|'settings'|'reset'|'car'|'bike'>('none');
  const [sceneError,setSceneError]=useState<string|null>(null);const [sceneKey,setSceneKey]=useState(0);
  const [spawn,setSpawn]=useState<Vec3>(SPAWN);const [initialHeading,setInitialHeading]=useState(Math.PI);const [resetToken,setResetToken]=useState(0);
  const [snapshot,setSnapshot]=useState<PlayerSnapshot>(defaultSnapshot);
  const snapshotRef=useRef(defaultSnapshot);const safeRef=useRef<PlayerSnapshot>(defaultSnapshot);
  const restored=useRef(false);
  const [collectState,setCollectState]=useState(()=>rollOver(initial.save?.collect??createCollectState(),todayKey()));
  const collectRef=useRef(collectState);collectRef.current=collectState;
  const onCollect=useCallback((item:CollectItem)=>{setCollectState(state=>applyCollect(state,item));haptic(item.kind==='coin'?12:[20,40,20]);},[haptic]);
  const [npcPositions,setNpcPositions]=useState<Record<NpcId,Vec3>|null>(null);
  const [npcInRange,setNpcInRange]=useState<NpcId|null>(null);
  const [npcToast,setNpcToast]=useState<{npcId:NpcId;coinsDelta:number}|null>(null);
  // Session-only anti-farming cap on Mayavi's blessing; not persisted to the save (a soft
  // nudge, not a ledger), so it resets on reload as well as at local midnight.
  const NPC_BLESS_DAILY_CAP=40;
  const npcBlessedRef=useRef<{dateKey:string;total:number}>({dateKey:todayKey(),total:0});
  const onNpcPositions=useCallback((positions:Record<NpcId,Vec3>)=>setNpcPositions(positions),[]);
  const onNpcProximity=useCallback((npcId:NpcId|null)=>setNpcInRange(npcId),[]);
  const onNpcCoinEffect=useCallback((npcId:NpcId,coinsDelta:number)=>{
    const today=todayKey();
    if(npcBlessedRef.current.dateKey!==today)npcBlessedRef.current={dateKey:today,total:0};
    if(coinsDelta>0){
      if(npcBlessedRef.current.total>=NPC_BLESS_DAILY_CAP)return;
      npcBlessedRef.current.total+=coinsDelta;
    }
    setCollectState(state=>({...state,coins:Math.max(0,state.coins+coinsDelta)}));
    haptic(coinsDelta<0?[10,30,10]:12);
    setNpcToast({npcId,coinsDelta});
  },[haptic]);
  useEffect(()=>{if(!npcToast)return;const t=setTimeout(()=>setNpcToast(null),3200);return()=>clearTimeout(t);},[npcToast]);
  const [npcChatOpen,setNpcChatOpen]=useState<NpcId|null>(null);
  const npcBaseUrl=(import.meta.env.VITE_MULTIPLAYER_URL??'ws://127.0.0.1:2567').replace(/^ws/,'http');
  useEffect(()=>{
    if(!npcInRange)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==='e')setNpcChatOpen(npcInRange);};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[npcInRange]);
  const [visited,setVisited]=useState<string[]>(initial.save?.visitedLandmarkIds.filter(id=>LANDMARKS.some(l=>l.id===id))??[]);
  const visitedRef=useRef(visited);visitedRef.current=visited;
  const [discovery,setDiscovery]=useState<string|null>(null);const [waypoint,setWaypoint]=useState<Vec3|null>(null);
  const [warning,setWarning]=useState<string|null>(initial.warning??initialPreferences.warning);const [hints,setHints]=useState(true);

  const updatePreferences=(next:Preferences)=>{commands?.clear();setPreferences(next);const result=writePreferences(next);if(!result.ok)setWarning(result.warning);};
  const onSnapshot=useCallback((value:PlayerSnapshot)=>{snapshotRef.current=value;if(value.grounded&&!needsSafeReset({x:value.position[0],y:value.position[1]+FEET_TO_CENTER,z:value.position[2]}))safeRef.current=value;setSnapshot(value);},[]);
  const onPause=useCallback(()=>setMode(m=>m==='playing'?'paused':m),[]);
  const onMap=useCallback(()=>setMode(m=>m==='playing'?'map':m),[]);
  const onPlayerReady=useCallback(()=>{restored.current=true;setMode(m=>m==='loading'?'playing':m);dispatchShell({type:'WORLD_READY'});},[]);
  const onSceneError=useCallback((error:string)=>{setSceneError(error);setMenu('none');setMode(m=>m==='menu'?'menu':'paused');dispatchShell({type:'LOAD_FAILED'});},[]);
  const persist=useCallback((urgent=false)=>{
    if(!active||profile.id==='preview'||!restored.current)return;
    if(!shouldPersistSave(inRoom))return;
    const last=safeRef.current;
    const save:SaveV3={version:3,collect:collectRef.current,locale,bicycle:snapshotRef.current.bicycle??bicycleSpawn,worldVersion:WORLD_VERSION,profile,position:last.position,headingRad:last.headingRad,safeSpawnId:'origin',visitedLandmarkIds:visitedRef.current,settings,updatedAt:new Date().toISOString()};
    const result=writeLocalSave(save);if(!result.ok)setWarning(result.warning);else setSaved(save);
    account.push({save},urgent);
  },[active,profile,settings,locale,bicycleSpawn,inRoom,account.push]);
  useEffect(()=>{if(!active)return;persist();const timer=setInterval(()=>persist(),5000);const hide=()=>{if(document.hidden)persist(true);};document.addEventListener('visibilitychange',hide);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);};},[active,persist]);
  // A run of pickups becomes one write, not one per coin.
  useEffect(()=>{if(!active)return;const id=setTimeout(()=>persist(),500);return()=>clearTimeout(id);},[collectState,active,persist]);
  useEffect(()=>{if(mode!=='playing')return;for(const landmark of LANDMARKS){if(visitedRef.current.includes(landmark.id))continue;const distance=Math.hypot(snapshot.position[0]-landmark.position[0],snapshot.position[2]-landmark.position[2]);if(distance<landmark.discoveryRadiusM){setVisited(v=>v.includes(landmark.id)?v:[...v,landmark.id]);setDiscovery(landmark.id);break;}}},[snapshot,mode]);
  useEffect(()=>{if(!discovery)return;const t=setTimeout(()=>setDiscovery(null),5500);return()=>clearTimeout(t);},[discovery]);
  useEffect(()=>{if(active&&mode!=='playing')persist(true);},[mode,active,persist]);
  useWakeLock(active&&mode==='playing');
  // Switching apps on a phone pauses the trail rather than letting it run unseen.
  useEffect(()=>{if(!active)return;const hide=()=>{if(document.hidden){commands?.clear();setMode(m=>m==='playing'?'paused':m);}};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[active,commands]);

  const start=(chosen:ExplorerProfile,continuing=false,characterId?:CharacterChoiceId)=>{
    const loadout=resolveEquipped(preferences.equipped,signedIn);
    setCarModelId(loadout.carId);setCarColor(loadout.carColor);setBikeModelId(loadout.bikeId);
    resetLoadProgress();
    // An explicit character (New Game) wins over the equipped one, which this render may not have seen yet.
    const next=applyEquippedCharacter(chosen,characterId??loadout.characterId);
    restored.current=false;
    const position=continuing?safeSavedPosition(saved):SPAWN;
    const nextSnapshot={...defaultSnapshot,position,headingRad:continuing?(saved?.headingRad??Math.PI):Math.PI};
    setBicycleSpawn(continuing&&saved?.worldVersion===WORLD_VERSION?saved?.bicycle??null:null);
    setInitialHeading(nextSnapshot.headingRad);setProfile(next);setSpawn(position);setSnapshot(nextSnapshot);snapshotRef.current=nextSnapshot;safeRef.current=nextSnapshot;
    if(!continuing)setVisited([]);
    setActive(true);setMenu('none');setMode('loading');setResetToken(n=>n+1);
  };
  const exit=()=>{persist(true);setActive(false);setMode('menu');setMenu('none');setDiscovery(null);dispatchShell({type:'QUIT_TO_MENU'});};
  const enterRoom=()=>{
    const loadout=resolveEquipped(preferences.equipped,signedIn);
    setCarModelId(loadout.carId);setCarColor(loadout.carColor);setBikeModelId(loadout.bikeId);
    resetLoadProgress();
    room.enter();
    restored.current=false;
    setActive(true);setMenu('none');setMode('loading');
  };
  const leaveRoom=()=>{room.leave();setActive(false);setMode('menu');setMenu('none');setDiscovery(null);dispatchShell({type:'QUIT_TO_MENU'});};
  const newGame=(chosen:ExplorerProfile)=>{
    // The creator's character choice becomes the equipped one, so the store and the game agree.
    const characterId=resolveEquipped({characterId:chosen.characterModelId??'procedural'},signedIn).characterId;
    if(characterId!==preferences.equipped.characterId)updatePreferences({...preferences,equipped:{...preferences.equipped,characterId}});
    setVisited([]);
    start(chosen,false,characterId);
  };
  const equip=(next:Equipped)=>{updatePreferences({...preferences,equipped:next});account.push({equipped:next},true);};
  const abandonLoad=()=>{if(inRoom)leaveRoom();else exit();setSceneError(null);setSceneKey(n=>n+1);};
  useEffect(()=>{dispatchShell({type:'SAVE_CHANGED',hasSave:!!saved});},[saved]);
  // A room that ends underneath the player, even mid-load, returns them to the multiplayer screen.
  useEffect(()=>{
    if(active&&shell.pendingGame==='room'&&!room.entered){setActive(false);setMode('menu');setMenu('none');dispatchShell({type:'ROOM_LOST'});}
  },[active,shell.pendingGame,room.entered]);
  const closeLobby=()=>{room.closeLobby();if(room.session.welcome&&!room.entered)room.leave();};
  const resume=()=>{setMenu('none');setMode('playing');};
  const resetPosition=()=>{setSpawn([...SPAWN]);setResetToken(n=>n+1);setMode('playing');setMenu('none');};
  const gliderOffer=active&&mode==='playing'&&!!snapshot.gliderAvailable&&!gliderDismissed;
  // Leaving the circle re-arms the offer after "Not now".
  useEffect(()=>{if(!snapshot.gliderAvailable)setGliderDismissed(false);},[snapshot.gliderAvailable]);
  const launchGlider=useCallback(()=>{setGliderLaunchToken(n=>n+1);setGliderDismissed(true);},[]);
  useEffect(()=>{
    if(!gliderOffer)return;
    const keydown=(event:KeyboardEvent)=>{
      if(event.repeat)return;
      if(event.code==='KeyF'||event.code==='Enter'){event.preventDefault();launchGlider();}
      else if(event.code==='KeyN'){event.preventDefault();setGliderDismissed(true);}
    };
    window.addEventListener('keydown',keydown);
    return()=>window.removeEventListener('keydown',keydown);
  },[gliderOffer,launchGlider]);
  // Inspect-only cheats: hold C (car) or B (bike) and press a number to spawn that catalog entry.
  useEffect(()=>{
    if(!inspectMode||!active||mode!=='playing')return;
    const held=new Set<string>();
    const keydown=(event:KeyboardEvent)=>{
      if(event.code==='KeyC'||event.code==='KeyB'){held.add(event.code);return;}
      // 0 is the tenth entry, so the whole car catalog is reachable.
      const digit=/^(?:Digit|Numpad)([0-9])$/.exec(event.code);
      if(!digit||event.repeat)return;
      const index=(Number(digit[1])+9)%10;
      if(held.has('KeyC')&&CAR_MODELS[index]){event.preventDefault();setCarModelId(CAR_MODELS[index].id);setCarSpawnToken(n=>n+1);}
      else if(held.has('KeyB')&&BIKE_MODELS[index]){event.preventDefault();setBikeModelId(BIKE_MODELS[index].id);setBikeSpawnToken(n=>n+1);}
    };
    const keyup=(event:KeyboardEvent)=>{held.delete(event.code);};
    const clear=()=>held.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);};
  },[inspectMode,active,mode]);
  const inspectDestination=(id:string)=>{
    const destination=INSPECTION_DESTINATIONS.find(place=>place.id===id);
    if(!destination?.available)return;
    setSpawn([...destination.position]);setInitialHeading(destination.headingRad);
    setResetToken(n=>n+1);setDiscovery(null);setMenu('none');setMode('playing');
  };
  // Football: walk into the circle at Kodakara, kick off, play until you leave the ground or end the match.
  const soccerOffer=!inRoom&&active&&mode==='playing'&&!!snapshot.soccerAvailable&&!soccerDismissed&&!soccerActive;
  useEffect(()=>{if(!snapshot.soccerAvailable)setSoccerDismissed(false);},[snapshot.soccerAvailable]);
  const startSoccer=useCallback(()=>{setSoccerScore({north:0,south:0});setSoccerBanner(null);setSoccerActive(true);setSoccerDismissed(true);},[]);
  const endSoccer=useCallback(()=>{setSoccerActive(false);kick.held=false;setSoccerBanner({text:'soccer.ended',id:Date.now()});},[kick]);
  useEffect(()=>{
    if(!soccerOffer)return;
    const keydown=(event:KeyboardEvent)=>{
      if(event.repeat)return;
      if(event.code==='KeyF'||event.code==='Enter'){event.preventDefault();startSoccer();}
      else if(event.code==='KeyN'){event.preventDefault();setSoccerDismissed(true);}
    };
    window.addEventListener('keydown',keydown);
    return()=>window.removeEventListener('keydown',keydown);
  },[soccerOffer,startSoccer]);
  useEffect(()=>{if(!active)setSoccerActive(false);},[active]);
  useEffect(()=>{if(!soccerBanner)return;const id=setTimeout(()=>setSoccerBanner(null),soccerBanner.text==='soccer.goal'?2200:2600);return()=>clearTimeout(id);},[soccerBanner]);
  const onSoccerEvent=useCallback((event:SoccerEvent)=>{
    if(event.kind==='goal'){haptic([40,60,40,60,80]);setSoccerScore(score=>({...score,[event.end]:score[event.end]+1}));setSoccerBanner({text:'soccer.goal',id:Date.now()});}
    else if(event.kind==='out')setSoccerBanner({text:'soccer.out',id:Date.now()});
    else endSoccer();
  },[endSoccer,haptic]);
  const soccer=useMemo<SoccerSceneProps>(()=>({active:soccerActive,kick,onEvent:onSoccerEvent,chargeBar}),[soccerActive,kick,onSoccerEvent]);
  const retry=()=>{setSceneError(null);setSceneKey(n=>n+1);if(active)setMode('loading');};
  const openCarControls=()=>{setMode('paused');setMenu('car');};
  const closeCarControls=()=>{setMenu('none');if(active)setMode('playing');};
  const spawnCar=()=>{setCarSpawnToken(token=>token+1);closeCarControls();};
  const openBikeControls=()=>{setMode('paused');setMenu('bike');};
  const spawnBike=()=>{setBikeSpawnToken(token=>token+1);closeCarControls();};
  const controller=useMemo<ExplorerControllerProps>(()=>({mode,profile,spawn,initialHeading,resetToken,inputCommands:receiveCommands,bicycleSpawn,returnBicycleToken,carSpawnToken,carModelId,carColor,bikeSpawnToken,bikeModelId,gliderLaunchToken,parachuteDropToken,sensitivity:settings.sensitivity,reducedMotion:settings.reducedMotion,cameraControl:touch?'mouse':settings.cameraControl,onSnapshot,onPause,onMap,onReady:onPlayerReady,onError:onSceneError}),[mode,profile,spawn,initialHeading,resetToken,receiveCommands,bicycleSpawn,returnBicycleToken,carSpawnToken,carModelId,carColor,bikeSpawnToken,bikeModelId,gliderLaunchToken,parachuteDropToken,settings.sensitivity,settings.reducedMotion,settings.cameraControl,touch,onSnapshot,onPause,onMap,onPlayerReady,onSceneError]);
  const currentRegion=WORLD_REGIONS.find(r=>r.id===getZoneAtPosition(snapshot.position[0],snapshot.position[2]))??WORLD_REGIONS[0];
  const currentArea=getAreaAt(snapshot.position[0],snapshot.position[2]);
  const placeLabel=currentArea?t(`area.${currentArea}` as TranslationKey):localizedRegion(currentRegion.id,locale);
  const location=discovery?LANDMARKS.find(l=>l.id===discovery):null;
  const npcMapEntries=npcPositions?(Object.entries(npcPositions) as [NpcId,Vec3][]).map(([id,position])=>({id,position})):undefined;
  const distance=waypoint?Math.round(Math.hypot(snapshot.position[0]-waypoint[0],snapshot.position[2]-waypoint[2])):null;

  return <LocaleProvider locale={locale}><main className={`experience ${active?'is-exploring':'is-entry'} ${snapshot.wasted?'is-wasted':''} ${touch?'uses-touch':''} ${soccerActive?'in-match':''}`} data-mode={mode} data-travel-mode={snapshot.travelMode??'foot'} data-player-position={snapshot.position.map(n=>n.toFixed(3)).join(",")} data-player-grounded={snapshot.grounded}>
    <AudioDirector settings={settings} mode={mode} player={snapshot}/>
    <Shell state={shell} dispatch={dispatchShell} account={account} locale={locale} touch={touch} reducedMotion={settings.reducedMotion} equipped={preferences.equipped} coins={collectState.coins}
      savedProfile={saved?.profile??null} savedDiscoveries={saved?.visitedLandmarkIds.length??0}
      roomProfile={applyEquippedCharacter(saved?.profile??profile,equipped.characterId)} room={room}
      settingsPanel={<SettingsPanel settings={settings} onChange={setSettings} controls={preferences.controls} onControlsChange={value=>updatePreferences({...preferences,controls:value})} locale={locale} onLocaleChange={value=>updatePreferences({...preferences,locale:value})} developerMode={inspectMode} onDeveloperModeChange={import.meta.env.DEV?setDeveloperMode:undefined} haptics={preferences.haptics} onHapticsChange={touch?value=>updatePreferences({...preferences,haptics:value}):undefined} offline={<OfflineSettings/>}/>}
      onLocaleChange={value=>updatePreferences({...preferences,locale:value})} onEquip={equip}
      onNewGame={newGame} onLoadGame={()=>{if(saved)start(saved.profile,true);}} onEnterRoom={enterRoom} onLeaveLobby={closeLobby}
      onRetry={retry} onAbandonLoad={abandonLoad} onResetExplorer={()=>setMenu('reset')}/>{active&&(<div className="world-viewport" aria-label="3D Kerala exploration world">
      <SceneBoundary key={sceneKey} onRetry={retry} onError={onSceneError} onExit={exit}><Suspense fallback={null}><WorldCanvas locale={locale} active={active} settings={settings} controller={controller} onReady={noop} onError={onSceneError} playerRef={snapshotRef} collectedIds={collectState.collectedIds} onCollect={onCollect} soccer={soccer} multiplayer={inRoom?{session:room.session,selfId:room.selfId,chatFocused:room.chatFocused}:undefined} onNpcCoinEffect={onNpcCoinEffect} onNpcPositions={onNpcPositions} onNpcProximity={onNpcProximity}/></Suspense></SceneBoundary>
    </div>)}
    {active&&<div className="hud" aria-label="Explorer heads-up display">{!touch&&<div className="hud-identity"><div className="identity-emblem"><Tree size={28} weight="light"/></div><div><span className="hud-name">{profile.displayName}</span><span className="hud-place">{placeLabel}</span></div></div>}<div className="hud-top-center"><span>N</span><span className="compass-tick"/><span>KERALA · CIRCA 2000</span><span className="compass-tick"/><span>S</span></div><div className="hud-map"><button className="minimap-button" aria-label="Open world map" onClick={onMap}><ExplorerMap compact player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint} npcs={npcMapEntries}/><div className="minimap-north">N</div></button><button className="map-open-button" onClick={onMap}><MapTrifold size={17}/> World map <kbd>M</kbd></button></div>{!inRoom&&<WalletHud coins={collectState.coins} heartsFound={heartsFoundToday(collectState)} locale={locale} compact={touch} place={placeLabel}/>}<div className="hud-actions"><button className="hud-icon" aria-label="Pause and settings" onClick={onPause}><Pause size={20}/></button><FullscreenButton className="hud-icon" landscape={touch}/>{!inRoom&&<><button className="hud-icon" aria-label="Open car controls" title="Car controls" onClick={openCarControls}><Car size={20}/></button><button className="hud-icon" aria-label="Open bike controls" title="Bike controls" onClick={openBikeControls}><Motorcycle size={20}/></button>{(snapshot.travelMode??'foot')==='foot'&&!snapshot.wasted&&<button className="hud-icon" aria-label={t('parachute.drop')} title={t('parachute.drop')} onClick={()=>setParachuteDropToken(n=>n+1)}><Parachute size={20}/></button>}</>}</div>
      {inRoom&&<RoomStatus session={room.session} onLeave={leaveRoom} onChatFocus={room.setChatFocused}/>}
      {!touch&&<div className="control-hints"><button onClick={()=>setHints(!hints)} className="hints-toggle"><Footprints size={17}/> Trail controls <CaretDown size={13} style={{transform:hints?'rotate(180deg)':'none'}}/></button>{hints&&<div className="hint-keys"><span><kbd>W A S D</kbd> Move</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>Q E</kbd> Turn</span><span><kbd>F</kbd> {t('car.interact')}</span><span><kbd>R</kbd> Sprint lock</span></div>}</div>}
      <div className="hud-bottom-right"><span>{visited.length} / {LANDMARKS.length} {t('app.placesDiscovered')}</span><span className="save-indicator">{warning?t('app.saveAttention'):saved?t('app.savedDevice'):t('app.saving')}</span></div>
      {waypoint&&<div className="waypoint-chip"><FlagPennant size={17}/><span>{distance} m · {t('map.bearing')} · {Math.round(bearingToWaypoint(snapshot.position,waypoint))}° N</span><button aria-label="Clear waypoint" onClick={()=>setWaypoint(null)}><X size={15}/></button></div>}
      {commands && touch && (
        <MobileControls enabled={mode === 'playing'} commands={commands} sprintLocked={snapshot.sprintLocked ?? false} travelMode={snapshot.travelMode ?? 'foot'} canInteract={Boolean(snapshot.canInteract) && !gliderOffer && !soccerOffer} opacity={settings.touchOpacity} nitroActive={Boolean(snapshot.nitroActive)} matchActive={soccerActive} />
      )}
      {gliderOffer&&<div className="glider-offer" role="dialog" aria-labelledby="glider-offer-title"><Wind size={26} weight="light"/><div><strong id="glider-offer-title">{t('glider.offerTitle')}</strong><p>{t('glider.offerBody')}</p><div className="glider-offer__actions"><button className="button button-primary" onClick={launchGlider}>{!touch&&<kbd>F</kbd>}{t('glider.yes')}</button><button className="button button-secondary" onClick={()=>setGliderDismissed(true)}>{!touch&&<kbd>N</kbd>}{t('glider.notNow')}</button></div></div></div>}
      {soccerOffer&&<div className="glider-offer" role="dialog" aria-labelledby="soccer-offer-title"><SoccerBall size={26} weight="light"/><div><strong id="soccer-offer-title">{t('soccer.offerTitle')}</strong><p>{t('soccer.offerBody')}</p><div className="glider-offer__actions"><button className="button button-primary" onClick={startSoccer}>{!touch&&<kbd>F</kbd>}{t('soccer.yes')}</button><button className="button button-secondary" onClick={()=>setSoccerDismissed(true)}>{!touch&&<kbd>N</kbd>}{t('soccer.notNow')}</button></div></div></div>}
      {soccerActive&&<div className="soccer-hud" role="group" aria-label="Football match">
        <div className="soccer-score" aria-live="polite"><span>{t('soccer.northGoal')}</span><strong>{soccerScore.north}</strong><i>–</i><strong>{soccerScore.south}</strong><span>{t('soccer.southGoal')}</span></div>
        {!touch&&<div className="soccer-power"><small>{t('soccer.power')}</small><span className="soccer-power__track"><span ref={node=>{chargeBar.current=node;}} className="soccer-power__fill"/></span></div>}
        {!touch&&<small className="soccer-hint">{t('soccer.controls')}</small>}
        <div className="soccer-actions"><button className="button button-secondary" onClick={endSoccer}>{t('soccer.endMatch')}</button></div>
      </div>}
      {soccerActive&&touch&&<div className="soccer-touch" style={{['--touch-opacity' as string]:settings.touchOpacity}}>
        <button type="button" className="soccer-touch__btn soccer-touch__pass" disabled title={t('soccer.passSoon')}>{t('soccer.pass')}</button>
        <button type="button" className="soccer-touch__btn soccer-touch__kick" aria-label={t('soccer.kick')} onPointerDown={e=>{e.preventDefault();kick.held=true;}} onPointerUp={()=>{kick.held=false;haptic(25);}} onPointerCancel={()=>{kick.held=false;}} onPointerLeave={()=>{kick.held=false;}}>
          <SoccerBall size={30} weight="fill"/><span>{t('soccer.kick')}</span>
          <span className="soccer-power__track soccer-touch__charge"><span ref={node=>{chargeBar.current=node;}} className="soccer-power__fill"/></span>
        </button>
      </div>}
      {soccerBanner&&mode==='playing'&&<div key={soccerBanner.id} className={`soccer-banner ${soccerBanner.text==='soccer.goal'?'is-goal':''}`} role="status">{t(soccerBanner.text)}</div>}
      {snapshot.wasted&&<div className="wasted-banner" role="status" aria-live="assertive"><span lang="ml">{t('plane.wasted')}</span></div>}
      {snapshot.travelMode==='plane'&&!snapshot.wasted&&<div className={`glider-status ${snapshot.climbing?'is-climbing':''}`} role="status"><Wind size={15}/><span>{t('plane.altitude')} {Math.round(snapshot.altitude??0)} m · {Math.round((snapshot.airspeed??0)*3.6)} km/h{snapshot.climbing?' ▲':''}</span>{!touch&&<small>{t('plane.controls')}</small>}</div>}
      {snapshot.travelMode==='glider'&&<div className={`glider-status ${snapshot.climbing?'is-climbing':''}`} role="status"><Wind size={15}/><span>{t('glider.altitude')} {Math.round(snapshot.altitude??0)} m{snapshot.climbing?` · ▲ ${t('glider.rising')}`:''}</span>{!touch&&<small>{t('glider.controls')}</small>}</div>}
      {mode==='playing'&&!snapshot.wasted&&!gliderOffer&&!soccerOffer&&(touch?Boolean(snapshot.interactionMessage&&snapshot.interactionMessage in ENGLISH_CATALOG):snapshot.canInteract||snapshot.interactionMessage)&&<div className="bicycle-prompt" role="status">{snapshot.interactionMessage?(snapshot.interactionMessage in ENGLISH_CATALOG?t(snapshot.interactionMessage as TranslationKey):snapshot.interactionMessage):<><kbd>{touch?'●':'F'}</kbd> {t(snapshot.travelMode==='car'?'controls.exitCar':snapshot.travelMode==='bicycle'?'controls.dismount':snapshot.travelMode==='boat'?'controls.leaveBoat':snapshot.travelMode==='plane'?'controls.leavePlane':snapshot.travelMode==='glider'?'controls.letGo':'controls.mount')}{snapshot.travelMode!=='foot'&&snapshot.travelMode!=='plane'&&snapshot.travelMode!=='glider'&&<small>S / ↓ · {t('controls.brake')}</small>}</>}</div>}
      {(snapshot.travelMode==='car'||snapshot.travelMode==='boat'||snapshot.travelMode==='bicycle'&&snapshot.nitroAvailable)&&<div className={`nitro-status ${snapshot.nitroActive?'is-active':''}`} role="status"><Car size={15}/><span>SHIFT · NITRO {snapshot.nitroActive?'ACTIVE':'READY'}</span></div>}
      {location&&mode==='playing'&&<div className="discovery-toast" role="status"><div><Compass size={24}/><span>{t('app.placeDiscovered')}</span></div><h2>{localizedPlace(location.id,locale)}</h2><p>{t(({origin:'landmark.originDescription',canopy:'landmark.canopyDescription',waterfall:'landmark.waterfallDescription',paddy:'landmark.paddyDescription',temple:'landmark.templeDescription','tea-shop':'landmark.teaShopDescription','river-bridge':'landmark.riverBridgeDescription','fishing-bank':'landmark.fishingBankDescription',market:'landmark.marketDescription',lighthouse:'landmark.lighthouseDescription',harbor:'landmark.harborDescription','spice-garden':'landmark.spiceGardenDescription'} as Record<string,TranslationKey>)[location.id]??`landmark.${location.id}Description` as TranslationKey)}</p></div>}
      {npcToast&&<div className="npc-toast" role="status">{formatNpcToast(npcToast.coinsDelta<0?'npc.toast.stolen':'npc.toast.blessed',Math.abs(npcToast.coinsDelta),locale)}</div>}
      {npcInRange&&mode==='playing'&&!npcChatOpen&&<button className="npc-prompt" onClick={()=>setNpcChatOpen(npcInRange)}>{t((touch?`npc.talk.${npcInRange}.touch`:`npc.talk.${npcInRange}`) as TranslationKey)}</button>}
      {npcChatOpen&&<NpcChatPanel npcId={npcChatOpen} zoneId={getZoneAtPosition(snapshot.position[0],snapshot.position[2])} baseUrl={npcBaseUrl} onClose={()=>setNpcChatOpen(null)}/>}
    </div>}
    {warning&&<div className="storage-notice" role="status"><p>{warning}</p><button aria-label="Dismiss save notice" onClick={()=>setWarning(null)}><X size={16}/></button></div>}
    <ModalShell open={mode==='map'} title={t('app.yourFieldAtlas')} onClose={()=>setMode('playing')} className="map-modal"><ExplorerMap player={snapshot} visited={visited} waypoint={waypoint} onWaypoint={setWaypoint} npcs={npcMapEntries}/></ModalShell>
    {!sceneError&&active&&mode==='paused'&&menu==='none'&&<PauseMenu locale={locale} inRoom={inRoom} onSelect={item=>item==='resume'?resume():item==='atlas'?setMode('map'):item==='settings'?setMenu('settings'):inRoom?leaveRoom():exit()}/>}
    <ModalShell open={menu==='settings'&&active} title={t('app.makeAtHome')} onClose={()=>setMenu('none')}><SettingsPanel settings={settings} onChange={setSettings} controls={preferences.controls} onControlsChange={value=>updatePreferences({...preferences,controls:value})} locale={locale} onLocaleChange={value=>updatePreferences({...preferences,locale:value})} developerMode={inspectMode} onDeveloperModeChange={import.meta.env.DEV?setDeveloperMode:undefined} haptics={preferences.haptics} onHapticsChange={touch?value=>updatePreferences({...preferences,haptics:value}):undefined} offline={<OfflineSettings/>} onResetPosition={active&&!inRoom?resetPosition:undefined}/>{active&&!inRoom&&snapshot.travelMode!=='bicycle'&&<button className="button button-secondary" onClick={()=>{setReturnBicycleToken(v=>v+1);resume();}}>{t('controls.returnBicycle')}</button>}{saved&&<button className="text-button reset-profile" onClick={()=>setMenu('reset')}><ArrowCounterClockwise size={16}/> Reset local explorer</button>}</ModalShell>
    <ModalShell open={menu==='car'} title={t('car.spawnerTitle')} onClose={closeCarControls} className="car-modal"><p className="car-modal__intro">Choose a car and drop it nearby. Hold <kbd>SHIFT</kbd> while driving to ignite nitrous for a short boost.</p><CarPicker embedded catalog={CAR_PICKER_CATALOG.map(lockFor('car'))} selectedId={carModelId} status={t('car.notSaved')} busy={false} preview={menu==='car'?<Suspense fallback={null}><CarPreview modelId={carModelId} color={carPaintable?carColor:undefined}/></Suspense>:null} colors={carPaintable?CAR_PAINT_COLORS:undefined} selectedColor={carColor} onColorSelect={setCarColor} onSelect={id=>setCarModelId(id as CarModelId)} onSpawn={spawnCar} onClose={closeCarControls}/></ModalShell>
    <ModalShell open={menu==='bike'} title="Bike spawner" onClose={closeCarControls} className="car-modal"><p className="car-modal__intro">Choose a bike and drop it nearby, then walk up and press <kbd>F</kbd>. Bikes ride on any dry ground. Hold <kbd>SHIFT</kbd> while riding a motor bike for nitrous.</p><p className="car-modal__intro">Stunts: <kbd>SPACE</kbd> hops, and speed launches you off ramps and crests. In the air, tap <kbd>W</kbd>/<kbd>S</kbd> to flip and <kbd>A</kbd>/<kbd>D</kbd> to spin, then land level and facing forward.</p><CarPicker embedded noun="bike" catalog={BIKE_PICKER_CATALOG.map(lockFor('bike'))} selectedId={bikeModelId} status="Bikes are not saved yet." busy={false} onSelect={id=>setBikeModelId(id as BikeModelId)} onSpawn={spawnBike} onClose={closeCarControls}/></ModalShell>
    <ModalShell open={menu==='reset'} title={t('app.startNewChapter')} onClose={()=>setMenu(active?'settings':'none')}><p>This removes your name, appearance, saved position, and discoveries from this browser.</p><div className="reset-actions"><button className="button button-secondary" onClick={()=>setMenu(active?'settings':'none')}>{t('app.keepExplorer')}</button><button className="button button-primary" onClick={()=>{const r=clearLocalSave();if(!r.ok){setWarning(r.warning);return;}setSaved(null);setVisited([]);setActive(false);setProfile(defaultProfile);setMode('menu');setMenu('none');}}>{t('app.resetExplorer')}</button></div></ModalShell>
    {inspectMode&&active&&<aside className="inspection-panel"><strong>Development inspection</strong><button onClick={()=>onSceneError('Simulated graphics interruption for recovery testing.')}>Test scene recovery</button>
      <select aria-label="Inspect landmark" defaultValue="" onChange={e=>{inspectDestination(e.currentTarget.value);e.currentTarget.value='';}}>
        <option value="" disabled>Fast travel to an area</option>
        {(['Existing landmarks','Mountain and forest expansion','V2 planned sites','Stunt parks'] as const).map(group=><optgroup key={group} label={group}>{INSPECTION_DESTINATIONS.filter(place=>place.group===group).map(place=><option key={place.id} value={place.id} disabled={!place.available}>{place.landmarkId?localizedPlace(place.landmarkId,locale):place.label}</option>)}</optgroup>)}
      </select>
      <output>{snapshot.position.map(n=>n.toFixed(1)).join(', ')} · {snapshot.grounded?'grounded':'airborne'}</output><output data-render-metrics="true">Measuring renderer…</output><small>Planned sites show current terrain only. Unbuilt terrain is unavailable.</small><small>Cheats: hold <kbd>C</kbd> + 1–9/0 to spawn one of {CAR_MODELS.length} cars, <kbd>B</kbd> + 1–{BIKE_MODELS.length} to spawn a bike ({BIKE_MODELS.map((m,i)=>`${i+1} ${m.name}`).join(', ')}).</small></aside>}

    <UpdateToast/>
  </main></LocaleProvider>;
}
