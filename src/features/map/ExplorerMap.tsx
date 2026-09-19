import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { ArrowUp, ArrowUpRight, Compass, FlagPennant, Mountains, Plus, Minus, HouseLine, Plant, Coffee, Storefront, Anchor, Waves, Boat, MapPin, Lighthouse, Bridge, Crosshair, Wind, SoccerBall, Motorcycle, SwimmingPool, Buildings, Lightning, AirplaneTilt, Umbrella, type Icon } from '@phosphor-icons/react';
import { LANDMARKS, MAIN_PATH, WORLD_REGIONS, RIVER_CENTERLINE, getZoneAtPosition, getAreaAt, EXPANSION_LAYOUT, WORLD_DEFINITION, WALKING_DETOURS, terrainHeight, walkableDeckHeight } from '../../content/world/kodassery';
import { V2_LAYOUT, V2_ROUTES } from '../../content/world/definition';
import { CHALAKKUDY_BRIDGES } from '../../content/world/chalakkudyCityPlan';
import { TEA_ESTATE, TEA_ESTATE_PLANTING } from '../../content/world/teaEstate';
import { STADIUM } from '../../content/world/stadiumLayout';
import type { PlayerSnapshot, Vec3, ZoneId } from '../../contracts';
import { NPC_DEFINITIONS, type NpcId } from '../../game/npc/npcDefinitions';
import { npcPinIcon } from './npcPinIcon';
import { createRiverMesh } from '../../game/world/riverGeometry';
import { worldToMap } from './projection';
import { bearingToWaypoint, distanceToWaypoint, mapToWorldViewport } from './mapGeometry';
import { localizedMapPlace, localizedPlace, localizedRegion, translate, useLocale, type TranslationKey } from '../i18n/translate';
import { smoothPath, simplify, type Point2 } from './smoothPath';
import { layoutLabels, type LabelRequest } from './labelLayout';
import { HIGHLIGHT_STYLE, airfieldSurfaces, buildingFootprints, mapCities, mapHighlights, type Highlight, type HighlightKind } from './mapFeatures';
import { reliefImage, type ReliefImage } from './mapRelief';

interface Props {player:PlayerSnapshot;visited:string[];waypoint:Vec3|null;onWaypoint:(position:Vec3|null)=>void;compact?:boolean;npcs?:{id:NpcId;position:Vec3}[]}
const mapBounds=WORLD_DEFINITION.mapBounds;
const H=650,W=H*(mapBounds.xMax-mapBounds.xMin)/(mapBounds.zMax-mapBounds.zMin);
/** Map units per world metre. */
const UNIT=H/(mapBounds.zMax-mapBounds.zMin);
const MIN_ZOOM=1,MAX_ZOOM=8;
const point=(v:Vec3):[number,number]=>{const p=worldToMap(v,mapBounds);return [p.u*W,p.v*H];};
const xz=(x:number,z:number):Point2=>point([x,0,z]);

const landmarkIcons:Record<string,Icon>={mountain:Mountains,house:HouseLine,waves:Waves,plant:Plant,temple:HouseLine,tea:Coffee,bridge:Bridge,boat:Boat,shop:Storefront,lighthouse:Lighthouse,anchor:Anchor,plane:AirplaneTilt,beach:Umbrella};
const highlightIcons:Record<HighlightKind,Icon>={paragliding:Wind,stadium:SoccerBall,'stunt-park':Motorcycle,'river-jump':Lightning,'water-park':SwimmingPool,waterfall:Waves};
const elevation=(x:number,z:number)=>walkableDeckHeight(x,z) ?? terrainHeight(x,z);

