import type { RoomSnapshotDto } from '@kerala-story/protocol';
import type { RoomState } from './roomState.ts';

export function projectSnapshot(state: RoomState, snapshot: RoomSnapshotDto) {
  state.phase = snapshot.phase;
  state.worldVersion = snapshot.worldVersion;
  state.serverTimeMs = snapshot.serverTimeMs;
  const sync = (map: RoomState['players'], entities: { id: string }[]) => {
    const ids = new Set(entities.map(entity => entity.id));
    for (const id of map.keys()) if (!ids.has(id)) map.delete(id);
    for (const entity of entities) {
      const json = JSON.stringify(entity);
      if (map.get(entity.id) !== json) map.set(entity.id, json);
    }
  };
  sync(state.players, snapshot.players);
  sync(state.vehicles, snapshot.vehicles);
}
