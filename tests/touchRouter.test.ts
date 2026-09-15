import { expect, it } from 'vitest';
import { createInputState, createInputCommands } from '../src/game/input/inputState';
import { createTouchRouter } from '../src/game/input/touchRouter';
it('keeps move/look contacts independent and ignores unrelated fingers',()=>{
 const s=createInputState(),r=createTouchRouter(createInputCommands(s));
 r.start('move',1,100,100);r.start('look',2,200,100);r.move(1,100,60);r.move(2,215,110);
 expect(s.move.forward).toBe(1);expect(s.lookX).toBe(15);expect(s.lookY).toBe(10);
 r.end(2);expect(s.move.forward).toBe(1);r.move(3,500,500);expect(s.move.forward).toBe(1);
 r.end(1);expect(s.move.forward).toBe(0);
});
it('rejects a second contact on an occupied pad and clears on cancel',()=>{
 const s=createInputState(),c=createInputCommands(s),r=createTouchRouter(c);
 expect(r.start('move',1,0,0)).toBe(true);expect(r.start('move',2,0,0)).toBe(false);
 r.move(1,1,1);expect(s.move.x).toBe(0);c.press('toggleSprint');r.cancel();expect(s.sprintLocked).toBe(false);r.move(1,50,0);expect(s.move.x).toBe(0);
});
