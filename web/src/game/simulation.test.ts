import { strict as assert } from 'node:assert';
import {
  createRun, EMPTY_INPUT, stepRun, resolveAnswer, normalSpeed, pointsForStage, stageForIndex, mechanismProgress,
  setPaused, sigmaSpeed, TIME_RAN_OUT,
} from './simulation';
import { HEARTS_2D, TIMER_START } from './rules';
import { placedSegments } from './level';

function advance(run: ReturnType<typeof createRun>, seconds: number, fps = 60, left = false) {
  for (let i = 0; i < Math.round(seconds * fps); i++)
    run = stepRun(run, { ...EMPTY_INPUT, left }, 1 / fps);
  return run;
}
// Milestone 1: leftward chase, rightward environment scroll, catch and restart.
for (const fps of [30, 60, 144]) {
  const initial = createRun('playing');
  const moved = advance(initial, 0.4, fps, true);
  assert(moved.player.x < initial.player.x);
  assert(moved.cameraX < initial.cameraX);
  assert(moved.monsterX < initial.monsterX);
  const caught = advance(initial, 20, fps);
  assert.equal(caught.mode, 'over');
  assert.equal(createRun('playing').health, HEARTS_2D);
}
console.log('Milestone 1 passed: direction, scrolling, catch, restart at 30/60/144 fps.');

// Milestone 2: exact non-stacking focus, live collision, health, correct gate.
let focused = createRun('playing');
focused = { ...focused, mode: 'focus', activeIndex: 0, timer: 30 };
const slowed = advance(focused, 2);
assert(Math.abs((focused.monsterX - slowed.monsterX) - normalSpeed(1) * 0.25 * 2) < 0.001);
assert.equal(slowed.player.x, focused.player.x);
assert(Math.abs(advance(focused, 1).sigmaTime - focused.sigmaTime - 0.375) < 0.001, 'bite clock is 50% quicker at focus speed');
assert(Math.abs(advance({ ...createRun('playing'), timer: 60 }, 1).sigmaTime - 1.5) < 0.001, 'bite clock is 50% quicker at normal speed');
let wrong = resolveAnswer(slowed, false);
assert.equal(wrong.health, HEARTS_2D - 1);
assert.equal(wrong.mode, 'focus');
const wrongStartX = wrong.monsterX;
wrong = advance(wrong, 1);
assert(Math.abs(wrongStartX - wrong.monsterX - 18.75) < 0.001);
  const solved = resolveAnswer(wrong, true, undefined, 100);
  const scoreAfter = solved.score;
assert.equal(solved.mode, 'playing');
assert(solved.mechanisms[0].solved && solved.boost > 0);
const normal = advance(solved, 1);
assert.equal(normalSpeed(1), 75, 'Sigma pace is fixed at 75 px/s');
for (const stage of [1, 2, 3, 4, 5, 6, 12, 40]) {
  const run = { ...createRun('playing'), stage, monsterX: 1e7 };
  const later = advance(run, 1);
  assert(Math.abs(run.monsterX - later.monsterX - 75) < 1e-5,
    `stage ${stage}: same slow chase movement`);
  assert(Math.abs(later.sigmaTime - 1.5) < 1e-6,
    `stage ${stage}: same fast bite animation`);
  const focused = { ...run, mode: 'focus' as const, activeIndex: 0, timer: 30 };
  const afterFocus = advance(focused, 1);
  assert(Math.abs(focused.monsterX - afterFocus.monsterX - 18.75) < 1e-5,
    `stage ${stage}: same question slowdown`);
  assert(Math.abs(afterFocus.sigmaTime - 0.375) < 1e-6,
    `stage ${stage}: bite rate never scales with level`);
}
for (let stage = 1; stage <= 12; stage++)
  assert.equal(normalSpeed(stage), 75, `Sigma speed stays fixed at stage ${stage}`);
assert(Math.abs(solved.monsterX - normal.monsterX - 75) < 0.001);
let fiveWrong = focused;
for (let i = 0; i < HEARTS_2D - 1; i++) fiveWrong = resolveAnswer(fiveWrong, false);
assert.equal(fiveWrong.mode, 'focus');
assert.equal(resolveAnswer(fiveWrong, false).mode, 'over', 'the fifth wrong answer ends the run');
  assert.equal(resolveAnswer(solved, true, undefined, 500).score, scoreAfter, 'completed checkpoints cannot award points twice');
  const stageTwo = resolveAnswer({ ...focused, stage: 2 }, true, undefined, pointsForStage(2));
  const stageOne = resolveAnswer(focused, true, undefined, pointsForStage(1));
  assert.equal(stageTwo.score, 200);
  assert.equal(stageOne.score, 100);
  const increasedTime = { ...stageTwo, time: 500, distance: 5000 };
  assert.equal(stepRun(increasedTime, EMPTY_INPUT, 0.1).score, stageTwo.score, 'time and distance do not score');
