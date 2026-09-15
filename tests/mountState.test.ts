import { expect,it } from 'vitest';
import { interactionReason } from '../src/game/vehicle/mountState';
it('requires grounded proximity and braking before dismount',()=>{
 expect(interactionReason('foot',true,0,1.9)).toBe('mount');expect(interactionReason('foot',true,0,2.1)).toBe('too-far');expect(interactionReason('foot',false,0,1)).toBe('airborne');expect(interactionReason('bicycle',true,1,0)).toBe('brake');expect(interactionReason('bicycle',true,0,0)).toBe('dismount');
});
