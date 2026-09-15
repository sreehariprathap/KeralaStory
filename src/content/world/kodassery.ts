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
export const CITY_PATH:[number,number][]=[[12,-64],[16,-48],[26,-25],[32,-4],[30,21],[38,43],[47,68],[47,88]];
export const MAIN_PATH:[number,number][]=[...KODASSERY_PATH,...VILLAGE_PATH.slice(1),[12,-64],...CITY_PATH.slice(1)];
export const BRIDGE_PATH:[number,number][]=[[12,-134],[12,-64]];
export const RIVER_CENTERLINE:[number,number][]=Array.from({length:33},(_,i)=>{const x=-100+i*6.25;return [x,riverCenter(x)];});
export const LANDMARKS:Landmark[]=[
  {id:'origin',zoneId:'kodassery',label:'The first overlook',position:SPAWN,discoveryRadiusM:7,iconId:'mountain',description:'A quiet beginning, above the clouds.'},
  {id:'canopy',zoneId:'kodassery',label:'Canopy homestead',position:[18,terrainHeight(18,-415)+3,-415],discoveryRadiusM:12,iconId:'house',description:'Timber homes held in the arms of the forest.'},
  {id:'waterfall',zoneId:'kodassery',label:'Silverthread falls',position:[31,terrainHeight(31,-386),-386],discoveryRadiusM:11,iconId:'waves',description:'Follow the sound of water through the leaves.'},
  {id:'paddy',zoneId:'kadambode',label:'Kadambode paddy fields',position:[-21,terrainHeight(-21,-288),-288],discoveryRadiusM:16,iconId:'plant',description:'Green paddy, coconut shade, and narrow earthen bunds.'},
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
