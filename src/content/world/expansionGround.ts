import type { ExpansionLayout } from '../../contracts/worldExpansion';
import { createRouteField, createRectilinearTerrainChunk, sampleTerrainChunk } from '../../game/world/expansionTerrain';
import { nearestRouteSample, pointInPolygon } from './expansionLayout';
import type { WorldV2Layout } from '../../contracts/worldV2';
import { createV2GroundProfile } from './v2Ground';

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const axis = (min: number, max: number, step: number) => { const count=Math.ceil((max-min)/step); return Array.from({length:count+1},(_,i)=>min+(max-min)*i/count); };
const merge = (...axes: number[][]) => [...new Set(axes.flat().map(n=>Math.round(n*1e9)/1e9))].sort((a,b)=>a-b);

export function createExpansionGround(layout: ExpansionLayout, originalHeight: (x: number, z: number) => number, v2?: WorldV2Layout) {
  const field = createRouteField(layout.routes);
  // Car roads only: where a foot trail starts on a road, the road surface wins.
  const carField = createRouteField(layout.routes.filter(route => route.allowedModes.includes('car')));
  const footField = createRouteField(layout.routes.filter(route => !route.allowedModes.includes('car')));
  const profile = v2 ? createV2GroundProfile(v2) : null;
  const base = layout.anchors.find(anchor => anchor.id === 'kodassery-junction')!.position[1];
  const summit = layout.summitPosition;
  const mainRoad=layout.routes.find(r=>r.id==='chokkana-main-road')!;
  const crossing=nearestRouteSample(mainRoad,-440,-429).position;
  const axisX=40/Math.hypot(40,100),axisZ=100/Math.hypot(40,100);
  const bridgeLocal=(x:number,z:number)=>({along:(x-crossing[0])*axisX+(z-crossing[2])*axisZ,across:(x-crossing[0])*axisZ-(z-crossing[2])*axisX});
  const rectangle=(halfWidth:number,halfLength:number)=>([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([w,l])=>[crossing[0]+w*halfWidth*axisZ+l*halfLength*axisX,crossing[2]-w*halfWidth*axisX+l*halfLength*axisZ] as [number,number]);
  const streamBridge={position:crossing,yawRad:Math.atan2(axisX,axisZ),widthM:7,lengthM:18,footprint:rectangle(3.5,9)};
  const streamWater={id:'chokkana-stream-water',kind:'river' as const,surfaceY:crossing[1]-3,footprint:rectangle(25,4)};
  const summitRoute=layout.routes.find(r=>r.id==='summit-trail')!;
  const restShelves=[.25,.5,.75].map(t=>[...summitRoute.points[Math.round((summitRoute.points.length-1)*t)]] as [number,number,number]);
  const northXs=Array.from({length:55},(_,i)=>-78+i/54*166);
  const northZs=Array.from({length:67},(_,i)=>-499+i*2.5);
  // Chalakkudy Dam headwaters: a mountain backdrop rises north of the reservoir (now widened
  // east toward Kodassery Peaks), framing the river's source. It fades out toward the dam so
  // the crest and downstream basin stay authored.
  const reservoirHead=v2?.riverNodes.find(n=>n.id==='reservoir-head');
  const reservoirEastArm=v2?.riverNodes.find(n=>n.id==='reservoir-east-arm');
  const reservoirCenterX=reservoirHead&&reservoirEastArm?(reservoirHead.position[0]+reservoirEastArm.position[0])/2:reservoirHead?.position[0];
  const authoredHeight = (x: number, z: number) => {
    const route = field(x,z);
    let height = base - 8 + Math.sin(x * .018) * 3 + Math.sin(z * .021) * 3;
    const summitDistance = Math.hypot((x-summit[0]) * .9, z-summit[2]);
    height += (summit[1] - base + 8) * Math.exp(-Math.pow(summitDistance / 115, 2));
    if (x < -510) height = base - 26 * smooth((z + 401) / 5) + Math.sin(x * .035) * 1.5;
    if (reservoirCenterX!==undefined) {
      const north=smooth((-800-z)/30), lateral=Math.exp(-Math.pow((x-reservoirCenterX)/130,2));
      height += 95*north*lateral;
      // The dam access road climbs the hillside west of the crest; a broad local rise keeps that
      // hillside built up under it, instead of a bare plateau edge dropping straight to the valley.
      const shoulderDistance=Math.hypot((x+716)*.7,z+793);
      height += 62*Math.exp(-Math.pow(shoulderDistance/95,2));
    }
    if (route) {
      const blend = smooth((route.distance - route.width - 2) / 16);
      height = route.height * (1-blend) + height * blend;
    }
    for (const position of restShelves) {
      const distance=Math.hypot(x-position[0],z-position[2]), blend=smooth((distance-4)/6);
      height=position[1]*(1-blend)+height*blend;
    }
    for (const anchor of layout.anchors) {
      if (!['kodassery-summit','summit-trailhead','athirappilly-falls','athirappilly-lower-view'].includes(anchor.id)) continue;
      const distance = Math.hypot(x-anchor.position[0], z-anchor.position[2]);
      const radius = anchor.id === 'kodassery-summit' ? 10 : 7;
      const blend = smooth((distance-radius)/5);
      height = anchor.position[1] * (1-blend) + height * blend;
    }
    const bridge=bridgeLocal(x,z);
    const bridgeBlend=(1-smooth((Math.abs(bridge.across)-5)/8))*(1-smooth((Math.abs(bridge.along)-9)/14));
    height=crossing[1]*bridgeBlend+height*(1-bridgeBlend);
    for (const water of [...layout.waterBodies,streamWater]) if (pointInPolygon(x,z,water.footprint)) height = water.surfaceY - 3;
    return height;
  };
  // Reuse the original north mesh rather than placing a second approach floor on top.
  // Every original route/building vertex remains unchanged; only its empty western margin is benched.
  const northHeight = (x:number,z:number) => {
    const route=field(x,z), original=originalHeight(x,z);
    if (!route || x >= -15) return z< -481 ? profile?.apply(x,z,original) ?? original : original;
    const influence=(1-smooth((route.distance-route.width-2)/10))*smooth((-15-x)/12);
    const height=original*(1-influence)+authoredHeight(x,z)*influence;
    return z< -481 ? profile?.apply(x,z,height) ?? height : height;
  };
  const originalNorthChunk=createRectilinearTerrainChunk('original-north',northXs,northZs,northHeight);
  const southZs=Array.from({length:214},(_,j)=>{
    const river=-100+Math.sin(-78*.025)*5;
    if(j<=102)return -334+j*2;
    if(j<=110)return -130+(river-21+130)*(j-102)/8;
    if(j<=131)return river-21+42*(j-110)/21;
    if(j<=135)return river+21+(-64-river-21)*(j-131)/4;
    return -64+(j-135)*2;
  });
  const originalEdge = (z:number) => {
    if (z <= -334) return sampleTerrainChunk(originalNorthChunk,-78,z)!;
    if(z>=92)return originalHeight(-78,z);
    const j=Math.max(0,southZs.findIndex(next=>next>=z)-1),t=(z-southZs[j])/(southZs[j+1]-southZs[j]);
    return originalHeight(-78,southZs[j])*(1-t)+originalHeight(-78,southZs[j+1])*t;
  };
  const extensionHeight = (x:number,z:number) => {
    let height=profile?.apply(x,z,authoredHeight(x,z)) ?? authoredHeight(x,z);
    // River banks and town pads are carved after the authored roads: restore each road surface with the
    // same blend the authored pass used, so no later carving cuts a step across a road.
    // Authored clearings (summit, falls, viewpoints) keep their own levelling.
    const core=carField(x,z), v2Core=profile?.field(x,z);
    // Clearings and the Athirappilly walking trail keep their own levels; both fade in over a few metres
    // so the restored road surface meets them without a step.
    const clearing=Math.min(...layout.anchors.filter(anchor=>['kodassery-summit','summit-trailhead','athirappilly-falls','athirappilly-lower-view'].includes(anchor.id))
      .map(anchor=>smooth((Math.hypot(x-anchor.position[0],z-anchor.position[2])-(anchor.id==='kodassery-summit'?10:7)-2)/8)),1);
    const foot=footField(x,z), footKeep=foot?smooth((foot.distance-foot.width-1)/6):1;
    if(core&&!(v2Core&&v2Core.distance<core.distance)){
      const weight=(1-smooth((core.distance-core.width-2)/16))*clearing*footKeep;
      height=core.height*weight+height*(1-weight);
    }
    if (z>=-499 && z<=92 && x>=-98 && x<=-78) {
      const blend=smooth((-78-x)/20);
      height=originalEdge(z)*(1-blend)+height*blend;
    }
    if (x>=-78 && x<=88 && z>=-519 && z<=-499) {
      const blend=smooth((-499-z)/20), edge=sampleTerrainChunk(originalNorthChunk,x,-499)!;
      const v2Road=profile?.field(x,z);
      if(v2Road&&v2Road.distance<=v2Road.width+2){
        const authoredEdge=profile!.apply(x,-499,authoredHeight(x,-499));
        height+=(edge-authoredEdge)*(1-blend);
      }else height=edge*(1-blend)+height*blend;
    }
    return height;
  };
  // Shared edges use the exact same sample coordinates, not merely the same height formula.
  const bounds=v2?.bounds ?? layout.bounds;
  const westZs=v2 ? merge(axis(bounds.zMin,-499,2),northZs,southZs,axis(92,bounds.zMax,2)) : merge(axis(bounds.zMin,-499,2),northZs,axis(-334,-240,2));
  const west=createRectilinearTerrainChunk('expansion-west',axis(bounds.xMin,-78,2),westZs,extensionHeight);
  const north=createRectilinearTerrainChunk('expansion-north',northXs,westZs.filter(z=>z<=-499),extensionHeight);
  const chunks=[west,north];
  if(v2&&bounds.xMax>88)chunks.push(createRectilinearTerrainChunk('expansion-east',axis(88,bounds.xMax,2),north.zCoordinates, (x,z)=>{
    const edge=sampleTerrainChunk(north,88,z)!;
    const blend=smooth((x-88)/12);
    return edge*(1-blend)+extensionHeight(x,z)*blend;
  }));
  const heightAt=(x:number,z:number):number|null=> {
    if(x>=-78 && z>=-499) return sampleTerrainChunk(originalNorthChunk,x,z);
    for(const chunk of chunks) { const y=sampleTerrainChunk(chunk,x,z); if(y!==null)return y; }
    return null;
  };
  const deckHeightAt=(x:number,z:number):number|null=>pointInPolygon(x,z,streamBridge.footprint)?crossing[1]:profile?.bridgeDeckAt(x,z)??null;
  return { chunks, originalNorthChunk, heightAt, field, restShelves, streamBridge, streamWater, deckHeightAt, v2:profile };
}
