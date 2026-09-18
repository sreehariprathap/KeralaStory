/** Next selectable index in a vertical list, wrapping at both ends and skipping disabled rows. */
export function stepIndex(disabled: readonly boolean[], current: number, delta: 1 | -1): number {
  const count = disabled.length;
  for (let step = 1; step <= count; step++) {
    const next = (current + delta * step + count * step) % count;
    if (!disabled[next]) return next;
  }
  return current;
}

export function firstEnabled(disabled: readonly boolean[]): number {
  const index = disabled.findIndex(value => !value);
  return index === -1 ? 0 : index;
}
