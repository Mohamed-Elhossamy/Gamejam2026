import type { Run } from './contracts';
import { PLAYER_SPEED } from './simulation';

/**
 * λ's legs: a presentation-only run cycle. The simulation still owns position,
 * jumping and collision; this only bends the two strokes of the glyph.
 *
 * Coordinates are λ's glyph units (drawn at half scale), origin between the
 * feet on the ground, x to the right. λ runs left, so "forward" is −x.
 * At rest the legs are exactly the original λ strokes.
 */
export type Point = { x: number; y: number };
export type Leg = { hip: Point; knee: Point; foot: Point };
export type LambdaLegs = { front: Leg; back: Leg };
export type GaitState = {
  /** Cycle angle in radians; advances with distance travelled, never with time alone. */
  phase: number;
  /** 0 standing still … 1 full running stride. */
  gait: number;
  /** 0 grounded … 1 full airborne tuck. */
  air: number;
  /** Last player x used to advance the phase; null before the first frame. */
  lastX: number | null;
};

export const LAMBDA_LEG_REST = {
  /** The long stroke from the λ's neck: its upper half is the thigh. */
  front: { hip: { x: -2, y: -64 }, foot: { x: -22, y: 0 } },
  /** The short stroke joins the long one just below the hip. */
  back: { hip: { x: -1, y: -54 }, foot: { x: 20, y: 0 } },
} as const;

/** World pixels λ travels per full two-step cycle. */
export const STRIDE_PX = 72;
/**
 * Foot swing and lift, in glyph units. Both strokes are fully extended in the
 * λ glyph, so each foot sweeps only inwards from its rest point (the front
 * foot back, the back foot forward): planted feet always reach the ground.
 */
const SWING = 13;
const LIFT = 16;
const CENTRE = { front: -SWING, back: SWING };
/** Airborne tuck: front knee up, back leg trailing. */
const AIR = { front: { forward: 12, lift: 20 }, back: { forward: -6, lift: 10 } };
/** Largest single-frame position change that still counts as running (respawns and knockback snaps are ignored). */
const MAX_STEP_PX = 30;

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const len = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const FRONT_LENGTH = len(LAMBDA_LEG_REST.front.hip, LAMBDA_LEG_REST.front.foot);
const BACK_LENGTH = len(LAMBDA_LEG_REST.back.hip, LAMBDA_LEG_REST.back.foot);

export function createGaitState(): GaitState {
  return { phase: 0, gait: 0, air: 0, lastX: null };
}

/** Target stride strength from the physical state: running on support, nothing in the air. */
function targets(player: Run['player']) {
  return {
    gait: player.grounded ? clamp(Math.abs(player.vx) / PLAYER_SPEED) : 0,
    air: player.grounded ? 0 : 1,
  };
}

/**
 * Advance by real simulation time only (dt is 0 while paused). The phase moves
 * with distance, so feet keep pace with the ground at any speed, including
 * boost, stumble and the battle, and stops dead when λ stops.
 */
export function advanceGait(state: GaitState, player: Run['player'], dt: number) {
  if (!Number.isFinite(player.x)) return;
  if (state.lastX === null) { state.lastX = player.x; return; }
  const step = player.x - state.lastX;
  state.lastX = player.x;
  if (dt <= 0) return;
  const real = Math.abs(step) <= MAX_STEP_PX ? step : 0;
  if (player.grounded) state.phase = (state.phase - real / STRIDE_PX * TAU) % TAU;
  const target = targets(player);
  // Stride strength follows actual movement, so pushing against a wall or a
  // locked gate settles into standing instead of freezing mid-step.
  const moved = player.grounded ? clamp(Math.abs(real) / dt / PLAYER_SPEED) : 0;
  state.gait += (Math.min(target.gait, moved) - state.gait) * clamp(dt * 12);
  // Leave the ground quickly; land a touch slower so the tuck unfolds.
  state.air += (target.air - state.air) * clamp(dt * (target.air > state.air ? 18 : 12));
}

/** Stateless fallback (tests, screenshots): the same pose without smoothing. */
export function gaitFromRun(run: Run): GaitState {
  const target = targets(run.player);
  return { phase: (-run.player.x / STRIDE_PX * TAU) % TAU, gait: target.gait, air: target.air, lastX: run.player.x };
}

/** Two-bone leg with equal thigh and shin; the knee always bends forward (−x). */
function solve(hip: Point, wanted: Point, length: number): Leg {
  let foot = wanted;
  let d = len(hip, foot);
  if (d > length) {
    const k = length / d;
    foot = { x: hip.x + (foot.x - hip.x) * k, y: hip.y + (foot.y - hip.y) * k };
    d = length;
  }
  const mid = { x: (hip.x + foot.x) / 2, y: (hip.y + foot.y) / 2 };
  const bend = d > 1e-6 ? Math.sqrt(Math.max(0, (length / 2) ** 2 - (d / 2) ** 2)) : length / 2;
  const ux = d > 1e-6 ? (foot.x - hip.x) / d : 0;
  const uy = d > 1e-6 ? (foot.y - hip.y) / d : 1;
  // Of the two perpendiculars, take the one pointing forward (−x).
  let px = -uy, py = ux;
  if (px > 0) { px = -px; py = -py; }
  return { hip, knee: { x: mid.x + px * bend, y: mid.y + py * bend }, foot };
}

function footOffset(u: number, centre: number, gait: number, air: { forward: number; lift: number }, airBlend: number) {
  const forward = (centre + SWING * Math.cos(u)) * gait;
  const lift = LIFT * Math.max(0, -Math.sin(u)) * gait;
  return {
    forward: forward + (air.forward - forward) * airBlend,
    lift: lift + (air.lift - lift) * airBlend,
  };
}

export function lambdaLegs(state: Pick<GaitState, 'phase' | 'gait' | 'air'>): LambdaLegs {
  const phase = Number.isFinite(state.phase) ? state.phase : 0;
  const gait = clamp(Number.isFinite(state.gait) ? state.gait : 0);
  const air = clamp(Number.isFinite(state.air) ? state.air : 0);
  const rest = LAMBDA_LEG_REST;
  const f = footOffset(phase, CENTRE.front, gait, AIR.front, air);
  const front = solve(rest.front.hip, { x: rest.front.foot.x - f.forward, y: rest.front.foot.y - f.lift }, FRONT_LENGTH);
  // The short stroke keeps its joint on the long one; the 9-unit stroke width covers the thigh's bend.
  const b = footOffset(phase + Math.PI, CENTRE.back, gait, AIR.back, air);
  const back = solve(rest.back.hip, { x: rest.back.foot.x - b.forward, y: rest.back.foot.y - b.lift }, BACK_LENGTH);
  return { front, back };
}
