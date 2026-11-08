import assert from 'node:assert/strict';
import {
  beginRun, createRun, createStageRun, creditedForStage, EMPTY_INPUT, makeMechanism,
  resolveAnswer, setPaused, sigmaSpeed, stepRun,
} from './simulation';
import { CLOCK_INTRO_SECONDS, CLOCK_TARGET, TIMER_START } from './rules';
import { drawGreatClock } from './greatClockArt';
import { clockPiecesRemaining, sigmaHitsRemaining, clockProgress } from './greatClockGeometry';
import { battleScene, BATTLE_TIMING, REST_PLACEMENT } from './greatClockBattle';

assert.equal(CLOCK_INTRO_SECONDS, 4, 'Opening announcement lasts two seconds longer');
for (const fps of [30, 60, 144]) for (const stage of [1, 2, 3, 4, 5, 6]) {
  let run = beginRun(createStageRun(stage));
  const initial = structuredClone(run);
  const paused = setPaused(run, true);
  assert.equal(stepRun(paused, { ...EMPTY_INPUT, left: true }, 0.1), paused);
  for (let frame = 0; frame < fps * CLOCK_INTRO_SECONDS; frame++) {
    run = stepRun(run, { left: true, right: false, jump: true }, 1 / fps);
    if (frame < fps * CLOCK_INTRO_SECONDS - 1) assert.equal(run.mode, 'intro');
    assert.deepEqual(run.player, initial.player, 'λ stays still despite movement input');
    assert.equal(run.monsterX, initial.monsterX, 'Sigma stays still throughout the message');
    assert.equal(run.cameraX, initial.cameraX, 'Map does not scroll during the message');
    assert.equal(run.time, initial.time, 'World animation clock is frozen');
    assert.equal(run.sigmaTime, initial.sigmaTime, 'Sigma animation clock is frozen');
    assert.deepEqual(run.mechanisms, initial.mechanisms, 'Mechanisms stay still during the message');
  }
  assert.equal(run.mode, 'playing');
  assert.equal(run.timer, TIMER_START);
  assert.equal(run.time, 0);
  assert.equal(run.monsterX, initial.monsterX);
  assert.deepEqual(run.player, initial.player);
  run = stepRun(run, EMPTY_INPUT, 1 / fps);
  assert(run.timer < TIMER_START, 'countdown begins only after the announcement');
}

for (const startStage of [1, 3, 5, 6]) {
  let run = createStageRun(startStage);
  const firstIndex = run.mechanisms[0].index;
  const credited = creditedForStage(startStage);
  assert.equal(run.correct, credited, 'a shortcut starts with the earlier clock parts fitted');
  assert.equal(run.credited, credited);
  assert.equal(run.score, 0, 'a shortcut never awards skipped points');
  assert.equal(run.battle, null, 'a shortcut never starts mid-battle');
  let assessed = 0;
  for (let index = firstIndex; index <= 26; index++) {
    const mechanism = makeMechanism(index);
    const supplementary = index === 20 || index === 21;
    run = { ...run, mode: 'focus', activeIndex: mechanism.index, mechanisms: [mechanism] };
    const previous = run;
    const wrong = resolveAnswer(run, false);
    assert.equal(wrong.correct, run.correct);
    assert.equal(clockPiecesRemaining(clockProgress(wrong)), clockPiecesRemaining(clockProgress(run)));
    assert.equal(wrong.battle?.start, run.battle?.start, 'a wrong answer never starts the battle');
    if (run.battle) assert.equal(wrong.battle?.lastMiss, run.time, 'a wrong battle answer sends Σ at the clock');
    else assert.equal(wrong.battle, null);
    assert.equal(sigmaHitsRemaining(clockProgress(wrong)), sigmaHitsRemaining(clockProgress(run)), 'a wrong answer never strikes Sigma');
    assert.deepEqual(wrong.lastRepair, run.lastRepair);
    assert.equal(wrong.health, run.health - 1);
    run = resolveAnswer(previous, true, undefined, 100, 5);
    if (!supplementary) assessed++;
    assert.equal(run.correct, credited + assessed);
    assert.equal(clockPiecesRemaining(clockProgress(run)), Math.max(0, 15 - run.correct));
    assert.equal(sigmaHitsRemaining(clockProgress(run)), 5 - run.levelSixCorrect);
    if (index < 22) assert.equal(run.battle, null, 'the clock is assembled before the Level 6 battle');
    if (index === 22) {
      assert.deepEqual(run.battle, { start: previous.time, liftoffX: previous.monsterX, lastMiss: null }, 'Sigma lifts off from wherever it was');
      assert.equal(sigmaSpeed(run), 0, 'airborne Sigma no longer pursues along the course');
    }
    if (index > 22) assert.equal(run.battle?.start, previous.battle?.start, 'later strikes keep the original liftoff');
    if (!supplementary) {
      assert.equal(run.lastRepair?.x, mechanism.x + 65);
      assert.equal(run.lastRepair?.time, run.time);
    }
    assert.equal(run.score, assessed * 100);
    assert.equal(run.timer, previous.timer + (supplementary ? 0 : 15), 'only assessed answers award time');
    assert.equal(resolveAnswer(run, true, undefined, 100, 5), run, 'duplicate verdict adds no piece/reward');
    assert.equal(run.mode, index === 26 ? 'won' : 'playing');
  }
  const victory = { ...run, timer: 0.001, monsterX: run.player.x, player: { ...run.player, vy: 800 } };
  let celebrated = victory;
  for (let i = 0; i < 300; i++) celebrated = stepRun(celebrated, { ...EMPTY_INPUT, left: true }, 1 / 60);
  assert.equal(celebrated.mode, 'won');
  assert.equal(celebrated.timer, victory.timer);
  assert.equal(celebrated.monsterX, victory.monsterX);
  assert.deepEqual(celebrated.player, victory.player);
  assert.equal(clockProgress(celebrated), CLOCK_TARGET);
  assert.equal(sigmaSpeed(celebrated), 0);
  assert(celebrated.celebration >= 4.99);
  const paused = setPaused(celebrated, true);
  assert.equal(stepRun(paused, EMPTY_INPUT, 0.1), paused, 'pause freezes clock/victory animation');
  const fresh = beginRun(createStageRun(startStage));
  assert.equal(fresh.correct, credited);
  assert.equal(fresh.battle, null);
  assert.equal(fresh.lastRepair, null);
  assert.equal(fresh.celebration, 0);
  assert.equal(fresh.timer, TIMER_START);
}

