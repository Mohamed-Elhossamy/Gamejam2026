import assert from 'node:assert/strict';
import { createRun, createStageRun, makeMechanism, resolveAnswer, stepRun, EMPTY_INPUT } from './simulation';

const finalIndices = [2, 5, 9, 14, 19];
for (const [i, index] of finalIndices.entries()) {
  const stage = i + 1;
  let run = createStageRun(stage);
  const gate = makeMechanism(index);
  run = { ...run, time: 10, mode: 'focus', activeIndex: index, mechanisms: [gate] };
  const wrong = resolveAnswer(run, false);
  assert.equal(wrong.levelTransition, undefined, 'Wrong answers never announce completion');
  const next = resolveAnswer(run, true);
  assert.deepEqual(next.levelTransition, { from: stage, to: stage + 1, time: 10 });
  assert.equal(next.mode, 'playing', 'Announcement does not pause the chase');
  const moved = stepRun(next, { ...EMPTY_INPUT, left: true }, 0.1);
  assert(moved.time > next.time && moved.player.x < next.player.x, 'Gameplay continues beneath the announcement');
}
assert.equal(createRun().levelTransition, undefined, 'Normal Play has no false completion message');
for (let stage = 1; stage <= 6; stage++) {
  assert.equal(createStageRun(stage).levelTransition, undefined, 'Level shortcuts and restarts have no false completion message');
}
let final = createStageRun(6);
const gate = makeMechanism(26);
final = { ...final, mode: 'focus', activeIndex: 26, levelSixCorrect: 4, mechanisms: [gate] };
final = resolveAnswer(final, true);
assert.equal(final.mode, 'won');
assert.equal(final.levelTransition, undefined, 'Victory never announces a nonexistent Level 7');
console.log('Level transitions: all five boundaries, no wrong-answer/shortcut messages, live movement and final victory passed.');
