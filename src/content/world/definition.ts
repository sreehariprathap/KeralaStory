import { createExpansionGround } from './expansionGround';
import { createV2Layout } from './v2Layout';
import { createChalakkudyStreet } from './townLayout';
import { createExpansionPlaces } from './expansionPlaces';
import { createV2Places } from './v2Places';
import { SNEHA_THEERAM, isSnehaSea } from './snehaTheeram';
import type { ExpansionLayout } from '../../contracts/worldExpansion';
import { createExpansionLayout, areaAt, pointInPolygon } from './expansionLayout';
import type { Landmark, MapBounds, TravelMode, Vec3, ZoneId } from '../../contracts';

export const WORLD_VERSION = 'kodassery-diaries-v2-chalakkudy-city-1';
export const ORIGINAL_WORLD_BOUNDS: MapBounds = { xMin: -78, xMax: 88, zMin: -484, zMax: 92 };
const PRE_V2_BOUNDS: MapBounds = { xMin: -680, xMax: 96.5, zMin: -740, zMax: 92 };
let activeGround: ReturnType<typeof createExpansionGround> | undefined;
// Legacy API name now denotes the complete connected prototype.
export const KODASSERY_BOUNDS: MapBounds = { xMin:-64,xMax:64,zMin:-484,zMax:-334 };
export const WATER_LEVEL = 8;
export const BRIDGE_X = 12;
export const BRIDGE_DECK_Y = 15;
export const BRIDGE_NORTH_Z = -134;
export const BRIDGE_SOUTH_Z = -64;
export function riverCenter(x:number){return -100+Math.sin(x*.025)*5;}
export const RIVER_CENTERLINE:[number,number][]=Array.from({length:33},(_,i)=>{const x=-100+i*6.25;return [x,riverCenter(x)];});
export function isRiver(x:number,z:number){return x>=-100 && x<=100 && Math.abs(z-riverCenter(x))<21;}
export function waterLevelAt(x:number,z:number):number|null {
  const surface=EXPANSION_GROUND.v2?.river.surfaceAt(x,z);
  if(surface!=null)return surface;
  const water=EXPANSION_LAYOUT.waterBodies.find(w=>w.id==='chokkana-stream-water'&&pointInPolygon(x,z,w.footprint));
  if(water)return water.surfaceY;
  if(isSeaAt(x,z))return WATER_LEVEL;
  return isRiver(x,z)||(x>=-78 && z>=-499 && (z>90||x>83)) ? WATER_LEVEL : null;
}
export function isWater(x:number,z:number){return waterLevelAt(x,z)!==null;}
/** Open sea west of the original world: Sneha Theeram's bay and the coast on toward the river mouth. */
export function isSeaAt(x:number,z:number){return x>=WORLD_BOUNDS.xMin && z<=WORLD_BOUNDS.zMax && isSnehaSea(x,z);}
/** Water surface a body at `feetY` is in, or null. A bridge or pier only keeps you dry while you stand on it, not beneath it. */
export function openWaterSurfaceAt(x:number,z:number,feetY:number):number|null{
  const deck=walkableDeckHeight(x,z);
  return deck!==null&&feetY>=deck-.5?null:waterLevelAt(x,z);
}
/** Surface current in m/s at a water point; still water (sea, ponds) has none. */
export function waterFlowAt(x:number,z:number):{x:number;z:number}{
  if(!isWater(x,z))return {x:0,z:0};
  return EXPANSION_GROUND.v2?.river.flowAt(x,z) ?? {x:0,z:0};
}
export function originalTerrainHeight(x:number,z:number):number{
  // Where the upland meets the village slope at z = -334 the grade steepens abruptly; a 24 m vertical
  // curve eases one into the other so the village road has no crest to launch a car.
  const z0=-334,d=12;
  if(Math.abs(z-z0)<d){
    const h0=rawOriginalTerrainHeight(x,z0),k1=(h0-rawOriginalTerrainHeight(x,z0-.5))/.5,k2=(rawOriginalTerrainHeight(x,z0+.5)-h0)/.5;
    return h0+k1*(z-z0)+(k2-k1)*(z-z0+d)**2/(4*d);
  }
  return rawOriginalTerrainHeight(x,z);
}
function rawOriginalTerrainHeight(x:number,z:number):number{
  if(z<=-334)return 76-(z+458)*.105+Math.sin(x*.065)*1.3+Math.sin((z+458)*.045)*.65;
  const hill=(z+334)/204;
  if(z<-130){const a=76-124*.105+Math.sin(x*.065)*1.3+Math.sin(124*.045)*.65;return a+(16-a)*hill+Math.sin(hill*Math.PI)*Math.sin(x*.04)*1.5;}
  const d=Math.abs(z-riverCenter(x));
  if(d<21)return 3.5;
  if(z<-64){
    const bank=3.5+Math.min(1,(d-21)/8)*12.5;
    // The south bank is notched under the wooden bridge so its deck runs clear onto the south ramp.
    const notch=(1-Math.max(0,Math.min(1,(Math.abs(x-BRIDGE_X)-3)/3)))*(z>-80?1:0);
    return notch>0?Math.min(bank,bank*(1-notch)+(BRIDGE_DECK_Y-.25)*notch):bank;
  }
  const city=Math.max(0,Math.min(1,(z+64)/156));
  const natural=14-city*8+Math.sin(x*.03)*.3;
  // South approach embankment: the road off the wooden bridge falls at 7% from deck level to the town.
  if(z<-40){
    const target=BRIDGE_DECK_Y-.1-(z+64)*.07, side=Math.abs(x-BRIDGE_X-Math.max(0,(z+55)/7)*4);
    const w=(1-Math.max(0,Math.min(1,(side-5)/6)))*Math.max(0,Math.min(1,(-40-z)/4));
    if(w>0&&target>natural)return natural+(target-natural)*w*w*(3-2*w);
  }
  return natural;
}
export function getZoneAt(z:number):ZoneId{return z<-334?'kodassery':z<-139?'kadambode':z<-62?'kurumali':'kodaly';}
export function terrainHeight(x:number,z:number):number { return (x>=-15&&z>=-481) ? originalTerrainHeight(x,z) : activeGround?.heightAt(x,z) ?? originalTerrainHeight(x,z); }
const authoredLayout = createExpansionLayout({
  junction: [-7, originalTerrainHeight(-7, -446), -446],
  panoramaTargets: [[18, originalTerrainHeight(18,-415)+12,-415], [50,originalTerrainHeight(50,-386)+16,-386], [-21,originalTerrainHeight(-21,-288),-288], [25,originalTerrainHeight(25,-238)+7,-238], [12,15,-99], [65,originalTerrainHeight(65,54)+20,54]],
});
const kodalyCenter:Vec3=[27,originalTerrainHeight(27,-19),-19];
export const V2_LAYOUT = createV2Layout({
  expansion: authoredLayout,
  existingBounds: PRE_V2_BOUNDS,
  legacyRiver: RIVER_CENTERLINE.map(([x,z])=>[x,WATER_LEVEL,z]),
  kodalyCenter,
  // On the village road between the tea shop and the Kurumali bridge approach.
  villageRoadJoin:[11.41,originalTerrainHeight(11.41,-165),-165],
  parkRoadJoin:[0,originalTerrainHeight(0,-481),-481],
});
export const WORLD_BOUNDS:MapBounds={...V2_LAYOUT.bounds};
export const SLICE_BOUNDS=WORLD_BOUNDS;
export const EXPANSION_GROUND=createExpansionGround(authoredLayout,originalTerrainHeight,V2_LAYOUT);
activeGround=EXPANSION_GROUND;
/** Onto a deck only when the authored height is at deck level: paths and viewpoints passing under a span keep the ground. */
const grounded = (p:Vec3):Vec3 => { const deck=EXPANSION_GROUND.deckHeightAt(p[0],p[2]); return [p[0],deck!==null&&Math.abs(deck-p[1])<3?deck:terrainHeight(p[0],p[2]),p[2]]; };
/** Coordinates are sampled from the same triangle arrays used by Rapier and rendering. */
export const EXPANSION_LAYOUT:ExpansionLayout = {
  ...authoredLayout,
  waterBodies:[...authoredLayout.waterBodies,EXPANSION_GROUND.streamWater],
  anchors:authoredLayout.anchors.map(a=>({...a,position:grounded(a.position)})),
  routes:authoredLayout.routes.map(r=>({...r,points:r.points.map(grounded)})),
  summitPosition:grounded(authoredLayout.summitPosition),
};
export const EXPANSION_REST_SHELVES=EXPANSION_GROUND.restShelves.map(grounded);
export const V2_ROUTES=EXPANSION_GROUND.v2!.routes.map(route=>({...route,points:route.points.map(grounded)}));
export const CHALAKKUDY_STREET=createChalakkudyStreet(V2_LAYOUT.towns.find(t=>t.id==='chalakkudy')!.center,EXPANSION_GROUND.chunks.find(c=>c.id==='expansion-west')!);
export function hasGroundAt(x:number,z:number):boolean {
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  return (x>=-78&&x<=88&&z>=-499&&z<=92) || EXPANSION_GROUND.heightAt(x,z)!==null;
}
export function getAreaAt(x: number, z: number) { return areaAt(EXPANSION_LAYOUT, x, z); }
export function getZoneAtPosition(x: number, z: number): ZoneId {
  const town=V2_LAYOUT.towns.find(t=>pointInPolygon(x,z,t.footprint)||t.districts?.some(d=>pointInPolygon(x,z,d.footprint)));
  return town?.regionId ?? (getAreaAt(x,z) ? 'kodassery' : getZoneAt(z));
}
export const SPAWN:Vec3=[0,terrainHeight(0,-460)+.05,-460];
export const KODASSERY_PATH:[number,number][]=[[0,-481],[0,-460],[-7,-446],[-9,-429],[0,-413],[9,-399],[6,-384],[-3,-371],[0,-349],[0,-334]];
export const VILLAGE_PATH:[number,number][]=[[0,-334],[8,-313],[11,-286],[2,-260],[-6,-238],[0,-211],[10,-184],[12,-157],[12,-134]];
// Kodaly Banyan circle (kodalyCircle.ts, centre 28,-18): the city road loops the island's west side on the carriageway midline.
const KODALY_LOOP:[number,number][]=(()=>{const from=Math.atan2(-48+18,16-28)+Math.PI*2,to=Math.atan2(21+18,30-28);return Array.from({length:7},(_,i)=>{const a=from+(to-from)*i/6;return [28+Math.cos(a)*19.5,-18+Math.sin(a)*19.5] as [number,number];});})();
export const CITY_PATH:[number,number][]=[[12,-64],[12,-55],[16,-48],...KODALY_LOOP,[30,21],[38,43],[36,58],[47,68],[47,88]];
export const MAIN_PATH:[number,number][]=[...KODASSERY_PATH,...VILLAGE_PATH.slice(1),[12,-64],...CITY_PATH.slice(1)];
export const BRIDGE_PATH:[number,number][]=[[12,-134],[12,-64]];
const LEGACY_LANDMARKS:Landmark[]=[
  {id:'origin',zoneId:'kodassery',label:'The first overlook',position:SPAWN,discoveryRadiusM:7,iconId:'mountain',description:'A quiet beginning, above the clouds.'},
  {id:'canopy',zoneId:'kodassery',label:'Canopy homestead',position:[18,terrainHeight(18,-415)+3,-415],discoveryRadiusM:12,iconId:'house',description:'Timber homes held in the arms of the forest.'},
  {id:'waterfall',zoneId:'kodassery',label:'Silverthread falls',position:[31,terrainHeight(31,-386),-386],discoveryRadiusM:11,iconId:'waves',description:'Follow the sound of water through the leaves.'},
  {id:'paddy',zoneId:'kadambode',label:'Kadambode paddy fields',position:[-21,terrainHeight(-21,-288),-288],discoveryRadiusM:16,iconId:'plant',description:'Green paddy, coconut shade, and narrow earthen bunds.'},
  {id:'spice-garden',zoneId:'kadambode',label:'Kadambode spice garden',position:[-8,terrainHeight(-8,-226),-226],discoveryRadiusM:9,iconId:'plant',description:'Pepper vines and cardamom beside the village path.'},
  {id:'temple',zoneId:'kadambode',label:'Kadambode temple',position:[16,terrainHeight(25,-238)+.04,-238],discoveryRadiusM:15,iconId:'temple',description:'Clay tiles, a brass lamp, and a quiet village courtyard.'},
  {id:'tea-shop',zoneId:'kadambode',label:'Rajan’s tea shop',position:[-10,terrainHeight(-10,-194),-194],discoveryRadiusM:11,iconId:'tea',description:'Steel tumblers, a bench under the awning, and time for one more chaya.'},
  {id:'river-bridge',zoneId:'kurumali',label:'Kurumali wooden bridge',position:[12,BRIDGE_DECK_Y,-99],discoveryRadiusM:13,iconId:'bridge',description:'The river separates the village from the harbor road.'},
  {id:'fishing-bank',zoneId:'kurumali',label:'Kurumali fishing bank',position:[-18,terrainHeight(-18,-66),-66],discoveryRadiusM:12,iconId:'boat',description:'Wooden vallams rest beside the blue-green water.'},
  {id:'market',zoneId:'kodaly',label:'Kodaly bazaar',position:kodalyCenter,discoveryRadiusM:16,iconId:'shop',description:'Hand-painted boards, tiled shopfronts, and the familiar bend in the tar road.'},
  {id:'lighthouse',zoneId:'kodaly',label:'Kodaly lighthouse',position:[65,terrainHeight(65,54),54],discoveryRadiusM:13,iconId:'lighthouse',description:'A red-and-white landmark watching over the coast.'},
  {id:'harbor',zoneId:'kodaly',label:'Kodaly harbor',position:[48,terrainHeight(48,77),77],discoveryRadiusM:16,iconId:'anchor',description:'From the misty hills to the sea. Stay a while.'},
];
const v2Grounded = (id: string, zoneId: ZoneId, x: number, z: number): { id: string; zoneId: ZoneId; position: Vec3 } => ({
  id, zoneId, position: [x, (EXPANSION_GROUND.deckHeightAt(x, z) ?? terrainHeight(x, z)) + 0.05, z],
});
/** Canonical discovery catalogue: legacy places remain stable, followed by expansion and V2 places. */
export const LANDMARKS: Landmark[] = createV2Places({
  legacy: [...LEGACY_LANDMARKS, ...createExpansionPlaces(EXPANSION_LAYOUT)],
  // Kodaly already has the stable market/harbor landmarks; add only the three new town records.
  towns: V2_LAYOUT.towns.filter(town => !town.existing).map(town => v2Grounded(town.id, town.regionId, town.center[0], town.center[2])),
  silverStorm: v2Grounded('silver-storm', 'kodassery', V2_LAYOUT.park.center[0], V2_LAYOUT.park.center[2]),
  fuelStation: v2Grounded('chalakkudy-fuel', 'kadambode', -372, -132),
  coffeeShop: v2Grounded('chalakkudy-coffee', 'kadambode', -414, -120),
  malakkapparaTeaStop: v2Grounded('malakkappara-tea', 'kodassery', -532, -642),
  // Set back from the wall's downstream face and buttress, on clear ground with a full view of the dam.
  chalakudyDam: v2Grounded('chalakudy-dam', 'kodassery', -645, -778),
  // Beside the terminal's forecourt, where the airport road ends.
  airport: v2Grounded('nedumbassery-airport', 'kodaly', -612, 93),
  beach: v2Grounded('sneha-theeram', 'kodaly', SNEHA_THEERAM.landmark[0], SNEHA_THEERAM.landmark[1]),
});
export const WORLD_REGIONS=[
  {id:'kodassery',name:'Kodassery Peaks',subtitle:'Misty canopy trails',number:'01',available:true},
  {id:'kadambode',name:'Kadambode',subtitle:'Paddy fields & a temple village',number:'02',available:true},
  {id:'kurumali',name:'Kurumali Puzha',subtitle:'The river crossing',number:'03',available:true},
  {id:'kodaly',name:'Kodaly',subtitle:'Shops, harbor & sea',number:'04',available:true},
];

