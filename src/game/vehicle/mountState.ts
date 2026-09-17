import type { TravelMode } from '../../contracts';
/** Getting off is always allowed, even mid-air or at speed, so a stuck vehicle never traps its rider. */
export function interactionReason(mode:TravelMode,grounded:boolean,distance:number,mountDistance=2): 'mount'|'dismount'|'too-far'|'airborne' {
 if(mode!=='foot')return 'dismount';
 if(!grounded)return 'airborne';
 return distance<=mountDistance?'mount':'too-far';
}