/** Everything static is projected once. */
const GEOMETRY=(()=>{
  const riverOutline=(reach:typeof V2_LAYOUT.riverReaches[number])=>{
    const mesh=createRiverMesh(reach),left:Point2[]=[],right:Point2[]=[];
    for(let i=0;i<mesh.vertices.length;i+=6){left.push(xz(mesh.vertices[i],mesh.vertices[i+2]));right.push(xz(mesh.vertices[i+3],mesh.vertices[i+5]));}
    return smoothPath([...simplify(left,3),...simplify(right.reverse(),3)],{closed:true,tension:.8});
  };
  const legacyWidth=21;
  const legacy=smoothPath([...RIVER_CENTERLINE.map(([x,z])=>xz(x,z-legacyWidth)),...RIVER_CENTERLINE.slice().reverse().map(([x,z])=>xz(x,z+legacyWidth))],{closed:true,tension:.6});
  const channels=V2_LAYOUT.riverReaches.filter(r=>r.id!=='kurumali-existing'&&r.kind!=='waterfall');
  const rivers=[...channels.map(riverOutline),legacy];
  const riverNames=[
    ...channels.filter(r=>r.kind==='channel').map(r=>({id:r.id,label:r.label,d:smoothPath(r.points.map(p=>xz(p[0],p[2])),{tension:.8}),length:r.points.reduce((sum,p,i)=>i?sum+Math.hypot(p[0]-r.points[i-1][0],p[2]-r.points[i-1][2]):0,0)*UNIT})),
    {id:'kurumali-existing',label:'Kurumalippuzha',d:smoothPath(RIVER_CENTERLINE.map(([x,z])=>xz(x,z)),{tension:.8}),length:200*UNIT},
  ].filter(r=>r.length>60);
  const roads=[
    {id:'main',d:smoothPath(simplify(MAIN_PATH.map(([x,z])=>xz(x,z)),2),{tension:.9}),width:6},
    ...V2_ROUTES.map(route=>({id:route.id,d:smoothPath(simplify(route.points.map(p=>xz(p[0],p[2])),2),{tension:.9}),width:route.widthM})),
    // Turning circles: a zero-length stroke with round caps draws a disc of the road's colour.
    ...V2_LAYOUT.roadCaps.map(cap=>({id:cap.id,d:`M${xz(cap.center[0],cap.center[2]).join(' ')}h.01`,width:cap.radius*2})),
    ...CHALAKKUDY_BRIDGES.map(bridge=>({id:bridge.id,d:`M${xz(bridge.from[0],bridge.from[2]).join(' ')}L${xz(bridge.to[0],bridge.to[2]).join(' ')}`,width:bridge.width})),
    ...EXPANSION_LAYOUT.routes.filter(r=>r.allowedModes.length>1).map(route=>({id:route.id,d:smoothPath(simplify(route.points.map(p=>xz(p[0],p[2])),2),{tension:.9}),width:route.widthM})),
  ];
  const trails=[
    ...EXPANSION_LAYOUT.routes.filter(r=>r.allowedModes.length===1).map(route=>({id:route.id,d:smoothPath(simplify(route.points.map(p=>xz(p[0],p[2])),2),{tension:.9})})),
    // Short pedestrian detours around landmarks (temple/tea-shop spurs, fishing bank paths, the
    // jetty walk): real walkable routes used for pathing, but not part of the road/trail network above.
    ...WALKING_DETOURS.map(detour=>({id:`detour-${detour.id}`,d:smoothPath(detour.path.map(([x,z])=>xz(x,z)),{tension:.9})})),
  ];
  const areas=EXPANSION_LAYOUT.areas.map(area=>({id:area.id,d:smoothPath(area.footprint.map(([x,z])=>xz(x,z)),{closed:true,tension:.35}),label:xz(area.labelPosition[0],area.labelPosition[1])}));
  const streams=EXPANSION_LAYOUT.waterBodies.filter(w=>w.id==='chokkana-stream-water').map(w=>smoothPath(w.footprint.map(([x,z])=>xz(x,z)),{closed:true,tension:.3}));
  const cities=mapCities().map(city=>{
    const xs=city.footprint.map(p=>p[0]),zs=city.footprint.map(p=>p[1]);
    const [x0,y0]=xz(Math.min(...xs),Math.min(...zs)),[x1,y1]=xz(Math.max(...xs),Math.max(...zs));
    return {...city,rect:{x:x0,y:y0,width:x1-x0,height:y1-y0},at:xz(city.center[0],city.center[1])};
  });
  const buildings=buildingFootprints().map(b=>{const [x,y]=xz(b.x,b.z);return {...b,px:x,py:y,w:b.width*UNIT,h:b.depth*UNIT,deg:-b.yaw*180/Math.PI};});
  const bridge={a:xz(WORLD_DEFINITION.bridgeBounds.xMin+2,WORLD_DEFINITION.bridgeBounds.zMin),b:xz(WORLD_DEFINITION.bridgeBounds.xMin+2,WORLD_DEFINITION.bridgeBounds.zMax)};
  const pitch=(()=>{const c=xz(STADIUM.center.x,STADIUM.center.z);return {x:c[0],y:c[1],deg:-STADIUM.yaw*180/Math.PI,w:STADIUM.pitch.halfWidth*2*UNIT,h:STADIUM.pitch.halfLength*2*UNIT,padW:STADIUM.pad.halfWidth*2*UNIT,padH:STADIUM.pad.halfLength*2*UNIT};})();
  const shore=xz(-78,V2_LAYOUT.riverNodes.find(n=>n.id==='main-outlet')?.position[2]??220);
  const airfield=airfieldSurfaces().map(s=>{const [x0,y0]=xz(s.xMin,s.zMin),[x1,y1]=xz(s.xMax,s.zMax);return {...s,x:x0,y:y0,width:x1-x0,height:y1-y0};});
  const runway=airfield.find(s=>s.id==='runway')!;
  // Tea rows as fine green contour lines, labelled at the estate's middle.
  const tea=TEA_ESTATE_PLANTING.rows.map(row=>smoothPath(simplify(row.points.map(p=>xz(p[0],p[2])),1.5),{tension:.8}));
  const teaPoints=TEA_ESTATE_PLANTING.rows.flatMap(row=>row.points),teaCentre=teaPoints.length?xz(teaPoints.reduce((a,p)=>a+p[0],0)/teaPoints.length,teaPoints.reduce((a,p)=>a+p[2],0)/teaPoints.length):null;
    // A highlight standing on a landmark (Silver Storm) is drawn once, as the highlight.
  const highlights=mapHighlights();
  const doubled=new Set(LANDMARKS.filter(l=>highlights.some(h=>Math.hypot(h.position[0]-l.position[0],h.position[2]-l.position[2])<30)).map(l=>l.id));
  return {rivers,riverNames,roads,trails,areas,streams,cities,buildings,bridge,pitch,shore,airfield,runway,tea,teaCentre,highlights,doubled};
})();

