import type { Landmark, MapBounds, Vec3, ZoneId } from '../../contracts';

export const WORLD_VERSION = 'kerala-2000-connected-2';
export const WORLD_BOUNDS: MapBounds = { xMin: -78, xMax: 88, zMin: -484, zMax: 92 };
// Legacy API name now denotes the complete connected prototype.
export const SLICE_BOUNDS = WORLD_BOUNDS;
export const KODASSERY_BOUNDS: MapBounds = { xMin:-64,xMax:64,zMin:-484,zMax:-334 };
export const WATER_LEVEL = 8;
export const BRIDGE_X = 12;
export const BRIDGE_DECK_Y = 15;
export const BRIDGE_NORTH_Z = -134;
export const BRIDGE_SOUTH_Z = -64;
export function riverCenter(x:number){return -100+Math.sin(x*.025)*5;}
export function isRiver(x:number,z:number){return Math.abs(z-riverCenter(x))<21;}
export function isWater(x:number,z:number){return isRiver(x,z)||z>90||x>83;}
export function terrainHeight(x:number,z:number):number{
  if(z<=-334)return 76-(z+458)*.105+Math.sin(x*.065)*1.3+Math.sin((z+458)*.045)*.65;
  const hill=(z+334)/204;
  if(z<-130){const a=76-124*.105+Math.sin(x*.065)*1.3+Math.sin(124*.045)*.65;return a+(16-a)*hill+Math.sin(hill*Math.PI)*Math.sin(x*.04)*1.5;}
  const d=Math.abs(z-riverCenter(x));
  if(d<21)return 3.5;
  if(z<-64)return 3.5+Math.min(1,(d-21)/8)*12.5;
  const city=Math.max(0,Math.min(1,(z+64)/156));
  return 14-city*8+Math.sin(x*.03)*.3;
}
export function getZoneAt(z:number):ZoneId{return z<-334?'kodassery':z<-139?'kadambode':z<-62?'kurumali':'kodaly';}
export const SPAWN:Vec3=[0,terrainHeight(0,-460)+.05,-460];
export const KODASSERY_PATH:[number,number][]=[[0,-481],[0,-460],[-7,-446],[-9,-429],[0,-413],[9,-399],[6,-384],[-3,-371],[0,-349],[0,-334]];
export const VILLAGE_PATH:[number,number][]=[[0,-334],[8,-313],[11,-286],[2,-260],[-6,-238],[0,-211],[10,-184],[12,-157],[12,-134]];
export const CITY_PATH:[number,number][]=[[12,-64],[12,-55],[16,-48],[26,-25],[32,-4],[30,21],[38,43],[36,58],[47,68],[47,88]];
export const MAIN_PATH:[number,number][]=[...KODASSERY_PATH,...VILLAGE_PATH.slice(1),[12,-64],...CITY_PATH.slice(1)];
export const BRIDGE_PATH:[number,number][]=[[12,-134],[12,-64]];
export const RIVER_CENTERLINE:[number,number][]=Array.from({length:33},(_,i)=>{const x=-100+i*6.25;return [x,riverCenter(x)];});
export const LANDMARKS:Landmark[]=[
  {id:'origin',zoneId:'kodassery',label:'The first overlook',position:SPAWN,discoveryRadiusM:7,iconId:'mountain',description:'A quiet beginning, above the clouds.'},
  {id:'canopy',zoneId:'kodassery',label:'Canopy homestead',position:[18,terrainHeight(18,-415)+3,-415],discoveryRadiusM:12,iconId:'house',description:'Timber homes held in the arms of the forest.'},
  {id:'waterfall',zoneId:'kodassery',label:'Silverthread falls',position:[31,terrainHeight(31,-386),-386],discoveryRadiusM:11,iconId:'waves',description:'Follow the sound of water through the leaves.'},
  {id:'paddy',zoneId:'kadambode',label:'Kadambode paddy fields',position:[-21,terrainHeight(-21,-288),-288],discoveryRadiusM:16,iconId:'plant',description:'Green paddy, coconut shade, and narrow earthen bunds.'},
  {id:'spice-garden',zoneId:'kadambode',label:'Kadambode spice garden',position:[-8,terrainHeight(-8,-226),-226],discoveryRadiusM:9,iconId:'plant',description:'Pepper vines and cardamom beside the village path.'},
  {id:'temple',zoneId:'kadambode',label:'Kadambode temple',position:[16,terrainHeight(25,-238)+.04,-238],discoveryRadiusM:15,iconId:'temple',description:'Clay tiles, a brass lamp, and a quiet village courtyard.'},
  {id:'tea-shop',zoneId:'kadambode',label:'Rajan’s tea shop',position:[-10,terrainHeight(-10,-194),-194],discoveryRadiusM:11,iconId:'tea',description:'Steel tumblers, a bench under the awning, and time for one more chaya.'},
  {id:'river-bridge',zoneId:'kurumali',label:'Kurumali wooden bridge',position:[12,BRIDGE_DECK_Y,-99],discoveryRadiusM:13,iconId:'bridge',description:'The river separates the village from the harbor road.'},
  {id:'fishing-bank',zoneId:'kurumali',label:'Kurumali fishing bank',position:[-18,terrainHeight(-18,-66),-66],discoveryRadiusM:12,iconId:'boat',description:'Wooden vallams rest beside the blue-green water.'},
  {id:'market',zoneId:'kodaly',label:'Kodaly bazaar',position:[27,terrainHeight(27,-19),-19],discoveryRadiusM:16,iconId:'shop',description:'Hand-painted boards, tiled shopfronts, and the familiar bend in the tar road.'},
  {id:'lighthouse',zoneId:'kodaly',label:'Kodaly lighthouse',position:[65,terrainHeight(65,54),54],discoveryRadiusM:13,iconId:'lighthouse',description:'A red-and-white landmark watching over the coast.'},
  {id:'harbor',zoneId:'kodaly',label:'Kodaly harbor',position:[48,terrainHeight(48,77),77],discoveryRadiusM:16,iconId:'anchor',description:'From the misty hills to the sea. Stay a while.'},
];
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
export const MAP_BOUNDS: MapBounds = { ...WORLD_BOUNDS, xMax: JETTY_BOUNDS.xMax };
export const COASTLINE: [number, number][] = [[83, WORLD_BOUNDS.zMin], [83, 90], [WORLD_BOUNDS.xMin, 90]];
export const BRIDGE_RAMPS = [
  { deckZ: BRIDGE_NORTH_Z + 12, landZ: BRIDGE_NORTH_Z - 12 },
  { deckZ: BRIDGE_SOUTH_Z, landZ: BRIDGE_SOUTH_Z + 9 },
].map(ramp => ({ ...ramp, landY: terrainHeight(BRIDGE_X, ramp.landZ) + 0.07 }));

