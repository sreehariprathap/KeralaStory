import { useMemo, useState } from 'react';
import { ArrowUp, ArrowUpRight, Compass, FlagPennant, Mountains, Plus, Minus, HouseLine, Plant, Coffee, Storefront, Anchor, Waves, Boat, MapPin, Lighthouse, Bridge, ArrowLeft, ArrowRight, ArrowDown } from '@phosphor-icons/react';
import { LANDMARKS, MAIN_PATH, SLICE_BOUNDS, WORLD_REGIONS, RIVER_CENTERLINE, riverCenter, getZoneAt } from '../../content/world/kodassery';
import type { PlayerSnapshot, Vec3, ZoneId } from '../../contracts';
import { worldToMap } from './projection';

interface Props {player:PlayerSnapshot;visited:string[];waypoint:Vec3|null;onWaypoint:(position:Vec3|null)=>void;compact?:boolean}
const mapBounds={...SLICE_BOUNDS,xMin:SLICE_BOUNDS.xMin-12,xMax:SLICE_BOUNDS.xMax+33,zMax:SLICE_BOUNDS.zMax+27};
const W=340,H=650;
const point=(v:Vec3)=>{const p=worldToMap(v,mapBounds);return [p.u*W,p.v*H];};
const poly=(points:[number,number][])=>points.map(([x,z])=>point([x,0,z]).join(',')).join(' ');
const path=poly(MAIN_PATH);
const riverPolygon=poly([...RIVER_CENTERLINE.map(([x,z])=>[x,z-21] as [number,number]),...RIVER_CENTERLINE.slice().reverse().map(([x,z])=>[x,z+21] as [number,number])]);
const northRiverBank=poly(RIVER_CENTERLINE.map(([x,z])=>[x,z-21] as [number,number]));
const southRiverBank=poly(RIVER_CENTERLINE.map(([x,z])=>[x,z+21] as [number,number]));
const icons={mountain:Mountains,house:HouseLine,waves:Waves,plant:Plant,temple:HouseLine,tea:Coffee,bridge:Bridge,boat:Boat,shop:Storefront,lighthouse:Lighthouse,anchor:Anchor};
const shortLabels:Record<string,string>={origin:'Origin',canopy:'Canopy homes',waterfall:'Silverthread falls',paddy:'Paddy fields',temple:'Kadambode temple','tea-shop':'Rajan’s tea shop','river-bridge':'Kurumali bridge','fishing-bank':'Fishing bank',market:'Kodaly bazaar',lighthouse:'Lighthouse',harbor:'Harbor jetty'};
const zoneCenters:Record<ZoneId,number>={kodassery:-418,kadambode:-233,kurumali:-100,kodaly:30};
export function ExplorerMap({player,visited,waypoint,onWaypoint,compact=false}:Props){
  const [zoom,setZoom]=useState(1);const [focus,setFocus]=useState<[number,number]|null>(null);const [filter,setFilter]=useState<ZoneId|'all'>('all');
  const [px,py]=point(player.position);const [wx,wy]=waypoint?point(waypoint):[0,0];
  const viewWidth=compact?145:W/zoom,viewHeight=compact?160:H/zoom;
  const center=compact?[px,py]:(focus??[px,py]);
  const vx=compact?Math.min(W-viewWidth,Math.max(0,px-viewWidth/2)):zoom===1?0:Math.min(W-viewWidth,Math.max(0,center[0]-viewWidth/2));
  const vy=compact?Math.min(H-viewHeight,Math.max(0,py-viewHeight/2)):zoom===1?0:Math.min(H-viewHeight,Math.max(0,center[1]-viewHeight/2));
  const shown=useMemo(()=>LANDMARKS.filter(l=>filter==='all'||l.zoneId===filter),[filter]);
  const focusRegion=(zone:ZoneId|'all')=>{setFilter(zone);if(zone==='all'){setZoom(1);setFocus(null);}else{setZoom(2);setFocus(point([12,0,zoneCenters[zone]]) as [number,number]);}};
  const pan=(x:number,y:number)=>setFocus([Math.max(viewWidth/2,Math.min(W-viewWidth/2,center[0]+x*viewWidth*.25)),Math.max(viewHeight/2,Math.min(H-viewHeight/2,center[1]+y*viewHeight*.25))]);
  return <div className={compact?'map-compact':'atlas-layout'}>
    <div className="atlas-sheet">
      {!compact&&<div className="atlas-sheet-heading"><span>KERALA · FIELD ATLAS</span><span><ArrowUp size={14}/> N</span></div>}
      <svg className="atlas-drawing" viewBox={`${vx} ${vy} ${viewWidth} ${viewHeight}`} role="img" aria-label="North-up map from Kodassery Peaks through Kadambode, across Kurumali Puzha to Kodaly harbor. Rivers and roads use world coordinates.">
        <defs><pattern id={compact?'map-dots-mini':'map-dots-full'} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".8" fill="#456b42" opacity=".2"/></pattern></defs>
        <rect width={W} height={H} fill="#a4cbc5"/>
        <path d={`M0 0H${point([83,0,0])[0]}V${point([0,0,90])[1]}H0Z`} fill="#e2dfb8"/>
        <path d={`M0 0H${point([83,0,0])[0]}V${point([0,0,-334])[1]}H0Z`} fill="#a7bb83"/>
        <path d={`M0 ${point([0,0,-334])[1]}H${point([83,0,0])[0]}V${point([0,0,-140])[1]}H0Z`} fill="#c7d18f"/>
        <rect width={W} height={H} fill={`url(#${compact?'map-dots-mini':'map-dots-full'})`}/>
        {[0,1,2,3].map(i=><g key={i} transform={`translate(${26+i*52} ${22+(i%2)*20})`}><path d="M-25 48 0 0 27 48" stroke="#6b895b" strokeWidth="1.5" fill="#7f9e6d"/><path d="M0 0 6 25 0 20 -7 27Z" fill="#bdcaa4"/></g>)}
        {[0,1,2,3,4].map(i=><path key={i} d={`M${10+i*13} 68 Q${100+i*8} 103 ${40+i*9} 140 T${30+i*13} 210`} fill="none" stroke="#668458" strokeWidth="1" opacity=".35"/>)}
        {[0,1,2,3].map(i=><path key={i} d={`M12 ${240+i*23} Q60 ${225+i*23} 105 ${237+i*23} L107 ${252+i*23} Q58 ${242+i*23} 12 ${258+i*23}Z`} fill={i%2?'#b1bf6c':'#a1b868'} stroke="#718e52" strokeWidth="1.3"/>)}
        <polygon points={riverPolygon} fill="#80b7ba"/>
        <polyline points={northRiverBank} fill="none" stroke="#567f61" strokeWidth="2"/><polyline points={southRiverBank} fill="none" stroke="#567f61" strokeWidth="2"/>
        <polyline points={poly(RIVER_CENTERLINE)} fill="none" stroke="#c4e2d7" strokeWidth="2" strokeDasharray="12 13"/>
        <polyline points={path} fill="none" stroke="#9b9f72" strokeWidth="10" strokeLinejoin="round"/>
        <polyline points={path} fill="none" stroke="#f4e6bb" strokeWidth="7" strokeLinejoin="round"/>
        <polyline points={path} fill="none" stroke="#aa6650" strokeWidth="1.8" strokeDasharray="2 4"/>
        <path d={`M${point([12,0,-134]).join(' ')} L${point([12,0,-64]).join(' ')}`} stroke="#8b6d45" strokeWidth="8"/>
        <path d={`M${point([12,0,-134]).join(' ')} L${point([12,0,-64]).join(' ')}`} stroke="#d1b586" strokeWidth="5" strokeDasharray="2 1"/>
        {[[3,-23],[9,4],[45,-17],[46,11],[52,39]].map(([x,z],i)=>{const [a,b]=point([x,0,z]);return <g key={i}><rect x={a-6} y={b-4} width="12" height="9" fill="#eadac0" stroke="#9b896c" strokeWidth="1"/><path d={`M${a-7} ${b-5}L${a} ${b-9}L${a+7} ${b-5}Z`} fill="#a9694b"/></g>;})}
        {!compact&&<><text x="245" y="578" fontSize="9" fill="#376b71" transform="rotate(-90 245 578)" letterSpacing="2">ARABIAN SEA</text><text x="22" y={point([0,0,riverCenter(-60)])[1]-5} fontSize="10" fill="#315f62" fontStyle="italic">Kurumali Puzha</text></>}
        {LANDMARKS.map(l=>{const [x,y]=point(l.position);const Icon=icons[l.iconId as keyof typeof icons]??MapPin;return <g key={l.id}><circle cx={x} cy={y} r={compact?5:7} fill={visited.includes(l.id)?'#3f6449':'#faf0ce'} stroke="#3f6449" strokeWidth="1.3"/>{!compact&&<><Icon x={x-4} y={y-4} width={8} height={8} color={visited.includes(l.id)?'#faf0ce':'#3f6449'}/><text x={x>205?x-10:x+11} y={y+3} textAnchor={x>205?'end':'start'} fontSize="8" fontWeight="500" fill="#304d38" stroke="#eee5c5" strokeWidth="2" paintOrder="stroke">{shortLabels[l.id]}</text></>}</g>;})}
        {waypoint&&<g transform={`translate(${wx},${wy})`}><circle r="10" fill="none" stroke="#996035" strokeWidth="1.5"/><path d="M0 7V-12L10-8 0-3" stroke="#996035" fill="#d5aa54" strokeWidth="1.5"/></g>}
        <g transform={`translate(${px},${py}) rotate(${player.headingRad*180/Math.PI})`}><circle r="7" fill="#fff7e5"/><path d="M0 -6 4 4 0 2 -4 4Z" fill="#294f3d"/></g>
      </svg>
      {!compact&&<><div className="map-tools"><button className="icon-button" aria-label="Zoom out" disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}><Minus size={17}/></button><span>{zoom.toFixed(1)}×</span><button className="icon-button" aria-label="Zoom in" disabled={zoom===3} onClick={()=>setZoom(Math.min(3,zoom+.5))}><Plus size={17}/></button></div>{zoom>1&&<div className="map-pan-tools"><button className="icon-button" aria-label="Pan map north" onClick={()=>pan(0,-1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label="Pan map west" onClick={()=>pan(-1,0)}><ArrowLeft size={15}/></button><button className="icon-button" aria-label="Pan map east" onClick={()=>pan(1,0)}><ArrowRight size={15}/></button><button className="icon-button" aria-label="Pan map south" onClick={()=>pan(0,1)}><ArrowDown size={15}/></button></div>}<p className="map-note">North is up · River, roads & landmarks match the world</p></>}
    </div>
    {!compact&&<div className="atlas-details"><span className="small-label">KERALA, CIRCA 2000</span><h3>From the hills to the sea.</h3><p>Follow village roads, pause at the temple, and cross Kurumali Puzha on the wooden bridge.</p><div className="map-region-filter" role="group" aria-label="Show a map region"><button aria-pressed={filter==='all'} onClick={()=>focusRegion('all')}>All places</button>{WORLD_REGIONS.map(r=><button key={r.id} aria-pressed={filter===r.id} onClick={()=>focusRegion(r.id as ZoneId)}>{r.name}</button>)}</div><div className="landmark-list">{shown.map(l=>{const Icon=icons[l.iconId as keyof typeof icons]??MapPin;return <button key={l.id} className={waypoint?.[0]===l.position[0]&&waypoint?.[2]===l.position[2]?'selected':''} onClick={()=>{onWaypoint(l.position);setFocus(point(l.position) as [number,number]);}}><span className="landmark-icon"><Icon size={20}/></span><span><strong>{l.label}</strong><small>{visited.includes(l.id)?'Discovered':'Unexplored'}</small></span><ArrowUpRight size={18}/></button>;})}</div>{waypoint&&<button className="text-button" onClick={()=>onWaypoint(null)}>Clear waypoint</button>}<div className="map-legend"><span><i/> Discovered</span><span><i className="unvisited"/> Unexplored</span><span><FlagPennant size={14}/> Waypoint</span></div><div className="world-preview"><Compass size={24}/><div><strong>{WORLD_REGIONS.find(r=>r.id===getZoneAt(player.position[2]))?.name}</strong><p>{visited.length} of {LANDMARKS.length} places discovered.<br/>Select a landmark for a bearing, then find your own way.</p></div></div></div>}
  </div>;
}
