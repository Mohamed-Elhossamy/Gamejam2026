import type { Input, Mechanism, Mode, Run } from './contracts';
import type { SlopeEffect, MotionEffect, VectorEffect } from '@lambda-rush/api-client';
import { surfaceHeight } from './coordinates';
import { terrainHeight, IDENTITY_DURATION } from './trigonometricTerrain';
import { mechanismX, placedSegments, type PlacedSegment } from './level';
import { jumpBlockHeight, touchesSpikes } from './obstacles';
import {
  HEARTS_2D, POINTS_MIN, SIGMA_BASE_SPEED, SIGMA_BITE_RATE, SIGMA_CLOCK_MAX,
  CLOCK_TARGET, CLOCK_INTRO_SECONDS, CLOCK_ASSEMBLY_COUNT, BATTLE_BITE_RATE, BATTLE_REAR_GAP,
  SIGMA_SPAWN_GAP, TIMER_START, WRONG_FLASH_S, questionSlowdown, rewardedTimeBonus,
  MAP_CONVEYOR_SPEED, MAP_OBSTACLE_KNOCKBACK_PX, MAP_OBSTACLE_STUMBLE_S,
  MAP_PIT_STUMBLE_S, MAP_RAISED_PLATFORM_HEIGHT, MAP_SHUTTER_WIDTH, MAP_SPIKE_HEIGHT, MAP_STEAM_PERIOD_S, MAP_TRAPDOOR_EARLY_WIDTH,
  MAP_SHUTTER_MAX_HEIGHT, MAP_SHUTTER_RAD_S, MAP_HAZARD_TRIGGER, MAP_PLATFORM_LANDING_TOLERANCE,
} from './rules';

export const FLOOR = 440;
export const PLAYER_W = 32;
export const PLAYER_H = 44;
export const PLAYER_SPEED = 260;
export const PLAYER_BOOST_SPEED = 360;
export const PLAYER_STUMBLE_SPEED = 60;
/** λ is stopped by a locked mechanism at m.x + 65; touching that face is touching its checkpoint. */
const CHECKPOINT_FACE = 65;
export const EMPTY_INPUT: Input = { left: false, right: false, jump: false };
export const TIME_RAN_OUT = 'time ran out';
const STAGE_LENGTHS = [3, 3, 4, 5, 5];

export function stageForIndex(index: number) {
  let ordinal = index;
  for (let i = 0; i < STAGE_LENGTHS.length; i++) {
    if (ordinal < STAGE_LENGTHS[i]) return { stage: i + 1, ordinal };
    ordinal -= STAGE_LENGTHS[i];
  }
  if (ordinal < 7) return { stage: 6, ordinal: [5, 6, 0, 1, 2, 3, 4][ordinal] };
  return { stage: 7 + Math.floor((ordinal - 7) / 4), ordinal: (ordinal - 7) % 4 };
}

export function makeMechanism(index: number): Mechanism {
  const { stage, ordinal } = stageForIndex(index);
  return {
    index, x: mechanismX(index), stage, ordinal,
    kind: stage <= 2 ? 'gear' : stage === 3 ? 'vector' : 'matrix',
    solved: false, animation: 0, elapsed: 0,
  };
}

export function createRun(mode: Mode = 'menu'): Run {
  return {
    mode, player: { x: 0, y: FLOOR - PLAYER_H, z: 0, vx: 0, vy: 0, vz: 0, grounded: true },
    monsterX: SIGMA_SPAWN_GAP, monsterZ: 0, cameraX: -560, time: 0, sigmaTime: 0, distance: 0, startX: 0,
    introRemaining: 0, celebration: 0, lastRepair: null, battle: null,
    stage: 1, correct: 0, levelSixCorrect: 0, credited: 0, health: HEARTS_2D, score: 0, boost: 0, damage: 0, stumble: 0,
    mechanisms: [0, 1, 2, 3].map(makeMechanism), activeIndex: null,
    jumpHeld: false, cause: '', normalChaseSpeed: normalSpeed(1),
    timer: TIMER_START, paused: false, perspective: '2d',
    questionPoints: POINTS_MIN,
  };
}

