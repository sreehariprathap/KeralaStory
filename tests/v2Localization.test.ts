import { describe, expect, it } from 'vitest';
import { localizedMapPlace, localizedPlace, translate } from '../src/features/i18n/translate';

describe('V2 place localization', () => {
  it('exposes English names and concise map labels for every added place', () => {
    expect(localizedPlace('chalakkudy', 'en')).toBe('Chalakkudy');
    expect(localizedMapPlace('silver-storm', 'en')).toBe('Silver Storm');
    expect(localizedMapPlace('chalakkudy-fuel', 'en')).toBe('Fuel station');
    expect(translate('landmark.malakkappara-teaDescription', 'en')).toMatch(/steel tumblers/i);
  });

  it('uses the established English fallback for untranslated Malayalam entries', () => {
    expect(localizedPlace('malakkappara', 'ml')).toBe('Malakkappara');
    expect(localizedMapPlace('chalakkudy-coffee', 'ml')).toBe('Coffee shop');
  });
});