/** Deck footprints match the existing physical colliders (meters, feet heights). */
export const BRIDGE_BOUNDS: MapBounds = { xMin: BRIDGE_X - 2, xMax: BRIDGE_X + 2, zMin: BRIDGE_NORTH_Z, zMax: BRIDGE_SOUTH_Z };
export const JETTY_BOUNDS: MapBounds = { xMin: 77.5, xMax: 96.5, zMin: 74.25, zMax: 77.75 };
export const QUAY_BOUNDS: MapBounds = {xMin:43,xMax:81,zMin:72,zMax:86};
export const QUAY_DECK_Y=terrainHeight(48,77);
export const QUAY_SOUTH_RAMP={x:47,landZ:89,deckZ:85,landY:terrainHeight(47,89)+.03};
export const JETTY_DECK_Y = WATER_LEVEL + 0.5;
export const JETTY_RAMP = { landX: 70, deckX: 77.5, landY: Math.max(terrainHeight(48,77),terrainHeight(70,76)) + 0.03, zMin:74.25, zMax:77.75 };
// The terrain envelope stays unchanged; maps include the authored pier extension.
export const MAP_BOUNDS: MapBounds = { ...WORLD_BOUNDS, xMax: Math.max(WORLD_BOUNDS.xMax,JETTY_BOUNDS.xMax) };
export const COASTLINE: [number, number][] = [[83, ORIGINAL_WORLD_BOUNDS.zMin], [83, 90], [ORIGINAL_WORLD_BOUNDS.xMin, 90]];
/**
 * The wooden bridge's approach ramps. Each starts flat on the deck (`deckZ`) and eases into the bank's own
 * grade at `landZ` along a cubic vertical curve, so neither end has a kink for a fast car to bounce over.
 */
