import { strict as assert } from 'node:assert';
import { checkpointPlacements, levelSections, mechanismX, placedSegments } from './level';
import { createRun, EMPTY_INPUT, stepRun } from './simulation';

for (const section of levelSections) assert.equal(section.segments[section.segments.length - 1]?.type, 'checkpoint', `${section.id} ends at a checkpoint`);
const checkpoints = checkpointPlacements(24);
assert.equal(checkpoints.length, 24);
for (let index = 0; index < checkpoints.length; index++) {
  assert.equal(checkpoints[index].xStart, mechanismX(index));
  if (index) assert(mechanismX(index) < mechanismX(index - 1), 'checkpoint x positions decrease');
}
const placed = placedSegments(-9000, 0).sort((a, b) => a.xStart - b.xStart);
for (let index = 1; index < placed.length; index++) assert(placed[index - 1].xEnd <= placed[index].xStart, 'map ranges do not overlap');
assert(placed.some(segment => segment.type === 'obstacle'), 'route contains obstacles');
assert(placed.some(segment => segment.type === 'obstacle' && segment.obstacle === 'spike-strip'), 'the route contains jumpable spikes');
assert(!placed.some(segment => 'decoration' in segment), 'route has no background decoration');
assert(!placed.some(segment => segment.type === 'obstacle' && ['pendulum', 'piston'].includes(segment.obstacle as string)), 'removed hazards stay off the route');
for (const segment of placed.filter((entry) => entry.type === 'obstacle')) {
  const run = createRun('playing');
  run.monsterX = 1e7;
  run.player.x = (segment.worldStart + segment.worldEnd) / 2;
  const after = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / 30);
  assert.equal(after.health, run.health, `${segment.obstacle} never reduces health`);
}
console.log('Level data passed: checkpoints, placement order and non-overlapping map ranges.');
