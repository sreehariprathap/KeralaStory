import type { TransformDto } from '@kerala-story/protocol';
import { walkingVelocity } from '../../packages/simulation/src/playerRules';
import { interpolateHeading } from '../game/network/transformInterpolation';
import type { NetworkInput } from './inputSender';

export interface PendingPrediction { input: NetworkInput; durationSeconds: number }
/** Collision-aware prediction may be injected by the client world; server transforms always win. */
export type PredictStep = (transform: TransformDto, input: NetworkInput, dt: number) => TransformDto;
export const predictWalking: PredictStep = (transform, input, dt) => {
  const velocity = walkingVelocity(input.moveX, input.moveZ);
  return { position: [transform.position[0] + velocity.x * dt, transform.position[1], transform.position[2] + velocity.z * dt],
    headingRad: Math.hypot(velocity.x, velocity.z) > 0 ? Math.atan2(velocity.x, -velocity.z) : transform.headingRad,
    velocity: [velocity.x, transform.velocity[1], velocity.z] };
};

export class LocalReconciliation {
  readonly pending: PendingPrediction[] = [];
  current: TransformDto;
  private target: TransformDto;
  private remaining = 0;
  private acknowledged = -1;
  constructor(initial: TransformDto, private readonly predict: PredictStep = predictWalking) {
    this.current = structuredClone(initial); this.target = structuredClone(initial);
  }
  predictInput(input: NetworkInput, dt: number) {
    const durationSeconds = Math.max(0, Math.min(.1, dt));
    this.pending.push({ input: structuredClone(input), durationSeconds });
    // Do not retain unbounded input when disconnected; reconnection starts from authority.
    if (this.pending.length > 180) this.pending.shift();
    this.current = this.predict(this.current, input, durationSeconds);
    this.target = this.predict(this.target, input, durationSeconds);
  }
  reconcile(authority: TransformDto, lastProcessedInput: number, safetyReset = false): 'blending' | 'safety-reset' | 'stale' {
    if (lastProcessedInput < this.acknowledged) return 'stale';
    this.acknowledged = lastProcessedInput;
    while (this.pending.length && this.pending[0].input.sequence <= lastProcessedInput) this.pending.shift();
    if (safetyReset) {
      this.pending.length = 0; this.current = structuredClone(authority); this.target = structuredClone(authority); this.remaining = 0;
      return 'safety-reset';
    }
    this.target = this.pending.reduce((state, pending) => this.predict(state, pending.input, pending.durationSeconds), structuredClone(authority));
    const distance = Math.hypot(...this.current.position.map((value, i) => value - this.target.position[i]));
    const angle = Math.abs(interpolateHeading(this.current.headingRad, this.target.headingRad, 1) - this.current.headingRad);
    this.remaining = distance > .35 || angle > Math.PI / 9 ? .18 : .1;
    return 'blending';
  }
  advance(dt: number): TransformDto {
    if (this.remaining <= 0) return this.current;
    const elapsed = Math.max(0, Math.min(dt, this.remaining));
    const alpha = elapsed / this.remaining;
    this.current = { position: this.current.position.map((value, i) => value + (this.target.position[i] - value) * alpha) as TransformDto['position'],
      headingRad: interpolateHeading(this.current.headingRad, this.target.headingRad, alpha), velocity: [...this.target.velocity] };
    this.remaining -= elapsed;
    return this.current;
  }
}