export const BRIDGE_RAMPS = [
  { deckZ: BRIDGE_NORTH_Z + 26, landZ: BRIDGE_NORTH_Z - 12 },
  { deckZ: BRIDGE_SOUTH_Z, landZ: BRIDGE_SOUTH_Z + 9 },
].map(ramp => {
  const landY = terrainHeight(BRIDGE_X, ramp.landZ) + 0.07, rise = landY - BRIDGE_DECK_Y, length = Math.abs(ramp.landZ - ramp.deckZ);
  const away = Math.sign(ramp.landZ - ramp.deckZ), bankGrade = (terrainHeight(BRIDGE_X, ramp.landZ + away * 2) - terrainHeight(BRIDGE_X, ramp.landZ)) / 2;
  // f(t) = a t² + b t³: flat at the deck, meeting the bank at its own slope.
  const endSlope = Math.max(.3, Math.min(2.5, bankGrade * length / (rise || 1)));
  return { ...ramp, landY, curve: { a: 3 - endSlope, b: endSlope - 2 } };
});
export function bridgeRampHeight(ramp: typeof BRIDGE_RAMPS[number], t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return BRIDGE_DECK_Y + (ramp.landY - BRIDGE_DECK_Y) * (ramp.curve.a * u * u + ramp.curve.b * u * u * u);
}

