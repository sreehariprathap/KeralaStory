import type { TravelMode } from '../../contracts';
export function interactionReason(mode:TravelMode,grounded:boolean,speed:number,distance:number,mountDistance=2): 'mount'|'dismount'|'too-far'|'airborne'|'brake' {
 if(!grounded)return 'airborne';
 if(mode!=='foot')return Math.abs(speed)>.5?'brake':'dismount';
 return distance<=mountDistance?'mount':'too-far';
}
