import { expect, it } from 'vitest';
import { createInputState, createInputCommands, readMovement, readFollowMovement, clearInput } from '../src/game/input/inputState';
it('normalizes touch diagonals and preserves analog strength',()=>{
 const state=createInputState(),c=createInputCommands(state);
 c.setMove('touch',1,1);expect(Math.hypot(readMovement(state,0).x,readMovement(state,0).z)).toBeCloseTo(1);
 c.setMove('touch',0,.4);expect(readMovement(state,0).z).toBeCloseTo(-.4);
});
it('sprint lock moves forward until explicitly cancelled, not after blur',()=>{
 const s=createInputState(),c=createInputCommands(s);c.press('toggleSprint');expect(readMovement(s,0).z).toBe(-1);expect(readMovement(s,0).running).toBe(true);
 c.setMove('touch',1,0);expect(readMovement(s,0).x).toBeGreaterThan(0);
 c.setMove('touch',0,-1);expect(s.sprintLocked).toBe(false);
 c.press('toggleSprint');c.setBrake(true);expect(s.sprintLocked).toBe(false);
 c.press('toggleSprint');clearInput(s);expect(readMovement(s,0).z).toBeCloseTo(0);
});
it('latest source owns movement; releasing it does not resurrect old motion',()=>{
 const s=createInputState(),c=createInputCommands(s);c.setMove('keyboard',0,1);c.setMove('touch',1,0);c.clear('touch');expect(readMovement(s,0).x).toBeCloseTo(0);expect(readMovement(s,0).z).toBeCloseTo(0);
 c.setMove('keyboard',0,1);c.clear('touch');expect(readMovement(s,0).z).toBe(-1);
});
it('queues actions and clears all input on ownership loss',()=>{
 const s=createInputState(),c=createInputCommands(s);c.press('jump');c.press('interact');c.addLook('touch',12,5);c.setBrake(true);clearInput(s);expect(s).toEqual(createInputState());
});
it('mouse-mode movement (readMovement) tracks a moving camera azimuth every frame; auto-mode (readFollowMovement) holds the direction from when the key was pressed',()=>{
 const s=createInputState(),c=createInputCommands(s);c.setMove('keyboard',0,1);
 // readMovement recomputes from the azimuth passed in on every call: turning the camera turns the movement direction.
 expect(readMovement(s,0).z).toBeCloseTo(-1);
 expect(readMovement(s,Math.PI/2).x).toBeCloseTo(-1);
 // readFollowMovement locks the azimuth reference at the moment the input started, ignoring later azimuth changes...
 expect(readFollowMovement(s,0).z).toBeCloseTo(-1);
 expect(readFollowMovement(s,Math.PI/2).z).toBeCloseTo(-1);
 // ...until the gesture is released and re-issued, which re-anchors it to the new azimuth.
 c.clear('keyboard');c.setMove('keyboard',0,1);
 expect(readFollowMovement(s,Math.PI/2).x).toBeCloseTo(-1);
});
it('auto-mode re-anchors keyboard movement to the current camera whenever the held keys change',()=>{
 const s=createInputState(),c=createInputCommands(s);
 // Hold D: the player runs right (+x) and the follow camera swings behind them (azimuth -π/2).
 c.setMove('keyboard',1,0);
 expect(readFollowMovement(s,0).x).toBeCloseTo(1);
 const behind=-Math.PI/2;
 expect(readFollowMovement(s,behind).x).toBeCloseTo(1);
 // Add W: forward-right is measured from the camera the player now sees, not from the old one.
 c.setMove('keyboard',1,1);
 const diagonal=readFollowMovement(s,behind);
 const cameraForward={x:-Math.sin(behind),z:-Math.cos(behind)},cameraRight={x:Math.cos(behind),z:-Math.sin(behind)};
 expect(diagonal.x*cameraForward.x+diagonal.z*cameraForward.z).toBeCloseTo(Math.SQRT1_2);
 expect(diagonal.x*cameraRight.x+diagonal.z*cameraRight.z).toBeCloseTo(Math.SQRT1_2);
 // Key repeats with the same keys keep the lock while the camera swings again.
 c.setMove('keyboard',1,1);
 expect(readFollowMovement(s,behind-Math.PI/4)).toEqual(diagonal);
});
it('touch movement keeps its gesture lock while the stick moves',()=>{
 const s=createInputState(),c=createInputCommands(s);
 c.setMove('touch',0,1);readFollowMovement(s,0);
 c.setMove('touch',.2,.9);
 expect(s.movementAzimuth).toBe(0);
});
it('accumulates mouse look deltas across frames until a consumer clears them',()=>{
 const s=createInputState(),c=createInputCommands(s);c.addLook('mouse',10,-4);c.addLook('mouse',5,2);
 expect(s.lookX).toBeCloseTo(15);expect(s.lookY).toBeCloseTo(-2);
 c.clear('mouse');expect(s.lookX).toBe(0);expect(s.lookY).toBe(0);
});
