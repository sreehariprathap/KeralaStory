import { ExpansionGround } from './ExpansionGround';
import { staticArchitectureBoxes } from '../../content/world/staticArchitecture';
import { RiverNetwork } from './RiverNetwork';
import { TownWorld } from './TownWorld';
import { ChalakkudyCity } from './ChalakkudyCity';
import { V2WorldDressing } from './V2WorldDressing';
import { MountainExpansion } from './MountainExpansion';
import { ChokkanaWorld } from './ChokkanaWorld';
import { AthirappillyWorld } from './AthirappillyWorld';
import { ChalakudyDam } from './ChalakudyDam';
import type { Locale } from '../../contracts';
import { translate, MALAYALAM_CATALOG, type TranslationKey } from '../../features/i18n/translate';
import { RegionalDetails } from './RegionalDetails';
import { CoconutGroves } from './CoconutGroves';
import { NedumbasseryAirport } from './NedumbasseryAirport';
import { SnehaTheeram } from './SnehaTheeram';
import { TeaEstate } from './TeaEstate';
import { MountainDressing } from './MountainDressing';
import { FlowerBeds } from './FlowerBeds';
import { Wildlife } from './Wildlife';
import { StuntParks } from './StuntParks';
import { GliderSites } from './GliderSites';
import { Stadium } from './Stadium';
import { KodalyCircle } from './KodalyCircle';
import { KODALY_AVENUE_SHOPS, KODALY_CIRCLE, isKodalyCityGround, kodalyCircleBoxes } from '../../content/world/kodalyCircle';
import { isStuntGround } from './stuntSites';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Object3D, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRIDGE_DECK_Y, BRIDGE_NORTH_Z, BRIDGE_SOUTH_Z, BRIDGE_X, CITY_PATH, VILLAGE_PATH, WATER_LEVEL, isWater, riverCenter, terrainHeight } from '../../content/world/kodassery';
import { isClearOfRoads } from '../../content/world/definition';
import { terrainMeshData, traversalBoxes } from './traversalGeometry';
import { createTerrainSurface, planFoundation, planFoundationSteps, type FoundationPlan } from './buildingFoundation';
import { GrassAssetMesh, KodasseryWorld, type Instance as GrassInstance } from './KodasseryWorld';

type V3 = [number, number, number];
type Collider = { position: V3; size: V3; rotation: V3 };
type Sign = { position: V3; yaw: number; english: string; malayalam: string; color: string; width: number };
type Instance = { position: V3; rotation: V3; scale: V3; color: string };
const UP = new Vector3(0, 1, 0);
const PALETTE = { tile:'#aa573c', tileLight:'#bd7049', timber:'#72563d', cream:'#e5d7b3', wall:'#a86046', sand:'#bfad79', tar:'#55594d' };
const FIELD_GRASS_URL = '/assets/grass/field.glb';

function generatePaddyGrass(): GrassInstance[] {
  const result: GrassInstance[] = [];
  let seed = 1907;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // The field blade is instanced across the five authored terraces only. Roads,
  // bunds, temple grounds, and the rest of Kadambode remain clear.
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const x = -42 + col * 12, z = -310 + row * 10;
    for (let i = 0; i < 48; i++) {
      const px = x - 4.9 + random() * 9.8, pz = z - 3.9 + random() * 7.8;
      result.push({ position: [px, terrainHeight(px, pz) + .04, pz], scale: [.55 + random() * .35, .78 + random() * .3, .55 + random() * .35], rotation: [0, random() * Math.PI * 2, 0], color: '#86a94f' });
    }
  }
  return result;
}

