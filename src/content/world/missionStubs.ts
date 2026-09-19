import type { ZoneId } from '../../contracts';

export interface MissionStub { id: string; zoneId: ZoneId; title: string; hint: string }

export const MISSION_STUBS: MissionStub[] = [
  { id: 'lost-boat-key', zoneId: 'kodaly', title: 'The jetty boatman lost his key', hint: 'Somewhere near the harbor jetty, half-buried in the sand.' },
  { id: 'tea-shop-delivery', zoneId: 'kadambode', title: "Rajan's tea needs a delivery", hint: 'A basket is waiting near the tea shop for someone headed to the market.' },
  { id: 'coconut-count', zoneId: 'kodassery', title: 'The canopy homes need a coconut count', hint: 'Climb toward the forest junction and count what you find along the way.' },
  { id: 'bridge-toll-riddle', zoneId: 'kurumali', title: 'The bridge keeper has a riddle', hint: 'Ask around near the river bridge — the answer floats downstream.' },
  { id: 'summit-flag', zoneId: 'kodassery', title: 'A flag waits at the summit trailhead', hint: 'Follow the summit track as far as your legs can carry you.' },
  { id: 'fishing-bank-net', zoneId: 'kodaly', title: 'A net went missing from the fishing bank', hint: 'Check along the shoreline near where the fishers gather at dawn.' },
];
