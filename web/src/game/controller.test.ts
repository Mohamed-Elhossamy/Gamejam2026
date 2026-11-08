// Runs the actual frontend controller against the real Haskell HTTP service,
// with only browser scheduling/storage replaced by deterministic test doubles.
import { strict as assert } from 'node:assert';
import { LambdaController } from './controller';
import { CLOCK_INTRO_SECONDS, HEARTS_2D, TIMER_START, rewardedTimeBonus } from './rules';

// Base URL of the running API server (scripts/dev.sh serves it on port 8080).
const API = process.env.LAMBDA_API ?? 'http://localhost:8080';

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: new EventTarget(),
  localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});
const originalFetch = globalThis.fetch;
let dropAnswer = false;
let holdAnswer = false;
let releaseAnswer: (() => void) | null = null;
globalThis.fetch = async (url, options) => {
  const absolute = typeof url === 'string' && url.startsWith('/') ? `${API}${url}` : url;
  const response = await originalFetch(absolute, options);
  if (String(absolute).endsWith('/math/answer')) {
    if (dropAnswer) { dropAnswer = false; throw new Error('Simulated lost response after server processing'); }
    if (holdAnswer) {
      holdAnswer = false;
      await new Promise<void>((resolve) => { releaseAnswer = resolve; });
    }
  }
  return response;
};
const game = new LambdaController(() => {});
let now = 100;
const step = () => {
  now += 1000 / 60;
  (game as unknown as { tick: (now: number) => void }).tick(now);
};
function finishIntro() {
  for (let frame = 0; frame < CLOCK_INTRO_SECONDS * 60 + 10 && game.view.run.mode === 'intro'; frame++) step();
}
async function waitFor(condition: () => boolean) {
  for (let n = 0; n < 200 && !condition(); n++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert(condition(), 'Expected controller state was not reached');
}
async function focus() {
  finishIntro();
  game.actions.control('left', true);
  for (let frame = 0; frame < 1200 && game.view.run.mode === 'playing'; frame++) {
    game.actions.control('jump', frame % 48 > 12);
    step();
  }
  assert.equal(game.view.run.mode, 'focus');
  await waitFor(() => game.view.question !== null);
}
function answerPowerRule() {
  const question = game.view.question!;
  const terms = question.prompt.match(/(\d*)x\^(\d+)/)!;
  const a = Number(terms[1] || 1), n = Number(terms[2]);
  const expected = `${a * n}x${n - 1 === 1 ? '' : `^${n - 1}`}`;
  assert(question.choices.includes(expected));
  game.actions.answer(expected);
}

await game.connect();
assert(game.view.engineReady);
game.actions.start();
game.view.run = { ...game.view.run, timer: 60 };
await focus();
const pausedQuestion = game.view.question!.id;
game.actions.pause(true);
const frozen = { ...game.view.run, player: { ...game.view.run.player } };
game.actions.answer('must not submit while paused');
for (let frame = 0; frame < 120; frame++) step();
assert.deepEqual(game.view.run, frozen, 'Pause freezes the timer, monster, player and question state');
assert.equal(game.view.submitting, false, 'No answer is submitted while paused');
assert.equal(game.view.question!.id, pausedQuestion);
game.actions.pause(false);
assert.equal(game.view.run.mode, 'focus');
assert.equal(game.view.question!.id, pausedQuestion, 'Resume preserves the same question');
const resumedTimer = game.view.run.timer;
step();
assert(game.view.run.timer < resumedTimer, 'Question countdown resumes');
const before = game.view.run.monsterX;
for (let frame = 0; frame < 60; frame++) step();
assert(Math.abs(before - game.view.run.monsterX - 18.75) < 0.01);
dropAnswer = true;
game.actions.answer('definitely wrong');
game.actions.answer('duplicate click must be ignored');
await waitFor(() => game.view.error !== null);
assert.equal(game.view.run.health, HEARTS_2D, 'Do not invent a result when the response is lost');
game.actions.retry();
await waitFor(() => !game.view.submitting && game.view.error === null);
assert.equal(game.view.run.health, HEARTS_2D - 1, 'Retry must deduct exactly once');
const powerTerms = game.view.question!.prompt.match(/(\d*)x\^(\d+)/)!;
const expectedGradient = Number(powerTerms[1] || 1) * Number(powerTerms[2]);
// Haskell's time bonus is the largest number in the canonical answer (coefficient or power).
const rawExpectedBonus = Math.max(expectedGradient, Number(powerTerms[2]) - 1);
const expectedBonus = rewardedTimeBonus(rawExpectedBonus);
const timerBefore = game.view.run.timer;
answerPowerRule();
await waitFor(() => game.view.run.mode === 'playing');
assert.equal(game.view.bonus?.seconds, expectedBonus, 'the scaled Haskell timeBonus reaches the popup');
assert.equal(game.view.run.timer, timerBefore + expectedBonus, 'the timer gains the scaled time bonus');
assert.equal(game.view.run.correct, 1);
assert(game.view.run.mechanisms[0].solved);
assert.equal(game.view.run.mechanisms[0].slope?.gradient, expectedGradient, 'Haskell gradient must reach the physical mechanism');
assert(game.view.run.boost > 0);
await focus();
for (let left = HEARTS_2D - 1; left > 1; left--) {
  game.actions.answer(`incorrect ${left}`);
  await waitFor(() => !game.view.submitting && game.view.run.health === left - 1);
  assert.equal(game.view.run.mode, 'focus', 'the question stays open after a wrong answer');
}
game.actions.answer('incorrect again');
await waitFor(() => game.view.run.mode === 'over');
assert.equal(game.view.run.health, 0);
assert(game.view.highScore >= 100);
assert(store.size > 0);
game.actions.start();
assert.equal(game.view.run.health, HEARTS_2D);
assert.equal(game.view.run.correct, 0);
assert.equal(game.view.run.distance, 0);
assert(game.view.highScore >= 100);
await focus();
holdAnswer = true;
game.actions.answer('wrong in old run');
await waitFor(() => releaseAnswer !== null);
game.actions.start();
releaseAnswer!();
await new Promise((resolve) => setTimeout(resolve, 50));
assert.equal(game.view.run.health, HEARTS_2D);
assert.equal(game.view.run.correct, 0);
const reloaded = new LambdaController(() => {});
assert.equal(reloaded.view.highScore, game.view.highScore);
for (let stage = 1; stage <= 6; stage++) {
  game.actions.menu();
  game.actions.startAtStage(stage);
  finishIntro();
  assert.equal(game.view.run.stage, stage);
  assert.equal(game.view.run.perspective, '2d');
  assert.equal(game.view.run.correct, [0, 3, 6, 10, 15, 15][stage - 1], 'earlier clock parts are fitted');
  assert.equal(game.view.run.correct - game.view.run.credited, 0, 'nothing is earned yet');
  assert.equal(game.view.run.distance, 0);
  const index = game.view.run.mechanisms[0].index;
  game.actions.control('left', true);
  for (let frame = 0; frame < 300 && game.view.run.mode === 'playing'; frame++) step();
  game.actions.control('left', false);
  await waitFor(() => { step(); return game.view.question !== null; });
  assert.equal(game.view.run.activeIndex, index);
  assert.equal(game.view.question!.choices.length, 4, 'Selected level loads a real Haskell question');
  game.actions.start();
  assert.equal(game.view.run.stage, stage, 'Try Again preserves the selected level');
}
game.actions.menu();
game.actions.start();
assert.equal(game.view.run.stage, 1, 'Main Play returns to the full game');
game.actions.menu();
game.actions.startAtStage(3);
assert.equal(game.view.run.perspective, '2d');
game.actions.pause(true);
game.actions.menu();
assert.equal(game.view.run.mode, 'menu', 'Exit returns to the main menu');
assert.equal(game.view.run.paused, false);
game.actions.start();
game.mount();
window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Escape', repeat: false }));
assert.equal(game.view.run.paused, true, 'Escape makes the pause and exit menu reachable');
game.actions.menu();
assert.equal(game.view.run.mode, 'menu', 'Exiting a paused run returns to the menu');
game.actions.startAtStage(3);
finishIntro();
const stageStart = game.view.run;
window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW', repeat: false }));
for (let i = 0; i < 6; i++) step();
window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyW' }));
assert.equal(game.view.run.player.z, 0, 'all stages stay on the 2D plane');
assert(game.view.run.player.y < stageStart.player.y, 'W jumps in the later maths stages too');
assert.equal(game.view.run.player.x, stageStart.player.x);
window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyA', repeat: false }));
step();
window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyA' }));
assert(game.view.run.player.x < stageStart.player.x, 'A keeps leftward movement in every stage');
assert(game.view.run.timer < stageStart.timer, 'there is no WebGL loading gate');
const oldRunNumber = game.view.runNumber;
game.actions.start();
assert.equal(game.view.runNumber, oldRunNumber + 1, 'restart creates fresh graphics state');
assert.equal(game.view.run.health, 5);
assert.equal(game.view.run.timer, TIMER_START);
game.actions.menu();
game.actions.start();
assert.equal(game.view.run.mode, 'intro');
const introduction = game.view.run;
for (let i = 0; i < 60; i++) step();
assert.equal(game.view.run.timer, introduction.timer, 'announcement spends no timer');
assert.equal(game.view.run.monsterX, introduction.monsterX, 'announcement freezes Sigma');
await focus();
// Accept the actual Haskell answer at the final repair boundary, with a catch
// and timeout otherwise imminent. Victory must own every subsequent frame.
game.view.run = { ...game.view.run, correct: 19, levelSixCorrect: 4, timer: 0.001, monsterX: game.view.run.player.x,
  mechanisms: game.view.run.mechanisms.map(m => m.index === game.view.run.activeIndex ? { ...m, stage: 6, ordinal: 4 } : m) };
answerPowerRule();
await waitFor(() => game.view.run.mode === 'won');
const victory = game.view.run;
assert.equal(victory.correct, 20);
for (let i = 0; i < 300; i++) step();
assert.equal(game.view.run.mode, 'won');
assert.equal(game.view.run.timer, victory.timer);
assert.equal(game.view.run.monsterX, victory.monsterX);
assert(game.view.run.celebration > 3.4);
game.actions.answer('a duplicate cannot award another piece');
assert.equal(game.view.run.correct, 20);
game.actions.start();
assert.equal(game.view.run.mode, 'intro');
assert.equal(game.view.run.correct, 0);
assert.equal(game.view.run.lastRepair, null);
game.destroy();
reloaded.destroy();
console.log('Live-Haskell level selection passed: all six shortcuts, real questions, selected-level restart and normal Play.');
console.log('Controller/live-Haskell journey passed: free introduction, focus, retries, duplicate input, correct route/boost, health death, restart, stale response isolation and protected final-answer victory.');
