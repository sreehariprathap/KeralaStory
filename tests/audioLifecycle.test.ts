import { expect,it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/contracts';
import { audioLevel, DEFAULT_BGM_PATH } from '../src/game/audio/audioPolicy';

it('uses the supplied BGM asset with a 50 percent default volume',()=>{
 expect(DEFAULT_BGM_PATH).toBe('/assets/bgm.mp3');
 expect(DEFAULT_SETTINGS.volume).toBe(.5);
});

it('silences hidden, paused and muted play without changing stored volume',()=>{
 const settings={muted:false,volume:.5};expect(audioLevel(settings,'playing',true)).toBe(.09);
 expect(audioLevel(settings,'paused',true)).toBe(0);expect(audioLevel(settings,'playing',false)).toBe(0);expect(audioLevel({...settings,muted:true},'playing',true)).toBe(0);expect(settings.volume).toBe(.5);
});