interface View {cx:number;cy:number;zoom:number}
const clampView=(v:View):View=>{
  const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,v.zoom)),w=W/zoom,h=H/zoom;
  return {zoom,cx:Math.max(w/2,Math.min(W-w/2,v.cx)),cy:Math.max(h/2,Math.min(H-h/2,v.cy))};
};
/** The interactive map animates its own viewBox; React only sets this once. */
const FULL_VIEWBOX=`0 0 ${W} ${H}`;
const viewBoxOf=(v:View)=>{const w=W/v.zoom,h=H/v.zoom;return {x:v.cx-w/2,y:v.cy-h/2,width:w,height:h};};

function useRelief(){
  const [relief,setRelief]=useState<ReliefImage|null>(null);
  useEffect(()=>{let live=true;reliefImage(mapBounds).then(image=>{if(live)setRelief(image);}).catch(()=>{});return()=>{live=false;};},[]);
  return relief;
}

type PinIcon=Icon|((props:{x:number;y:number;width:number;height:number;color:string;weight?:string})=>ReactElement);
function Pin({x,y,r,color,fill,icon:IconComponent,iconColor,pulse}:{x:number;y:number;r:number;color:string;fill:string;icon:PinIcon;iconColor:string;pulse?:boolean}){
  return <g transform={`translate(${x} ${y})`}>
    {pulse&&<circle className="map-pin-halo" r={r*1.9} fill={color} opacity=".22"/>}
    <circle r={r} fill={fill} stroke={color} strokeWidth={r*.2}/>
    <IconComponent x={-r*.62} y={-r*.62} width={r*1.24} height={r*1.24} color={iconColor} weight="bold"/>
  </g>;
}