const nearby = { ...focused, monsterX: 33 };
assert.equal(advance(nearby, 0.2).mode, 'over');
console.log('Milestone 2 passed: live focus/catch, exact 25%, repeated wrong answers, gate, boost, normal speed.');

// Milestones 3/4: stage families, functionally unlocked gaps, endless progression.
assert.deepEqual([0, 3, 6, 10, 15, 20, 27].map((n) => stageForIndex(n).stage), [1, 2, 3, 4, 5, 6, 7]);
for (const correct of [6, 10, 15, 20, 40]) {
  let run = createRun('playing');
  run.correct = correct;
  run.stage = stageForIndex(correct).stage;
  run.mechanisms[0].kind = correct === 6 ? 'vector' : 'matrix';
  run.mode = 'focus';
  run.activeIndex = 0;
  const previousScore = run.score;
  run = resolveAnswer(run, true, undefined, pointsForStage(run.stage));
  assert(run.mechanisms[0].solved);
  assert.equal(run.correct, correct + 1);
  assert.equal(run.score, previousScore + pointsForStage(stageForIndex(correct + 1).stage));
}
console.log('Milestones 3/4 passed: vector/matrix mechanisms, five topic stages and mixed survival, weighted scoring.');

assert.equal(mechanismProgress(0.8), 1);
assert(mechanismProgress(0.79) < 1);
for (const kind of ['gear', 'vector', 'matrix'] as const) {
  let transition = createRun('playing');
  const mechanism = transition.mechanisms[0];
  mechanism.kind = kind;
  mechanism.solved = true;
  mechanism.animation = 0.75;
  transition.player.x = mechanism.x + 66;
  transition.player.grounded = true;
  transition.monsterX = 5000;
  transition = stepRun(transition, { ...EMPTY_INPUT, left: true }, 1 / 60);
  assert(transition.mechanisms[0].animation < 0.8);
  assert.equal(transition.player.x, mechanism.x + 65, `${kind} collider remains locked while its mechanism moves`);
  while (transition.mechanisms[0].animation < 0.8) {
    transition = stepRun(transition, { ...EMPTY_INPUT, left: true }, 1 / 60);
  }
  transition = stepRun(transition, { ...EMPTY_INPUT, left: true }, 1 / 60);
  assert(transition.player.x < mechanism.x + 65, `${kind} collider opens at the aligned visual endpoint`);
}
console.log('Mechanism alignment passed: gear, vector and matrix colliders unlock only when fully traversable.');

let journey = createRun('playing');
// Every stage uses the same 2D checkpoint question and answer rules.
for (let gate = 0; gate < 27; gate++) {
  for (let frame = 0; frame < 1200 && journey.mode === 'playing'; frame++) {
    const obstacleAhead = placedSegments(journey.player.x - 180, journey.player.x + 20).some((segment) =>
      segment.type === 'obstacle' && !['conveyor', 'bridge-gap'].includes(segment.obstacle) &&
      journey.player.x - segment.worldEnd < 65 &&
      journey.player.x - segment.worldEnd > -segment.width - 32);
    // Jump in response to a real approach, not a frame-count oscillation.
    journey = stepRun(journey, { ...EMPTY_INPUT, left: true,
      jump: journey.player.grounded && !journey.jumpHeld && obstacleAhead }, 1 / 60);
  }
  assert.equal(journey.mode, 'focus', `Route to mechanism ${gate} must be traversable`);
  assert.equal(journey.activeIndex, gate);
  journey = advance(journey, 6);
  assert.equal(journey.mode, 'focus', 'A fair six-second answer window must remain');
  journey = resolveAnswer(journey, true, undefined, 0, 12);
}
assert.equal(journey.mode, 'won');
assert.equal(journey.correct, 25);
assert.equal(journey.levelSixCorrect, 5);
console.log('Full route passed: 25 assessed questions, two unscored terrain checkpoints and protected victory.');

