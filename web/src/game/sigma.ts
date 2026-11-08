import type { Run } from './contracts';
import { advanceGait, createGaitState, type GaitState } from './lambdaGait';
import {
  BITE_CLAMP_S, BITE_CYCLE_MAX_S, BITE_CYCLE_MIN_S, BITE_REAR_S, BITE_REST_S, BITE_STRIKE_S,
  LAMBDA_BLINK_S, SIGMA_BOB_PRIMARY_HZ, SIGMA_BOB_SECONDARY_HZ,
} from './rules';

type Point = [number, number];
type PointKey = 'T' | 'Ct' | 'A' | 'Cam' | 'M' | 'Cmb' | 'B' | 'Cb' | 'D';
type PosePoints = Record<PointKey, Point> & { lean: number; squash: number; squint: number };

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const KEYS: PointKey[] = ['T', 'Ct', 'A', 'Cam', 'M', 'Cmb', 'B', 'Cb', 'D'];

const REST: PosePoints = {
  T: [-170, -226], Ct: [-90, -224], A: [-8, -204], Cam: [-36, -162], M: [-84, -112],
  Cmb: [-36, -62], B: [-8, -17], Cb: [-90, -16], D: [-170, -17],
  lean: 0, squash: 0, squint: 0,
};
const REAR: PosePoints = {
  T: [-136, -262], Ct: [-72, -236], A: [-14, -186], Cam: [-34, -150], M: [-72, -104],
  Cmb: [-34, -58], B: [-10, -17], Cb: [-80, -16], D: [-148, -17],
  lean: 8, squash: -0.07, squint: 0.6,
};
const STRIKE: PosePoints = {
  T: [-206, -112], Ct: [-112, -156], A: [-12, -184], Cam: [-34, -148], M: [-92, -100],
  Cmb: [-36, -56], B: [-8, -17], Cb: [-104, -16], D: [-206, -18],
  lean: -6, squash: 0.05, squint: 0.2,
};
const CLAMP: PosePoints = {
  T: [-156, -58], Ct: [-88, -112], A: [-14, -150], Cam: [-30, -118], M: [-62, -86],
  Cmb: [-34, -50], B: [-10, -17], Cb: [-88, -15], D: [-164, -21],
  lean: -3, squash: -0.05, squint: 0.8,
};
const STIFFNESS: Record<PointKey, number> = {
  T: 0.9, Ct: 1, A: 1.12, Cam: 1.12, M: 1.05, Cmb: 1.12, B: 1.18, Cb: 1.1, D: 0.9,
};
const REST_HOLD = BITE_REST_S;
const REAR_TIME = BITE_REAR_S;
const STRIKE_TIME = BITE_STRIKE_S;
const CLAMP_TIME = BITE_CLAMP_S;
const SIGMA_STIFFNESS: Record<PointKey, [number, number]> = {
  T: [150, 12], Ct: [170, 13], A: [260, 24], Cam: [260, 24], M: [220, 20],
  Cmb: [260, 26], B: [320, 32], Cb: [300, 30], D: [220, 20],
};
const motionQuery = typeof window === 'undefined'
  ? null
  : window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionQuery?.matches ?? false;
motionQuery?.addEventListener('change', event => { reduceMotion = event.matches; });

type PointSpring = { x: Point; v: Point };
type ScalarSpring = { x: number; v: number };

export type CharacterAnimationState = {
  lastRunTime: number;
  lastSigmaTime: number;
  sigma: {
    time: number;
    phase: number;
    cycle: number;
    duration: number;
    points: Record<PointKey, PointSpring>;
    glowTop: PointSpring;
    glowControl: PointSpring;
    lean: ScalarSpring;
    squash: ScalarSpring;
    squint: number;
  };
  lambda: {
    y: number;
    vy: number;
    air: boolean;
    squash: ScalarSpring;
    /** Leg run cycle; advanced even with reduced motion, since it is locomotion. */
    stride: GaitState;
  };
};

function pointSpring(point: Point): PointSpring {
  return { x: [...point], v: [0, 0] };
}

function scalarSpring(): ScalarSpring {
  return { x: 0, v: 0 };
}

