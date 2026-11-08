import assert from 'node:assert/strict';
import { courseSegments, createRun, createStageRun, creditedForStage, EMPTY_INPUT, resolveAnswer, stepRun } from './simulation';
import { TIMER_START, HEARTS_2D, PROX2D_START_PX, SIGMA_SPAWN_GAP } from './rules';
import { sigmaRenderBounds } from './sigma';
import { VW } from './renderer';

const starts = [0, 3, 6, 10, 15, 20];
// Earlier questions are assumed correct: their clock parts are already fitted (capped at the finished dial).
const credited = [0, 3, 6, 10, 15, 15];
for (let stage = 1; stage <= 6; stage++) {
  let run = createStageRun(stage);
  const index = starts[stage - 1];
  assert.equal(run.stage, stage);
  assert.equal(run.perspective, '2d');
  assert.equal(run.mechanisms[0].index, index);
  assert.equal(run.correct, credited[stage - 1], `Level ${stage} starts with the earlier clock parts fitted`);
  assert.equal(run.credited, credited[stage - 1]);
  assert.equal(creditedForStage(stage), credited[stage - 1]);
  assert.equal(run.score, 0);
  assert.equal(run.distance, 0);
  assert.equal(run.timer, TIMER_START);
  assert.equal(run.health, HEARTS_2D);
  assert.equal(run.monsterX - run.player.x, SIGMA_SPAWN_GAP);
  const behind = courseSegments(run, run.player.x + 32, run.cameraX + VW + 400)
    .filter(segment => segment.type !== 'ground' && segment.worldEnd > run.player.x + 32);
  assert.deepEqual(behind.map(segment => segment.type === 'obstacle' ? segment.obstacle : segment.type), [],
    `Level ${stage} has no obstacle or spike behind λ's spawn`);
  if (stage < 3) {
     const sigmaBounds = sigmaRenderBounds(run);
     const sigmaScreenX = run.monsterX - run.cameraX;
     const lambdaScreenX = run.player.x - run.cameraX;
     assert(run.monsterX - (run.player.x + 32) > PROX2D_START_PX, `Level ${stage} avoids immediate danger effects`);
     assert(sigmaScreenX + sigmaBounds.left >= 0, `Level ${stage} Sigma starts onscreen`);
     assert(sigmaScreenX + sigmaBounds.right <= VW, `Level ${stage} shows all of Sigma`);
     assert(sigmaScreenX + sigmaBounds.left > lambdaScreenX + 32, `Level ${stage} keeps Sigma behind λ`);
   }
  for (let frame = 0; frame < 300; frame++) {
    run = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / 60);
    if (run.mode === 'focus') break;
  }
  assert.notEqual(run.mode, 'over', `Level ${stage} has a safe spawn`);
  assert.equal(run.activeIndex, index);
  assert(run.distance < 100, 'Skipped terrain must not count as earned distance');
  assert.equal(run.mode, 'focus');
  run = resolveAnswer(run, true, undefined, 100, 5);
  assert.equal(run.correct, credited[stage - 1] + (stage === 6 ? 0 : 1), 'only assessed answers add to the count');
  assert.equal(run.correct - run.credited, stage === 6 ? 0 : 1, 'supplementary terrain is unscored');
  assert.equal(run.stage, stage, 'Answering does not reset progression to level 1');
}
const vectorStart = createStageRun(3);
assert.equal(vectorStart.perspective, '2d');
assert.deepEqual(createStageRun(1), createRun('playing'));
console.log('Level selection passed: all six spawns, perspective, checkpoint, fresh state, distance and progression.');
