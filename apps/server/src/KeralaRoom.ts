import { CloseCode, Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { ClientMessageSchema, type RoomErrorDto, type RoomSnapshotDto } from '@kerala-story/protocol';
import { addPlayer, createSimulationWorld, disposeSimulationWorld, launchGlider, playerSnapshots, removePlayer, setPlayerConnected, stepSimulation, submitPlayerInput, type SimulationWorld } from '@kerala-story/simulation';
import { Admission, AdmissionError, JoinOptionsSchema } from './admission.ts';
import { ChatService } from './chatService.ts';
import { InputQueue, ServerTicker } from './inputQueue.ts';
import { liveRooms } from './liveRooms.ts';
import { RoomMetrics } from './metrics.ts';
import { projectSnapshot } from './patchProjector.ts';
import { roomRegistry } from './roomRegistry.ts';
import { RoomState } from './roomState.ts';

export class KeralaRoom extends Room<{ state: RoomState }> {
  state = new RoomState({ phase: 'waiting', worldVersion: '', serverTimeMs: 0 });
  readonly metrics = new RoomMetrics();
  readonly ticker = new ServerTicker();
  private readonly intentQueue = new InputQueue();
  private readonly chat = new ChatService();
  private readonly dropped = new Map<string, string>();
  private simulation!: SimulationWorld;
  private admission!: Admission;
  code = '';

  async onCreate() {
    this.autoDispose = false;
    // Admission owns connected + grace capacity and returns the explicit ROOM_FULL code.
    this.maxClients = Infinity;
    this.maxMessagesPerSecond = 60;
    await this.setPrivate(true);
    this.setPatchRate(null);
    this.simulation = await createSimulationWorld();
    this.admission = new Admission(this.simulation.definition.version, Date.now());
    this.state.worldVersion = this.simulation.definition.version;
    this.code = roomRegistry.register(this.roomId);
    liveRooms.register({ roomId: this.roomId, code: this.code, metrics: this.metrics });
    this.onMessage('*', (client, type, payload) => this.message(client, type, payload));
    this.setSimulationInterval(delta => this.advance(delta), 1000 / 60);
  }
  onAuth(_client: Client, raw: unknown, _context: AuthContext) {
    const parsed = JoinOptionsSchema.safeParse(raw);
    if (!parsed.success) throw new ServerError(400, 'INVALID_MESSAGE');
    if (parsed.data.worldVersion !== this.state.worldVersion) throw new ServerError(409, 'WORLD_VERSION_MISMATCH');
    return true;
  }
  onJoin(client: Client, options: unknown) {
    this.expire();
    try {
      const joined = this.admission.join(client.sessionId, options, Date.now());
      try {
        if (joined.reconnected) setPlayerConnected(this.simulation, joined.guest.id, true);
        else addPlayer(this.simulation, { id: joined.guest.id, displayName: joined.guest.displayName, appearance: joined.guest.appearance });
      } catch { this.admission.leave(client.sessionId, Date.now()); throw new AdmissionError('ROOM_ENDED'); }
      this.metrics.increment(joined.reconnected ? 'reconnects' : 'joins');
      client.send('roomWelcome', { roomCode: this.code, guestId: joined.guest.id, reconnectToken: joined.token });
      client.send('roomSnapshot', this.snapshot());
      for (const message of this.chat.history()) client.send('chatAccepted', message);
      this.publish();
    } catch (error) {
      throw new ServerError(400, error instanceof AdmissionError ? error.code : 'INVALID_MESSAGE');
    }
  }
  onDrop(client: Client) {
    const id = this.admission.disconnect(client.sessionId, Date.now());
    if (!id) return;
    this.dropped.set(client.sessionId, id);
    this.intentQueue.clear(id);
    setPlayerConnected(this.simulation, id, false);
    this.publish();
    void this.allowReconnection(client, 60).catch(() => { /* Explicit expiry owns simulation cleanup. */ });
  }
  onReconnect(client: Client) {
    const id = this.dropped.get(client.sessionId);
    if (!id || !this.admission.resumeTransport(id, client.sessionId, Date.now())) { client.leave(CloseCode.FAILED_TO_RECONNECT); return; }
    this.dropped.delete(client.sessionId);
    setPlayerConnected(this.simulation, id, true);
    this.metrics.increment('reconnects');
    client.send('roomSnapshot', this.snapshot());
    this.publish();
  }
  onLeave(client: Client, code?: number) {
    if (code === CloseCode.CONSENTED) {
      const id = this.admission.leave(client.sessionId, Date.now());
      if (id) { removePlayer(this.simulation, id); this.intentQueue.remove(id); this.chat.removeGuest(id); }
    }
    this.dropped.delete(client.sessionId);
    this.publish();
  }
  private message(client: Client, type: string | number, payload: unknown) {
    const guest = this.admission.bySession(client.sessionId);
    const message = ClientMessageSchema.safeParse({ type, payload });
    if (!guest || !message.success) { this.metrics.increment('rejectedInput'); this.error(client, 'INVALID_MESSAGE'); return; }
    switch (message.data.type) {
      case 'input':
        if (this.state.phase !== 'playing' || !this.intentQueue.push(guest.id, message.data.payload)) { this.metrics.increment('rejectedInput'); this.error(client, 'INVALID_MESSAGE'); }
        break;
      case 'ready':
        if (message.data.payload.worldVersion !== this.state.worldVersion) this.error(client, 'WORLD_VERSION_MISMATCH');
        else { this.state.phase = 'playing'; this.publish(); }
        break;
      case 'leave': client.leave(CloseCode.CONSENTED); break;
      case 'ping': client.send('pong', { clientTimeMs: message.data.payload.clientTimeMs, serverTimeMs: Date.now() }); break;
      case 'chatSend': {
        const result = this.chat.send(guest, message.data.payload.text, Date.now());
        if ('error' in result) { this.metrics.increment('rejectedChat'); this.error(client, result.error); }
        else this.broadcast('chatAccepted', result.message);
        break;
      }
      case 'enterVehicle': case 'exitVehicle': this.error(client, 'VEHICLE_DENIED'); break;
      case 'launchGlider':
        if (this.state.phase !== 'playing' || !launchGlider(this.simulation, guest.id)) this.error(client, 'GLIDER_DENIED');
        break;
    }
  }
  private error(client: Client, code: RoomErrorDto['code']) { client.send('roomError', { code, message: code.replaceAll('_', ' ') }); }
  private expire() {
    for (const id of this.admission.expire(Date.now())) { removePlayer(this.simulation, id); this.intentQueue.remove(id); this.chat.removeGuest(id); }
  }
  advance(deltaMs: number) {
    this.expire();
    if (this.admission.shouldClose(Date.now())) { this.metrics.closeReason = 'empty'; this.state.phase = 'closing'; this.publish(); void this.disconnect(); return; }
    this.ticker.advance(deltaMs, () => {
      const started = performance.now();
      for (const [id, input] of this.intentQueue.drain()) if (!submitPlayerInput(this.simulation, id, input)) this.metrics.increment('rejectedInput');
      if (this.state.phase === 'playing') stepSimulation(this.simulation, 1 / 60);
      this.metrics.sample('tickMs', performance.now() - started);
    }, () => this.publish());
  }
  snapshot(): RoomSnapshotDto {
    const players = playerSnapshots(this.simulation);
    return { phase: this.state.phase as RoomSnapshotDto['phase'], worldVersion: this.state.worldVersion, players, vehicles: [], roster: players.map(({ id, displayName, connected }) => ({ id, displayName, connected })), serverTimeMs: Date.now() };
  }
  private publish() {
    const snapshot = this.snapshot();
    this.metrics.activeGuests = snapshot.players.filter(player => player.connected).length;
    this.metrics.occupancy = this.admission.guests.size;
    projectSnapshot(this.state, snapshot);
    // Size is DTO projection bytes; transport-encoded patch bytes require a transport sample.
    this.metrics.sample('patchBytes', Buffer.byteLength(JSON.stringify(snapshot)));
    this.broadcastPatch();
  }
  onDispose() {
    roomRegistry.remove(this.code, this.roomId);
    liveRooms.remove(this.roomId);
    this.metrics.closeReason ??= 'shutdown';
    if (this.simulation) disposeSimulationWorld(this.simulation);
  }
}
