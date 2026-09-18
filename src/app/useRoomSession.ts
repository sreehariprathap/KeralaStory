import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMultiplayer, type MultiplayerSession } from '../features/multiplayer/useMultiplayer';
import { canEnterWorld, roomCodeFromSearch, roomErrorMessage } from '../features/multiplayer/roomSessionModel';

export interface RoomSession {
  session: MultiplayerSession;
  lobbyOpen: boolean;
  entered: boolean;
  inRoom: boolean;
  selfId: string | null;
  chatFocused: boolean;
  initialCode: string;
  canEnter: boolean;
  errorMessage: string;
  openLobby(): void;
  closeLobby(): void;
  enter(): void;
  leave(): void;
  setChatFocused(focused: boolean): void;
}

export function useRoomSession(): RoomSession {
  const session = useMultiplayer();
  const [initialCode] = useState(() => roomCodeFromSearch(location.search) ?? '');
  const [lobbyOpen, setLobbyOpen] = useState(() => initialCode.length > 0);
  const [entered, setEntered] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);
  const selfId = session.welcome?.guestId ?? null;
  const inRoom = entered && session.welcome !== null;
  const canEnter = canEnterWorld(session.phase, session.snapshot, selfId);
  const errorMessage = useMemo(() => (session.error ? roomErrorMessage(session.error) : ''), [session.error]);

  // A room that ends underneath the player returns them to the title rather than a frozen world.
  useEffect(() => {
    if (entered && (session.phase === 'ended' || session.phase === 'error')) setEntered(false);
  }, [entered, session.phase]);

  const openLobby = useCallback(() => setLobbyOpen(true), []);
  const closeLobby = useCallback(() => setLobbyOpen(false), []);
  const enter = useCallback(() => { setEntered(true); setLobbyOpen(false); }, []);
  const leave = useCallback(() => { session.leave(); setEntered(false); setChatFocused(false); }, [session]);

  return { session, lobbyOpen, entered, inRoom, selfId, chatFocused, initialCode, canEnter, errorMessage, openLobby, closeLobby, enter, leave, setChatFocused };
}
