import assert from 'node:assert/strict';
import { advanceGait, createGaitState, gaitFromRun, LAMBDA_LEG_REST, lambdaLegs, STRIDE_PX } from './lambdaGait';
import { advanceCharacterAnimations, createCharacterAnimationState } from './sigma';
import { beginRun, createRun, createStageRun, EMPTY_INPUT, makeMechanism, resolveAnswer, setPaused, stepRun } from './simulation';

const near = (a: number, b: number, eps = 1e-6, msg?: string) => assert(Math.abs(a - b) < eps, msg ?? `${a} ≈ ${b}`);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (leg: { hip: { x: number; y: number }; foot: { x: number; y: number } }) => dist(leg.hip, leg.foot);
const frontLength = length(LAMBDA_LEG_REST.front);
const backLength = length(LAMBDA_LEG_REST.back);

// Standing is exactly the original λ glyph: straight strokes, feet on the ground.
{
  const rest = lambdaLegs({ phase: 1.3, gait: 0, air: 0 });
  near(rest.front.foot.x, -22); near(rest.front.foot.y, 0);
  near(rest.back.hip.x, -1); near(rest.back.hip.y, -54);
  near(rest.back.foot.x, 20); near(rest.back.foot.y, 0);
  near(dist(rest.front.hip, rest.front.knee) + dist(rest.front.knee, rest.front.foot), frontLength, 1e-6, 'front leg straight');
}

// Every running and airborne pose: finite, bones keep their length, knees bend forward, feet never sink.
for (let phase = -20; phase <= 20; phase += 0.05) for (const gait of [0, 0.3, 1]) for (const air of [0, 0.5, 1]) {
  const legs = lambdaLegs({ phase, gait, air });
  for (const [leg, total] of [[legs.front, frontLength], [legs.back, backLength]] as const) {
    for (const p of [leg.hip, leg.knee, leg.foot]) assert(Number.isFinite(p.x) && Number.isFinite(p.y));
    near(dist(leg.hip, leg.knee), total / 2, 1e-6, 'thigh length');
    near(dist(leg.knee, leg.foot), total / 2, 1e-6, 'shin length');
    assert(leg.foot.y <= 1e-6, 'a foot never goes below the ground line');
    const mid = (leg.hip.x + leg.foot.x) / 2;
    assert(leg.knee.x <= mid + 1e-6, 'knees bend forward, the way λ runs');
  }
}

// Running: the legs alternate — one foot planted while the other swings up.
{
  let planted = 0;
  for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
    const legs = lambdaLegs({ phase, gait: 1, air: 0 });
    if (legs.front.foot.y > -6 || legs.back.foot.y > -6) planted++;
    assert(legs.front.foot.y > -20 && legs.back.foot.y > -20, 'stride lifts stay small');
  }
  assert(planted >= 60, 'at least one foot stays near the ground throughout the stride');
  const a = lambdaLegs({ phase: 0, gait: 1, air: 0 }), b = lambdaLegs({ phase: Math.PI, gait: 1, air: 0 });
  assert(a.front.foot.x < b.front.foot.x - 10, 'the front foot swings through');
  const airborne = lambdaLegs({ phase: 0, gait: 0, air: 1 });
  assert(airborne.front.foot.y < -15 && airborne.back.foot.y < -5, 'both feet tuck in the air');
}

// The phase follows distance, not time: paused or blocked λ never moonwalks; respawn snaps are ignored.
{
  const g = createGaitState();
  const player = { x: 0, y: 0, z: 0, vx: -260, vy: 0, vz: 0, grounded: true };
  advanceGait(g, player, 1 / 60);
  for (let i = 0; i < 60; i++) { player.x -= 260 / 60; advanceGait(g, player, 1 / 60); }
  near(g.phase, (260 / STRIDE_PX * Math.PI * 2) % (Math.PI * 2), 1e-6, 'one second of running advances 260 px of stride');
  assert(g.gait > 0.99, 'full stride while running');
  const frozen = { ...g };
  advanceGait(g, player, 0);
  assert.deepEqual(g, frozen, 'pausing changes nothing');
  for (let i = 0; i < 60; i++) advanceGait(g, player, 1 / 60);
  assert(g.gait < 0.01 && g.phase === frozen.phase, 'pushing against a wall settles to standing');
  player.x += 5000; advanceGait(g, player, 1 / 60);
  assert.equal(g.phase, frozen.phase, 'teleports do not spin the legs');
  player.grounded = false; player.vy = -400;
  for (let i = 0; i < 20; i++) { player.x -= 4; advanceGait(g, player, 1 / 60); }
  assert(g.air > 0.99 && g.gait < 0.05, 'jumping tucks the legs');
  assert.equal(g.phase, frozen.phase, 'feet do not cycle in mid-air');
}

// Through real play — every level, jumps, a question, the battle, pause and restart — the legs stay valid.
for (let stage = 1; stage <= 6; stage++) {
  let run = beginRun(createStageRun(stage));
  const animation = createCharacterAnimationState();
  let ran = false, jumped = false;
  for (let frame = 0; frame < 900; frame++) {
    const input = { ...EMPTY_INPUT, left: true, jump: frame % 50 < 3 };
    run = stepRun(run, input, 1 / 60);
    if (frame === 400) run = setPaused(run, true);
    if (frame === 420) run = setPaused(run, false);
    if (run.mode === 'focus' && run.activeIndex !== null) {
      run = resolveAnswer(run, true, undefined, 100, 5);
    }
    advanceCharacterAnimations(animation, run);
    const stride = animation.lambda.stride;
    if (stride.gait > 0.5) ran = true;
    if (stride.air > 0.5) jumped = true;
    const legs = lambdaLegs(stride);
    for (const p of [legs.front.knee, legs.front.foot, legs.back.knee, legs.back.foot])
      assert(Number.isFinite(p.x) && Number.isFinite(p.y), `finite legs at level ${stage}`);
    if (run.mode === 'over') break;
  }
  assert(ran, `λ runs on level ${stage}`);
  assert(jumped, `λ tucks its legs when jumping on level ${stage}`);
}

// The battle: Sigma airborne, λ still running and jumping with the same legs.
{
  let run = beginRun(createRun('playing'));
  for (let i = 0; i < 130; i++) run = stepRun(run, EMPTY_INPUT, 1 / 60);
  const gate = makeMechanism(22);
  run = resolveAnswer({ ...run, correct: 15, mode: 'focus', activeIndex: gate.index, mechanisms: [gate] }, true);
  assert(run.battle);
  const animation = createCharacterAnimationState();
  let ran = false;
  for (let i = 0; i < 240; i++) {
    run = stepRun(run, { ...EMPTY_INPUT, left: true, jump: i % 60 === 0 }, 1 / 60);
    advanceCharacterAnimations(animation, run);
    if (animation.lambda.stride.gait > 0.5) ran = true;
  }
  assert(ran, 'λ keeps running during the boss battle');
  const fallback = gaitFromRun(run);
  assert(Number.isFinite(fallback.phase));
}

console.log('λ legs passed: rest pose is the plain glyph, constant bone lengths, forward knees, alternating stride, airborne tuck, distance-driven phase, pause/wall/teleport safety, every level and the battle.');
