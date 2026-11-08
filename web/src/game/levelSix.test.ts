import { strict as assert } from 'node:assert';
import { createStageRun, stepRun, EMPTY_INPUT, resolveAnswer, groundHeight, sigmaSpeed, setPaused, FLOOR, PLAYER_H, makeMechanism } from './simulation';
import { terrainHeight, terrainComponents } from './trigonometricTerrain';
import { clockProgress } from './greatClockGeometry';

let run = createStageRun(6);
const initial = { score: run.score, correct: run.correct, timer: run.timer };
assert.equal(run.mechanisms[0].ordinal, 5);
run = { ...run, mode: 'focus', activeIndex: 20 };
assert.equal(sigmaSpeed(run), 18.75, '25% throughout Level 6 questions even above 60 seconds');
for (let i = 0; i < 3; i++) {
  run = resolveAnswer(run, false);
  assert.equal(sigmaSpeed(run), 18.75);
  assert.equal(run.terrain, undefined);
}
assert.equal(run.health, 2);
run = resolveAnswer(run, true, undefined, 500, 99);
assert.deepEqual({ score: run.score, correct: run.correct, timer: run.timer }, initial,
  'supplementary checkpoint must never count or reward points/time even if caller supplies them');
assert.equal(run.battle, null);
assert.equal(run.terrain?.phase, 'sine');
const origin = run.terrain!.origin;
run = { ...run, time: run.time + 2 };
for (let x = origin - 1500; x < origin - 50; x += 13) {
  assert(Math.abs(terrainHeight(run, x) - (FLOOR - 36 * Math.sin((origin - x) / 120))) < 1e-8);
  assert.equal(groundHeight(run, x), terrainHeight(run, x), 'renderer and collision share a function');
}
// Walk a full sine section without jumps: descending troughs remain solid.
for (const fps of [30, 60, 144]) {
  let walking = { ...run, monsterX: origin + 1000, player: { ...run.player, x: origin - 100 } };
  walking.player.y = groundHeight(walking, walking.player.x + 16) - PLAYER_H;
  const monsterStart = walking.monsterX;
  for (let frame = 0; frame < fps * 2; frame++) {
    walking = stepRun(walking, { ...EMPTY_INPUT, left: true }, 1 / fps);
    assert(walking.player.grounded);
    assert(Math.abs(walking.player.y + PLAYER_H - groundHeight(walking, walking.player.x + 16)) < 1e-6);
  }
  assert(Math.abs(monsterStart - walking.monsterX - 150) < 1e-6);
}
run = { ...run, mode: 'focus', activeIndex: 21 };
run = resolveAnswer(run, true);
assert.equal(run.terrain?.phase, 'identity');
const start = run.time;
for (const elapsed of [0, 0.6, 1.2, 2.1, 3, 4]) {
  const sample = { ...run, time: start + elapsed };
  for (let x = origin - 2000; x < origin - 100; x += 17) {
    const values = terrainComponents(sample, x)!;
    assert(Math.abs(values.squared + values.complement - 1) < 1e-12);
    if (elapsed >= 3) assert(Math.abs(terrainHeight(sample, x) - (FLOOR - 36)) < 1e-8);
  }
}
run = { ...run, time: start + 2.99, monsterX: origin + 1000 };
run = stepRun(run, EMPTY_INPUT, 0.02);
assert(run.boost > 3.3, 'boost begins only when flattening completes');
assert.equal(stepRun(setPaused(run, true), EMPTY_INPUT, 0.1).time, run.time);
const caught = stepRun({ ...run, mode: 'focus', activeIndex: 22, monsterX: run.player.x + 33 }, EMPTY_INPUT, 0.1);
assert.equal(caught.mode, 'over', 'Sigma can catch Lambda mid-question');
for (let i = 0; i < 5; i++) {
  const gate = makeMechanism(22 + i);
  run = { ...run, mode: 'focus', activeIndex: gate.index, mechanisms: [gate] };
  run = resolveAnswer(run, true, undefined, 500, 12);
  assert.equal(run.levelSixCorrect, i + 1);
  assert.equal(clockProgress(run), 16 + i);
  assert.equal(run.mode, i === 4 ? 'won' : 'playing');
}
assert.equal(run.correct - run.credited, 5);
assert.equal(run.score, 2500);
const fresh = createStageRun(6);
assert.equal(fresh.terrain, undefined);
assert.equal(fresh.levelSixCorrect, 0);
assert.equal(fresh.health, 5);
console.log('Level 6 passed: five assessed questions, unscored checkpoints, live chase, matching sine collision, exact identity, delayed boost, boss victory and reset.');