/** Start the announcement without spending any gameplay time. */
export function beginRun(run: Run): Run {
  return { ...run, mode: 'intro', introRemaining: CLOCK_INTRO_SECONDS };
}

/**
 * Clock parts a level shortcut assumes were already earned: one per earlier
 * question. Capped at the finished dial so the five-blow battle always remains.
 */
export function creditedForStage(stage: number) {
  const selected = Math.max(1, Math.min(6, Math.floor(stage) || 1));
  const index = STAGE_LENGTHS.slice(0, selected - 1).reduce((sum, length) => sum + length, 0);
  return Math.min(index, CLOCK_ASSEMBLY_COUNT);
}

/** Jump to an existing stage with earlier clock parts in place, but no points or earned answers. */
export function createStageRun(stage: number): Run {
  const selected = Math.max(1, Math.min(6, Math.floor(stage) || 1));
  const run = createRun('playing');
  if (selected === 1) return run;
  const index = STAGE_LENGTHS.slice(0, selected - 1).reduce((sum, length) => sum + length, 0);
  const x = mechanismX(index) + 250;
  const credited = creditedForStage(selected);
  return {
    ...run, stage: selected, perspective: '2d', correct: credited, credited,
    player: { ...run.player, x }, startX: x, monsterX: x + SIGMA_SPAWN_GAP, cameraX: x - 560,
    normalChaseSpeed: normalSpeed(selected),
    mechanisms: [index, index + 1, index + 2, index + 3].map(makeMechanism),
  };
}

/** Every stage uses the same live question state. */
export function atQuestion(run: Run) {
  return run.mode === 'focus';
}

/**
 * Σ's effective horizontal speed. Calculated every
 * step from state and never stored. The normal pace is fixed at 75 px/s;
 * Focus can only reduce it, never increase it.
 */
export function sigmaSpeed(run: Run) {
  if (run.timer <= 0 || run.mode === 'won' || run.mode === 'intro' || run.battle) return 0;
  return run.normalChaseSpeed * (run.stage === 6 && atQuestion(run) ? 0.25 : questionSlowdown(atQuestion(run), run.timer));
}

/** Pause or resume. Only a live run can pause; everything freezes, timer included. */
export function setPaused(run: Run, paused: boolean): Run {
  if (!['intro', 'playing', 'focus', 'won'].includes(run.mode)) return run.paused ? { ...run, paused: false } : run;
  return run.paused === paused ? run : { ...run, paused };
}

export function normalSpeed(_stage: number) {
  return SIGMA_BASE_SPEED;
}

export const MECHANISM_UNLOCK_PROGRESS = 0.8;

export function mechanismProgress(animation: number) {
  return Math.max(0, Math.min(1, animation / MECHANISM_UNLOCK_PROGRESS));
}

export function shutterHeight(time: number, index: number) {
  return MAP_SHUTTER_MAX_HEIGHT * Math.max(0, Math.sin(time * MAP_SHUTTER_RAD_S + index));
}

export function trapdoor(mechanism: Mechanism, time: number) {
  if (mechanism.stage < 2) return null;
  const segment = placedSegments(mechanism.x + 700, mechanism.x + 1100)
    .find((entry) => entry.type === 'obstacle' && entry.obstacle === 'collapsing-grate' && entry.mechanismIndex === mechanism.index);
  if (!segment) return null;
  const phase = Math.sin(time * (mechanism.stage >= 6 ? 1.5 : 1) + mechanism.index);
  return {
    x: segment.worldStart, width: mechanism.stage >= 6 ? segment.worldEnd - segment.worldStart : MAP_TRAPDOOR_EARLY_WIDTH,
    open: phase > 0.55,
    angle: Math.max(0, Math.min(1, (phase - 0.3) / 0.35)) * Math.PI / 2,
  };
}

export function pointsForStage(stage: number) {
  return Math.min(5, Math.max(1, Math.floor(stage))) * 100;
}

