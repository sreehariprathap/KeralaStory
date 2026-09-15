export const BICYCLE_SPEED=9;
export interface BicycleMotorState {speed:number;headingRad:number;reverseArmed:boolean}
export interface BicycleIntent {forward:number;steer:number;brake:boolean}
export function createBicycleState(headingRad=0):BicycleMotorState{return {speed:0,headingRad,reverseArmed:true};}
function approach(value:number,target:number,amount:number){return value<target?Math.min(target,value+amount):Math.max(target,value-amount);}
/** Arcade roadster: fixed physics step, measured collision response applied by caller. */
export function stepBicycle(state:BicycleMotorState,intent:BicycleIntent,dt:number){
  const forward=Math.max(-1,Math.min(1,intent.forward)),steer=Math.max(-1,Math.min(1,intent.steer));
  if(intent.brake){state.speed=approach(state.speed,0,7*dt);state.reverseArmed=false;}
  else if(forward>0){state.speed=approach(state.speed,BICYCLE_SPEED*forward,3*dt);state.reverseArmed=false;}
  else if(forward<0){
    if(state.speed>0){state.speed=approach(state.speed,0,7*dt);state.reverseArmed=false;}
    else if(state.reverseArmed)state.speed=approach(state.speed,-2*Math.abs(forward),2*dt);
  } else {state.speed=approach(state.speed,0,1.2*dt);if(Math.abs(state.speed)<.01)state.reverseArmed=true;}
  const turn=Math.min(1,Math.abs(state.speed)/1.5)*(1.8-.8*Math.min(1,Math.abs(state.speed)/BICYCLE_SPEED));
  state.headingRad+=steer*turn*dt*(state.speed<0?-1:1);
  return {x:Math.sin(state.headingRad)*state.speed*dt,z:-Math.cos(state.headingRad)*state.speed*dt};
}
