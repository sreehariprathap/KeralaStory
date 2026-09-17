import type { ReplicatedPlayerDto, RoomSnapshotDto, TransformDto } from '@kerala-story/protocol';
import { SnapshotBuffer, sampleSnapshot } from '../game/network/snapshotBuffer';
import { interpolateHeading, interpolateVec3 } from '../game/network/transformInterpolation';

export class RemoteSnapshots {
  private readonly players = new Map<string, SnapshotBuffer<TransformDto>>();
  private latestTime = -Infinity;
  push(snapshot: RoomSnapshotDto): boolean {
    if (snapshot.serverTimeMs <= this.latestTime) return false;
    this.latestTime = snapshot.serverTimeMs;
    const present = new Set(snapshot.players.map(player => player.id));
    for (const id of this.players.keys()) if (!present.has(id)) this.players.delete(id);
    for (const player of snapshot.players) {
      let buffer = this.players.get(player.id);
      if (!buffer) { buffer = new SnapshotBuffer(); this.players.set(player.id, buffer); }
      buffer.push({ serverTimeMs: snapshot.serverTimeMs, value: structuredClone(player.transform) });
    }
    return true;
  }
  sample(id: ReplicatedPlayerDto['id'], serverNowMs: number): TransformDto | null {
    const buffer = this.players.get(id);
    if (!buffer) return null;
    return sampleSnapshot(buffer.samples, serverNowMs - 100, (from, to, alpha) => ({
      position: [...interpolateVec3(from.position, to.position, alpha)],
      velocity: [...interpolateVec3(from.velocity, to.velocity, alpha)],
      headingRad: interpolateHeading(from.headingRad, to.headingRad, alpha),
    }));
  }
  clear() { this.players.clear(); this.latestTime = -Infinity; }
}