export function resolveAnswer(
  run: Run, correct: boolean, effect?: SlopeEffect | MotionEffect | VectorEffect, points = 0, timeBonus = 0,
): Run {
  if (run.mode !== 'focus' || run.activeIndex === null) return run;
  const gate = run.mechanisms.find((m) => m.index === run.activeIndex);
  if (!gate || gate.solved) return run;
  if (!correct) {
    const health = run.health - 1;
    return {
      ...run, health, damage: WRONG_FLASH_S,
      // In the battle a wrong answer sends Σ at the clock; it never removes a bar or a part.
      battle: run.battle ? { ...run.battle, lastMiss: run.time } : null,
      mode: health <= 0 ? 'over' : 'focus',
      cause: health <= 0 ? 'health-depleted' : '',
    };
  }
  return solveMechanism(run, gate, effect, points, timeBonus);
}

function solveMechanism(
  run: Run, gate: Mechanism, effect: SlopeEffect | MotionEffect | VectorEffect | undefined,
  points: number, timeBonus: number,
): Run {
  if (gate.stage === 6 && gate.ordinal >= 5) {
    return {
      ...run, mode: 'playing', activeIndex: null, boost: 0,
      terrain: {
        phase: gate.ordinal === 5 ? 'sine' : 'identity',
        started: run.time, origin: run.terrain?.origin ?? gate.x,
      },
      mechanisms: run.mechanisms.map(m => m.index === gate.index ? { ...m, solved: true } : m),
    };
  }
  const correctCount = run.correct + 1;
  const levelSixCorrect = run.levelSixCorrect + (gate.stage === 6 ? 1 : 0);
  const won = levelSixCorrect >= CLOCK_TARGET - CLOCK_ASSEMBLY_COUNT;
  const stage = stageForIndex(gate.index + 1).stage;
  // The first strike (answer 16) lifts Σ off the course from wherever it was.
  const battle = run.battle ?? (levelSixCorrect > 0 ? { start: run.time, liftoffX: run.monsterX, lastMiss: null } : null);
  return {
    ...run, correct: correctCount, levelSixCorrect, stage, normalChaseSpeed: normalSpeed(stage), battle,
    levelTransition: !won && stage > run.stage && stage <= 6
      ? { from: run.stage, to: stage, time: run.time } : run.levelTransition,
    mode: won ? 'won' : 'playing', activeIndex: null, boost: won ? 0 : 3.4,
    player: won ? { ...run.player, vx: 0, vy: 0, vz: 0 } : run.player,
    lastRepair: { x: gate.x + CHECKPOINT_FACE, time: run.time },
    celebration: 0,
    mechanisms: run.mechanisms.map((m) => m.index === gate.index ? {
      ...m, solved: true,
      slope: effect?.kind === 'slope' ? effect : undefined,
      motion: effect?.kind === 'motion' ? effect : undefined,
      vector: effect?.kind === 'vector' ? effect : undefined,
    } : m),
    score: run.score + Math.max(0, Math.floor(points)),
    // Once time has run out the catch is already under way; a late bonus cannot undo it.
    timer: run.timer > 0 ? run.timer + rewardedTimeBonus(timeBonus) : run.timer,
  };
}

/**
 * The route as this run sees it. A stage shortcut starts the course at λ's
 * spawn: terrain from the skipped section behind λ is neither drawn nor solid,
 * so every obstacle in view lies ahead, exactly as on the Stage 1 runway.
 */
export function courseSegments(run: Pick<Run, 'startX'>, fromX: number, toX: number): PlacedSegment[] {
  return placedSegments(fromX, toX).filter(segment =>
    segment.worldStart < run.startX &&
    // Level 6 is a continuous mathematical surface, not the repeating spike course.
    !(segment.sectionIndex >= 20 && segment.sectionIndex <= 26 && segment.type === 'obstacle'));
}

/** Cache the route query once when sampling thousands of terrain vertices. */
export function groundSupport(run: Run, segments: readonly PlacedSegment[]) {
  const bridges = segments.flatMap(segment => {
    if (segment.type !== 'obstacle' || segment.obstacle !== 'bridge-gap') return [];
    const m = run.mechanisms.find(m => m.index === segment.mechanismIndex);
    return m && m.kind !== 'gear' ? [{ start: segment.worldStart, end: segment.worldEnd,
      open: !m.solved || mechanismProgress(m.animation) < 1 }] : [];
  });
  const hatches = run.mechanisms.flatMap(m => {
    const hatch = trapdoor(m, run.time);
    return hatch?.open ? [{ ...hatch, z: (m.index % 3 - 1) * 180 }] : [];
  });
  return (x: number, _z = 0) =>
    !bridges.some(b => x > b.start && x < b.end && b.open) &&
    !hatches.some(h => x > h.x && x < h.x + h.width);
}

