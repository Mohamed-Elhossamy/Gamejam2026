import assert from 'node:assert/strict';
import { createRun, EMPTY_INPUT, stepRun } from './simulation';
import {
  advanceCharacterAnimations,
  biteCycleDuration,
  bitePhaseAt,
  createCharacterAnimationState,
  lambdaPose,
  sigmaPose,
} from './sigma';
import { dangerEffect } from './renderer';
import {
  BITE_CLAMP_S, BITE_CYCLE_MAX_S, BITE_CYCLE_MIN_S, BITE_REAR_S, BITE_REST_S, BITE_STRIKE_S,
  PROX2D_MAX_SHAKE_PX, PROX2D_MAX_ZOOM, PROX2D_START_PX,
} from './rules';

const run = { ...createRun('playing'), timer: 60 };
assert(sigmaPose(run).hop < 15, 'Σ begins close to the ground in the visible spawn area');
run.monsterX = 360; // middle of the occasional cosmetic hop
assert(sigmaPose(run).hop > 25);
const snapshot = JSON.stringify(run);
sigmaPose(run);
assert.equal(JSON.stringify(run), snapshot, 'drawing a hop must not alter gameplay');

for (const mode of ['playing', 'focus'] as const) {
  for (const fps of [30, 60, 144]) {
    const moving = { ...run, mode };
    const pose = sigmaPose(moving);
    assert(pose.hop > 25);
    const next = stepRun(moving, EMPTY_INPUT, 1 / fps);
    const expected = moving.normalChaseSpeed * (mode === 'focus' ? 0.25 : 1) / fps;
    assert(Math.abs(moving.monsterX - next.monsterX - expected) < 1e-8,
      'hopping never adds horizontal speed, including during Focus');
  }
}
const caught = { ...run, mode: 'over' as const, cause: 'The pursuing anomaly caught you.' };
assert.equal(sigmaPose(caught).jawClose, 1);
assert.equal(sigmaPose(caught).hop, 0, 'the integrated jaws bite at ground level');
assert(sigmaPose(run).jawClose < 0.2, 'the open letter remains recognisable during pursuit');

function animate(mode: 'playing' | 'focus') {
  const state = createCharacterAnimationState();
  const initial = createRun(mode);
  const snapshot = JSON.stringify(initial);
  for (let frame = 1; frame <= 120; frame++) {
    const time = frame / 60;
    advanceCharacterAnimations(state, {
      ...initial,
      time,
      sigmaTime: time * (mode === 'focus' ? 0.25 : 1),
    }, () => 0.5);
  }
  assert.equal(JSON.stringify(initial), snapshot, 'presentation animation never mutates gameplay state');
  return { state, run: { ...initial, time: 2, sigmaTime: mode === 'focus' ? 0.5 : 2 } };
}

const normalAnimation = animate('playing');
const focusAnimation = animate('focus');
assert(Math.abs(normalAnimation.state.sigma.time - 2) < 1e-8, 'Σ animation follows normal simulation time');
assert(Math.abs(focusAnimation.state.sigma.time - 0.5) < 1e-8, 'Σ attack animation slows to 25% in Focus');
assert(Math.abs(
  lambdaPose(normalAnimation.run, normalAnimation.state).hop -
  lambdaPose(focusAnimation.run, focusAnimation.state).hop,
) < 1e-8, 'λ has no decorative lift in either running or Focus');
assert.equal(lambdaPose(normalAnimation.run, normalAnimation.state).hop, 0, 'physical position owns the entire jump arc');
assert(
  sigmaPose(normalAnimation.run, normalAnimation.state).points.T[0] !== -170,
  'Σ control points use the spring-driven poses',
);
for (const fps of [30, 60, 144]) {
  const state = createCharacterAnimationState();
  const run = createRun('playing');
  for (let frame = 1; frame <= Math.floor(1.1 * fps); frame++) {
    advanceCharacterAnimations(state, { ...run, time: frame / fps, sigmaTime: frame / fps }, () => 0.5);
  }
  assert.equal(state.lambda.air, false, 'standing on a surface never starts an automatic hop');
  for (let frame = Math.floor(1.1 * fps) + 1; frame <= Math.ceil(1.4 * fps); frame++) {
    advanceCharacterAnimations(state, { ...run, time: frame / fps, sigmaTime: frame / fps }, () => 0.5);
  }
  assert.equal(state.lambda.air, false, 'waiting longer still cannot create a visual-only jump');
  assert.equal(state.lambda.y, 0);
  const jumping = { ...run, time: 1.5, player: { ...run.player, y: run.player.y - 50, grounded: false, vy: -200 } };
  advanceCharacterAnimations(state, jumping);
  assert(state.lambda.air, 'airborne animation follows a real jump');
  assert.equal(lambdaPose(jumping, state).hop, 0, 'the real jump is never counted twice');
  advanceCharacterAnimations(state, { ...run, time: 1.6 });
  assert.equal(state.lambda.air, false, 'landing clears the airborne presentation');
  const visual = lambdaPose(run, state);
  const squash = Math.max(-0.25, Math.min(0.25, state.lambda.squash.x * 0.06));
  assert.equal(visual.scaleX, 1 + squash * 0.7);
  assert.equal(visual.scaleY, 1 - squash);
  advanceCharacterAnimations(state, { ...run, time: 0 }, () => 0.5);
  const fresh = createCharacterAnimationState();
  // The leg stride only records where the restarted λ stands; it has not stepped.
  fresh.lambda.stride.lastX = run.player.x;
  assert.deepEqual(state, fresh, 'restart resets both presentation clocks');
}
assert.equal(bitePhaseAt(BITE_REST_S - 0.0001), 'rest');
assert.equal(bitePhaseAt(BITE_REST_S), 'rear');
assert.equal(bitePhaseAt(BITE_REST_S + BITE_REAR_S), 'strike');
assert.equal(bitePhaseAt(BITE_REST_S + BITE_REAR_S + BITE_STRIKE_S), 'clamp');
assert.equal(bitePhaseAt(BITE_REST_S + BITE_REAR_S + BITE_STRIKE_S + BITE_CLAMP_S), 'recover');
for (let cycle = 0; cycle < 20; cycle++) {
  const duration = biteCycleDuration(cycle);
  assert(duration >= BITE_CYCLE_MIN_S && duration <= BITE_CYCLE_MAX_S, 'bite duration stays in range');
  assert.equal(duration, biteCycleDuration(cycle), 'bite durations are deterministic');
}

const dangerRun = createRun('playing');
dangerRun.monsterX = dangerRun.player.x + 32 + PROX2D_START_PX;
assert.equal(dangerEffect(dangerRun).strength, 0, 'proximity starts at the configured gap');
dangerRun.monsterX = dangerRun.player.x + 32;
const closeDanger = dangerEffect(dangerRun);
assert(closeDanger.shake <= PROX2D_MAX_SHAKE_PX && closeDanger.zoom <= PROX2D_MAX_ZOOM);
const reducedDanger = dangerEffect(dangerRun, true);
assert.equal(reducedDanger.shake, 0);
assert.equal(reducedDanger.zoom, 0);
const dangerSnapshot = JSON.stringify(dangerRun);
dangerEffect(dangerRun);
sigmaPose(dangerRun);
assert.equal(JSON.stringify(dangerRun), dangerSnapshot, 'presentation cannot mutate collision state');
console.log('Σ/λ passed: source bite timing, springs, Focus slowdown, physics-only λ jumps, grounded feet, unchanged gameplay state and constant chase speed.');
