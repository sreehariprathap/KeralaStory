import type { TravelMode } from '../../contracts';
export function interactionReason(mode:TravelMode,grounded:boolean,speed:number,distance:number): 'mount'|'dismount'|'too-far'|'airborne'|'brake' {
 if(!grounded)return 'airborne';
 if(mode==='bicycle')return Math.abs(speed)>.5?'brake':'dismount';
 return distance<=2?'mount':'too-far';
}
