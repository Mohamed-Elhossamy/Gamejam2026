import assert from 'node:assert/strict';
import {
  createRun, createStageRun, EMPTY_INPUT, resolveAnswer, stepRun,
  groundHeight, hasGround, makeMechanism, setPaused,
} from './simulation';
import { motionScale } from './coordinates';
import { HEARTS_2D } from './rules';

// The same 2D renderer/physics path is used at every selectable stage.
for (const fps of [30, 60, 144]) {
  for (let stage = 1; stage <= 6; stage++) {
    let run = createStageRun(stage);
    const start = run.player.x;
    run.monsterX = start + 10000;
    for (let i = 0; i < fps / 5; i++)
      run = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / fps);
    assert.equal(run.perspective, '2d');
    assert(run.player.x < start, `stage ${stage} keeps leftward movement`);
    assert.equal(run.player.z, 0);
    assert.equal(run.monsterZ, 0);
    assert.equal(stepRun(setPaused(run, true), EMPTY_INPUT, 0.1).timer, run.timer);
  }

  // Retain the maths-driven lift and its physical support.
  let liftRun = createRun('focus');
  liftRun.activeIndex = 0;
  liftRun.player.x = liftRun.mechanisms[0].x + 65;
  liftRun = resolveAnswer(liftRun, true, { kind: 'motion', velocity: 10, duration: 2 });
  for (let i = 0; i < fps; i++) liftRun = stepRun(liftRun, EMPTY_INPUT, 1 / fps);
  const lift = liftRun.mechanisms[0];
  assert(Math.abs((440 - groundHeight(liftRun, liftRun.player.x + 16)) / motionScale(lift) - 10) < 1e-7);
  assert(Math.abs(liftRun.player.y + 44 - groundHeight(liftRun, liftRun.player.x + 16)) < 1e-7);
  assert.equal(liftRun.health, HEARTS_2D);

  // Check a long sequence of checkpoint entries/answers, including the former
  // stage-3 switch, without a camera freeze or state reset.
  let run = createRun('playing');
  for (let index = 0; index < 27; index++) {
    const gate = makeMechanism(index);
    run.mechanisms = [gate];
    run.player.x = gate.x + 66;
    run.player.y = 396;
    run.monsterX = gate.x + 10000;
    const timer = run.timer;
    run = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / fps);
    assert.equal(run.mode, 'focus', `checkpoint ${index} opens immediately`);
    assert.equal(run.perspective, '2d');
    assert(run.timer < timer, 'no camera-transition freeze');
    const paused = setPaused(run, true);
    assert.equal(stepRun(paused, EMPTY_INPUT, 0.1), paused);
    run = resolveAnswer(run, true,
      gate.kind === 'vector' ? { kind: 'vector', displacement: [6, 6, 2] } : undefined,
      100, 5);
    assert.equal(run.mode, index === 26 ? 'won' : 'playing');
    assert.equal(run.correct, index + 1 - (index >= 21 ? 2 : index === 20 ? 1 : 0));
    assert.equal(run.health, HEARTS_2D);
    if (gate.kind !== 'gear') {
      run.mechanisms[0].animation = 1;
      assert(hasGround(run, gate.x - 100), 'maths bridge is traversable in 2D');
    }
  }
  assert.equal(run.mode, 'won', 'the main run ends after the fifth Level 6 assessment');
}
console.log('2D-only progression passed: every entry point, lift support, 27 checkpoints, pause, maths bridges and victory at 30/60/144 fps.');
