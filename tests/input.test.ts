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
it('accumulates mouse look deltas across frames until a consumer clears them',()=>{
 const s=createInputState(),c=createInputCommands(s);c.addLook('mouse',10,-4);c.addLook('mouse',5,2);
 expect(s.lookX).toBeCloseTo(15);expect(s.lookY).toBeCloseTo(-2);
 c.clear('mouse');expect(s.lookX).toBe(0);expect(s.lookY).toBe(0);
});