export function containsPoint(bounds: MapBounds, x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.xMin && x <= bounds.xMax && z >= bounds.zMin && z <= bounds.zMax;
}

/** Highest authored elevated surface, excluding terrain and decorative geometry. */
export function walkableDeckHeight(x: number, z: number): number | null {
  let height: number | null = containsPoint(JETTY_BOUNDS, x, z) ? JETTY_DECK_Y : EXPANSION_GROUND.deckHeightAt(x,z);
  const townDeck=CHALAKKUDY_STREET.deckHeightAt(x,z);
  if(townDeck!==null)height=Math.max(height??-Infinity,townDeck);
  if (containsPoint(QUAY_BOUNDS,x,z)) height=Math.max(height??-Infinity,QUAY_DECK_Y);
  if (Math.abs(x-QUAY_SOUTH_RAMP.x)<=2 && z>=QUAY_SOUTH_RAMP.deckZ && z<=QUAY_SOUTH_RAMP.landZ) {
    height=Math.max(height??-Infinity,QUAY_DECK_Y+(QUAY_SOUTH_RAMP.landY-QUAY_DECK_Y)*(z-QUAY_SOUTH_RAMP.deckZ)/(QUAY_SOUTH_RAMP.landZ-QUAY_SOUTH_RAMP.deckZ));
  }
  if (x >= JETTY_RAMP.landX && x <= JETTY_RAMP.deckX && z >= JETTY_RAMP.zMin && z <= JETTY_RAMP.zMax) {
    height = JETTY_RAMP.landY + (JETTY_DECK_Y - JETTY_RAMP.landY) * (x - JETTY_RAMP.landX) / (JETTY_RAMP.deckX - JETTY_RAMP.landX);
  }
  if (containsPoint(BRIDGE_BOUNDS, x, z)) height = BRIDGE_DECK_Y;
  if (Math.abs(x - BRIDGE_X) <= 2) {
    for (const ramp of BRIDGE_RAMPS) {
      const t = (z - ramp.deckZ) / (ramp.landZ - ramp.deckZ);
      if (t >= 0 && t <= 1) {
        const rampY = bridgeRampHeight(ramp, t);
        height = Math.max(height ?? -Infinity, rampY);
      }
    }
  }
  return height;
}
export function isOnWalkableDeck(x: number, z: number): boolean {
  return walkableDeckHeight(x, z) !== null;
}

