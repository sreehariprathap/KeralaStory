import { Client, type Room } from '@colyseus/sdk';
import { ClientMessageSchema, RoomSnapshotSchema, ServerEventSchema, normalizeRoomCode, type AvatarAppearanceDto, type RoomSnapshotDto, type RoomWelcomeDto, type ServerEventDto } from '@kerala-story/protocol';
import type { SessionTokenRepository } from '../features/multiplayer/sessionToken';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';
export interface JoinProfile { displayName: string; appearance: AvatarAppearanceDto; worldVersion: string }
export interface RoomClientCallbacks {
  onPhase(phase: ConnectionPhase): void;
  onEvent(event: ServerEventDto): void;
  onWarning?(message: string): void;
}
export interface PatchedRoomState {
  phase: string; worldVersion: string; serverTimeMs: number;
  players: { forEach(callback: (value: string) => void): void };
  vehicles: { forEach(callback: (value: string) => void): void };
}
/** Decode the server's per-entity JSON map projection, then validate before rendering. */
export function decodeRoomState(state: PatchedRoomState): RoomSnapshotDto | null {
  try {
    const players: unknown[] = [], vehicles: unknown[] = [];
    state.players.forEach(value => players.push(JSON.parse(value)));
    state.vehicles.forEach(value => vehicles.push(JSON.parse(value)));
    const roster = players.map(player => {
      const value = player as { id: string; displayName: string; connected: boolean };
      return { id: value.id, displayName: value.displayName, connected: value.connected };
    });
    const result = RoomSnapshotSchema.safeParse({ phase: state.phase, worldVersion: state.worldVersion, serverTimeMs: state.serverTimeMs, players, vehicles, roster });
    return result.success ? result.data : null;
  } catch { return null; }
}

export class MultiplayerRoomClient {
  private room: Room<unknown, PatchedRoomState> | null = null;
  private generation = 0;
  private welcome: RoomWelcomeDto | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private cleanups: (() => void)[] = [];
  private readonly sdk: Client;
  serverOffsetMs = 0;
  rttMs = 0;
  constructor(private readonly endpoint: string, private readonly tokens: SessionTokenRepository, private readonly callbacks: RoomClientCallbacks) {
    this.sdk = new Client(endpoint);
  }
  async connect(profile: JoinProfile, code?: string) {
    await this.leave(false);
    const generation = ++this.generation;
    this.callbacks.onPhase('connecting');
    try {
      let room: Room<unknown, PatchedRoomState>;
      if (code) {
        const normalized = normalizeRoomCode(code);
        const url = new URL(this.endpoint); url.protocol = url.protocol === 'wss:' || url.protocol === 'https:' ? 'https:' : 'http:';
        url.pathname = `${url.pathname.replace(/\/$/, '')}/rooms/${normalized}`; url.search = ''; url.hash = '';
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(response.status === 404 ? 'ROOM_NOT_FOUND' : 'ROOM_ENDED');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('roomId' in data) || typeof data.roomId !== 'string') throw new Error('ROOM_NOT_FOUND');
        const saved = this.tokens.get(normalized); if (saved.warning) this.callbacks.onWarning?.(saved.warning);
        room = await this.sdk.joinById<PatchedRoomState>(data.roomId, { ...profile, ...(saved.token ? { reconnectToken: saved.token } : {}) });
      } else room = await this.sdk.create<PatchedRoomState>('kerala', profile);
      if (generation !== this.generation) { await room.leave(); return; }
      this.room = room;
      this.cleanups.push(room.onMessage('*', (type, payload) => this.receive(type, payload)));
      const onState = (state: PatchedRoomState) => { const snapshot = decodeRoomState(state); if (snapshot) this.receive('roomSnapshot', snapshot); };
      const onDrop = () => this.callbacks.onPhase('reconnecting');
      const onReconnect = () => this.callbacks.onPhase('connected');
      const onLeave = () => { this.stopPing(); this.callbacks.onPhase('ended'); };
      room.onStateChange(onState); room.onDrop(onDrop); room.onReconnect(onReconnect); room.onLeave(onLeave);
      this.cleanups.push(() => { room.onStateChange.remove(onState); room.onDrop.remove(onDrop); room.onReconnect.remove(onReconnect); room.onLeave.remove(onLeave); });
      if (room.state) onState(room.state);
      this.pingTimer = setInterval(() => this.send('ping', { clientTimeMs: Date.now() }), 500);
      this.callbacks.onPhase('connected');
    } catch (error) {
      if (generation !== this.generation) return;
      this.callbacks.onPhase('error'); throw error;
    }
  }
  send(type: string, payload: unknown): boolean {
    const parsed = ClientMessageSchema.safeParse({ type, payload });
    if (!parsed.success || !this.room) return false;
    this.room.send(parsed.data.type, parsed.data.payload); return true;
  }
  private receive(type: string | number, payload: unknown) {
    const parsed = ServerEventSchema.safeParse({ type, payload }); if (!parsed.success) return;
    const event = parsed.data;
    if (event.type === 'roomWelcome') {
      this.welcome = event.payload;
      const result = this.tokens.set(event.payload.roomCode, event.payload.reconnectToken);
      if (result.warning) this.callbacks.onWarning?.(result.warning);
    }
    if (event.type === 'pong') {
      const now = Date.now(); this.rttMs = Math.max(0, now - event.payload.clientTimeMs);
      this.serverOffsetMs = event.payload.serverTimeMs - (event.payload.clientTimeMs + now) / 2;
    }
    this.callbacks.onEvent(event);
  }
  private stopPing() { if (this.pingTimer) clearInterval(this.pingTimer); this.pingTimer = null; }
  async leave(forgetToken = true) {
    ++this.generation; this.stopPing();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    const room = this.room; this.room = null;
    if (forgetToken && this.welcome) this.tokens.remove(this.welcome.roomCode);
    this.welcome = null;
    if (room) await room.leave(true);
  }
}
