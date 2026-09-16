/** Shortest-arc, frame-rate independent follow; heading zero faces world north. */
export function followHeading(azimuth: number, heading: number, dt: number): number {
  const difference = Math.atan2(Math.sin(-heading - azimuth), Math.cos(-heading - azimuth));
  return azimuth + difference * (1 - Math.exp(-5 * Math.max(0, dt)));
}