/** Static meshes are merged by material: repeated architecture does not add draw calls. */
class VillageBuilder {
  terrain = createTerrainSurface(terrainMeshData('south'));
  pieces = new Map<string, BufferGeometry[]>();
  colliders: Collider[] = [];
  signs: Sign[] = [];
  add(geometry: BufferGeometry, color: string, position: V3, rotation: V3 = [0,0,0], scale: V3 = [1,1,1]) {
    const transform = new Object3D(); transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv'); g.deleteAttribute('uv1'); g.applyMatrix4(transform.matrix);
    const list = this.pieces.get(color) ?? []; list.push(g); this.pieces.set(color,list); geometry.dispose();
  }
  box(position: V3,size: V3,color: string,solid=false,rotation: V3=[0,0,0]) {
    this.add(new BoxGeometry(...size),color,position,rotation);
    if(solid) this.colliders.push({position,size:size.map(v=>v/2) as V3,rotation});
  }
  cylinder(position:V3,top:number,bottom:number,height:number,color:string,segments=8) {
    this.add(new CylinderGeometry(top,bottom,height,segments),color,position);
  }
  beam(a:V3,b:V3,radius:number,color:string) {
    const va=new Vector3(...a),vb=new Vector3(...b),d=vb.clone().sub(va),g=new CylinderGeometry(radius,radius,d.length(),5);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(UP,d.clone().normalize()));
    this.add(g,color,va.add(vb).multiplyScalar(.5).toArray() as V3);
  }
  foundation(x:number,z:number,width:number,depth:number,color=PALETTE.wall,clearance=.22):FoundationPlan {
    const plan=planFoundation(this.terrain,{x,z,width,depth,clearance});
    this.box(plan.body.position,plan.body.size,color,true);
    // A flush dressed cap and broad masonry courses read as a retaining plinth.
    // They stay inside the solid footprint, so decoration adds no collision lip.
    this.box([x,plan.deckY-.065,z],[width,.13,depth],'#a98569');
    for(let y=plan.deckY-.48,course=0;y>plan.groundMin;y-=.46,course++) {
      for(const sign of [-1,1]) {
        this.box([x,y,z+sign*(depth/2+.006)],[width,.022,.018],'#805f4c');
        this.box([x+sign*(width/2+.006),y,z],[.018,.022,depth],'#805f4c');
        for(let offset=-width/2+.7+(course%2)*.6;offset<width/2;offset+=1.4) {
          this.box([x+offset,y+.23,z+sign*(depth/2+.008)],[.018,.44,.016],'#805f4c');
        }
      }
    }
    return plan;
  }
  steps(x:number,edgeZ:number,deckY:number,width=3) {
    const steps=planFoundationSteps(this.terrain,{x,edgeZ,deckY,width});
    for(const step of steps) {
      // These are the visible, dressed masonry treads. A separate continuous
      // collision face below prevents tiny terrain-to-tread lips from stopping
      // the capsule before it reaches an otherwise legal riser.
      this.box(step.position,step.size,PALETTE.wall);
      this.box([step.position[0],step.position[1]+step.size[1]/2-.025,step.position[2]],[step.size[0],.05,step.size[2]],'#aa8567');
    }
    const outer=steps.at(-1)!;
    const landingZ=outer.position[2]+outer.size[2]/2+1.2;
    const landingY=this.terrain.heightAt(x,landingZ)+.02;
    const length=landingZ-edgeZ,rise=deckY-landingY,angle=Math.atan2(rise,length),thickness=.16;
    // The collision surface starts at the porch and ends just above the
    // rendered terrain. Its lower volume is buried or hidden by the treads.
    this.box([x,(deckY+landingY)/2-Math.cos(angle)*thickness/2,edgeZ+length/2],[width,thickness,Math.hypot(length,rise)],PALETTE.wall,true,[angle,0,0]);
  }
  roof(x:number,y:number,z:number,w:number,d:number,h:number) {
    // Four genuinely sloping roof faces, a long ridge, and generous Kerala eaves.
    const ridge=Math.max(.5,d-w*.48),p=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,0,h,-ridge/2,0,h,ridge/2];
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0]);g.computeVertexNormals();this.add(g,PALETTE.tile,[x,y,z]);
    this.box([x,y-.08,z],[w+.15,.18,d+.15],PALETTE.timber);
    this.beam([x,y+h+.07,z-ridge/2],[x,y+h+.07,z+ridge/2],.12,PALETTE.tileLight);
    // Parallel raised clay-tile courses make the surface read as tile, not a pyramid.
    for(let i=1;i<=5;i++) {const f=i/6,ww=w*(1-f),dd=d*(1-f)+ridge*f,yy=y+h*f+.015;
      this.beam([x-ww/2,yy,z-dd/2],[x-ww/2,yy,z+dd/2],.035,PALETTE.tileLight);
      this.beam([x+ww/2,yy,z-dd/2],[x+ww/2,yy,z+dd/2],.035,PALETTE.tileLight);
    }
  }
}

function buildHouse(b:VillageBuilder,x:number,z:number,w=8,d=6,color=PALETTE.cream) {
  const foundation=b.foundation(x,z,w+1,d+2),y=foundation.deckY-.3,h=3.1;
  b.box([x,y+h/2+.3,z-.6],[w,h,d-1],color,true);
  b.roof(x,y+h+.35,z,w+2,d+2,1.7);
  b.box([x,y+1.35,z+d/2-.98],[1.25,2.2,.08],PALETTE.timber);
  for(const side of [-1,1]) {
    b.box([x+side*w*.31,y+1.9,z+d/2-.94],[1.3,1.15,.09],'#435d52');
    b.box([x+side*w*.31,y+1.9,z+d/2-.87],[.07,1.22,.07],PALETTE.cream);
    b.box([x+side*(w/2-.3),y+1.65,z+d/2+.5],[.16,3,.16],PALETTE.timber);
  }
  b.steps(x,foundation.bounds.zMax,foundation.deckY);
}

