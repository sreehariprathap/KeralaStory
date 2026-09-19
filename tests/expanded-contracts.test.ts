import { expect, it } from 'vitest';
import { LocaleSchema, SaveV2Schema, PreferencesSchema, DEFAULT_SETTINGS, DEFAULT_EQUIPPED } from '../src/contracts';
it('validates locale and standalone preferences', () => {
  expect(LocaleSchema.parse('ml')).toBe('ml');
  expect(() => LocaleSchema.parse('xx')).toThrow();
  expect(PreferencesSchema.parse({})).toEqual({locale:'en', controls:'auto', haptics:true, equipped:{...DEFAULT_EQUIPPED}});
});
it('validates parked bicycle coordinates and accepts only version two', () => {
  const value={version:2,worldVersion:'test',profile:{id:'local',displayName:'Traveler',avatarPresetId:'canopy',colors:{skin:'#ba805b',hair:'#292a25',clothing:'#285943'}},position:[0,76,-460],headingRad:0,safeSpawnId:'origin',visitedLandmarkIds:[],settings:DEFAULT_SETTINGS,updatedAt:'2026-09-14T00:00:00.000Z',locale:'en',bicycle:null};
  expect(SaveV2Schema.parse(value).bicycle).toBeNull();
  expect(() => SaveV2Schema.parse({...value,bicycle:{position:[Infinity,0,0],headingRad:0}})).toThrow();
  expect(() => SaveV2Schema.parse({...value,locale:'bad'})).toThrow();
});
