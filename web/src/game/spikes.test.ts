import assert from 'node:assert/strict';
import { placedSegments } from './level';
import { createRun, EMPTY_INPUT, PLAYER_STUMBLE_SPEED, PLAYER_W, stepRun } from './simulation';
import { HEARTS_2D, MAP_OBSTACLE_KNOCKBACK_PX, MAP_SPIKE_HEIGHT } from './rules';

const spike = placedSegments(-10000, 0).find(
  (segment) => segment.type === 'obstacle' && segment.obstacle === 'spike-strip',
);
assert(spike && spike.type === 'obstacle', 'the route includes a spike strip');
assert(MAP_SPIKE_HEIGHT > 0 && MAP_SPIKE_HEIGHT < 100, 'the spikes are high enough to read and jump');

function runAt(x: number) {
  const run = createRun('playing');
  run.monsterX = 1e7;
  run.player.x = x;
  run.mechanisms = run.mechanisms.map((mechanism) => ({ ...mechanism, solved: true, animation: 1 }));
  return run;
}

let hit = runAt(spike.worldEnd + PLAYER_W + 1);
for (let frame = 0; frame < 20 && hit.stumble === 0; frame++) {
  hit = stepRun(hit, { ...EMPTY_INPUT, left: true }, 1 / 60);
}
assert(hit.stumble > 0, 'touching spikes at ground height triggers a knockback');
assert(hit.player.x >= spike.worldEnd + MAP_OBSTACLE_KNOCKBACK_PX - PLAYER_STUMBLE_SPEED / 30,
  'the knockback clears the spike strip, allowing the remaining fixed substeps of that frame');
assert.equal(hit.health, HEARTS_2D, 'spikes use the existing stumble rule rather than taking health');

let jump = runAt(spike.worldEnd + 50);
for (let frame = 0; frame < 55; frame++) {
  jump = stepRun(jump, { ...EMPTY_INPUT, left: true, jump: frame === 0 }, 1 / 60);
}
assert.equal(jump.stumble, 0, 'a normal jump clears the spike height and width');
assert(jump.player.x + PLAYER_W < spike.worldStart, 'λ lands beyond the spikes');

console.log('Spike strip passed: ground contact stumbles, a normal jump clears the hazard.');