function buildShop(b:VillageBuilder,x:number,z:number,english:string,malayalam:string,color:string,w=7) {
  const d=5,foundation=b.foundation(x,z,w+1,d+3),y=foundation.deckY-.2;
  b.steps(x,foundation.bounds.zMax,foundation.deckY);
  b.box([x,y+1.8,z-1],[w,3.2,3.2],color,true);
  b.roof(x,y+3.5,z-.1,w+1.5,7.2,1.1);
  b.box([x,y+3.15,z+2.3],[w+1,.12,2.8],'#748c7a',false,[-.12,0,0]);
  for(const dx of [-w/2,w/2])b.box([x+dx,y+1.6,z+3.5],[.12,3.2,.12],PALETTE.timber);
  for(const dx of [-w*.28,w*.28]) {
    b.box([x+dx,y+1.7,z+.66],[2.5,2.55,.1],'#566c63');
    for(let i=0;i<9;i++)b.box([x+dx,y+.65+i*.25,z+.73],[2.5,.035,.05],'#8b9480');
  }
  b.signs.push({position:[x,y+2.82,z+3.57],yaw:0,english,malayalam,color:'#eee0ab',width:w});
  b.box([x,y+.95,z+2.8],[w*.68,.16,.55],PALETTE.timber);
  for(const dx of [-w*.25,w*.25])b.box([x+dx,y+.5,z+2.8],[.13,.9,.4],PALETTE.timber);
  for(let i=0;i<5;i++)b.cylinder([x-w*.25+i*.35,y+1.1,z+2.8],.075,.055,.16,'#b6baaa');
  b.box([x+w*.36,y+.65,z+2.5],[.85,.9,.8],'#ae8b4e');
}

function buildTemple(b:VillageBuilder) {
  const x=25,z=-238,foundation=b.foundation(x,z,26,24,'#aa8b68'),y=foundation.deckY;
  b.box([17,y+.025,z],[10,.05,2.4],PALETTE.sand);
  // A broad solid approach joins the village trail to the raised west gate.
  // Its top endpoints and collider agree; the retaining body remains below grade.
  const approachStart=-1,approachEnd=12,approachY=b.terrain.heightAt(approachStart,z)+.02,approachLength=approachEnd-approachStart,approachRise=y+.04-approachY;
  const angle=Math.atan2(approachRise,approachLength),thickness=Math.abs(approachRise)+1.5;
  b.box([approachStart+approachLength/2+Math.sin(angle)*thickness/2,(approachY+y+.04)/2-Math.cos(angle)*thickness/2,z],[Math.hypot(approachLength,approachRise),thickness,3],PALETTE.sand,true,[0,0,angle]);
  // Low laterite boundary follows the courtyard, with a broad open west entrance.
  for(const dz of [-12,12])b.box([x,y+.48,z+dz],[26,.95,.55],PALETTE.wall,true);
  b.box([x+13,y+.48,z],[.55,.95,24],PALETTE.wall,true);
  for(const dz of [-8,8])b.box([x-13,y+.48,z+dz],[.55,.95,8],PALETTE.wall,true);
  b.box([x+2,y+.38,z-2],[10,.75,10],PALETTE.timber,true);
  b.box([x+2,y+2.1,z-2],[6,3,6],PALETTE.cream,true);
  b.roof(x+2,y+3.6,z-2,12,12,2.7);
  b.box([x+2,y+6.2,z-2],[3,1.1,3],PALETTE.timber);
  b.roof(x+2,y+6.8,z-2,5.5,5.5,1.8);
  b.cylinder([x+2,y+8.75,z-2],.1,.23,.7,'#c39e4b');
  b.box([x+2,y+1.65,z+1.06],[1.3,2.3,.12],'#443c2c');
  for(const dx of [-4,4])for(const dz of [-4,4])b.box([x+2+dx,y+1.95,z-2+dz],[.2,3.15,.2],PALETTE.timber);
  // Stepped lamp plinth and the recognisable multi-tier brass nilavilakku.
  b.box([x+2,y+.2,z+7],[2,.4,2],'#7b7460',true);
  b.cylinder([x+2,y+1.7,z+7],.12,.2,2.7,'#c39e4b');
  for(let i=0;i<4;i++)b.cylinder([x+2,y+.65+i*.65,z+7],.48-i*.06,.18,.15,'#c39e4b');
  b.cylinder([x+2,y+3.22,z+7],0,.17,.6,'#c39e4b');
  // Temple tank: inset water and four descending stone ledges; decorative water is enclosed.
  const tx=x+23,tz=z+5,ty=terrainHeight(tx,tz);
  b.box([tx,ty-.05,tz],[12,.25,13],'#589386');
  for(let step=0;step<4;step++) {const s=12-step*1.3,yy=ty+.14+step*.14;
    for(const sign of [-1,1]){b.box([tx+sign*s/2,yy,tz],[.65,.3,s+1],'#92917a',true);b.box([tx,yy,tz+sign*(s+1)/2],[s,.3,.65],'#92917a',true);}}
  b.signs.push({position:[x-12.9,y+2.25,z+2],yaw:-Math.PI/2,english:'KADAMBODE TEMPLE',malayalam:'കടമ്പോട് ക്ഷേത്രം',color:'#e9d5a2',width:4});
}

