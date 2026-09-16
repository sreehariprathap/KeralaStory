import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowUp, ArrowUpRight, Compass, FlagPennant, Mountains, Plus, Minus, HouseLine, Plant, Coffee, Storefront, Anchor, Waves, Boat, MapPin, Lighthouse, Bridge, ArrowLeft, ArrowRight, ArrowDown } from '@phosphor-icons/react';
import { LANDMARKS, MAIN_PATH, WORLD_REGIONS, RIVER_CENTERLINE, riverCenter, getZoneAtPosition, getAreaAt, EXPANSION_LAYOUT, WORLD_DEFINITION, terrainHeight, walkableDeckHeight } from '../../content/world/kodassery';
import { EXPANSION_GROUND, V2_LAYOUT, V2_ROUTES } from '../../content/world/definition';
import type { PlayerSnapshot, Vec3, ZoneId } from '../../contracts';
import { createRiverMesh } from '../../game/world/riverGeometry';
import { worldToMap } from './projection';
import { bearingToWaypoint, distanceToWaypoint, mapToWorldViewport } from './mapGeometry';
import { localizedMapPlace, localizedPlace, localizedRegion, translate, useLocale, type TranslationKey } from '../i18n/translate';

interface Props {player:PlayerSnapshot;visited:string[];waypoint:Vec3|null;onWaypoint:(position:Vec3|null)=>void;compact?:boolean}
const mapBounds=WORLD_DEFINITION.mapBounds;
const H=650,W=H*(mapBounds.xMax-mapBounds.xMin)/(mapBounds.zMax-mapBounds.zMin);
const point=(v:Vec3)=>{const p=worldToMap(v,mapBounds);return [p.u*W,p.v*H];};
const poly=(points:readonly (readonly [number,number])[])=>points.map(([x,z])=>point([x,0,z]).join(',')).join(' ');
const path=poly(MAIN_PATH);
const riverWidth=21;
const riverPolygon=poly([...RIVER_CENTERLINE.map(([x,z])=>[x,z-riverWidth] as [number,number]),...RIVER_CENTERLINE.slice().reverse().map(([x,z])=>[x,z+riverWidth] as [number,number])]);
const northRiverBank=poly(RIVER_CENTERLINE.map(([x,z])=>[x,z-riverWidth] as [number,number]));
const southRiverBank=poly(RIVER_CENTERLINE.map(([x,z])=>[x,z+riverWidth] as [number,number]));
const v2OutletZ=V2_LAYOUT.riverNodes.find(node=>node.id==='main-outlet')?.position[2] ?? 220;
const groundRect=(bounds:{xMin:number;xMax:number;zMin:number;zMax:number})=>poly([[bounds.xMin,bounds.zMin],[bounds.xMax,bounds.zMin],[bounds.xMax,bounds.zMax],[bounds.xMin,bounds.zMax]]);
const v2RiverPolygon=(reach:typeof V2_LAYOUT.riverReaches[number])=>{
  const mesh=createRiverMesh(reach);
  const left:number[][]=[],right:number[][]=[];
  for(let i=0;i<mesh.vertices.length;i+=6){
    left.push([mesh.vertices[i],mesh.vertices[i+2]]);
    right.push([mesh.vertices[i+3],mesh.vertices[i+5]]);
  }
  return poly([...left,...right.reverse()] as [number,number][]);
};
const icons={mountain:Mountains,house:HouseLine,waves:Waves,plant:Plant,temple:HouseLine,tea:Coffee,bridge:Bridge,boat:Boat,shop:Storefront,lighthouse:Lighthouse,anchor:Anchor};
const elevation=(x:number,z:number)=>walkableDeckHeight(x,z) ?? terrainHeight(x,z);
const translatePlace=(id:string,locale:import('../../contracts').Locale)=>localizedMapPlace(id,locale);
const translateGeography=(id:'sea'|'river',locale:import('../../contracts').Locale)=>translate(`geography.${id}` as TranslationKey,locale);
export function ExplorerMap({player,visited,waypoint,onWaypoint,compact=false}:Props){
  const { locale } = useLocale();
  const svgRef=useRef<SVGSVGElement>(null);
  const [zoom,setZoom]=useState(1);const [focus,setFocus]=useState<[number,number]|null>(null);const [filter,setFilter]=useState<ZoneId|'all'>('all');
  const [px,py]=point(player.position);const [wx,wy]=waypoint?point(waypoint):[0,0];
  const viewWidth=compact?145:W/zoom,viewHeight=compact?160:H/zoom;
  const center=compact?[px,py]:(focus??[px,py]);
  const vx=compact?Math.min(W-viewWidth,Math.max(0,px-viewWidth/2)):zoom===1?0:Math.min(W-viewWidth,Math.max(0,center[0]-viewWidth/2));
  const vy=compact?Math.min(H-viewHeight,Math.max(0,py-viewHeight/2)):zoom===1?0:Math.min(H-viewHeight,Math.max(0,center[1]-viewHeight/2));
  const shown=useMemo(()=>LANDMARKS.filter(l=>filter==='all'||l.zoneId===filter),[filter]);
  const focusRegion=(zone:ZoneId|'all')=>{setFilter(zone);if(zone==='all'){setZoom(1);setFocus(null);}else{const region=WORLD_DEFINITION.regions.find(candidate=>candidate.id===zone);setZoom(2);setFocus(region?point([region.center[0],0,region.center[1]]) as [number,number]:null);}};
  const pan=(x:number,y:number)=>setFocus([Math.max(viewWidth/2,Math.min(W-viewWidth/2,center[0]+x*viewWidth*.25)),Math.max(viewHeight/2,Math.min(H-viewHeight/2,center[1]+y*viewHeight*.25))]);
  const onMapPointer=(event:PointerEvent<SVGSVGElement>)=>{if(compact)return;const position=mapToWorldViewport(event.clientX,event.clientY,event.currentTarget.getBoundingClientRect(),{x:vx,y:vy,width:viewWidth,height:viewHeight},mapBounds,{width:W,height:H});if(position){position[1]=elevation(position[0],position[2]);onWaypoint(position);setFocus(point(position) as [number,number]);}};
  const waypointBearing=waypoint?bearingToWaypoint(player.position,waypoint):0;
  const waypointDistance=waypoint?distanceToWaypoint(player.position,waypoint):0;
  return <div className={compact?'map-compact':'atlas-layout'}>
    <div className="atlas-sheet">
      {!compact&&<div className="atlas-sheet-heading"><span>KERALA · FIELD ATLAS</span><span><ArrowUp size={14}/> N</span></div>}
      <svg ref={svgRef} onPointerUp={onMapPointer} className="atlas-drawing" viewBox={`${vx} ${vy} ${viewWidth} ${viewHeight}`} role="img" aria-label={`North-up map from ${localizedRegion('kodassery',locale)} through ${localizedRegion('kadambode',locale)}, across ${localizedRegion('kurumali',locale)} to ${localizedRegion('kodaly',locale)}.`}>
        <defs><pattern id={compact?'map-dots-mini':'map-dots-full'} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".8" fill="#456b42" opacity=".2"/></pattern></defs>
        <rect width={W} height={H} fill="#a4cbc5"/>
        <polygon points={poly([[-78,-499],[83,-499],[83,90],[-78,90]])} fill="#e2dfb8"/>
        <polygon points={poly([[-78,-499],[83,-499],[83,-334],[-78,-334]])} fill="#a7bb83"/>
        <polygon points={poly([[-78,-334],[83,-334],[83,-139],[-78,-139]])} fill="#c7d18f"/>
        {EXPANSION_GROUND.chunks.map(chunk=>{
          const bounds=chunk.id==='expansion-west' ? {...chunk.bounds,zMax:Math.min(chunk.bounds.zMax,v2OutletZ)} : chunk.bounds;
          return <polygon key={chunk.id} points={groundRect(bounds)} fill={chunk.id==='expansion-east'?'#8aa96f':'#82a16e'} stroke="#668458" strokeWidth="1"/>;
        })}
        {EXPANSION_LAYOUT.areas.map(area=><polygon key={area.id} points={poly(area.footprint)} fill={area.id==='kodassery-summit'?'#a7bb83':'#82a16e'} stroke="#668458" strokeWidth="1"/>)}
        <rect width={W} height={H} fill={`url(#${compact?'map-dots-mini':'map-dots-full'})`}/>
        {EXPANSION_LAYOUT.waterBodies.filter(water=>water.id==='chokkana-stream-water').map(water=><polygon key={water.id} points={poly(water.footprint)} fill="#80b7ba" stroke="#567f61" strokeWidth="1"/>)}
        {EXPANSION_LAYOUT.routes.map(route=><polyline key={route.id} points={poly(route.points.map(p=>[p[0],p[2]] as const))} fill="none" stroke={route.allowedModes.length===1?'#aa6650':'#f4e6bb'} strokeWidth={route.allowedModes.length===1?1.8:4} strokeDasharray={route.allowedModes.length===1?'3 3':undefined} strokeLinejoin="round"/>)}
        {V2_ROUTES.map(route=><polyline key={route.id} points={poly(route.points.map(p=>[p[0],p[2]] as const))} fill="none" stroke="#d8b87a" strokeWidth="3" strokeDasharray="8 5" strokeLinejoin="round" opacity=".9"/>)}
        {!compact&&EXPANSION_LAYOUT.areas.map(area=>{const [x,y]=point([area.labelPosition[0],0,area.labelPosition[1]]);return <text key={area.id} x={x} y={y} fontSize="11" textAnchor="middle" fill="#285943" stroke="#F4E8CC" strokeWidth="3" paintOrder="stroke">{translate(`area.${area.id}` as TranslationKey,locale)}</text>;})}
        {!compact&&V2_LAYOUT.towns.map(town=>{const [x,y]=point(town.center);return <text key={`${town.id}-site`} x={x} y={y} fontSize="10" textAnchor="middle" fill="#285943" stroke="#F4E8CC" strokeWidth="3" paintOrder="stroke">{town.label} site</text>;})}
        {!compact&&(()=>{const [x,y]=point(V2_LAYOUT.park.center);return <text x={x} y={y} fontSize="10" textAnchor="middle" fill="#285943" stroke="#F4E8CC" strokeWidth="3" paintOrder="stroke">{V2_LAYOUT.park.label} site</text>;})()}
        {V2_LAYOUT.riverReaches.filter(reach=>reach.id!=='kurumali-existing'&&reach.kind!=='waterfall').map(reach=><polygon key={reach.id} points={v2RiverPolygon(reach)} fill="#80b7ba" stroke="#567f61" strokeWidth="1.2"/>)}
        <polygon points={riverPolygon} fill="#80b7ba"/>
        <polyline points={northRiverBank} fill="none" stroke="#567f61" strokeWidth="2"/><polyline points={southRiverBank} fill="none" stroke="#567f61" strokeWidth="2"/>
        <polyline points={poly(RIVER_CENTERLINE)} fill="none" stroke="#c4e2d7" strokeWidth="2" strokeDasharray="12 13"/>
        <polyline points={path} fill="none" stroke="#9b9f72" strokeWidth="10" strokeLinejoin="round"/>
        <polyline points={path} fill="none" stroke="#f4e6bb" strokeWidth="7" strokeLinejoin="round"/>
        <polyline points={path} fill="none" stroke="#aa6650" strokeWidth="1.8" strokeDasharray="2 4"/>
        <path d={`M${point([WORLD_DEFINITION.bridgeBounds.xMin,0,WORLD_DEFINITION.bridgeBounds.zMin]).join(' ')} L${point([WORLD_DEFINITION.bridgeBounds.xMin,0,WORLD_DEFINITION.bridgeBounds.zMax]).join(' ')}`} stroke="#8b6d45" strokeWidth="8"/>
        <path d={`M${point([WORLD_DEFINITION.bridgeBounds.xMin,0,WORLD_DEFINITION.bridgeBounds.zMin]).join(' ')} L${point([WORLD_DEFINITION.bridgeBounds.xMin,0,WORLD_DEFINITION.bridgeBounds.zMax]).join(' ')}`} stroke="#d1b586" strokeWidth="5" strokeDasharray="2 1"/>
        {[[3,-23],[9,4],[45,-17],[46,11],[52,39]].map(([x,z],i)=>{const [a,b]=point([x,0,z]);return <g key={i}><rect x={a-6} y={b-4} width="12" height="9" fill="#eadac0" stroke="#9b896c" strokeWidth="1"/><path d={`M${a-7} ${b-5}L${a} ${b-9}L${a+7} ${b-5}Z`} fill="#a9694b"/></g>;})}
        {!compact&&<><text x={W-14} y={H-72} fontSize="9" fill="#376b71" transform={`rotate(-90 ${W-14} ${H-72})`} letterSpacing="2">{translateGeography('sea',locale)}</text><text x="22" y={point([0,0,riverCenter(-60)])[1]-5} fontSize="10" fill="#315f62" fontStyle="italic">{translateGeography('river',locale)}</text></>}
        {LANDMARKS.map(l=>{const [x,y]=point(l.position);const Icon=icons[l.iconId as keyof typeof icons]??MapPin;return <g key={l.id}><circle cx={x} cy={y} r={compact?5:7} fill={visited.includes(l.id)?'#3f6449':'#faf0ce'} stroke="#3f6449" strokeWidth="1.3"/>{!compact&&<><Icon x={x-4} y={y-4} width={8} height={8} color={visited.includes(l.id)?'#faf0ce':'#3f6449'}/><text x={x>205?x-10:x+11} y={y+3} textAnchor={x>205?'end':'start'} fontSize="8" fontWeight="500" fill="#304d38" stroke="#eee5c5" strokeWidth="2" paintOrder="stroke">{translatePlace(l.id,locale)}</text></>}</g>;})}
        {waypoint&&<g transform={`translate(${wx},${wy})`}><circle r="10" fill="none" stroke="#996035" strokeWidth="1.5"/><path d="M0 7V-12L10-8 0-3" stroke="#996035" fill="#d5aa54" strokeWidth="1.5"/></g>}
        <g transform={`translate(${px},${py}) rotate(${player.headingRad*180/Math.PI})`}><circle r="7" fill="#fff7e5"/><path d="M0 -6 4 4 0 2 -4 4Z" fill="#294f3d"/></g>
      </svg>
      {!compact&&<><div className="map-tools"><button className="icon-button" aria-label="Zoom out" disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}><Minus size={17}/></button><span>{zoom.toFixed(1)}×</span><button className="icon-button" aria-label="Zoom in" disabled={zoom===3} onClick={()=>setZoom(Math.min(3,zoom+.5))}><Plus size={17}/></button></div>{zoom>1&&<div className="map-pan-tools"><button className="icon-button" aria-label="Pan map north" onClick={()=>pan(0,-1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label="Pan map west" onClick={()=>pan(-1,0)}><ArrowLeft size={15}/></button><button className="icon-button" aria-label="Pan map east" onClick={()=>pan(1,0)}><ArrowRight size={15}/></button><button className="icon-button" aria-label="Pan map south" onClick={()=>pan(0,1)}><ArrowDown size={15}/></button></div>}<p className="map-note">{translate('map.note',locale)}</p>{waypoint&&<p className="map-note" aria-live="polite">{Math.round(waypointDistance)} m · {Math.round((waypointBearing*180/Math.PI+360)%360)}° {translate('map.bearing',locale)}</p>}</>}
    </div>
    {!compact&&<div className="atlas-details"><span className="small-label">KERALA, CIRCA 2000</span><h3>{translate('map.fromHills',locale)}</h3><p>{translate('map.description',locale)}</p><div className="map-region-filter" role="group" aria-label={translate('map.showRegion',locale)}><button aria-pressed={filter==='all'} onClick={()=>focusRegion('all')}>{translate('map.allPlaces',locale)}</button>{WORLD_REGIONS.map(r=><button key={r.id} aria-pressed={filter===r.id} onClick={()=>focusRegion(r.id as ZoneId)}>{localizedRegion(r.id,locale)}</button>)}</div><div className="landmark-list">{shown.map(l=>{const Icon=icons[l.iconId as keyof typeof icons]??MapPin;return <button key={l.id} className={waypoint?.[0]===l.position[0]&&waypoint?.[2]===l.position[2]?'selected':''} onClick={()=>{onWaypoint(l.position);setFocus(point(l.position) as [number,number]);}}><span className="landmark-icon"><Icon size={20}/></span><span><strong>{localizedPlace(l.id,locale)}</strong><small>{visited.includes(l.id)?translate('map.discovered',locale):translate('map.unexplored',locale)}</small></span><ArrowUpRight size={18}/></button>;})}</div>{waypoint&&<button className="text-button" onClick={()=>onWaypoint(null)}>{translate('map.clearWaypoint',locale)}</button>}<div className="map-legend"><span><i/> {translate('map.discovered',locale)}</span><span><i className="unvisited"/> {translate('map.unexplored',locale)}</span><span><FlagPennant size={14}/> {translate('map.legendWaypoint',locale)}</span><span>┄ {translate('bicycle.walkOnly',locale)}</span></div><div className="world-preview"><Compass size={24}/><div><strong>{getAreaAt(player.position[0],player.position[2])?translate(`area.${getAreaAt(player.position[0],player.position[2])}` as TranslationKey,locale):localizedRegion(getZoneAtPosition(player.position[0],player.position[2]),locale)}</strong><p>{visited.length} of {LANDMARKS.length} places discovered.<br/>Select a landmark for a bearing, then find your own way.</p></div></div></div>}
  </div>;
}
