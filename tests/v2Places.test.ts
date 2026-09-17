import { describe, expect, it } from 'vitest';
import type { Landmark } from '../src/contracts';
import { createV2Places, type V2PlaceAnchors } from '../src/content/world/v2Places';

const legacy: Landmark[] = [{
  id: 'harbor', zoneId: 'kodaly', label: 'Kodaly harbor', position: [48, 3, 77],
  discoveryRadiusM: 16, iconId: 'anchor', description: 'From the misty hills to the sea.',
}];

const anchor = (id: string, zoneId: 'kodassery' | 'kadambode', position: [number, number, number]) => ({ id, zoneId, position });
const input: V2PlaceAnchors = {
  legacy,
  towns: [anchor('chalakkudy', 'kadambode', [-430, 49, -120]), anchor('kodakara', 'kadambode', [-210, 32, -200]), anchor('malakkappara', 'kodassery', [-555, 81, -680])],
  silverStorm: anchor('silver-storm', 'kodassery', [40, 78, -685]),
  fuelStation: anchor('chalakkudy-fuel', 'kadambode', [-372, 48, -132]),
  coffeeShop: anchor('chalakkudy-coffee', 'kadambode', [-414, 49, -120]),
  malakkapparaTeaStop: anchor('malakkappara-tea', 'kodassery', [-532, 80, -642]),
};

describe('V2 place catalogue', () => {
  it('preserves legacy records and adds grounded town and stop records', () => {
    const places = createV2Places(input);
    expect(places).toHaveLength(8);
    expect(places[0]).toEqual(legacy[0]);
    expect(places.map(place => place.id)).toEqual([
      'harbor', 'chalakkudy', 'kodakara', 'malakkappara', 'silver-storm',
      'chalakkudy-fuel', 'chalakkudy-coffee', 'malakkappara-tea',
    ]);
    expect(places.find(place => place.id === 'malakkappara-tea')?.position).toEqual([-532, 80, -642]);
  });

  it('provides readable identity copy for all new records', () => {
    for (const place of createV2Places(input).slice(1)) {
      expect(place.label.length).toBeGreaterThan(3);
      expect(place.description.length).toBeGreaterThan(30);
      expect(place.iconId.length).toBeGreaterThan(0);
      expect(place.discoveryRadiusM).toBeGreaterThan(0);
    }
  });

  it('does not alias mutable anchor positions or accept duplicate IDs', () => {
    const places = createV2Places(input);
    const source = input.coffeeShop.position as [number, number, number];
    source[1] = 999;
    expect(places.find(place => place.id === 'chalakkudy-coffee')?.position[1]).toBe(49);
    expect(() => createV2Places({ ...input, fuelStation: anchor('harbor', 'kadambode', [-1, 1, -1]) })).toThrow('Duplicate');
    expect(() => createV2Places({ ...input, towns: [anchor('unknown-town', 'kadambode', [0, 0, 0])] })).toThrow('No copy');
  });
});