function buildBridge(b:VillageBuilder) {
  const length=BRIDGE_SOUTH_Z-BRIDGE_NORTH_Z,mid=(BRIDGE_NORTH_Z+BRIDGE_SOUTH_Z)/2;
  for (const shape of traversalBoxes().filter(shape=>shape.id.startsWith('bridge-'))) b.box(shape.position,shape.size,PALETTE.timber,true,shape.rotation);
  for(let i=0;i<110;i++)b.box([BRIDGE_X,BRIDGE_DECK_Y+.025,BRIDGE_NORTH_Z+(i+.5)*length/110],[4.15,.06,length/110-.035],i%3===0?'#ab895c':'#92734e');
  for(const side of [-1,1]) {
    const x=BRIDGE_X+side*2.12;
    for(let i=0;i<=14;i++){const z=BRIDGE_NORTH_Z+i*length/14;b.box([x,BRIDGE_DECK_Y+.65,z],[.16,1.55,.16],PALETTE.timber);if(i%3===0)b.box([x,8.5,z],[.32,13,.35],PALETTE.timber);}
    for(const h of [.48,1.2])b.box([x,BRIDGE_DECK_Y+h,mid],[.13,.13,length],PALETTE.timber);
    // Continuous physical rails keep the crossing usable even between visible posts.

  }

}

function boat(b:VillageBuilder,x:number,z:number,y:number,yaw=0,scale=1) {
  // A tapered vallam hull, with open dark interior and transverse timber seats.
  const points=[[-.9,0,-3.8],[.9,0,-3.8],[1.25,0,0],[.8,0,3.8],[0,.3,4.7],[-.8,0,3.8],[-1.25,0,0],[0,-.65,0]];
  const idx=[0,1,7,1,2,7,2,3,7,3,4,7,4,5,7,5,6,7,6,0,7];
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points.flat(),3));g.setIndex(idx);g.computeVertexNormals();b.add(g,'#594739',[x,y,z],[0,yaw,0],[scale,scale,scale]);
  const p=(dx:number,dy:number,dz:number):V3=>[x+(Math.cos(yaw)*dx+Math.sin(yaw)*dz)*scale,y+dy*scale,z+(-Math.sin(yaw)*dx+Math.cos(yaw)*dz)*scale];
  for(let i=0;i<points.length-1;i++)b.beam(p(...points[i] as V3),p(...points[(i+1)%7] as V3),.085*scale,'#a48558');
  for(const dz of [-2,0,2])b.box(p(0,.03,dz),[1.9*scale,.12*scale,.35*scale],PALETTE.timber,false,[0,yaw,0]);
  b.beam(p(-.5,.1,-1),p(2.2,.2,3),.055,PALETTE.timber);
}