export function containsPoint(bounds: MapBounds, x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.xMin && x <= bounds.xMax && z >= bounds.zMin && z <= bounds.zMax;
}

/** Highest authored elevated surface, excluding terrain and decorative geometry. */
export function walkableDeckHeight(x: number, z: number): number | null {
  let height: number | null = containsPoint(JETTY_BOUNDS, x, z) ? JETTY_DECK_Y : null;
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
        const rampY = BRIDGE_DECK_Y + (ramp.landY - BRIDGE_DECK_Y) * t;
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
const parking = (id: string, x: number, z: number): ParkingSpot => ({ id, zoneId: getZoneAt(z), position: [x, Math.max(terrainHeight(x, z), walkableDeckHeight(x, z) ?? -Infinity) + 0.05, z], headingRad: Math.PI });
export const PARKING_SPOTS: ParkingSpot[] = [
  parking('origin-parking', 1.3, -460),
  parking('canopy-parking', 0, -413),
  parking('village-parking', 0, -211),
  parking('north-bank-parking', 12, -149),
  parking('south-bank-parking', 12, -63),
  parking('harbor-parking', 47, 68),
];
export const SAFE_SPAWNS = [
  { id: 'origin', zoneId: 'kodassery' as ZoneId, position: SPAWN, headingRad: Math.PI },
  ...PARKING_SPOTS.map(spot => ({ ...spot, id: `${spot.id}-spawn`, position: [...spot.position] as Vec3 })),
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
    if (deckY !== null) return [x, Math.max(deckY, containsPoint(WORLD_BOUNDS, x, z) ? terrainHeight(x, z) : deckY) + 0.05, z];
    if (containsPoint(WORLD_BOUNDS, x, z) && !isWater(x, z)) return [x, terrainHeight(x, z) + 0.05, z];
  }
  return [...nearestParking(position).position];
}

function distanceToSegment(x: number, z: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
/** Six-meter ground corridor, narrowing to three meters between bridge rails. */
export function isCycleAllowed(x: number, z: number): boolean {
  if (!containsPoint(WORLD_BOUNDS, x, z) || containsPoint(JETTY_BOUNDS, x, z)) return false;
  if (isWater(x, z) && !isOnWalkableDeck(x, z)) return false;
  if (z >= BRIDGE_NORTH_Z - 12 && z <= BRIDGE_SOUTH_Z && Math.abs(x - BRIDGE_X) > 1.5) return false;
  return MAIN_PATH.some((point, i) => i > 0 && distanceToSegment(x, z, MAIN_PATH[i - 1], point) <= 3);
}

export const WALKING_DETOURS = [
  { id: 'canopy', parkingId: 'canopy-parking', path: [[0, -413], [8, -434], [18, -415]] },
  { id: 'spice-garden', parkingId: 'village-parking', path: [[-3, -224], [-8, -226]] },
  { id: 'north-fishing', parkingId: 'north-bank-parking', path: [[12, -149], [27, -140]] },
  { id: 'south-fishing', parkingId: 'south-bank-parking', path: [[12, -63], [0, -58], [-18, -66]] },
  { id: 'jetty', parkingId: 'harbor-parking', path: [[47, 68], [73, 76], [96, 76]] },
];

const regionCuts = [WORLD_BOUNDS.zMin, -334, -139, -62, WORLD_BOUNDS.zMax];
export const REGIONS = WORLD_REGIONS.map((region, i) => ({
  ...region, id: region.id as ZoneId,
  bounds: { ...WORLD_BOUNDS, zMin: regionCuts[i], zMax: regionCuts[i + 1] },
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
  walkingDetours: WALKING_DETOURS,
};