export function ExplorerMap({player,visited,waypoint,onWaypoint,compact=false,npcs}:Props){
  const { locale } = useLocale();
  const relief=useRelief();
  const svgRef=useRef<SVGSVGElement>(null);
  const [px,py]=point(player.position);
  const [filter,setFilter]=useState<ZoneId|'all'>('all');
  const [target,setTarget]=useState<View>(()=>clampView({cx:W/2,cy:H/2,zoom:1}));
  const shown=useMemo(()=>LANDMARKS.filter(l=>filter==='all'||l.zoneId===filter),[filter]);
  // The compact minimap follows the player at a fixed close zoom.
  const view=compact?clampView({cx:px,cy:py,zoom:3.6}):target;
  const zoom=view.zoom,k=1/zoom;

  // Glide the drawn viewBox toward the target without re-rendering React every frame.
  const drawn=useRef<View>(view);
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    if(compact||matchMedia('(prefers-reduced-motion: reduce)').matches){drawn.current=view;const b=viewBoxOf(view);svg.setAttribute('viewBox',`${b.x} ${b.y} ${b.width} ${b.height}`);return;}
    let frame=0;
    const step=()=>{
      const d=drawn.current,t=.2;
      const next={cx:d.cx+(view.cx-d.cx)*t,cy:d.cy+(view.cy-d.cy)*t,zoom:Math.exp(Math.log(d.zoom)+(Math.log(view.zoom)-Math.log(d.zoom))*t)};
      const done=Math.abs(next.cx-view.cx)<.05&&Math.abs(next.cy-view.cy)<.05&&Math.abs(next.zoom-view.zoom)<.002;
      drawn.current=done?view:next;
      const b=viewBoxOf(drawn.current);svg.setAttribute('viewBox',`${b.x} ${b.y} ${b.width} ${b.height}`);
      if(!done)frame=requestAnimationFrame(step);
    };
    frame=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(frame);
  },[view.cx,view.cy,view.zoom,compact]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt=(factor:number,anchor?:[number,number])=>setTarget(current=>{
    const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*factor));
    if(!anchor)return clampView({...current,zoom});
    // Keep the map point under the cursor fixed.
    const ratio=current.zoom/zoom;
    return clampView({zoom,cx:anchor[0]+(current.cx-anchor[0])*ratio,cy:anchor[1]+(current.cy-anchor[1])*ratio});
  });
  const toMapPoint=(clientX:number,clientY:number):[number,number]|null=>{
    const svg=svgRef.current;if(!svg)return null;
    const b=viewBoxOf(drawn.current),position=mapToWorldViewport(clientX,clientY,svg.getBoundingClientRect(),b,mapBounds,{width:W,height:H});
    return position?point(position):null;
  };

  useEffect(()=>{
    const svg=svgRef.current;if(!svg||compact)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();const anchor=toMapPoint(event.clientX,event.clientY)??undefined;zoomAt(Math.exp(-event.deltaY*(event.deltaMode===1?.05:.0018)),anchor);};
    svg.addEventListener('wheel',wheel,{passive:false});
    return()=>svg.removeEventListener('wheel',wheel);
  }); // Re-bound each render so handlers see fresh closures.

  // Drag to pan, pinch to zoom, tap to drop a waypoint.
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const gesture=useRef<{moved:boolean;startDistance:number;startZoom:number;last:{x:number;y:number}}|null>(null);
  const onPointerDown=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(compact)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const list=[...pointers.current.values()];
    gesture.current={moved:gesture.current?.moved??false,startDistance:list.length>1?Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y):0,startZoom:target.zoom,last:{x:event.clientX,y:event.clientY}};
    if(list.length===1)gesture.current.moved=false;
  };
  const onPointerMove=(event:ReactPointerEvent<SVGSVGElement>)=>{
    const g=gesture.current;if(compact||!g||!pointers.current.has(event.pointerId))return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const list=[...pointers.current.values()];
    const rect=event.currentTarget.getBoundingClientRect(),scale=Math.min(rect.width/(W/target.zoom),rect.height/(H/target.zoom));
    if(list.length>1&&g.startDistance>0){
      g.moved=true;
      const distance=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y);
      const anchor=toMapPoint((list[0].x+list[1].x)/2,(list[0].y+list[1].y)/2)??undefined;
      zoomAt(g.startZoom*distance/g.startDistance/target.zoom,anchor);
      return;
    }
    const dx=event.clientX-g.last.x,dy=event.clientY-g.last.y;
    if(!g.moved&&Math.hypot(dx,dy)<5)return;
    g.moved=true;g.last={x:event.clientX,y:event.clientY};
    setTarget(current=>{const next=clampView({...current,cx:current.cx-dx/scale,cy:current.cy-dy/scale});drawn.current=next;return next;});
  };
  const onPointerUp=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(compact)return;
    const g=gesture.current;
    pointers.current.delete(event.pointerId);
    if(pointers.current.size>0)return;
    gesture.current=null;
    if(g?.moved)return;
    const b=viewBoxOf(drawn.current),position=mapToWorldViewport(event.clientX,event.clientY,event.currentTarget.getBoundingClientRect(),b,mapBounds,{width:W,height:H});
    if(position){position[1]=elevation(position[0],position[2]);onWaypoint(position);}
  };
  const focusOn=(position:Vec3,minZoom=2.5)=>{const [x,y]=point(position);setTarget(current=>clampView({cx:x,cy:y,zoom:Math.max(current.zoom,minZoom)}));};
  const focusRegion=(zone:ZoneId|'all')=>{
    setFilter(zone);
    if(zone==='all'){setTarget(clampView({cx:W/2,cy:H/2,zoom:1}));return;}
    const region=WORLD_DEFINITION.regions.find(candidate=>candidate.id===zone);
    if(region){const [x,y]=xz(region.center[0],region.center[1]);setTarget(clampView({cx:x,cy:y,zoom:2.5}));}
  };

  // Labels keep a constant on-screen size; lower-priority ones give way when crowded.
  const labels=useMemo(()=>{
    if(compact)return [];
    const requests:LabelRequest[]=[];
    // Districts (Chalakkudy East, Riverfront) are smaller and give way to town names.
    for(const city of GEOMETRY.cities)requests.push({id:`city-${city.id}`,text:city.label.toUpperCase(),x:city.at[0],y:city.at[1],fontSize:(city.district?10:city.tier==='A'?15:city.tier==='B'?13:12)*k,offset:0,priority:city.district?85:100,centered:true});
    for(const area of GEOMETRY.areas)requests.push({id:`area-${area.id}`,text:translate(`area.${area.id}` as TranslationKey,locale),x:area.label[0],y:area.label[1],fontSize:12*k,offset:0,priority:90,centered:true});
    if(GEOMETRY.teaCentre)requests.push({id:'area-tea-estate',text:TEA_ESTATE.label,x:GEOMETRY.teaCentre[0],y:GEOMETRY.teaCentre[1],fontSize:11*k,offset:0,priority:88,centered:true});
    for(const h of GEOMETRY.highlights){const [x,y]=point(h.position);requests.push({id:`hl-${h.id}`,text:h.label,x,y,fontSize:9.5*k,offset:7*k,priority:h.kind==='stadium'||h.kind==='paragliding'?80:70});}
    for(const l of LANDMARKS){if(GEOMETRY.doubled.has(l.id))continue;const [x,y]=point(l.position);requests.push({id:`lm-${l.id}`,text:localizedMapPlace(l.id,locale),x,y,fontSize:9*k,offset:6*k,priority:visited.includes(l.id)?60:55});}
    const pin=(owner:string,[x,y]:[number,number])=>({owner,pin:true,x0:x-7*k,y0:y-7*k,x1:x+7*k,y1:y+7*k});
    const obstacles=[...GEOMETRY.highlights.map(h=>pin(`hl-${h.id}`,point(h.position))),...LANDMARKS.map(l=>pin(`lm-${l.id}`,point(l.position)))];
    return layoutLabels(requests,obstacles);
  },[k,locale,visited,compact]);

  const b=viewBoxOf(view);
  const [wx,wy]=waypoint?point(waypoint):[0,0];
  const waypointBearing=waypoint?bearingToWaypoint(player.position,waypoint):0;
  const waypointDistance=waypoint?distanceToWaypoint(player.position,waypoint):0;
  const scaleMetres=[50,100,200,500].find(m=>m*UNIT*zoom>=45)??500;
  const idPrefix=compact?'mini':'full';
  const cityVisible=(tier:string)=>!compact||tier==='A';

  return <div className={compact?'map-compact':'atlas-layout'}>
    <div className="atlas-sheet">
      {!compact&&<div className="atlas-sheet-heading"><span>KERALA · FIELD ATLAS</span><span><ArrowUp size={14}/> N</span></div>}
      <svg ref={svgRef} className={`atlas-drawing ${compact?'':'is-interactive'}`} style={compact?undefined:{aspectRatio:`${W}/${H}`}} viewBox={compact?`${b.x} ${b.y} ${b.width} ${b.height}`:FULL_VIEWBOX} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="img" aria-label={`North-up map from ${localizedRegion('kodassery',locale)} through ${localizedRegion('kadambode',locale)}, across ${localizedRegion('kurumali',locale)} to ${localizedRegion('kodaly',locale)}.`}>
        <defs>
          <pattern id={`${idPrefix}-forest`} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2.5" r="1.25" fill="#3f6f3c" opacity=".35"/><circle cx="5.5" cy="6" r="1" fill="#3f6f3c" opacity=".28"/></pattern>
          <pattern id={`${idPrefix}-streets`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 4.5H9M4.5 0V9" stroke="#fffaf0" strokeWidth=".9" opacity=".75"/></pattern>
          <radialGradient id={`${idPrefix}-vignette`} cx="50%" cy="50%" r="75%"><stop offset="70%" stopColor="#23402f" stopOpacity="0"/><stop offset="100%" stopColor="#23402f" stopOpacity=".16"/></radialGradient>
          <filter id={`${idPrefix}-soft`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".6"/></filter>
        </defs>
        <rect width={W} height={H} fill="#a4cbc5"/>
        {relief?<image href={relief.url} x="0" y="0" width={W} height={H} preserveAspectRatio="none" style={{imageRendering:'auto'}}/>:<>
          <rect x={xz(-78,-499)[0]} y={xz(-78,-499)[1]} width={xz(83,90)[0]-xz(-78,-499)[0]} height={xz(83,90)[1]-xz(-78,-499)[1]} fill="#b3d08f"/>
          <rect x="0" y="0" width={xz(-78,0)[0]} height={GEOMETRY.shore[1]} fill="#9cc27f"/>
        </>}
        {/* Forest and summit areas. */}
        {GEOMETRY.areas.map(area=><path key={area.id} d={area.d} fill={area.id==='kodassery-summit'?'none':`url(#${idPrefix}-forest)`} stroke="#4f7a47" strokeWidth={1.2*k} strokeDasharray={`${4*k} ${3*k}`} opacity=".85"/>)}
        {/* Towns read as built-up districts. */}
        {GEOMETRY.cities.filter(c=>cityVisible(c.tier)).map(city=><g key={city.id}>
          <rect {...city.rect} rx={Math.min(city.rect.width,city.rect.height)*.18} fill="#eadcbc" stroke="#b99c6c" strokeWidth={1.3*k} opacity=".92"/>
          <rect {...city.rect} rx={Math.min(city.rect.width,city.rect.height)*.18} fill={`url(#${idPrefix}-streets)`} opacity=".9"/>
        </g>)}
        {/* Football ground: levelled pad and a marked pitch. */}
        <g transform={`translate(${GEOMETRY.pitch.x} ${GEOMETRY.pitch.y}) rotate(${GEOMETRY.pitch.deg})`}>
          <rect x={-GEOMETRY.pitch.padW/2} y={-GEOMETRY.pitch.padH/2} width={GEOMETRY.pitch.padW} height={GEOMETRY.pitch.padH} rx="2" fill="#d9d2bd" stroke="#a39776" strokeWidth={.8*k}/>
          <rect x={-GEOMETRY.pitch.w/2} y={-GEOMETRY.pitch.h/2} width={GEOMETRY.pitch.w} height={GEOMETRY.pitch.h} fill="#5fa04a" stroke="#f7f7f0" strokeWidth=".5"/>
          <path d={`M${-GEOMETRY.pitch.w/2} 0H${GEOMETRY.pitch.w/2}`} stroke="#f7f7f0" strokeWidth=".4"/>
          <circle r={GEOMETRY.pitch.w*.14} fill="none" stroke="#f7f7f0" strokeWidth=".4"/>
        </g>
        {/* Peringalkuthu Tea Estate. */}
        {GEOMETRY.tea.map((d,i)=><path key={`tea${i}`} d={d} fill="none" stroke="#5d8f3c" strokeWidth={Math.max(1.4*UNIT,.6*k)} strokeLinecap="round" opacity=".85"/>)}
        {/* Nedumbassery's runway, apron and taxiways, with the runway centreline. */}
        {GEOMETRY.airfield.map(s=><rect key={s.id} x={s.x} y={s.y} width={s.width} height={s.height} fill={s.color} stroke="#6f6a5c" strokeWidth={.5*k}/>)}
        <path d={`M${GEOMETRY.runway.x+4*k} ${GEOMETRY.runway.y+GEOMETRY.runway.height/2}H${GEOMETRY.runway.x+GEOMETRY.runway.width-4*k}`} stroke="#f4f3ee" strokeWidth={.8*k} strokeDasharray={`${4*k} ${4*k}`}/>
        {/* Rivers. */}
        {GEOMETRY.streams.map((d,i)=><path key={`s${i}`} d={d} fill="#7cb8c4" stroke="#4f8f98" strokeWidth={.8*k}/>)}
        {GEOMETRY.rivers.map((d,i)=><path key={i} d={d} fill="#7cb8c4" stroke="#4f8f98" strokeWidth={1*k} strokeLinejoin="round"/>)}
        {!compact&&GEOMETRY.riverNames.map(r=><g key={r.id}><path id={`${idPrefix}-river-${r.id}`} d={r.d} fill="none" stroke="#c9ebec" strokeWidth={.9*k} strokeDasharray={`${6*k} ${9*k}`} opacity=".8"/>
          <text fontSize={8.5*k} fill="#1f5d68" fontStyle="italic" letterSpacing={.6*k} stroke="#cde9ea" strokeWidth={2*k} paintOrder="stroke"><textPath href={`#${idPrefix}-river-${r.id}`} startOffset="50%" textAnchor="middle">{r.label}</textPath></text></g>)}
        {/* Roads: casing, then fill; foot trails dashed on top. */}
        {GEOMETRY.roads.map(r=><path key={`c${r.id}`} d={r.d} fill="none" stroke="#8d7a58" strokeWidth={Math.max(r.width*UNIT+1.6*k,2.6*k)} strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>)}
        {GEOMETRY.roads.map(r=><path key={`f${r.id}`} d={r.d} fill="none" stroke="#fbf1d4" strokeWidth={Math.max(r.width*UNIT,1.4*k)} strokeLinecap="round" strokeLinejoin="round"/>)}
        {GEOMETRY.trails.map(r=><path key={r.id} d={r.d} fill="none" stroke="#9c5a43" strokeWidth={1.3*k} strokeDasharray={`${3*k} ${2.5*k}`} strokeLinecap="round"/>)}
        <path d={`M${GEOMETRY.bridge.a.join(' ')}L${GEOMETRY.bridge.b.join(' ')}`} stroke="#6f5434" strokeWidth={Math.max(4*UNIT+1.2*k,3*k)}/>
        <path d={`M${GEOMETRY.bridge.a.join(' ')}L${GEOMETRY.bridge.b.join(' ')}`} stroke="#cfae78" strokeWidth={Math.max(4*UNIT,2*k)}/>
        {/* Buildings with their roof colours. */}
        {GEOMETRY.buildings.map(bd=><rect key={bd.id} x={bd.px-bd.w/2} y={bd.py-bd.h/2} width={bd.w} height={bd.h} rx=".6" transform={bd.deg?`rotate(${bd.deg} ${bd.px} ${bd.py})`:undefined} fill={bd.roof} stroke="#5d3f2c" strokeWidth={.35*k}/>)}
        {!compact&&<rect x={b.x} y={b.y} width={b.width} height={b.height} fill={`url(#${idPrefix}-vignette)`} pointerEvents="none"/>}
        {/* Highlighted spots. */}
        {GEOMETRY.highlights.map(h=>{const [x,y]=point(h.position),style=HIGHLIGHT_STYLE[h.kind];return <Pin key={h.id} x={x} y={y} r={(compact?4.5:6.5)*k*(compact?2.2:1)} color={style.color} fill={style.color} icon={highlightIcons[h.kind]} iconColor="#fffaf0" pulse={!compact}/>;})}
        {LANDMARKS.map(l=>{const [x,y]=point(l.position),seen=visited.includes(l.id);return <Pin key={l.id} x={x} y={y} r={(compact?4:5.5)*k*(compact?2.2:1)} color="#2f5a3e" fill={seen?'#2f5a3e':'#fbf3d9'} icon={landmarkIcons[l.iconId]??MapPin} iconColor={seen?'#fbf3d9':'#2f5a3e'}/>;})}
        {npcs?.map(n=>{const [x,y]=point(n.position),def=NPC_DEFINITIONS[n.id];return <Pin key={n.id} x={x} y={y} r={(compact?4:5.5)*k*(compact?2.2:1)} color={def.horn} fill={def.skin} icon={npcPinIcon(n.id)} iconColor={def.skin}/>;})}
        {/* City names, area names and pin labels. */}
        {compact&&GEOMETRY.cities.filter(c=>cityVisible(c.tier)).map(city=><text key={city.id} x={city.at[0]} y={city.at[1]} fontSize={13*k*2.2} fontWeight="700" textAnchor="middle" fill="#5b4526" stroke="#f6eed8" strokeWidth={2.5*k*2.2} paintOrder="stroke" letterSpacing={1.5*k}>{city.label.toUpperCase()}</text>)}
        {labels.map(label=>{
          const city=label.id.startsWith('city-'),area=label.id.startsWith('area-'),highlight=label.id.startsWith('hl-');
          return <text key={label.id} x={label.x} y={label.y} fontSize={label.fontSize} textAnchor={label.anchor} fontFamily={city||area?"'Noto Serif', serif":undefined} fontWeight={city?700:highlight?600:500} fontStyle={area?'italic':undefined} letterSpacing={city?label.fontSize*.18:undefined} fill={city?'#5b4526':area?'#2d5a3c':highlight?'#3b2a1a':'#2c4a36'} stroke="#f8f1dc" strokeWidth={label.fontSize*.28} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">{label.text}</text>;
        })}
        {waypoint&&<g transform={`translate(${wx} ${wy}) scale(${k})`}><circle r="11" fill="#d5aa54" opacity=".25"/><circle r="10" fill="none" stroke="#996035" strokeWidth="1.5"/><path d="M0 7V-12L10-8 0-3" stroke="#996035" fill="#d5aa54" strokeWidth="1.5"/></g>}
        {waypoint&&<path d={`M${px} ${py}L${wx} ${wy}`} stroke="#996035" strokeWidth={1.1*k} strokeDasharray={`${4*k} ${3*k}`} opacity=".7"/>}
        <g transform={`translate(${px} ${py}) rotate(${player.headingRad*180/Math.PI}) scale(${compact?k*2.2:k})`}>
          <path d="M0 0L-9 -20A22 22 0 0 1 9 -20Z" fill="#fff7e5" opacity=".35"/>
          <circle r="8" fill="#fff7e5" stroke="#294f3d" strokeWidth="1.2"/><path d="M0 -6 4.5 4.5 0 2.2 -4.5 4.5Z" fill="#294f3d"/>
        </g>
        {!compact&&<g transform={`translate(${b.x+10*k} ${b.y+b.height-14*k})`} pointerEvents="none">
          <rect x={-4*k} y={-11*k} width={scaleMetres*UNIT+22*k} height={17*k} rx={3*k} fill="#fbf3dccc"/>
          <path d={`M0 0H${scaleMetres*UNIT}M0 ${-3*k}V${3*k}M${scaleMetres*UNIT} ${-3*k}V${3*k}`} stroke="#2c4a36" strokeWidth={1.2*k}/>
          <text x={scaleMetres*UNIT+4*k} y={3*k} fontSize={8*k} fill="#2c4a36">{scaleMetres} m</text>
        </g>}
      </svg>
      {!compact&&<><div className="map-tools"><button className="icon-button" aria-label="Zoom out" disabled={target.zoom<=MIN_ZOOM} onClick={()=>zoomAt(1/1.6)}><Minus size={17}/></button><span>{target.zoom.toFixed(1)}×</span><button className="icon-button" aria-label="Zoom in" disabled={target.zoom>=MAX_ZOOM} onClick={()=>zoomAt(1.6)}><Plus size={17}/></button><button className="icon-button" aria-label="Centre on me" onClick={()=>focusOn(player.position,3)}><Crosshair size={17}/></button></div>
        <p className="map-note">{translate('map.dragHint',locale)}</p>
        {waypoint&&<p className="map-note" aria-live="polite">{Math.round(waypointDistance)} m · {Math.round((waypointBearing*180/Math.PI+360)%360)}° {translate('map.bearing',locale)}</p>}</>}
    </div>
    {!compact&&<div className="atlas-details"><span className="small-label">KERALA, CIRCA 2000</span><h3>{translate('map.fromHills',locale)}</h3><p>{translate('map.description',locale)}</p>
      <div className="map-region-filter" role="group" aria-label={translate('map.showRegion',locale)}><button aria-pressed={filter==='all'} onClick={()=>focusRegion('all')}>{translate('map.allPlaces',locale)}</button>{WORLD_REGIONS.map(r=><button key={r.id} aria-pressed={filter===r.id} onClick={()=>focusRegion(r.id as ZoneId)}>{localizedRegion(r.id,locale)}</button>)}</div>
      <h4 className="map-section-title">{translate('map.highlights',locale)}</h4>
      <div className="highlight-list">{GEOMETRY.highlights.map((h:Highlight)=>{const IconComponent=highlightIcons[h.kind],style=HIGHLIGHT_STYLE[h.kind];return <button key={h.id} className={waypoint?.[0]===h.position[0]&&waypoint?.[2]===h.position[2]?'selected':''} onClick={()=>{onWaypoint(h.position);focusOn(h.position);}} style={{'--spot':style.color} as CSSProperties}><span className="highlight-icon"><IconComponent size={16} weight="bold"/></span><span><strong>{h.label}</strong><small>{translate(style.key,locale)} · {Math.round(distanceToWaypoint(player.position,h.position))} m</small></span></button>;})}</div>
      <h4 className="map-section-title">{translate('map.cities',locale)}</h4>
      <div className="city-chips">{GEOMETRY.cities.map(city=><button key={city.id} onClick={()=>{const position:Vec3=[city.center[0],elevation(city.center[0],city.center[1]),city.center[1]];onWaypoint(position);focusOn(position,2);}}><Buildings size={14}/> {city.label}</button>)}</div>
      <h4 className="map-section-title">{translate('map.allPlaces',locale)}</h4>
      <div className="landmark-list">{shown.map(l=>{const IconComponent=landmarkIcons[l.iconId]??MapPin;return <button key={l.id} className={waypoint?.[0]===l.position[0]&&waypoint?.[2]===l.position[2]?'selected':''} onClick={()=>{onWaypoint(l.position);focusOn(l.position);}}><span className="landmark-icon"><IconComponent size={20}/></span><span><strong>{localizedPlace(l.id,locale)}</strong><small>{visited.includes(l.id)?translate('map.discovered',locale):translate('map.unexplored',locale)}</small></span><ArrowUpRight size={18}/></button>;})}</div>
      {waypoint&&<button className="text-button" onClick={()=>onWaypoint(null)}>{translate('map.clearWaypoint',locale)}</button>}
      <div className="map-legend"><span><i/> {translate('map.discovered',locale)}</span><span><i className="unvisited"/> {translate('map.unexplored',locale)}</span><span><i className="highlight"/> {translate('map.highlights',locale)}</span><span><i className="city"/> {translate('map.cities',locale)}</span><span><FlagPennant size={14}/> {translate('map.legendWaypoint',locale)}</span><span className="trail">┄ {translate('bicycle.walkOnly',locale)}</span></div>
      <div className="world-preview"><Compass size={24}/><div><strong>{getAreaAt(player.position[0],player.position[2])?translate(`area.${getAreaAt(player.position[0],player.position[2])}` as TranslationKey,locale):localizedRegion(getZoneAtPosition(player.position[0],player.position[2]),locale)}</strong><p>{visited.length} of {LANDMARKS.length} places discovered.<br/>Select a landmark for a bearing, then find your own way.</p></div></div>
    </div>}
  </div>;
}

