import type { Run } from './contracts';
import { BATTLE_LAYOUT, CLOCK_LAYOUT, sigmaHitsTaken, clockProgress } from './greatClockGeometry';
import { SIGMA_HEALTH_BARS } from './rules';

/**
 * Choreography of the last five answers, as a pure function of run state and
 * time. Everything here is presentation: the simulation owns hits, bars and
 * the win, and every timing freezes with the run clock while paused.
 */
export const BATTLE_TIMING = {
  /** Answer 16: the dial flares gold, its shockwave lands the first blow, then both leave the course. */
  awakenFlash: 0.55, awakenStrike: 0.72, awakenLift: 1.0, liftDuration: 1.45,
  /** Σ rises into the top-right spot only once the clock has started leaving it. */
  sigmaLiftDelay: 0.4,
  /** A wrong answer in the battle: Σ lunges at the clock, bites, and returns. */
  missOut: 0.38, missHold: 0.24, missBack: 0.6,
  /** Answers 17–20: the clock flies at Σ, holds on impact, and returns to its perch. */
  strikeOut: 0.45, strikeHold: 0.14, strikeBack: 0.65, flashDuration: 0.32,
  /** After the fifth blow: Σ dissolves, the course fades, the clock centres, the message appears. */
  dissolveDuration: 1.35, fadeStart: 1.25, fadeDuration: 1.3, centreStart: 2.2, centreDuration: 1.15,
  message: 3.6,
} as const;

/** Σ's body centre relative to the (left x, floor y) anchor used by paintSigma. */
export const SIGMA_BODY_OFFSET = { x: 65, y: -62 } as const;
/** Σ's hover anchor derived from the top-right layout point. */
export const SIGMA_HOVER = {
  x: BATTLE_LAYOUT.sigma.x - SIGMA_BODY_OFFSET.x,
  floor: BATTLE_LAYOUT.sigma.y - SIGMA_BODY_OFFSET.y,
} as const;
const STRIKE_SCALE = 0.46;

