import { HEARTS_2D } from './rules';
import assert from 'node:assert/strict';
import { createRun, EMPTY_INPUT, resolveAnswer, stepRun, groundHeight } from './simulation';
import { rampHeight, coordinateFrame, yUnit } from './coordinates';

for (const fps of [30, 60, 144]) for (const gradient of [4, 12, 1000]) {
  let run = createRun('focus');
  run.activeIndex = 0;
  run.player.x = run.mechanisms[0].x + 65;
  run.cameraX = run.player.x - 560;
  const effect = { kind: 'slope' as const, atX: 1, gradient };
  const wrong = resolveAnswer(run, false, effect);
  assert.equal(wrong.mechanisms[0].slope, undefined);
  assert.equal(groundHeight(wrong, -775), 440);
  run = resolveAnswer(run, true, effect);
  for (let i = 0; i < fps; i++) run = stepRun(run, EMPTY_INPUT, 1 / fps);
  const gate = run.mechanisms[0];
  assert.equal(rampHeight(gate, gate.x + 25 - 100) / yUnit(gate), gradient / 2);
  let climbed = false;
  for (let i = 0; i < fps * 2; i++) {
    run = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / fps);
    const frame = coordinateFrame(run);
    if (frame.x > 0.2 && frame.x < 0.8) {
      assert(Math.abs(frame.y - frame.x * gradient) < 1e-6);
      climbed = true;
    }
  }
  assert(climbed, 'λ must actually walk up the mathematical slope');
  assert(run.player.x < gate.x - 375, 'the full ramp remains traversable');
  assert.equal(run.health, HEARTS_2D);
  assert.equal(createRun('playing').mechanisms[0].slope, undefined);
}
console.log('Coordinate ramps passed: correct mathematical rise/run, actual player y collision, wrong-answer lock, traversal and restart at 30/60/144 fps.');