export function hasGround(run: Run, x: number, z = 0) {
  return groundSupport(run, courseSegments(run, x - 300, x + 300))(x, z);
}

export function groundHeight(run: Run, x: number, _z = 0) {
  return terrainHeight(run, x) - Math.max(0, ...run.mechanisms.map(m =>
    (m.motion || mechanismProgress(m.animation) >= 1) ? surfaceHeight(m, x) : 0));
}


function substep(current: Run, input: Input, dt: number): Run {
  if (current.mode === 'intro') {
    const remaining = Math.max(0, current.introRemaining - dt);
    return { ...current, introRemaining: remaining < 1e-8 ? 0 : remaining,
      mode: remaining < 1e-8 ? 'playing' : 'intro' };
  }
  if (current.mode === 'won') {
    // Victory owns the terminal state: only the restoration celebration advances.
    return { ...current, time: current.time + dt, celebration: current.celebration + dt,
      mechanisms: current.mechanisms.map(m => m.solved ? {
        ...m, animation: Math.min(1, m.animation + dt * 1.6), elapsed: m.elapsed + dt,
      } : m) };
  }
  if (current.mode === 'over' || current.mode === 'menu') {
    return { ...current, time: current.time + dt };
  }
  const timer = Math.max(0, current.timer - dt);
  if (timer === 0) return {
    ...current, time: current.time + dt, timer, mode: 'over', cause: TIME_RAN_OUT,
  };
  const run: Run = {
    ...current, player: { ...current.player },
    mechanisms: current.mechanisms.map((m) => ({
      ...m, animation: m.solved ? Math.min(1, m.animation + dt * (m.motion ? MECHANISM_UNLOCK_PROGRESS / m.motion.duration : 1.6)) : 0,
      elapsed: m.solved ? m.elapsed + dt : 0,
    })),
    time: current.time + dt,
    timer,
    boost: Math.max(0, current.boost - dt),
    damage: Math.max(0, current.damage - dt),
    stumble: Math.max(0, current.stumble - dt),
    normalChaseSpeed: normalSpeed(current.stage),
  };
  // Effective speed is derived from state every step (never stored), so repeated
  // wrong attempts cannot compound the 25% multiplier.
  const speed = sigmaSpeed(run);
  if (run.terrain?.phase === 'identity' &&
      current.time - run.terrain.started < IDENTITY_DURATION &&
      run.time - run.terrain.started >= IDENTITY_DURATION) run.boost = 3.4;
  const speedRatio = speed / run.normalChaseSpeed;
  // Σ's bite cycle is 50% quicker than the speed-scaled pursuit clock; while it
  // hovers in the battle it snaps aggressively but never pursues.
  run.sigmaTime = current.sigmaTime + dt * (run.battle ? BATTLE_BITE_RATE : Math.min(SIGMA_CLOCK_MAX, speedRatio * SIGMA_BITE_RATE));
  run.monsterZ = 0;
  run.monsterX -= speed * dt;
  const p = run.player;
  if (run.mode === 'focus') {
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.grounded = true;
    p.y = groundHeight(run, p.x + PLAYER_W / 2) - PLAYER_H;
  } else {
    const speed = run.stumble > 0 ? PLAYER_STUMBLE_SPEED : run.boost > 0 ? PLAYER_BOOST_SPEED : PLAYER_SPEED;
    p.vx = (Number(input.right) - Number(input.left)) * speed;
    p.vz = 0;
    p.z = 0;
    if (input.jump && !run.jumpHeld && p.grounded) {
      p.vy = -530;
      p.grounded = false;
    }
    const oldBottom = p.y + PLAYER_H;
    p.vy = Math.min(800, p.vy + 1450 * dt);
    p.x = Math.min(0, p.x + p.vx * dt);
    p.y += p.vy * dt;
    p.grounded = false;

    for (const m of run.mechanisms) {
      // Keep every collider locked until its visible mechanism reaches its
      // traversable position, including the gear door's raised panel.
      const locked = !m.solved || mechanismProgress(m.animation) < 1;
      if (locked && p.x < m.x + 65 && current.player.x >= m.x + 65) {
        p.x = m.x + 65;
        p.vx = 0;
      }
    }
    // Map hazards are data-driven and only ever cost position/time. They use
    // run.time, so both their motion and collision freeze with pause.
    // Environmental collisions stay on the same 2D route at every stage.
    const nearby = courseSegments(run, p.x - 180, p.x + PLAYER_W + 180);
    for (const segment of nearby) {
      if (segment.type !== 'obstacle' || segment.obstacle === 'bridge-gap' || segment.obstacle === 'collapsing-grate') continue;
      const overlaps = p.x + PLAYER_W > segment.worldStart && p.x < segment.worldEnd;
      if (!overlaps) continue;
      const owner = segment.mechanismIndex ?? 0;
      const knockBack = () => {
        p.x = Math.min(0, segment.worldEnd + MAP_OBSTACLE_KNOCKBACK_PX);
        p.vx = 0;
        run.stumble = Math.max(run.stumble, MAP_OBSTACLE_STUMBLE_S);
      };
      if (segment.obstacle === 'spike-strip') {
        if (current.stumble <= 0 && touchesSpikes(segment, p, PLAYER_W, PLAYER_H, FLOOR)) knockBack();
      } else if (segment.obstacle === 'jump-block') {
        const top = FLOOR - jumpBlockHeight(segment);
        // Land on the visible top; side contact stops motion without teleporting.
        if (oldBottom > top + MAP_PLATFORM_LANDING_TOLERANCE && p.y + PLAYER_H > top && p.y < FLOOR) {
          if (current.player.x >= segment.worldEnd - 1) p.x = segment.worldEnd;
          else if (current.player.x + PLAYER_W <= segment.worldStart + 1) p.x = segment.worldStart - PLAYER_W;
          else {
            // Recover an embedded body too; a prior overlap is not a way through.
            // Check the whole nearby solid group, so adjacent steps cannot
            // repeatedly eject λ into one another.
            const solids = nearby.filter(b => jumpBlockHeight(b) &&
              p.y + PLAYER_H > FLOOR - jumpBlockHeight(b) && p.y < FLOOR);
            const exits = solids.flatMap(b => [b.worldStart - PLAYER_W, b.worldEnd])
              .filter(x => !solids.some(b => x + PLAYER_W > b.worldStart && x < b.worldEnd))
              .sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
            p.x = exits[0] ?? current.player.x;
          }
          p.vx = 0;
        }
      } else if (segment.obstacle === 'timed-shutter-platform') {
        const platformEnd = segment.worldEnd - MAP_SHUTTER_WIDTH;
        const platformTop = FLOOR - MAP_RAISED_PLATFORM_HEIGHT;
        if (p.x + PLAYER_W > segment.worldStart && p.x < platformEnd && p.vy >= 0 &&
            oldBottom <= platformTop + MAP_PLATFORM_LANDING_TOLERANCE && p.y + PLAYER_H >= platformTop) {
          p.y = platformTop - PLAYER_H;
          p.vy = 0;
          p.grounded = true;
        }
        const raised = shutterHeight(run.time, owner);
        if (raised > 1 && p.x + PLAYER_W > platformEnd && p.x < segment.worldEnd &&
            p.y + PLAYER_H > FLOOR - raised && p.y < FLOOR && p.vx < 0) knockBack();
      } else if (segment.obstacle === 'conveyor' && p.grounded) {
        p.x = Math.min(0, p.x + MAP_CONVEYOR_SPEED * dt);
      } else if (segment.obstacle === 'steam-vent') {
        const active = Math.sin(run.time * Math.PI * 2 / MAP_STEAM_PERIOD_S + owner) > MAP_HAZARD_TRIGGER;
        if (active && p.y + PLAYER_H > FLOOR - MAP_RAISED_PLATFORM_HEIGHT) knockBack();
      }
    }
    let ground = groundHeight(run, p.x + PLAYER_W / 2, p.z);
    for (const segment of nearby) {
      const height = jumpBlockHeight(segment);
      const footLeft = p.x + 6, footRight = p.x + PLAYER_W - 6;
      if (height && footRight > segment.worldStart && footLeft < segment.worldEnd &&
          oldBottom <= FLOOR - height + MAP_PLATFORM_LANDING_TOLERANCE)
        ground = Math.min(ground, FLOOR - height);
    }
    const wasOnTerrain = current.player.grounded &&
      Math.abs(oldBottom - groundHeight(current, current.player.x + PLAYER_W / 2)) < 3;
    // Solid terrain is not a one-way platform: a descending foot penetrating an
    // uphill/moving surface must be resolved even if it crossed by more than 2px.
    // Follow slopes from their PREVIOUS support, not their new height.
    const touchesSurface = p.y < ground && p.y + PLAYER_H >= ground;
    if (p.vy >= 0 && (wasOnTerrain || touchesSurface) &&
        hasGround(run, p.x + PLAYER_W / 2, p.z)) {
      p.y = ground - PLAYER_H;
      p.vy = 0;
      p.grounded = true;
    }
    if (p.y > 600) {
      // Missing a platform costs time, not a health point or an extra death rule.
      const hatch = run.mechanisms.map((m) => trapdoor(m, run.time))
        .find((h) => h && p.x > h.x - PLAYER_W && p.x < h.x + h.width);
      const nearest = run.mechanisms.find((m) => Math.abs(m.x - p.x) < 500);
      p.x = hatch ? hatch.x + hatch.width + 35 : nearest ? nearest.x + 90 : p.x + 120;
      p.y = groundHeight(run, p.x + PLAYER_W / 2) - PLAYER_H;
      p.vy = 0;
      p.grounded = true;
      run.stumble = MAP_PIT_STUMBLE_S;
    }
    // Touching a checkpoint starts its question on this same step: no interact key,
    // no grounded requirement. A locked mechanism stops λ at its checkpoint face.
    const gate = run.mechanisms.find((m) => !m.solved && p.x <= m.x + CHECKPOINT_FACE + 0.5);
    if (gate) {
      run.activeIndex = gate.index;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.y = groundHeight(run, p.x + PLAYER_W / 2) - PLAYER_H;
      p.grounded = true;
      run.mode = 'focus';
    }
  }
  run.jumpHeld = input.jump;
  // Airborne Σ is no longer on the route: keep it parked far behind λ so the
  // rear boundary, proximity cues and marker all stay inert.
  if (run.battle) run.monsterX = p.x + PLAYER_W + BATTLE_REAR_GAP;
  // Σ is the rear limit of the chase at every height, including Focus and falls.
  const crossedSigma = !run.battle && p.x + PLAYER_W >= run.monsterX;
  if (crossedSigma) {
    // Jumping, pit recovery or knockback must never put λ behind the pursuer.
    p.x = Math.min(p.x, run.monsterX - PLAYER_W);
    p.vx = 0;
    run.mode = 'over';
    run.cause = 'The pursuing anomaly caught you.';
  }
  run.cameraX = p.x - 560;
  run.distance = Math.max(run.distance, (run.startX - p.x) / 10);

  const last = run.mechanisms[run.mechanisms.length - 1];
  if (last && last.x > p.x - 4500) run.mechanisms.push(makeMechanism(last.index + 1));
  run.mechanisms = run.mechanisms.filter((m) => m.x < p.x + 1800);
  return run;
}

export function stepRun(run: Run, input: Input, elapsed: number): Run {
  // Pause freezes everything: timer, Σ, physics, obstacles and animations.
  if (run.paused) return run;
  // Fixed maximum substeps preserve collision behavior across frame rates.
  let remaining = Math.max(0, Math.min(elapsed, 0.15));
  let next = run;
  while (remaining > 0.000001) {
    const dt = Math.min(1 / 120, remaining);
    next = substep(next, input, dt);
    remaining -= dt;
  }
  return next;
}
