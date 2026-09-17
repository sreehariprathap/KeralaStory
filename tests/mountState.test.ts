import { expect,it } from 'vitest';
import { interactionReason } from '../src/game/vehicle/mountState';
it('requires grounded proximity to mount',()=>{
 expect(interactionReason('foot',true,1.9)).toBe('mount');expect(interactionReason('foot',true,2.1)).toBe('too-far');expect(interactionReason('foot',false,1)).toBe('airborne');
});
it('always lets the rider get off, even moving or airborne',()=>{
 for(const mode of ['bicycle','car','glider'] as const){expect(interactionReason(mode,true,0)).toBe('dismount');expect(interactionReason(mode,false,0)).toBe('dismount');}
});