export interface ParkingSpot { id: string; zoneId: ZoneId; position: Vec3; headingRad: number }
const parking = (id: string, x: number, z: number): ParkingSpot => ({ id, zoneId: getZoneAtPosition(x,z), position: [x, Math.max(terrainHeight(x, z), walkableDeckHeight(x, z) ?? -Infinity) + 0.05, z], headingRad: Math.PI });
export const PARKING_SPOTS: ParkingSpot[] = [
  parking('origin-parking', 1.3, -460),
  parking('canopy-parking', 0, -413),
  parking('village-parking', 0, -211),
  parking('north-bank-parking', 12, -149),
  parking('south-bank-parking', 12, -63),
  parking('harbor-parking', 47, 68),
  ...EXPANSION_LAYOUT.anchors.filter(a=>['summit-trailhead','chokkana-entry','chokkana-ridge','chokkana-stream','chokkana-tea-stop','athirappilly-falls'].includes(a.id)).map(a=>parking(`${a.id}-parking`,a.position[0],a.position[2])),
  ...V2_ROUTES.map(route=>{const p=route.points.at(-1)!;return parking(`${route.id}-parking`,p[0],p[2]);}),
];
export const SAFE_SPAWNS = [
  { id: 'origin', zoneId: 'kodassery' as ZoneId, position: SPAWN, headingRad: Math.PI },
  ...PARKING_SPOTS.map(spot => ({ ...spot, id: `${spot.id}-spawn`, position: [...spot.position] as Vec3 })),
  ...EXPANSION_LAYOUT.anchors.filter(a=>['kodassery-summit','athirappilly-lower-view'].includes(a.id)).map(a=>({id:`${a.id}-spawn`,zoneId:'kodassery' as ZoneId,position:[a.position[0],a.position[1]+.05,a.position[2]] as Vec3,headingRad:Math.PI})),
];

