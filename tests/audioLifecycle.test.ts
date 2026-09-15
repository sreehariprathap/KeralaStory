import { expect,it } from 'vitest';
import { audioLevel } from '../src/game/audio/audioPolicy';
it('silences hidden, paused and muted play without changing stored volume',()=>{
 const settings={muted:false,volume:.5};expect(audioLevel(settings,'playing',true)).toBe(.09);
 expect(audioLevel(settings,'paused',true)).toBe(0);expect(audioLevel(settings,'playing',false)).toBe(0);expect(audioLevel({...settings,muted:true},'playing',true)).toBe(0);expect(settings.volume).toBe(.5);
});