// Exercise original clock art at every reconstruction state without DOM/Wall
// clocks. Non-finite geometry would otherwise silently disappear on a canvas.
for (let piece = 0; piece <= CLOCK_TARGET; piece++) for (const reducedMotion of [false, true]) {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (target, name) => Reflect.has(target, name) ? Reflect.get(target, name)
      : name === 'createRadialGradient' || name === 'createLinearGradient'
      ? () => gradient
      : (...args: unknown[]) => { for (const arg of args) if (typeof arg === 'number') assert(Number.isFinite(arg), `${String(name)} geometry`); },
    set: (target, name, value) => {
      if (typeof value === 'number') assert(Number.isFinite(value));
      return Reflect.set(target, name, value);
    },
  }) as CanvasRenderingContext2D;
  drawGreatClock(ctx, { time: 5, correct: piece,
    lastRepairTime: piece ? 4.7 : null, pulseX: -500, placement: REST_PLACEMENT,
    powered: piece > 15, gold: piece > 15 ? 1 : 0, flash: piece === 16 ? 0.7 : 0, running: piece > 15 ? 9 : 0, reducedMotion });
}

// The battle: Sigma cannot catch λ once airborne, and the rear boundary stays inert.
{
  let run = beginRun(createRun('playing'));
  for (let i = 0; i < 130; i++) run = stepRun(run, EMPTY_INPUT, 1 / 60);
  const mechanism = makeMechanism(22);
  run = { ...run, correct: 15, mode: 'focus', activeIndex: mechanism.index, mechanisms: [mechanism] };
  run = resolveAnswer(run, true);
  assert.equal(run.correct, 16);
  assert(run.battle);
  const playerX = run.player.x;
  for (let i = 0; i < 600; i++) run = stepRun(run, { ...EMPTY_INPUT, right: true }, 1 / 60);
  assert.notEqual(run.mode, 'over', 'backtracking into the old chase line cannot be caught by an airborne Sigma');
  assert(run.monsterX > run.player.x + 1000, 'Sigma is parked far off the course');
  assert(run.player.x >= playerX);
  assert(run.sigmaTime > 0, 'Sigma keeps biting aggressively in the air');
}

