import type { BicycleTuning } from '../../content/assets/bikeProfiles';
import { createNitroState, stepNitro, type NitroState } from './carNitro';

export const BICYCLE_SPEED=9;
const ROADSTER_TUNING:BicycleTuning={topSpeed:BICYCLE_SPEED,acceleration:3};
export interface BicycleMotorState {speed:number;headingRad:number;reverseArmed:boolean;nitro:NitroState}
/** `airborne`: wheels are off the ground, so the bike keeps its speed and heading (input drives tricks instead). */
export interface BicycleIntent {forward:number;steer:number;brake:boolean;nitro?:boolean;airborne?:boolean}
export function createBicycleState(headingRad=0):BicycleMotorState{return {speed:0,headingRad,reverseArmed:true,nitro:createNitroState()};}
function approach(value:number,target:number,amount:number){return value<target?Math.min(target,value+amount):Math.max(target,value-amount);}
/** Arcade roadster: fixed physics step, measured collision response applied by caller. */
export function stepBicycle(state:BicycleMotorState,intent:BicycleIntent,dt:number,tuning:BicycleTuning=ROADSTER_TUNING){
  const forward=Math.max(-1,Math.min(1,intent.forward)),steer=Math.max(-1,Math.min(1,intent.steer));
  if(intent.airborne){stepNitro(state.nitro,false,dt);return {x:Math.sin(state.headingRad)*state.speed*dt,z:-Math.cos(state.headingRad)*state.speed*dt};}
  const boost=tuning.nitro;
  stepNitro(state.nitro,!!boost&&intent.nitro===true&&forward>0&&!intent.brake,dt);
  const boosting=!!boost&&state.nitro.active;
  const top=tuning.topSpeed+(boosting?boost.extraSpeed:0);
  const accel=tuning.acceleration*(boosting?boost.accelerationMultiplier:1);
  const brake=tuning.brake??7;
  if(intent.brake){state.speed=approach(state.speed,0,brake*dt);state.reverseArmed=false;}
  else if(forward>0){
    const target=top*forward;
    // Above the cap (e.g. nitro just ended) bleed speed off gently instead of snapping down.
    state.speed=approach(state.speed,target,(state.speed>target?Math.max(accel*.5,3):accel)*dt);state.reverseArmed=false;
  }
  else if(forward<0){
    if(state.speed>0){state.speed=approach(state.speed,0,brake*dt);state.reverseArmed=false;}
    else if(state.reverseArmed)state.speed=approach(state.speed,-2*Math.abs(forward),2*dt);
  } else {state.speed=approach(state.speed,0,1.2*dt);if(Math.abs(state.speed)<.01)state.reverseArmed=true;}
  const turn=Math.min(1,Math.abs(state.speed)/1.5)*(1.8-.8*Math.min(1,Math.abs(state.speed)/tuning.topSpeed));
  state.headingRad+=steer*turn*dt*(state.speed<0?-1:1);
  return {x:Math.sin(state.headingRad)*state.speed*dt,z:-Math.cos(state.headingRad)*state.speed*dt};
}