export function buildArchitecture() {
  const b=new VillageBuilder();buildTemple(b);buildBridge(b);
  buildShop(b,-10,-194,"RAJAN'S TEA SHOP",'രാജൻ ചായക്കട','#cfc197',7);
  for(const shop of KODALY_AVENUE_SHOPS)buildShop(b,shop.x,shop.z,shop.english,shop.malayalam,shop.color,shop.width);
  buildShop(b,47,7,'KODALY PROVISIONS','കൊടാലി പലചരക്ക്','#d8cbb0',9);
  buildShop(b,43,51,'HARBOUR TEA STALL','തുറമുഖം ചായക്കട','#b7c2ae',6);
  for(const [x,z,w,d] of [[-25,-319,8,6],[31,-307,8,7],[31,-278,9,7],[-23,-250,8,6],[-31,-214,9,7],[36,-177,8,6],[-25,-157,7,6],[-7,-43,8,6],[-20,-10,9,7],[7,21,9,6],[54,31,8,6],[8,51,10,7]] as [number,number,number,number][]) {
    buildHouse(b,x,z,w,d,z%2===0?'#d4c7a3':PALETTE.cream);
    // Short level masonry sections follow the slope; each reaches below the mesh.
    for(let i=0;i<9;i++) {
      const wall=planFoundation(b.terrain,{x:x-w*.65,z:z-.5+(i+.5)*13/9,width:.45,depth:13/9,clearance:1.1,burial:.35});
      b.box(wall.body.position,wall.body.size,PALETTE.wall,true);
      b.box([wall.body.position[0],wall.deckY-.045,wall.body.position[2]],[.45,.09,13/9],'#99765b');
    }
  }
  // Paddy terraces sit on the hillside, each small field and bund follows its own elevation.
  for(let row=0;row<5;row++)for(let col=0;col<3;col++) {
    const x=-42+col*12,z=-310+row*10,y=terrainHeight(x,z);
    b.box([x,y-1.2,z],[11,2.4,8.9],'#a59662',true);
    b.box([x,y+.018,z],[11,.036,8.9],row%2?'#80a947':'#98b34b',true);
    for(const side of [-1,1])b.box([x+side*5.6,y+.04,z],[.4,.25,9.4],'#a7a260');
    for(const side of [-1,1])b.box([x,y+.04,z+side*4.5],[11.4,.25,.45],'#a7a260');
    for(let i=0;i<6;i++)b.box([x-4.5+i*1.8,y+.06,z],[.07,.08,8.4],'#b4c76a');
  }
  // Electricity poles and thin sagging overhead wires along the narrow road.
  const poles:V3[]=[];
  for(const [x,z] of [...VILLAGE_PATH.slice(2,-1),...CITY_PATH.filter((_,i)=>i%2===0)]) {
    const px=x+6.3,y=terrainHeight(px,z);
    if(isKodalyCityGround(px,z,1))continue;poles.push([px,y+6.8,z]);b.cylinder([px,y+3.4,z],.1,.17,6.8,'#88877a');b.box([px,y+6.45,z],[1.8,.12,.15],PALETTE.timber);
    for(const side of [-1,1])b.cylinder([px+side*.7,y+6.6,z],.09,.09,.24,'#d0d2c3');
  }
  for(let i=1;i<poles.length;i++){const a=poles[i-1],c=poles[i];if(Math.abs(c[2]-a[2])>60)continue;for(const dx of [-.7,.7]){const mid:V3=[(a[0]+c[0])/2+dx,(a[1]+c[1])/2-.75,(a[2]+c[2])/2];b.beam([a[0]+dx,a[1],a[2]],mid,.024,'#454b40');b.beam(mid,[c[0]+dx,c[1],c[2]],.024,'#454b40');}}
  // Lighthouse and its low compound; the road and approach remain unobstructed.
  const lx=65,lz=54,lighthouseFoundation=b.foundation(lx,lz,8,8,'#99917c'),ly=lighthouseFoundation.deckY;
  b.steps(lx,lighthouseFoundation.bounds.zMax,ly);
  for(let i=0;i<5;i++)b.cylinder([lx,ly+1.5+i*2.9,lz],2.1-i*.16,2.26-i*.16,2.9,i%2?'#b95c48':'#eee2c4',16);
  b.colliders.push({position:[lx,ly+7.5,lz],size:[2.1,7.5,2.1],rotation:[0,0,0]});
  b.cylinder([lx,ly+15,lz],2.4,2.4,.3,PALETTE.timber,16);b.cylinder([lx,ly+16.2,lz],1.4,1.4,2.2,'#486e69',12);b.cylinder([lx,ly+17.8,lz],0,2.2,1.4,PALETTE.tile,12);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;b.box([lx+Math.cos(a)*2.15,ly+15.55,lz+Math.sin(a)*2.15],[.08,1,.08],'#ddd5b8');}
  // Kodaly Banyan trunk and the green buildings around the circle; KodalyCircle renders them.
  for(const shape of kodalyCircleBoxes())b.colliders.push({position:shape.position,size:shape.size.map(v=>v/2) as V3,rotation:shape.rotation});
  b.signs.push({position:[lx,ly+2,lz+2.31],yaw:0,english:'KODALY LIGHT',malayalam:'കൊടാലി',color:'#eee0ab',width:2.7});
  // Working harbor: quay, wooden pier, sheds, coir bundles and moored fishing boats.
  const hy=terrainHeight(48,77);
  for (const shape of traversalBoxes().filter(shape=>!shape.id.startsWith('bridge-'))) b.box(shape.position,shape.size,shape.id==='harbor-quay'?'#b5ad92':PALETTE.timber,true,shape.rotation);
  for(let i=0;i<8;i++)for(const sign of [-1,1])b.box([79+i*2.4,WATER_LEVEL-1,76+sign*1.8],[.2,3,.2],PALETTE.timber);
  buildHouse(b,63,73,9,5,'#c2c1a7');
  for(let i=0;i<7;i++)b.cylinder([55+(i%4)*1.3,hy+.45,82+Math.floor(i/4)*1.3],.5,.56,.9,'#a48655');
  boat(b,-22,-83,WATER_LEVEL+.55,.4,.8);boat(b,47,-109,WATER_LEVEL+.55,1.2,1);boat(b,96,69,WATER_LEVEL+.5,.3,1.2);boat(b,90,83,WATER_LEVEL+.5,-.25,1);boat(b,60,99,WATER_LEVEL+.5,1.7,1.1);
  const meshes=[...b.pieces].map(([color,parts])=>{const geometry=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());geometry.computeBoundingSphere();return {color,geometry};});
  return {meshes,colliders:b.colliders,signs:b.signs};
}

