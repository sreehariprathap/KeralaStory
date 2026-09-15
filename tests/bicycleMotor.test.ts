import { expect, it } from 'vitest';
import { createBicycleState, stepBicycle } from '../src/game/vehicle/bicycleMotor';
it('accelerates to capped cruise and brakes without immediate reverse',()=>{
 const s=createBicycleState();for(let i=0;i<300;i++)stepBicycle(s,{forward:1,steer:0,brake:false},1/60);
 expect(s.speed).toBeCloseTo(9);
 for(let i=0;i<180;i++)stepBicycle(s,{forward:-1,steer:0,brake:false},1/60);
 expect(s.speed).toBe(0);
 stepBicycle(s,{forward:0,steer:0,brake:false},1/60);for(let i=0;i<120;i++)stepBicycle(s,{forward:-1,steer:0,brake:false},1/60);
 expect(s.speed).toBe(-2);
});
it('coasts down and cannot strafe while stationary',()=>{
 const s=createBicycleState();stepBicycle(s,{forward:0,steer:1,brake:false},1/60);expect(s.headingRad).toBe(0);
 s.speed=3;for(let i=0;i<180;i++)stepBicycle(s,{forward:0,steer:0,brake:false},1/60);expect(s.speed).toBe(0);
});
it('makes identical fixed-step travel regardless of render batching',()=>{
 const run=(batch:number)=>{const s=createBicycleState();let z=0;for(let i=0;i<360;i+=batch)for(let j=0;j<batch;j++)z+=stepBicycle(s,{forward:1,steer:.1,brake:false},1/60).z;return z;};
 expect(run(1)).toBeCloseTo(run(2),8);expect(run(2)).toBeCloseTo(run(4),8);
});
