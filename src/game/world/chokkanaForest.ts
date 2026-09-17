import { EXPANSION_LAYOUT, V2_ROUTES, isWater, terrainHeight } from '../../content/world/definition';
import { createRouteField } from './expansionTerrain';
import { createForestInstances } from './expansionInstances';
import { isStuntGround } from './stuntSites';

/** Deterministic broadleaf positions for the Chokkana forest. */
export function chokkanaForest(count: number) {
  const field=createRouteField([...EXPANSION_LAYOUT.routes,...V2_ROUTES]);
  return createForestInstances({seed:2000,count,bounds:{xMin:-665,xMax:-90,zMin:-610,zMax:-250},heightAt:terrainHeight,allowedAt:(x,z)=>{
    const road=field(x,z);
    if(isWater(x,z)||(road&&road.distance<road.width+8)||isStuntGround(x,z,4))return false;
    if(EXPANSION_LAYOUT.anchors.some(a=>Math.hypot(x-a.position[0],z-a.position[2])<19))return false;
    // Clear rays to the lower world and falls; never screen the panorama with near-summit canopy.
    if(x>-220&&z<-495)return false;
    return true;
  }});
}