export function createCharacterAnimationState(): CharacterAnimationState {
  return {
    lastRunTime: 0,
    lastSigmaTime: 0,
    sigma: {
      time: 0,
      phase: 0,
      cycle: 0,
      duration: biteCycleDuration(0),
      points: Object.fromEntries(KEYS.map(key => [key, pointSpring(REST[key])])) as Record<PointKey, PointSpring>,
      glowTop: pointSpring(REST.T),
      glowControl: pointSpring(REST.Ct),
      lean: scalarSpring(),
      squash: scalarSpring(),
      squint: 0,
    },
    lambda: { y: 0, vy: 0, air: false, squash: scalarSpring(), stride: createGaitState() },
  };
}

/** Stable hash so bite-cycle variation is reproducible without touching gameplay state. */
function cycleHash(cycle: number) {
  let value = (cycle + 1) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Deterministic, speed-clock cycle duration in the tuned range. */
export function biteCycleDuration(cycle: number) {
  return BITE_CYCLE_MIN_S + cycleHash(cycle) * (BITE_CYCLE_MAX_S - BITE_CYCLE_MIN_S);
}

export type BitePhase = 'rest' | 'rear' | 'strike' | 'clamp' | 'recover';
export function bitePhaseAt(phase: number): BitePhase {
  if (phase < REST_HOLD) return 'rest';
  if (phase < REST_HOLD + REAR_TIME) return 'rear';
  if (phase < REST_HOLD + REAR_TIME + STRIKE_TIME) return 'strike';
  if (phase < REST_HOLD + REAR_TIME + STRIKE_TIME + CLAMP_TIME) return 'clamp';
  return 'recover';
}

function springPoint(state: PointSpring, target: Point, stiffness: number, damping: number, dt: number) {
  const steps = 3;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (let axis = 0; axis < 2; axis++) {
      state.v[axis] += (stiffness * (target[axis] - state.x[axis]) - damping * state.v[axis]) * h;
      state.x[axis] += state.v[axis] * h;
    }
  }
}

