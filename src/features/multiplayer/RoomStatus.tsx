import { useState } from 'react';
import type { SeatId } from '@kerala-story/protocol';
import type { MultiplayerSession } from './useMultiplayer';

export function RoomStatus({ session, onLeave, onChatFocus }: { session: MultiplayerSession; onLeave: () => void; onChatFocus: (focused: boolean) => void }) {
  const [copy, setCopy] = useState('');
  const [draft, setDraft] = useState('');
  const [seat, setSeat] = useState<SeatId>('driver');
  const [muted, setMuted] = useState<string[]>([]);
  const self = session.snapshot?.players.find(player => player.id === session.welcome?.guestId);
  const nearest = self && session.snapshot?.vehicles.map(vehicle => ({ vehicle, distance: Math.hypot(...vehicle.transform.position.map((value, index) => value - self.transform.position[index])) })).sort((a, b) => a.distance - b.distance)[0];
  const connected = session.phase === 'connected';
  const copyInvite = async () => { try { const url = new URL(location.href); url.search = ''; url.searchParams.set('room', session.welcome!.roomCode); await navigator.clipboard.writeText(url.toString()); setCopy('Invite copied.'); } catch { setCopy('Copy failed. Select and copy the room code instead.'); } };
  return <aside className="multiplayer-room" aria-label="Shared room">
    <details><summary>Room <code>{session.welcome?.roomCode}</code> · {session.snapshot?.roster.length ?? 0}/10</summary>
      <p role="status">{session.phase === 'connected' ? 'Connected' : session.phase === 'reconnecting' ? 'Reconnecting… Movement is paused.' : 'Room connection ended. Return to title to reconnect.'}</p>
      <button className="button button-secondary" onClick={() => void copyInvite()}>Copy invite</button><p role="status">{copy}</p>
      <ul>{session.snapshot?.roster.map(guest => <li key={guest.id}>{guest.displayName} {guest.connected ? '' : '· Reconnecting'}{guest.id !== self?.id && <button onClick={() => setMuted(value => value.includes(guest.id) ? value.filter(id => id !== guest.id) : [...value, guest.id])}>{muted.includes(guest.id) ? 'Unmute' : 'Mute'} chat</button>}</li>)}</ul>
      <button className="button button-secondary" onClick={onLeave}>Leave room</button>
    </details>
    {session.error && <p role="alert">{session.error}</p>}
    {self?.travel.kind === 'vehicle' ? <div className="multiplayer-seat"><span>Seat: {self.travel.seatId}</span><button className="button button-secondary" disabled={!connected} onClick={() => session.client.current?.send('exitVehicle', {})}>Exit vehicle</button></div> : nearest && nearest.distance < 6 ? <div className="multiplayer-seat"><label>Vehicle seat<select value={seat} onChange={event => setSeat(event.target.value as SeatId)}>{(nearest.vehicle.kind === 'car' ? ['driver', 'frontPassenger', 'rearLeft', 'rearRight'] : ['rider', 'passenger']).map(value => <option key={value} value={value}>{value}</option>)}</select></label><button className="button button-secondary" disabled={!connected} onClick={() => session.client.current?.send('enterVehicle', { vehicleId: nearest.vehicle.id, preferredSeat: nearest.vehicle.kind === 'bicycle' && !['rider', 'passenger'].includes(seat) ? 'rider' : seat })}>Enter {nearest.vehicle.kind}</button></div> : null}
    <details onToggle={event => { if (!event.currentTarget.open) onChatFocus(false); }}><summary>Room chat</summary><form className="multiplayer-chat" onSubmit={event => { event.preventDefault(); if (draft.trim() && session.client.current?.send('chatSend', { text: draft })) setDraft(''); }}>
      <ol aria-label="Room messages" aria-live="polite">{session.messages.filter(message => !muted.includes(message.senderId)).map(message => <li key={message.id}><strong>{message.senderName}</strong>: {message.text}</li>)}</ol>
      <label>Message<input value={draft} maxLength={280} disabled={!connected} onFocus={() => onChatFocus(true)} onBlur={() => onChatFocus(false)} onChange={event => setDraft(event.target.value)}/></label><button className="button button-primary" disabled={!connected || !draft.trim()}>Send</button>
    </form></details>
  </aside>;
}