function createTerrain() {
  const {vertices:p,indices,nx,nz}=terrainMeshData('south'),colors:number[]=[],color=new Color();
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++) {
    const index=(j*(nx+1)+i)*3,x=p[index],z=p[index+2];
    color.set(isWater(x,z)?'#8b9b81':z>-64?'#9baa71':j%3?'#91a265':'#8f9d61');color.multiplyScalar(.98+Math.sin(i*1.7+j*.8)*.035);colors.push(color.r,color.g,color.b);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function ribbon(path:readonly [number,number][],width:number,lift=.065) {
  const p:number[]=[],index:number[]=[];
  const points:Vector3[]=[];for(let i=0;i<path.length-1;i++){const [ax,az]=path[i],[bx,bz]=path[i+1],n=Math.ceil(Math.hypot(bx-ax,bz-az)/1.3);for(let j=0;j<n;j++)points.push(new Vector3(ax+(bx-ax)*j/n,0,az+(bz-az)*j/n));}points.push(new Vector3(path.at(-1)![0],0,path.at(-1)![1]));
  points.forEach((v,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],side=after.clone().sub(before).normalize();for(const sign of [-1,1]){const x=v.x+side.z*width*.5*sign,z=v.z-side.x*width*.5*sign;p.push(x,terrainHeight(x,z)+lift,z);}if(i<points.length-1){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
/** Road runs outside the Kodaly Banyan carriageway; KodalyCircle paves the ring itself. */
function outsideKodalyCircle(path:readonly [number,number][]) {
  const {center:{x:cx,z:cz},roadOuter}=KODALY_CIRCLE,inside=([x,z]:readonly [number,number])=>Math.hypot(x-cx,z-cz)<roadOuter;
  const edge=(out:readonly [number,number],inn:readonly [number,number]):[number,number]=>{let lo=0,hi=1;for(let i=0;i<30;i++){const t=(lo+hi)/2;if(inside([out[0]+(inn[0]-out[0])*t,out[1]+(inn[1]-out[1])*t]))hi=t;else lo=t;}return [out[0]+(inn[0]-out[0])*lo,out[1]+(inn[1]-out[1])*lo];};
  const runs:[number,number][][]=[];let run:[number,number][]=[];
  path.forEach((point,i)=>{
    const previous=path[i-1];
    if(inside(point)){if(run.length){run.push(edge(previous,point));runs.push(run);run=[];}return;}
    if(previous&&inside(previous))run.push(edge(point,previous));
    run.push([point[0],point[1]]);
  });
  if(run.length>1)runs.push(run);
  return runs;
}
function riverGeometry() {
  const p:number[]=[],indices:number[]=[];for(let i=0;i<=64;i++){const x=-160+i*6;for(const side of [-1,1])p.push(x,WATER_LEVEL,riverCenter(x)+side*21);}for(let i=0;i<64;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** A curved leaf with a serrated coconut silhouette, authored here in meters. */
function leafGeometry(banana=false) {
  const p:number[]=[],indices:number[]=[],n=banana?12:22;
  for(let i=0;i<=n;i++){const f=i/n,width=Math.sin(f*Math.PI)*(banana?.75:.65)*(banana?1:i%2?.54:1),z=f*(banana?3.9:5.8),y=Math.sin(f*Math.PI)*(banana?1.1:1.15)-f*f*(banana?.5:1.35);p.push(-width,y,z,0,y+.07,z,width,y,z);}
  for(let i=0;i<n;i++){const a=i*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function generatePlants() {
  let seed=9471;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const trunks:Instance[]=[],fronds:Instance[]=[],bananaTrunks:Instance[]=[],bananaLeaves:Instance[]=[],shrubs:Instance[]=[];
  const path=[...VILLAGE_PATH,...CITY_PATH];
  const landmarks:[[number,number],number][]=[[[25,-238],19],[[48,-233],10],[[-10,-194],8],...KODALY_AVENUE_SHOPS.map(shop=>[[shop.x,shop.z],10] as [[number,number],number]),[[47,7],10],[[65,54],8],[[48,77],15]];
  for(let i=0;i<260;i++) {
    const x=-70+r()*145,z=-331+r()*420;
    if(isWater(x,z)||z>-64&&x>72||x<-10&&x>-51&&z>-320&&z<-260||isStuntGround(x,z,3)||isKodalyCityGround(x,z,3))continue;
    let roadDistance=Infinity;for(let j=1;j<path.length;j++){const a=path[j-1],c=path[j],dx=c[0]-a[0],dz=c[1]-a[1],f=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));roadDistance=Math.min(roadDistance,Math.hypot(x-a[0]-f*dx,z-a[1]-f*dz));}
    if(roadDistance<7||!isClearOfRoads(x,z,5)||landmarks.some(([[lx,lz],radius])=>Math.hypot(x-lx,z-lz)<radius))continue;
    const y=terrainHeight(x,z),h=7+r()*5,lean=(r()-.5)*.25,yaw=r()*Math.PI*2;
    if(i%4!==0) {
      // Segmented leaning trunks and curved, radial fronds give coconut palms their silhouette.
      for(let k=0;k<3;k++)trunks.push({position:[x+Math.sin(yaw)*lean*h*(k+.5)/3,y+h*(k+.5)/3,z+Math.cos(yaw)*lean*h*(k+.5)/3],rotation:[lean*Math.cos(yaw),0,-lean*Math.sin(yaw)],scale:[.25-k*.025,h/3+.08,.25-k*.025],color:'#8d8060'});
      for(let k=0;k<9;k++)fronds.push({position:[x+Math.sin(yaw)*lean*h,y+h,z+Math.cos(yaw)*lean*h],rotation:[-.18+(k%3)*.12,yaw+k*Math.PI*2/9,0],scale:[1,1,.8+r()*.35],color:k%3?'#4f7a43':'#70964b'});
    } else {
      bananaTrunks.push({position:[x,y+1.5,z],rotation:[0,0,0],scale:[.22,3,.22],color:'#91a45f'});
      for(let k=0;k<7;k++)bananaLeaves.push({position:[x,y+2.8,z],rotation:[-.35+(k%3)*.2,yaw+k*Math.PI*2/7,0],scale:[1,1,1],color:k%2?'#6e963f':'#88a750'});
    }
    if(i%2===0)shrubs.push({position:[x+2,y+.8,z+2],rotation:[0,yaw,0],scale:[2.2,.95,2],color:'#6d8b4a'});
  }
  return {trunks,fronds,bananaTrunks,bananaLeaves,shrubs};
}
function Plants({data,geometry,low=false}:{data:Instance[];geometry:BufferGeometry;low?:boolean}) {
  const ref=useRef<InstancedMesh>(null),items=useMemo(()=>low?data.filter((_,i)=>i%2===0):data,[data,low]);
  useLayoutEffect(()=>{const o=new Object3D(),c=new Color();items.forEach((v,i)=>{o.position.set(...v.position);o.rotation.set(...v.rotation);o.scale.set(...v.scale);o.updateMatrix();ref.current!.setMatrixAt(i,o.matrix);ref.current!.setColorAt(i,c.set(v.color));});ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere();},[items]);
  return <instancedMesh ref={ref} args={[geometry,undefined,items.length]} castShadow receiveShadow><meshStandardMaterial roughness={1} side={DoubleSide}/></instancedMesh>;
}
const signKeys:Record<string,TranslationKey>={"RAJAN'S TEA SHOP":'sign.rajan-tea','SREEKRISHNA STORES':'sign.sreekrishna-stores','ROYAL BAKERY':'sign.royal-bakery','VIDYA BOOKS':'sign.vidya-books','KODALY PROVISIONS':'sign.kodaly-provisions','HARBOUR TEA STALL':'sign.harbor-tea','KODALY LIGHT':'sign.kodaly-light','KADAMBODE TEMPLE':'sign.temple'};
const signPlaces:Record<string,TranslationKey>={"RAJAN'S TEA SHOP":'place.tea-shop','KADAMBODE TEMPLE':'place.temple','KODALY LIGHT':'place.lighthouse'};
function PaintedSign({sign,locale}:{sign:Sign;locale:Locale}) {
  const {texture,paint}=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
    const ctx=canvas.getContext('2d')!,texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
    const paint=()=>{ctx.fillStyle=sign.color;ctx.fillRect(0,0,1024,320);ctx.strokeStyle='#566449';ctx.lineWidth=12;ctx.strokeRect(12,12,1000,296);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#465343';ctx.font='bold 64px "Noto Sans Malayalam", sans-serif';ctx.fillText(translate(locale==='ml'&&!MALAYALAM_CATALOG[signKeys[sign.english]]?.trim()&&signPlaces[sign.english]?signPlaces[sign.english]:signKeys[sign.english],locale),512,135,950);ctx.fillStyle='#94503b';ctx.font='bold 55px Georgia, serif';ctx.fillText('KERALA · 2000',512,248,945);texture.needsUpdate=true;};
    paint();return {texture,paint};
  },[sign,locale]);
  useEffect(()=>{let active=true;void document.fonts.load('bold 64px "Noto Sans Malayalam"').then(()=>{if(active)paint();});return()=>{active=false;texture.dispose();};},[paint,texture]);
  return <mesh position={sign.position} rotation={[0,sign.yaw,0]}><planeGeometry args={[sign.width,sign.width*.3125]}/><meshStandardMaterial map={texture} roughness={1} side={DoubleSide}/></mesh>;
}
function Water({animated}:{animated:boolean}) {
  const geometry=useMemo(riverGeometry,[]),ref=useRef<Group>(null);
  const streaks=useMemo(()=>{const pieces=Array.from({length:23},(_,i)=>{const x=-74+i*7,g=new PlaneGeometry(1.3+i%4,.07);g.rotateX(-Math.PI/2);g.translate(x,WATER_LEVEL+.028,riverCenter(x)+Math.sin(i*2.2)*14);return g;});const merged=mergeGeometries(pieces,false)!;pieces.forEach(p=>p.dispose());return merged;},[]);
  useFrame(({clock})=>{if(ref.current&&animated)ref.current.position.x=Math.sin(clock.elapsedTime*.13)*.35;});
  return <>
    <mesh geometry={geometry}><meshStandardMaterial color="#4b9c98" roughness={.32} metalness={.04} side={DoubleSide}/></mesh>
    <mesh position={[220,WATER_LEVEL,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[274,1100]}/><meshStandardMaterial color="#579e9f" roughness={.38}/></mesh>
    <mesh position={[0,WATER_LEVEL,260]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[170,340]}/><meshStandardMaterial color="#579e9f" roughness={.38}/></mesh>
    <group ref={ref}><mesh geometry={streaks}><meshBasicMaterial color="#a0d0bd" transparent opacity={.65}/></mesh></group>
  </>;
}
function KeralaGeometry({quality='medium',animated=true,locale='en'}:{quality?:'low'|'medium'|'high';animated?:boolean;locale?:Locale}) {
  const collision=useMemo(staticArchitectureBoxes,[]);
  const architecture=useMemo(buildArchitecture,[]),ground=useMemo(createTerrain,[]),plants=useMemo(generatePlants,[]),paddyGrass=useMemo(generatePaddyGrass,[]);
  const roads=useMemo(()=>({village:ribbon(VILLAGE_PATH,3.8),tar:ribbon(VILLAGE_PATH.filter(([,z])=>z>=-260),3,.082),...Object.fromEntries(outsideKodalyCircle(CITY_PATH).flatMap((run,i)=>[[`city${i}`,ribbon(run,4.1)],[`cityTar${i}`,ribbon(run,3.1,.082)]])),temple:ribbon([[-6,-238],[12,-238],[22,-231]],2.4),tea:ribbon([[7,-190],[-10,-190]],2.1)}),[]);
  const frond=useMemo(()=>leafGeometry(),[]),banana=useMemo(()=>leafGeometry(true),[]),trunk=useMemo(()=>new CylinderGeometry(.75,1,1,7),[]),shrub=useMemo(()=>new CylinderGeometry(.4,1,1,7),[]);
  return <>
    <ExpansionGround/><MountainExpansion locale={locale}/><ChokkanaWorld quality={quality} locale={locale}/><AthirappillyWorld quality={quality} animated={animated} locale={locale}/><ChalakudyDam quality={quality} animated={animated} locale={locale}/><KodasseryWorld quality={quality} animated={animated}/><RegionalDetails quality={quality} animated={animated}/>
    <RigidBody type="fixed" colliders="trimesh"><mesh geometry={ground} receiveShadow><meshStandardMaterial vertexColors roughness={1}/></mesh></RigidBody>
    {Object.entries(roads).map(([key,geometry])=><mesh key={key} geometry={geometry} receiveShadow><meshStandardMaterial color={key==='tar'||key.startsWith('cityTar')?PALETTE.tar:PALETTE.sand} roughness={1} side={DoubleSide}/></mesh>)}
    <Water animated={animated}/><RiverNetwork animated={animated} quality={quality}/><TownWorld/><ChalakkudyCity/><V2WorldDressing/><CoconutGroves quality={quality}/><FlowerBeds quality={quality}/><Wildlife quality={quality}/><StuntParks/><NedumbasseryAirport/><SnehaTheeram animated={animated}/><TeaEstate quality={quality}/><MountainDressing quality={quality}/><GliderSites animated={animated}/><Stadium animated={animated}/><KodalyCircle quality={quality}/>
    {architecture.meshes.map(({color,geometry})=><mesh key={color} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.92} side={DoubleSide}/></mesh>)}
    <RigidBody type="fixed" colliders={false}>{collision.map(c=><CuboidCollider key={c.id} args={[c.size[0]/2,c.size[1]/2,c.size[2]/2]} position={c.position} rotation={c.rotation}/>)}</RigidBody>
    {architecture.signs.map(sign=><PaintedSign key={sign.english} sign={sign} locale={locale}/>)}
    <Plants data={plants.trunks} geometry={trunk}/><Plants data={plants.fronds} geometry={frond}/>
    <Plants data={plants.bananaTrunks} geometry={trunk}/><Plants data={plants.bananaLeaves} geometry={banana}/>
    {quality!=='low'&&<Plants data={plants.shrubs} geometry={shrub}/>}
    {quality!=='low'&&<GrassAssetMesh url={FIELD_GRASS_URL} data={paddyGrass}/>}
  </>;
}
export const KeralaWorld=memo(KeralaGeometry);