function springScalar(state: ScalarSpring, target: number, stiffness: number, damping: number, dt: number) {
  const steps = 3;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (stiffness * (target - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
}


function advanceSigmaAnimation(state: CharacterAnimationState['sigma'], dt: number) {
  state.time += dt;
  state.phase += dt;
  if (state.phase >= state.duration) {
    state.phase -= state.duration;
    state.cycle += 1;
    state.duration = biteCycleDuration(state.cycle);
  }

  const target = phaseTarget(state.phase);
  for (const key of KEYS) {
    const [k, d] = SIGMA_STIFFNESS[key];
    springPoint(state.points[key], target[key], k, d, dt);
  }
  springPoint(state.glowTop, state.points.T.x, 55, 13, dt);
  springPoint(state.glowControl, state.points.Ct.x, 60, 13, dt);
  springScalar(
    state.lean,
    target.lean + Math.sin(state.time * 3.1) * 0.7 + Math.sin(state.time * 1.7) * 0.4,
    60,
    9,
    dt,
  );
  springScalar(state.squash, target.squash, 120, 14, dt);
  state.squint += (target.squint - state.squint) * Math.min(1, dt * 10);
}

function advanceLambdaAnimation(state: CharacterAnimationState['lambda'], dt: number, player: Run['player']) {
  if (state.air && player.grounded) state.squash.v += 6 + Math.abs(state.vy) * 0.012;
  else if (!state.air && !player.grounded && player.vy < 0) state.squash.v -= 4;
  state.air = !player.grounded;
  state.vy = player.vy;
  // The physical player position already contains the entire jump arc.
  state.y = 0;
  springScalar(state.squash, 0, 260, 16, dt);
}

/** Advances only character presentation; the game simulation still owns movement and collisions. */
export function advanceCharacterAnimations(
  state: CharacterAnimationState,
  run: Run,
  _random: () => number = Math.random,
) {
  if (run.time < state.lastRunTime || run.sigmaTime < state.lastSigmaTime) Object.assign(state, createCharacterAnimationState());
  const lambdaDt = Math.min(0.05, Math.max(0, run.time - state.lastRunTime));
  const sigmaDt = Math.min(0.05, Math.max(0, run.sigmaTime - state.lastSigmaTime));
  state.lastRunTime = run.time;
  state.lastSigmaTime = run.sigmaTime;
  if (run.mode === 'over') return;
  // The legs follow λ's real movement in every mode — chase, questions, battle, finale.
  advanceGait(state.lambda.stride, run.player, lambdaDt);
  if (reduceMotion) return;

  if (sigmaDt > 0) advanceSigmaAnimation(state.sigma, sigmaDt);
  if (lambdaDt > 0) advanceLambdaAnimation(state.lambda, lambdaDt, run.player);
}

function positiveMod(value: number, period: number) {
  return ((value % period) + period) % period;
}

/** Spring response sampled analytically, so poses stay deterministic. */
function springEase(t: number, stiffness: number) {
  const u = clamp(t);
  const omega = 6.8 * stiffness;
  const damped = omega * Math.sqrt(1 - 0.72 * 0.72);
  const envelope = Math.exp(-0.72 * omega * u);
  return 1 - envelope * (
    Math.cos(damped * u) + (0.72 / Math.sqrt(1 - 0.72 * 0.72)) * Math.sin(damped * u)
  );
}

function interpolatePose(from: PosePoints, to: PosePoints, progress: number): PosePoints {
  const pose = {} as PosePoints;
  for (const key of KEYS) {
    const k = springEase(progress, STIFFNESS[key]);
    pose[key] = [
      from[key][0] + (to[key][0] - from[key][0]) * k,
      from[key][1] + (to[key][1] - from[key][1]) * k,
    ];
  }
  const k = springEase(progress, 1);
  pose.lean = from.lean + (to.lean - from.lean) * k;
  pose.squash = from.squash + (to.squash - from.squash) * k;
  pose.squint = from.squint + (to.squint - from.squint) * k;
  return pose;
}

function phasePose(phase: number): PosePoints {
  if (phase < REST_HOLD || phase >= REST_HOLD + REAR_TIME + STRIKE_TIME + CLAMP_TIME) return REST;
  if (phase < REST_HOLD + REAR_TIME) {
    return interpolatePose(REST, REAR, (phase - REST_HOLD) / REAR_TIME);
  }
  const rearEnd = REST_HOLD + REAR_TIME;
  if (phase < rearEnd + STRIKE_TIME) {
    return interpolatePose(REAR, STRIKE, (phase - rearEnd) / STRIKE_TIME);
  }
  const strikeEnd = rearEnd + STRIKE_TIME;
  if (phase < strikeEnd + CLAMP_TIME) {
    return interpolatePose(STRIKE, CLAMP, (phase - strikeEnd) / CLAMP_TIME);
  }
  return REST;
}

function phaseTarget(phase: number): PosePoints {
  if (phase < REST_HOLD || phase >= REST_HOLD + REAR_TIME + STRIKE_TIME + CLAMP_TIME) return REST;
  if (phase < REST_HOLD + REAR_TIME) return REAR;
  const rearEnd = REST_HOLD + REAR_TIME;
  if (phase < rearEnd + STRIKE_TIME) return STRIKE;
  if (phase < rearEnd + STRIKE_TIME + CLAMP_TIME) return CLAMP;
  return REST;
}

/**
 * A distance clock ties the legless Sigma's body beats to its actual pursuit:
 * the same world-space travel takes four times longer in Focus mode.
 */
export function sigmaPose(run: Run, animation?: CharacterAnimationState) {
  const gap = run.monsterX - (run.player.x + 32);
  const caught = run.mode === 'over' && (run.cause.toLowerCase().includes('caught') || run.timer <= 0);
  const chaseTime = (1000 - run.monsterX) / Math.max(1, run.normalChaseSpeed);
  const cycleTime = animation?.sigma.duration ?? biteCycleDuration(0);
  const phase = reduceMotion ? 0 : animation?.sigma.phase ?? positiveMod(run.sigmaTime, cycleTime);
  const fallback = phasePose(phase);
  const points = {} as PosePoints;
  for (const key of KEYS) {
    points[key] = caught
      ? [...CLAMP[key]]
      : reduceMotion
        ? [...REST[key]]
        : animation
          ? [...animation.sigma.points[key].x]
          : [...fallback[key]];
  }
  points.lean = caught ? CLAMP.lean : reduceMotion ? 0 : animation?.sigma.lean.x ?? fallback.lean;
  points.squash = caught ? CLAMP.squash : reduceMotion ? 0 : animation?.sigma.squash.x ?? fallback.squash;
  points.squint = caught ? CLAMP.squint : reduceMotion ? 0 : animation?.sigma.squint ?? fallback.squint;
  const hopProgress = (positiveMod(1000 - run.monsterX, 780) - 585) / 110;
  const hopping = !reduceMotion && (run.mode === 'playing' || run.mode === 'focus') &&
    hopProgress > 0 && hopProgress < 1;
  const hop = hopping ? Math.sin(hopProgress * Math.PI) * 26 * clamp((gap - 75) / 180) : 0;
  const blink = !reduceMotion && positiveMod(chaseTime, LAMBDA_BLINK_S) < 0.12;
  const strikeStart = REST_HOLD + REAR_TIME;
  const clampStart = strikeStart + STRIKE_TIME;
  const jawClose = caught
    ? 1
    : phase < strikeStart
      ? 0
      : phase < clampStart
        ? (phase - strikeStart) / STRIKE_TIME
        : phase < clampStart + CLAMP_TIME
          ? 1
          : 0;
  const glowSpeed = animation ? Math.hypot(...animation.sigma.points.T.v) : 0;
  const danger = !reduceMotion && phase >= REST_HOLD && phase < strikeStart + STRIKE_TIME;
  const bob = !reduceMotion && animation
    ? Math.sin(animation.sigma.time * SIGMA_BOB_PRIMARY_HZ) * 1.3 + Math.sin(animation.sigma.time * SIGMA_BOB_SECONDARY_HZ) * 0.5
    : 0;
  return {
    hop, points, caught, chaseTime, phase, blink, jawClose, danger, bob,
    lean: points.lean, squash: points.squash, squint: points.squint,
    pulse: animation && !reduceMotion ? 0.78 + 0.22 * Math.abs(Math.sin(animation.sigma.time * 9)) : 1,
    glowOpacity: reduceMotion ? 0 : Math.min(0.28, glowSpeed / 4000),
    glowTop: animation?.sigma.glowTop.x ?? points.T,
    glowControl: animation?.sigma.glowControl.x ?? points.Ct,
  };
}

export function sigmaRenderBounds(run: Run, animation?: CharacterAnimationState) {
  const { points } = sigmaPose(run, animation);
  const xs = KEYS.map(key => points[key][0]);
  return {
    left: 124 + Math.min(...xs) * 0.58 - 14,
    right: 124 + Math.max(...xs) * 0.58 + 14,
  };
}

export function lambdaPose(run: Run, animation?: CharacterAnimationState) {
  const player = run.player;
  if (animation && !reduceMotion) {
    const { lambda } = animation;
    const lsq = Math.max(-0.25, Math.min(0.25, lambda.squash.x * 0.06));
    const eyeLag = Math.max(-5, Math.min(5, -lambda.vy * 0.012));
    const danger = sigmaPose(run, animation).danger;
    const lift = player.grounded ? 0 : Math.min(1, Math.abs(player.vy) / 530);
    return {
      hop: 0,
      scaleX: 1 + lsq * 0.7,
      scaleY: 1 - lsq,
      blink: positiveMod(run.time, LAMBDA_BLINK_S) < 0.12,
      eyeLeftOffsetY: eyeLag + Math.sin(run.time * 2.4) * 2.5,
      eyeRightOffsetY: eyeLag * 1.2 + Math.sin(run.time * 2.4 + 0.9) * 2.5,
      eyeLook: danger ? 1.6 : -1.8,
      shadowScale: 1 - 0.35 * lift,
      shadowOpacity: 0.3 * (1 - 0.5 * lift),
    };
  }
  const airborneStretch = !reduceMotion && !player.grounded
    ? clamp(Math.abs(player.vy) / 530) * (player.vy < 0 ? 0.12 : -0.06)
    : 0;
  const lift = player.grounded ? 0 : Math.min(1, Math.abs(player.vy) / 530);
  return {
    hop: 0,
    scaleX: 1 - airborneStretch * 0.55,
    scaleY: 1 + airborneStretch,
    blink: !reduceMotion && positiveMod(run.time, LAMBDA_BLINK_S) < 0.12,
    eyeLeftOffsetY: 0,
    eyeRightOffsetY: 0,
    eyeLook: run.monsterX - (player.x + 32) < 260 ? 1.6 : -1.8,
    shadowScale: 1 - 0.35 * lift,
    shadowOpacity: 0.3 * (1 - 0.5 * lift),
  };
}

function quadratic(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function tangent(a: Point, c: Point, b: Point, t: number): Point {
  const x = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
  const y = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

function drawTooth(ctx: CanvasRenderingContext2D, a: Point, c: Point, b: Point, t: number, inward: 1 | -1) {
  const p = quadratic(a, c, b, t);
  const u = tangent(a, c, b, t);
  const n: Point = [-u[1] * inward, u[0] * inward];
  const base: Point = [p[0] + n[0] * 14, p[1] + n[1] * 14];
  const tip: Point = [p[0] + n[0] * 30, p[1] + n[1] * 30];
  ctx.beginPath();
  ctx.moveTo(base[0] - u[0] * 6, base[1] - u[1] * 6);
  ctx.lineTo(tip[0], tip[1]);
  ctx.lineTo(base[0] + u[0] * 6, base[1] + u[1] * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function sigmaPath(ctx: CanvasRenderingContext2D, p: PosePoints) {
  ctx.beginPath();
  ctx.moveTo(...p.T);
  ctx.quadraticCurveTo(...p.Ct, ...p.A);
  ctx.quadraticCurveTo(...p.Cam, ...p.M);
  ctx.quadraticCurveTo(...p.Cmb, ...p.B);
  ctx.quadraticCurveTo(...p.Cb, ...p.D);
}

/**
 * The large Σ silhouette remains a single gliding letter: two opposing strokes
 * form its mouth, with teeth grown directly from their inner edges.
 */
export function paintSigma(
  ctx: CanvasRenderingContext2D,
  run: Run,
  x: number,
  floor: number,
  options: {
    hopOffset?: number; shadow?: boolean; animation?: CharacterAnimationState;
    /** Boss-phase look: 0–1 dark red, white impact flash, laser eyes and dissolve. */
    battle?: { red: number; flash: number; lasers: number; dissolve: number; time: number };
  } = {},
) {
  const pose = sigmaPose(run, options.animation);
  const points = pose.points;
  const hop = options.hopOffset ?? pose.hop;
  const scale = 0.58;
  const battle = options.battle;
  const red = battle ? Math.max(0, Math.min(1, battle.red)) * (0.78 + 0.22 * Math.abs(Math.sin(battle.time * 7))) : 0;
  ctx.save();
  if (battle) ctx.globalAlpha = 1 - Math.max(0, Math.min(1, battle.dissolve));
  if (options.shadow !== false) {
    ctx.fillStyle = `rgba(6,6,7,${Math.max(0.16, 0.42 - hop / 100)})`;
    ctx.beginPath();
    ctx.ellipse(x + 65, floor + 2, 62 - hop * 0.28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(x + 124, floor + 10 + pose.bob - hop);
  // Match the SVG's translate → scale → rotate-about-pivot order.
  ctx.scale(scale * 0.9 * (1 - points.squash * 0.6), scale * 0.9 * (1 + points.squash));
  ctx.translate(-85, -15);
  ctx.rotate((points.lean * Math.PI) / 180);
  ctx.translate(85, 15);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (pose.glowOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = pose.glowOpacity;
    ctx.beginPath();
    ctx.moveTo(...pose.glowTop);
    ctx.quadraticCurveTo(...pose.glowControl, ...points.A);
    ctx.strokeStyle = '#d2b67a';
    ctx.lineWidth = 22;
    ctx.stroke();
    ctx.restore();
  }

  sigmaPath(ctx, points);
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 35;
  ctx.stroke();
  if (red > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(220,30,24,${0.8 * red})`;
    ctx.shadowBlur = 34;
    sigmaPath(ctx, points);
    ctx.strokeStyle = `rgba(150,18,14,${0.55 * red})`;
    ctx.lineWidth = 44;
    ctx.stroke();
    ctx.restore();
  }
  sigmaPath(ctx, points);
  ctx.strokeStyle = mixHex('#a8874f', '#a3161a', red);
  ctx.lineWidth = 30;
  ctx.stroke();
  sigmaPath(ctx, points);
  ctx.strokeStyle = mixHex('#34342f', '#3d0909', red);
  ctx.lineWidth = 25;
  ctx.stroke();
  sigmaPath(ctx, points);
  ctx.strokeStyle = red > 0 ? `rgba(255,96,72,${0.4 + 0.5 * red})` : 'rgba(210,182,122,0.78)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = '#efe6cf';
  ctx.strokeStyle = '#76603a';
  ctx.lineWidth = 1;
  for (const t of [0.07, 0.19, 0.31, 0.43]) {
    drawTooth(ctx, points.T, points.Ct, points.A, t, 1);
  }
  for (const t of [0.13, 0.25, 0.37, 0.49]) {
    drawTooth(ctx, points.D, points.Cb, points.B, t, -1);
  }

  const eye = (t: number, radius: number) => {
    const p = quadratic(points.T, points.Ct, points.A, t);
    const u = tangent(points.T, points.Ct, points.A, t);
    const cx = p[0] + u[1] * 25;
    const cy = p[1] - u[0] * 25;
    const eyeSquash = 1 - 0.6 * points.squint;
    ctx.globalAlpha = pose.pulse;
    ctx.fillStyle = '#efe6cf';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * eyeSquash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#25231f';
    ctx.beginPath();
    ctx.arc(cx + 1.2, cy + 0.2, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d2b67a';
    ctx.beginPath();
    ctx.arc(cx + 2.1, cy - 1, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  eye(0.62, 8);
  eye(0.8, 6);
  if (battle && battle.lasers > 0) {
    // Visual-only laser eyes. Each beam wanders on its own erratic path across the
    // screen; they are never aimed at λ and never affect play.
    const strength = Math.max(0, Math.min(1, battle.lasers));
    const flicker = 0.75 + 0.25 * Math.abs(Math.sin(battle.time * 31));
    for (const [t, seed] of [[0.62, 0], [0.8, 2.3]] as const) {
      const p = quadratic(points.T, points.Ct, points.A, t);
      const u = tangent(points.T, points.Ct, points.A, t);
      const ex = p[0] + u[1] * 25;
      const ey = p[1] - u[0] * 25;
      const sweep = laserWander(battle.time, seed);
      const dx = -Math.cos(sweep) * 1500, dy = Math.sin(sweep) * 1500;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [width, color] of [[18, `rgba(255,40,30,${0.22 * strength * flicker})`], [7, `rgba(255,70,50,${0.65 * strength * flicker})`], [2.4, `rgba(255,226,214,${0.95 * strength})`]] as const) {
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx, ey + dy);
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,80,60,${0.7 * strength})`; ctx.fill();
      ctx.restore();
    }
  }
  if (battle && battle.flash > 0) {
    // The strike's white flash covers the whole silhouette.
    ctx.save();
    ctx.globalAlpha *= Math.min(1, battle.flash);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 30;
    sigmaPath(ctx, points);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 36;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * A laser's angle (0 = straight left, positive = downward). Incommensurate
 * sines give a smooth path that never repeats visibly and sweeps from up-left,
 * across the course, to down-right — so it reads as random, not as targeting.
 */
export function laserWander(time: number, seed: number) {
  return 0.35
    + 0.8 * Math.sin(time * 0.71 + seed)
    + 0.45 * Math.sin(time * 1.93 + seed * 2.7)
    + 0.22 * Math.sin(time * 4.37 + seed * 5.1);
}

function mixHex(a: string, b: string, k: number) {
  if (k <= 0) return a;
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a), [r2, g2, b2] = parse(b);
  const t = Math.min(1, k);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