export function nearestParking(position: Vec3): ParkingSpot {
  if (!position.every(Number.isFinite)) return PARKING_SPOTS[0];
  return PARKING_SPOTS.reduce((nearest, spot) => {
    const distance = (candidate: ParkingSpot) => Math.hypot(candidate.position[0] - position[0], candidate.position[2] - position[2]);
    return distance(spot) < distance(nearest) ? spot : nearest;
  });
}

/** Normalize a feet-position for restore; callers must still validate collider clearance. */
export function safeGroundPosition(position: Vec3): Vec3 {
  const [x, , z] = position;
  if (position.every(Number.isFinite)) {
    const deckY = walkableDeckHeight(x, z);
    if (deckY !== null) return [x, Math.max(deckY, hasGroundAt(x,z) ? terrainHeight(x, z) : deckY) + 0.05, z];
    if (hasGroundAt(x,z) && !isWater(x,z) && isSafeGroundSlope(x,z)) return [x, terrainHeight(x, z) + 0.05, z];
  }
  return [...nearestParking(position).position];
}

function distanceToSegment(x: number, z: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
/** Restore only dry land with a capsule-sized, walkable surrounding gradient. */
export function isSafeGroundSlope(x:number,z:number):boolean {
  if(!hasGroundAt(x,z))return false;
  const y=terrainHeight(x,z);
  return [[.5,0],[-.5,0],[0,.5],[0,-.5]].every(([dx,dz])=>hasGroundAt(x+dx,z+dz)&&Math.abs(terrainHeight(x+dx,z+dz)-y)<=.5);
}
/** Six-meter original corridor and authored expansion roads, narrowing at the old bridge. */
export function isCycleAllowed(x: number, z: number): boolean {
  if (!hasGroundAt(x,z) || containsPoint(JETTY_BOUNDS,x,z)) return false;
  const route=EXPANSION_GROUND.field(x,z);
  const v2Road=EXPANSION_GROUND.v2?.field(x,z);
  if(route?.footOnly&&route.distance<=route.width&&!(v2Road&&v2Road.distance<=v2Road.width))return false;
  if(route && route.distance<=route.width && !route.footOnly && (!isWater(x,z)||isOnWalkableDeck(x,z)))return true;
  if(v2Road&&v2Road.distance<=v2Road.width&&!isWater(x,z))return true;
  if (isWater(x, z) && !isOnWalkableDeck(x, z)) return false;
  if (z >= BRIDGE_NORTH_Z - 12 && z <= BRIDGE_SOUTH_Z && Math.abs(x - BRIDGE_X) > 1.5) return false;
  return MAIN_PATH.some((point, i) => i > 0 && distanceToSegment(x, z, MAIN_PATH[i - 1], point) <= 3);
}

/** Cars may leave the road ribbons and climb any authored dry terrain. Only
 * unsupported gaps, water and near-vertical terrain are rejected. */
/**
 * True when (x, z) is at least `margin` metres beyond the paved edge (incl. shoulder) of every authored
 * road and trail, and off every bridge deck. Scenery (trees, palms, shrubs, grass) must pass this.
 */
export function isClearOfRoads(x: number, z: number, margin: number): boolean {
  for (const field of [EXPANSION_GROUND.field, EXPANSION_GROUND.v2?.field]) {
    const road = field?.(x, z);
    if (road && road.distance <= road.width + margin) return false;
  }
  for (const [dx, dz] of [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]) if (EXPANSION_GROUND.v2?.bridgeDeckAt(x + dx, z + dz) != null) return false;
  return true;
}
/**
 * The nearest dry spot at least `from` metres from (x, z) that keeps `margin` metres off every road,
 * trail and bridge: where a board, stall or hut beside a landmark should stand. Searches outward in
 * rings; falls back to (x + from, z) if nothing within 30 m is clear.
 */
export function roadsideSpot(x: number, z: number, from = 5, margin = 1.5): Vec3 {
  for (let r = from; r <= 30; r += 1) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2 + r * .37, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (hasGroundAt(px, pz) && !isWater(px, pz) && isClearOfRoads(px, pz, margin)) return [px, terrainHeight(px, pz), pz];
  }
  return [x + from, terrainHeight(x + from, z), z];
}
export function isCarTerrainAllowed(x: number, z: number): boolean {
  return carTerrain(x, z, false);
}
/** Where a moving vehicle may go: like cars, but open water is enterable (the vehicle sinks there). */
export function isVehicleTerrainAllowed(x: number, z: number): boolean {
  return carTerrain(x, z, true);
}
function carTerrain(x: number, z: number, waterPassable: boolean): boolean {
  if (!hasGroundAt(x, z)) return false;
  if (isOnWalkableDeck(x, z)) return true;
  if (isWater(x, z)) return waterPassable;
  const y = terrainHeight(x, z);
  const samples = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  return samples.every(([dx, dz]) => {
    if (!hasGroundAt(x + dx, z + dz)) return false;
    if (isWater(x + dx, z + dz)) return waterPassable;
    return Math.abs(terrainHeight(x + dx, z + dz) - y) <= 1.75;
  });
}

