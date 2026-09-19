/**
 * Drives a physics car along every car road, both ways, on the shared collision world, and reports
 * how smooth the ride was. Used while tuning the road network for racing.
 *   npx tsx scripts/drive-roads.ts [roadId...]
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { roadDriveReport, ROAD_DRIVE_ROUTES } from '../tests/support/roadDrive';

await RAPIER.init();
const only = process.argv.slice(2);
for (const route of ROAD_DRIVE_ROUTES.filter(r => !only.length || only.includes(r.id))) {
  for (const reverse of [false, true]) {
    const r = roadDriveReport(route, reverse);
    const flag = !r.finished || r.airborneMs > 150 || r.maxJolt > 9 || r.maxOffset > route.halfWidth + .5 || r.maxTilt > .5;
    console.log(`${flag ? '!!' : 'ok'} ${route.id}${reverse ? ' (rev)' : ''} finished=${r.finished} t=${r.seconds.toFixed(1)}s avg=${r.averageSpeed.toFixed(1)}m/s air=${r.airborneMs}ms jolt=${r.maxJolt.toFixed(1)}@${r.joltAt} offset=${r.maxOffset.toFixed(1)}@${r.offsetAt} tilt=${r.maxTilt.toFixed(2)}${r.stuckAt ? ' STUCK@' + r.stuckAt : ''}`);
    if (r.events.length) console.log('     ' + r.events.join(' | '));
  }
}
