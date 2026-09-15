import { describe, expect, it } from 'vitest';
import en from '../src/content/locales/en.json';
import ml from '../src/content/locales/ml.json';
import { localizedMapPlace, localizedPlace, localizedRegion, translate, translateFromCatalog, type TranslationKey } from '../src/features/i18n/translate';

describe('translation catalog', () => {
  it('returns the canonical English value for English', () => {
    expect(translate('region.kodassery', 'en')).toBe(en['region.kodassery']);
  });

  it('falls back for blank and whitespace Malayalam values', () => {
    const fixture = { greeting: 'Welcome' } as const;
    expect(translateFromCatalog('greeting', 'ml', fixture, { greeting: '' })).toBe('Welcome');
    expect(translateFromCatalog('greeting', 'ml', fixture, { greeting: '   ' })).toBe('Welcome');
  });

  it('preserves supplied Malayalam text', () => {
    const fixture = { greeting: 'Welcome' } as const;
    expect(translateFromCatalog('greeting', 'ml', fixture, { greeting: 'സ്വാഗതം' })).toBe('സ്വാഗതം');
  });

  it('keeps English and Malayalam key inventories in parity', () => {
    expect(Object.keys(ml).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(en).every(key => typeof en[key as TranslationKey] === 'string')).toBe(true);
  });

  it('resolves every region and place in the current world catalog', () => {
    for (const id of ['kodassery', 'kadambode', 'kurumali', 'kodaly']) {
      expect(localizedRegion(id, 'en')).not.toBe(id);
    }
    for (const id of ['origin', 'canopy', 'waterfall', 'paddy', 'temple', 'tea-shop', 'river-bridge', 'fishing-bank', 'market', 'lighthouse', 'harbor', 'spice-garden']) {
      expect(localizedPlace(id, 'ml')).toBe(en[`place.${id}` as keyof typeof en]);
    }
  });

  it('uses a supplied Malayalam full place name when the short map label is blank', () => {
    const english = { 'map.place.temple': 'Temple', 'place.temple': 'Village temple' };
    const malayalam = { 'map.place.temple': '  ', 'place.temple': 'ഗ്രാമക്ഷേത്രം' };
    expect(localizedMapPlace('temple', 'ml', english, malayalam)).toBe('ഗ്രാമക്ഷേത്രം');
    expect(localizedMapPlace('temple', 'en', english, malayalam)).toBe('Temple');
  });

  it('falls back from blank short and full labels to a readable ID', () => {
    expect(localizedMapPlace('unknown', 'ml', { 'map.place.unknown': ' ', 'place.unknown': '' }, {})).toBe('unknown');
  });
});