export type ClockPlacement = { x: number; y: number; scale: number; tilt: number };
export type BattleScene = {
  /** Σ has left the course: answer 16 or later. */
  active: boolean;
  /** Strikes whose blow has visibly landed; bars lost so far. */
  landed: number;
  barsLeft: number;
  clock: ClockPlacement & { gold: number; flash: number; running: number; hurt: number; glow: number };
  shockwave: { radius: number; alpha: number } | null;
  sigma: {
    visible: boolean;
    /** paintSigma anchor in screen space. */
    x: number; floor: number;
    lift: number; red: number; flash: number; dissolve: number; floating: boolean;
    lasers: number;
  };
  bars: { x: number; y: number; visible: boolean };
  worldFade: number;
  message: boolean;
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (p: number) => { const u = clamp(p); return u * u * (3 - 2 * u); };
const easeIn = (p: number) => { const u = clamp(p); return u * u; };
const easeOut = (p: number) => { const u = clamp(p); return 1 - (1 - u) ** 3; };

export const REST_PLACEMENT: ClockPlacement = {
  x: CLOCK_LAYOUT.cx, y: CLOCK_LAYOUT.cy, scale: CLOCK_LAYOUT.displayScale, tilt: 0,
};

const INACTIVE: BattleScene = {
  active: false, landed: 0, barsLeft: SIGMA_HEALTH_BARS,
  clock: { ...REST_PLACEMENT, gold: 0, flash: 0, running: 0, hurt: 0, glow: 0 },
  shockwave: null,
  sigma: { visible: false, x: 0, floor: 0, lift: 0, red: 0, flash: 0, dissolve: 0, floating: false, lasers: 0 },
  bars: { x: 0, y: 0, visible: false },
  worldFade: 0, message: false,
};

export function battleScene(run: Run, cam: number, liftoffFloor: number, reducedMotion: boolean): BattleScene {
  const hits = sigmaHitsTaken(clockProgress(run));
  const battle = run.battle;
  if (!battle || hits < 1) return INACTIVE;
  const T = BATTLE_TIMING;
  const rm = reducedMotion;
  const age = Math.max(0, run.time - battle.start);
  const since = Math.max(0, run.time - (run.lastRepair?.time ?? battle.start));
  const perch = BATTLE_LAYOUT.perch;
  const sigmaCentre = { x: SIGMA_HOVER.x + SIGMA_BODY_OFFSET.x, y: SIGMA_HOVER.floor + SIGMA_BODY_OFFSET.y };
  const hoverBobY = rm ? 0 : Math.sin(age * 2.1) * 7;
  const hoverBobX = rm ? 0 : Math.sin(age * 1.3) * 4;
  const menaceY = rm ? 0 : Math.sin(age * 1.7) * 6;
  const menaceTilt = rm ? 0 : Math.sin(age * 1.7 + 0.6) * 0.05;
  const running = Math.max(0, age - T.awakenFlash) * 60;

  const clock: BattleScene["clock"] = { x: perch.x, y: perch.y, scale: perch.scale, tilt: menaceTilt, gold: 1, flash: 0, running, hurt: 0, glow: 0 };
  clock.y += menaceY;
  const sigma = {
    visible: true, x: SIGMA_HOVER.x + hoverBobX, floor: SIGMA_HOVER.floor + hoverBobY,
    lift: 1, red: 1, flash: 0, dissolve: 0, floating: true, lasers: 1,
  };
  let landed = hits;
  let shockwave: BattleScene['shockwave'] = null;
  let worldFade = 0;
  let message = false;

  if (hits === 1) {
    // Awakening: the clock still sits on its landmark; Σ is wherever the chase left it.
    const flare = clamp(age / 0.12);
    const decay = age > T.awakenStrike ? 1 - clamp((age - T.awakenStrike) / 0.35) : 1;
    const shimmer = rm ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(age * 26));
    clock.flash = flare * shimmer * decay;
    clock.gold = clamp((age - T.awakenFlash) / 0.4);
    landed = age >= T.awakenStrike ? 1 : 0;
    if (age >= T.awakenFlash && age < T.awakenFlash + 0.55) {
      const k = (age - T.awakenFlash) / 0.55;
      shockwave = { radius: CLOCK_LAYOUT.radius * CLOCK_LAYOUT.displayScale + k * 1300, alpha: 0.55 * (1 - k) };
    }
    const p = clamp((age - T.awakenLift) / T.liftDuration);
    const e = rm ? (age >= T.awakenLift ? 1 : 0) : smooth(p);
    const arc = rm ? 0 : Math.sin(p * Math.PI);
    clock.x = lerp(REST_PLACEMENT.x, perch.x, e);
    clock.y = lerp(REST_PLACEMENT.y, perch.y, e) - arc * 34 + menaceY * e;
    clock.scale = lerp(REST_PLACEMENT.scale, perch.scale, e);
    clock.tilt = menaceTilt * e;
    // Σ follows a beat later, rising into the top-right spot the clock has just vacated.
    const sigmaStart = T.awakenLift + T.sigmaLiftDelay;
    const ps = clamp((age - sigmaStart) / T.liftDuration);
    const es = rm ? (age >= sigmaStart ? 1 : 0) : smooth(ps);
    const sigmaArc = rm ? 0 : Math.sin(ps * Math.PI);
    const startX = battle.liftoffX - cam;
    sigma.x = lerp(startX, SIGMA_HOVER.x, es) + hoverBobX * es;
    sigma.floor = lerp(liftoffFloor, SIGMA_HOVER.floor, es) - sigmaArc * 70 + hoverBobY * es;
    sigma.lift = es;
    sigma.floating = es > 0;
    sigma.red = clamp((age - T.awakenStrike) / 0.8);
    sigma.lasers = clamp((es - 0.85) / 0.15);
    if (age >= T.awakenStrike) sigma.flash = 1 - clamp((age - T.awakenStrike) / T.flashDuration);
  } else {
    // A strike in flight from the perch; Σ already hovers opposite.
    const holdEnd = T.strikeOut + T.strikeHold;
    const out = easeIn(since / T.strikeOut);
    const back = easeOut((since - holdEnd) / T.strikeBack);
    const final = hits >= SIGMA_HEALTH_BARS;
    if (since < T.strikeOut) {
      landed = hits - 1;
      if (!rm) {
        clock.x = lerp(perch.x, sigmaCentre.x, out);
        clock.y = lerp(perch.y + menaceY, sigmaCentre.y, out);
        clock.scale = lerp(perch.scale, STRIKE_SCALE, out);
        clock.tilt = menaceTilt * (1 - out);
      }
      clock.flash = out * 0.6;
    } else if (since < holdEnd || (final && since < T.centreStart)) {
      if (!rm || final) {
        clock.x = sigmaCentre.x; clock.y = sigmaCentre.y; clock.scale = STRIKE_SCALE; clock.tilt = 0;
      }
      clock.flash = final ? Math.max(0.35, 1 - (since - T.strikeOut) * 0.6) : 1;
    } else if (!final) {
      if (!rm) {
        clock.x = lerp(sigmaCentre.x, perch.x, back);
        clock.y = lerp(sigmaCentre.y, perch.y + menaceY, back);
        clock.scale = lerp(STRIKE_SCALE, perch.scale, back);
        clock.tilt = menaceTilt * back;
      }
      clock.flash = (1 - back) * 0.5;
    }
    if (since >= T.strikeOut) {
      sigma.flash = 1 - clamp((since - T.strikeOut) / T.flashDuration);
      const jolt = rm ? 0 : 22 * (1 - clamp((since - T.strikeOut) / 0.4));
      sigma.x += jolt;
      sigma.floor -= jolt * 0.35;
    }
    if (final) {
      sigma.dissolve = clamp((since - T.strikeOut) / T.dissolveDuration);
      sigma.visible = sigma.dissolve < 1;
      sigma.lasers = 1 - sigma.dissolve;
      worldFade = clamp((since - T.fadeStart) / T.fadeDuration);
      message = since >= T.message;
      if (since >= T.centreStart) {
        const c = clamp((since - T.centreStart) / T.centreDuration);
        const e = rm ? 1 : smooth(c);
        const finale = BATTLE_LAYOUT.finale;
        clock.x = lerp(sigmaCentre.x, finale.x, e);
        clock.y = lerp(sigmaCentre.y, finale.y, e);
        const pulse = rm ? 0 : Math.sin(since * 7);
        clock.scale = lerp(STRIKE_SCALE, finale.scale, e) * (1 + 0.02 * pulse * e);
        clock.tilt = 0;
        clock.flash = c < 1 ? 0.35 : (rm ? 0.5 : 0.4 + 0.35 * Math.abs(pulse));
        clock.glow = e * (rm ? 1 : 0.88 + 0.12 * Math.abs(pulse));
      }
    }
  }

  // A wrong answer during the battle: Σ lunges across and bites the clock on its perch.
  const lastEvent = run.lastRepair?.time ?? battle.start;
  const perched = hits === 1
    ? age >= T.awakenLift + T.sigmaLiftDelay + T.liftDuration
    : hits < SIGMA_HEALTH_BARS && since >= T.strikeOut + T.strikeHold + T.strikeBack;
  if (battle.lastMiss != null && battle.lastMiss >= lastEvent && perched) {
    const m = Math.max(0, run.time - battle.lastMiss);
    const holdEnd = T.missOut + T.missHold;
    const target = { x: clock.x + 78, y: clock.y };
    const hover = { x: sigma.x + SIGMA_BODY_OFFSET.x, y: sigma.floor + SIGMA_BODY_OFFSET.y };
    let k = 0;
    if (m < T.missOut) k = easeIn(m / T.missOut);
    else if (m < holdEnd) k = 1;
    else k = 1 - easeOut((m - holdEnd) / T.missBack);
    if (!rm) {
      sigma.x += (target.x - hover.x) * k;
      sigma.floor += (target.y - hover.y) * k;
    }
    if (m >= T.missOut) {
      const impact = 1 - clamp((m - T.missOut) / 0.55);
      clock.hurt = impact;
      if (!rm) {
        clock.x -= 16 * impact * Math.abs(Math.sin((m - T.missOut) * 40));
        clock.tilt += -0.12 * impact * Math.sin((m - T.missOut) * 30);
      }
    }
  }

  return {
    active: true, landed, barsLeft: SIGMA_HEALTH_BARS - landed,
    clock, shockwave, sigma,
    bars: { x: sigma.x + SIGMA_BODY_OFFSET.x, y: sigma.floor - 142, visible: sigma.visible },
    worldFade, message,
  };
}
