import { useState } from 'react';
import type { ExplorerProfile } from '../../contracts';
import type { MultiplayerSession } from './useMultiplayer';
import { parseLobbyInput } from './lobbyModel';
import './multiplayer.css';

export function MultiplayerEntry({ session, profile, onEnter, onClose }: { session: MultiplayerSession; profile: ExplorerProfile; onEnter: () => void; onClose: () => void }) {
  const [name, setName] = useState(profile.displayName);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [invalid, setInvalid] = useState('');
  const busy = session.phase === 'connecting' || session.phase === 'reconnecting';
  const connect = (join: boolean) => {
    const result = parseLobbyInput(code);
    if (!name.trim() || Array.from(name.trim()).length > 24 || /[<>\u0000-\u001f]/.test(name)) { setInvalid('Use a plain-text name of 1–24 characters.'); return; }
    if (join && !result.ok) { setInvalid('Enter an eight-character room code or invite link.'); return; }
    setInvalid(''); void session.connect({ ...profile, displayName: name.trim() }, join && result.ok ? result.roomCode : undefined);
  };
  return <section className="multiplayer-panel"><p>Explore with up to ten guests. Rooms are private and temporary. Your solo save stays on this device.</p>
    <label>Guest name<input value={name} maxLength={48} onChange={event => setName(event.target.value)} disabled={busy}/></label>
    <label>Room code or invite link<input value={code} onChange={event => setCode(event.target.value)} autoComplete="off" disabled={busy}/></label>
    <div className="multiplayer-actions"><button className="button button-primary" disabled={busy} onClick={() => connect(false)}>Create room</button><button className="button button-secondary" disabled={busy} onClick={() => connect(true)}>Join room</button></div>
    <p role="status">{invalid || session.error || (busy ? 'Connecting to your room…' : session.welcome ? `Room ${session.welcome.roomCode} · ${session.snapshot?.roster.length ?? 1}/10 guests` : '')}</p>
    {session.welcome && <button className="button button-primary" disabled={!session.snapshot?.players.some(player => player.id === session.welcome?.guestId) || session.phase !== 'connected'} onClick={onEnter}>Enter shared world</button>}
    <button className="button button-secondary" onClick={onClose}>Back to title</button>
  </section>;
}
