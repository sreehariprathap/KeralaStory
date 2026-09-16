import { describe, expect, it } from 'vitest';
import en from '../src/content/locales/en.json';
import ml from '../src/content/locales/ml.json';
import { createExpansionLayout } from '../src/content/world/expansionLayout';
import { createExpansionPlaces } from '../src/content/world/expansionPlaces';
import { localizedMapPlace, localizedPlace } from '../src/features/i18n/translate';

const layout = createExpansionLayout({ junction: [-7, 74.5, -446], panoramaTargets: [[65, 25, 54]] });
const places = createExpansionPlaces(layout);
const ids = layout.anchors.map((anchor) => anchor.id);

describe('expansion places', () => {
  it('maps every frozen anchor exactly once without duplicating coordinates', () => {
    expect(places.map((place) => place.id)).toEqual(ids);
    expect(new Set(places.map((place) => place.id)).size).toBe(9);
    for (const place of places) {
      const anchor = layout.anchors.find((candidate) => candidate.id === place.id)!;
      expect(place.zoneId).toBe('kodassery');
      expect(place.position).toEqual(anchor.position);
    }
  });

  it('has full and map labels, descriptions, and Malayalam fallback keys', () => {
    for (const id of ids) {
      expect(en[`place.${id}` as keyof typeof en]).toBeTruthy();
      expect(en[`map.place.${id}` as keyof typeof en]).toBeTruthy();
      expect(en[`landmark.${id}Description` as keyof typeof en]).toBeTruthy();
      expect(ml[`place.${id}` as keyof typeof ml]).toBe('');
      expect(ml[`map.place.${id}` as keyof typeof ml]).toBe('');
      expect(ml[`landmark.${id}Description` as keyof typeof ml]).toBe('');
      expect(localizedPlace(id, 'ml')).toBe(en[`place.${id}` as keyof typeof en]);
      expect(localizedMapPlace(id, 'ml')).toBe(en[`map.place.${id}` as keyof typeof en]);
    }
  });

  it('adds area and trail legend copy with Malayalam fallback', () => {
    for (const id of ['kodassery-summit', 'chokkana', 'athirappilly']) {
      expect(en[`area.${id}` as keyof typeof en]).toBeTruthy();
      expect(ml[`area.${id}` as keyof typeof ml]).toBe('');
    }
    expect(en['map.legendWaypoint' as keyof typeof en]).toBeTruthy();
    expect(ml['map.legendWaypoint' as keyof typeof ml]).toBe('');
  });
});
