import type { ExplorerControllerProps } from '../../contracts';
import type { MultiplayerSession } from './useMultiplayer';
import { localGuest, remoteGuests } from './roomSessionModel';
import { MultiplayerLocalController } from '../../game/player/MultiplayerLocalController';
import { RemoteExplorer } from '../../game/player/RemoteExplorer';

export interface MultiplayerSceneProps {
  session: MultiplayerSession;
  selfId: string | null;
  chatFocused: boolean;
}

/** Render-only guests sample from refs, so a moving room never re-renders React. */
export function MultiplayerRoomScene({ session, selfId, chatFocused, controller }: MultiplayerSceneProps & { controller: ExplorerControllerProps }) {
  const self = localGuest(session.snapshot, selfId);
  const others = remoteGuests(session.snapshot, selfId);
  if (!self) return null;
  return <>
    <MultiplayerLocalController player={self} session={session} controller={controller} focused={!chatFocused}/>
    {others.map(player => (
      <RemoteExplorer
        key={player.id}
        player={player}
        sample={() => session.remote.current.sample(player.id, Date.now() + (session.client.current?.serverOffsetMs ?? 0))}
        reducedMotion={controller.reducedMotion}
      />
    ))}
  </>;
}