// Choreography: blows land only after their answer, five bars in total, message only after the fifth.
{
  const base = beginRun(createRun('playing'));
  const at = (correct: number, since: number, battleAge = since) => battleScene({
    ...base, correct, levelSixCorrect: Math.max(0, correct - 15), time: 100,
    battle: correct > 15 ? { start: 100 - battleAge, liftoffX: base.monsterX, lastMiss: null } : null,
    lastRepair: { x: 0, time: 100 - since },
  }, base.cameraX, 440, false);
  assert.equal(at(15, 1).active, false, 'no battle while assembling');
  assert.equal(at(16, 0.1).landed, 0, 'the awakening flare comes before the first blow');
  assert.equal(at(16, BATTLE_TIMING.awakenStrike + 0.01).landed, 1, 'the sixteenth answer lands the first blow');
  assert.equal(at(16, BATTLE_TIMING.awakenStrike + 0.01).barsLeft, 4);
  const perched = at(16, 5);
  assert(perched.clock.x < 300 && perched.clock.y < 260, 'the powered clock perches top-left');
  assert(perched.sigma.x > 750 && perched.sigma.floating, 'Sigma floats top-right');
  assert(perched.sigma.red > 0.99 && perched.sigma.lasers > 0.99, 'Sigma is dark red with laser eyes');
  for (let correct = 17; correct <= 20; correct++) {
    assert.equal(at(correct, 0.1, 30).landed, correct - 16, 'the clock is still flying');
    const impact = at(correct, BATTLE_TIMING.strikeOut + 0.02, 30);
    assert.equal(impact.landed, correct - 15);
    assert(impact.sigma.flash > 0.9, 'Sigma flashes white on impact');
    assert(Math.abs(impact.clock.x - (impact.sigma.x + 65)) < 30, 'the clock reaches Sigma');
    assert.equal(at(correct, 30, 60).message, correct === 20, 'only the fifth blow wins');
    if (correct < 20) assert(at(correct, 3, 60).clock.x < 300, 'the clock returns to its perch');
  }
  const end = at(20, 10, 60);
  assert.equal(end.barsLeft, 0);
  assert.equal(end.sigma.visible, false, 'Sigma has dissolved');
  assert.equal(end.worldFade, 1, 'the course has faded away');
  assert(Math.abs(end.clock.x - 550) < 1 && end.clock.scale > 0.55, 'the clock is centred and large');
  assert(end.clock.y + 166 * end.clock.scale * 1.03 < 0.48 * 580, 'the finale clock stays above the victory message');
  assert(end.clock.glow > 0.85, 'the finale has the large victory glow');
  for (const correct of [16, 17, 20]) for (let since = 0; since < 8; since += 0.05) for (const rm of [false, true]) {
    const scene = battleScene({ ...base, correct, levelSixCorrect: Math.max(0, correct - 15), time: 100, battle: { start: 100 - since, liftoffX: base.monsterX, lastMiss: correct === 17 ? 100 - since / 2 : null }, lastRepair: { x: 0, time: 100 - since } }, base.cameraX, 440, rm);
    for (const value of [scene.clock.x, scene.clock.y, scene.clock.scale, scene.sigma.x, scene.sigma.floor, scene.worldFade])
      assert(Number.isFinite(value));
    assert(scene.clock.y - 166 * scene.clock.scale > -40, 'the clock stays within the playfield');
  }
}
// Wrong answers in the battle: Σ lunges at the clock, bites it, and returns — no bar changes hands.
{
  const base = beginRun(createRun('playing'));
  const miss = (correct: number, sinceMiss: number) => battleScene({
    ...base, correct, levelSixCorrect: Math.max(0, correct - 15), time: 200,
    battle: { start: 100, liftoffX: base.monsterX, lastMiss: 200 - sinceMiss },
    lastRepair: { x: 0, time: correct === 16 ? 100 : 150 },
  }, base.cameraX, 440, false);
  const perched = miss(17, 30);
  for (const correct of [16, 17, 19]) {
    const bite = miss(correct, BATTLE_TIMING.missOut + 0.05);
    assert(Math.abs(bite.sigma.x + 65 - (bite.clock.x + 78)) < 30, 'Σ reaches the clock');
    assert(bite.clock.hurt > 0.8, 'the bitten clock flashes red');
    assert.equal(bite.barsLeft, 20 - correct, 'a miss never costs Σ a bar');
    assert.equal(bite.landed, correct - 15);
  }
  assert(perched.sigma.x > 750 && perched.clock.hurt === 0, 'Σ returns to its spot and the clock recovers');
  const rest = battleScene({ ...base, correct: 16, time: 101, battle: { start: 100, liftoffX: base.monsterX, lastMiss: 100.5 }, lastRepair: { x: 0, time: 100 } }, base.cameraX, 440, false);
  assert.equal(rest.clock.hurt, 0, 'no bite while the clock is still taking off');
  const after = battleScene({ ...base, correct: 18, time: 200, battle: { start: 100, liftoffX: base.monsterX, lastMiss: 150 }, lastRepair: { x: 0, time: 199.5 } }, base.cameraX, 440, false);
  assert.equal(after.clock.hurt, 0, 'a later correct answer replaces the bite with a strike');
}

// The assembling clock rests top-right, where Σ will hover in the battle.
{
  assert(REST_PLACEMENT.x > 800, 'the assembling clock rests on the right');
  const base = beginRun(createRun('playing'));
  const flare = battleScene({ ...base, correct: 16, levelSixCorrect: 1, time: 100.3, battle: { start: 100, liftoffX: base.monsterX, lastMiss: null }, lastRepair: { x: 0, time: 100 } }, base.cameraX, 440, false);
  assert.equal(flare.clock.x, REST_PLACEMENT.x, 'answer 16 flashes the clock where it rests');
  const leaving = battleScene({ ...base, correct: 16, levelSixCorrect: 1, time: 101.3, battle: { start: 100, liftoffX: base.monsterX, lastMiss: null }, lastRepair: { x: 0, time: 100 } }, base.cameraX, 440, false);
  assert(leaving.clock.x < REST_PLACEMENT.x - 20 && leaving.sigma.lift === 0, 'the clock leaves before Σ rises into its spot');
}
console.log('Great Clock passed: 15-part assembly, Sigma lift-off on answer 16, five correct-only strikes, no wrong-answer hits, airborne Sigma cannot catch, wrong battle answers bite the clock without changing bars, finale only after the fifth blow above the message, paused celebration, shortcut/reset state and finite canvas geometry.');