// ---- Timer, pause, time bonus and hearts ----
const far = (run: ReturnType<typeof createRun>) => ({ ...run, monsterX: 1e7 });
for (const fps of [30, 60, 144]) {
  const start = far(createRun('playing'));
  assert.equal(TIMER_START, 120, 'the start timer is two minutes');
  assert.equal(start.timer, TIMER_START);
  const later = advance(start, 5, fps);
  assert(Math.abs(start.timer - later.timer - 5) < 1e-6, `timer drops 1/s at ${fps} fps`);
  const focusRun = far({ ...createRun('playing'), mode: 'focus' as const, activeIndex: 0 });
  assert(Math.abs(advance(focusRun, 3, fps).timer - (TIMER_START - 3)) < 1e-6, 'timer keeps running during questions');
}
const pausedRun = setPaused(far(createRun('playing')), true);
assert.equal(stepRun(pausedRun, { ...EMPTY_INPUT, left: true }, 0.15), pausedRun, 'pause freezes everything');
assert.equal(setPaused(createRun('menu'), true).paused, false, 'only a live run can pause');
const q = far({ ...createRun('playing'), mode: 'focus' as const, activeIndex: 0, timer: 40 });
assert.equal(resolveAnswer(q, false).timer, 40, 'a wrong answer never changes the timer');
const bonusRun = resolveAnswer(q, true, undefined, 100, 7);
assert.equal(bonusRun.timer, 54, 'a raw bonus of 7 is doubled');
assert.equal(resolveAnswer(q, true, undefined, 100, 6).timer, 58, 'a raw bonus below 7 is tripled');
assert.equal(resolveAnswer(bonusRun, true, undefined, 100, 7).timer, 54, 'a repeated result never adds time twice');
assert.equal(resolveAnswer({ ...q, timer: 58 }, true, undefined, 100, 9).timer, 76, 'scaled rewards are uncapped above 60 s');

// Σ speed formula
const base = normalSpeed(1);
assert.equal(base, 75, 'the stage-one base chase speed is halved');
const atQ = (timer: number, points = 100) => ({ ...createRun('playing'), mode: 'focus' as const, activeIndex: 0, timer, questionPoints: points });
assert.equal(sigmaSpeed(atQ(60)), base * 0.25, 'exactly 25% at a question with 60 s or less');
let repeated = atQ(30);
for (let i = 0; i < 3; i++) repeated = resolveAnswer(repeated, false);
assert.equal(sigmaSpeed(repeated), base * 0.25, 'repeated wrong answers never drop below 25%');
assert.equal(sigmaSpeed(atQ(61, 100)), base, 'Focus does not speed Sigma up');
for (const timer of [120, 90, 61, 60, 30, 1]) {
  assert.equal(sigmaSpeed({ ...createRun('playing'), timer }), base,
    `running pace stays constant with ${timer}s left`);
}
assert.equal(sigmaSpeed({ ...createRun('playing'), timer: 0 }), 0, 'no chase continues after immediate timeout');
for (const startMode of ['playing', 'focus'] as const) {
  let out = { ...createRun('playing'), mode: startMode, activeIndex: startMode === 'focus' ? 0 : null, timer: 0.001, monsterX: 1200 };
  let seconds = 0;
  while (out.mode !== 'over' && seconds < 3) { out = stepRun(out, EMPTY_INPUT, 1 / 60); seconds += 1 / 60; }
  assert.equal(out.mode, 'over');
  assert.equal(out.cause, TIME_RAN_OUT);
  assert.equal(out.timer, 0);
  assert.equal(out.monsterX, 1200, 'timer expiry ends the game without a catch chase');
  assert(seconds <= 1 / 60 + 1e-6, `timer expiry from ${startMode} ends in the same rendered frame`);
}

// 2D checkpoint touch enters Focus Mode on the same step
const touch = far(createRun('playing'));
touch.player.x = touch.mechanisms[0].x + 66;
const touched = stepRun(touch, { ...EMPTY_INPUT, left: true }, 1 / 60);
assert.equal(touched.mode, 'focus');
assert.equal(touched.activeIndex, 0);
const airborne = far(createRun('playing'));
airborne.player.x = airborne.mechanisms[0].x + 66;
airborne.player.y -= 120; airborne.player.grounded = false;
assert.equal(stepRun(airborne, { ...EMPTY_INPUT, left: true }, 1 / 60).mode, 'focus', 'no grounded requirement');

// The bite clock is cosmetic: Σ's position never depends on it
const a = advance({ ...createRun('playing'), sigmaTime: 0 }, 2);
const b = advance({ ...createRun('playing'), sigmaTime: 0.77 }, 2);
assert.equal(a.monsterX, b.monsterX, "Σ's bite never changes its horizontal position");
console.log('Core rules passed: timer, pause, time bonus, Σ speed formula, catch at 0 s, 5 hearts, instant checkpoints.');