/** Vehicle callers must check the intended position before movement or mounting. */
export function isTravelAllowed(mode:TravelMode,x:number,z:number):boolean {
  if(mode==='foot')return (hasGroundAt(x,z)&&!isWater(x,z)) || isOnWalkableDeck(x,z);
  // Gliders fly over rivers; they only need to stay above the map.
  if(mode==='glider')return hasGroundAt(x,z);
  // Bikes ride anywhere a car can; isCycleAllowed still describes the paved network.
  return isCarTerrainAllowed(x,z);
}

export const WALKING_DETOURS = [
  { id: 'canopy', parkingId: 'canopy-parking', path: [[0, -413], [8, -434], [18, -415]] },
  { id: 'spice-garden', parkingId: 'village-parking', path: [[-3, -224], [-8, -226]] },
  { id: 'north-fishing', parkingId: 'north-bank-parking', path: [[12, -149], [27, -140]] },
  { id: 'south-fishing', parkingId: 'south-bank-parking', path: [[12, -63], [0, -58], [-18, -66]] },
  { id: 'jetty', parkingId: 'harbor-parking', path: [[47, 68], [73, 76], [96, 76]] },
];

const regionCuts = [ORIGINAL_WORLD_BOUNDS.zMin, -334, -139, -62, ORIGINAL_WORLD_BOUNDS.zMax];
export const REGIONS = WORLD_REGIONS.map((region, i) => ({
  ...region, id: region.id as ZoneId,
  bounds: { ...ORIGINAL_WORLD_BOUNDS, zMin: regionCuts[i], zMax: regionCuts[i + 1] },
  center: [5, (regionCuts[i] + regionCuts[i + 1]) / 2] as [number, number],
  labelPosition: [5, (regionCuts[i] + regionCuts[i + 1]) / 2] as [number, number],
  neighborIds: WORLD_REGIONS.filter((_, j) => Math.abs(i - j) === 1).map(neighbor => neighbor.id as ZoneId),
  landmarkIds: LANDMARKS.filter(landmark => landmark.zoneId === region.id).map(landmark => landmark.id),
  safeSpawnIds: SAFE_SPAWNS.filter(spawn => spawn.zoneId === region.id).map(spawn => spawn.id),
}));
export const WORLD_DEFINITION = {
  version: WORLD_VERSION, bounds: WORLD_BOUNDS, mapBounds: MAP_BOUNDS, regions: REGIONS,
  landmarks: LANDMARKS, mainPath: MAIN_PATH, riverCenterline: RIVER_CENTERLINE,
  coastline: COASTLINE, bridgeBounds: BRIDGE_BOUNDS, bridgeRamps: BRIDGE_RAMPS,
  jettyBounds: JETTY_BOUNDS, parkingSpots: PARKING_SPOTS, safeSpawns: SAFE_SPAWNS,
  walkingDetours: WALKING_DETOURS, expansion: EXPANSION_LAYOUT,
  v2:V2_LAYOUT,
};
