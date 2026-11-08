import { CLOCK_ASSEMBLY_COUNT, CLOCK_TARGET, SIGMA_HEALTH_BARS } from './rules';

/**
 * The casing, bezel, dial and minute track are present from the first frame.
 * One real answer installs one part, in assembly order: twelve numerals, the
 * centre pin, then both hands. The five answers after that strike Σ.
 */
export const CLOCK_ASSEMBLY_PARTS = [
  'numeral-XII', 'numeral-I', 'numeral-II', 'numeral-III',
  'numeral-IV', 'numeral-V', 'numeral-VI', 'numeral-VII',
  'numeral-VIII', 'numeral-IX', 'numeral-X', 'numeral-XI',
  'centre-pin', 'hour-hand', 'minute-hand',
] as const;

export const CLOCK_LAYOUT = {
  // While it is assembled the clock rests top-right — the spot Σ takes in the battle —
  // drawn above every obstacle, clear of the HUD and above Σ's chasing body.
  cx: 915, cy: 200, displayScale: 0.5, radius: 166, numeralRadius: 110,
  tickOuter: 146, tickMinor: 140, tickMajor: 135,
  hourLength: 73, minuteLength: 108,
} as const;

/** Screen anchors (1100 × 580 logical space) once the clock is powered. */
export const BATTLE_LAYOUT = {
  /** The powered clock's menacing perch, top-left, clear of the hearts and stage label. */
  perch: { x: 168, y: 196, scale: 0.42 },
  /** Σ hovers opposite the clock, top-right: body centre, clear of the HUD. */
  sigma: { x: 915, y: 214 },
  /** The clock alone, centred in the upper half, above the victory message. */
  finale: { x: 550, y: 168, scale: 0.6 },
} as const;

const count = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** The dial is complete after fifteen answers; only Level 6 deals boss damage. */
export function clockProgress(run: { correct: number; levelSixCorrect: number }) {
  return Math.min(CLOCK_ASSEMBLY_COUNT, run.correct) + run.levelSixCorrect;
}

export function clockAssembledParts(correct: number) {
  return Math.min(CLOCK_ASSEMBLY_COUNT, count(correct));
}

export function clockPiecesRemaining(correct: number) {
  return CLOCK_ASSEMBLY_COUNT - clockAssembledParts(correct);
}

/** Strikes earned so far (answers 16–20), whether or not the blow has visibly landed yet. */
export function sigmaHitsTaken(correct: number) {
  return Math.min(SIGMA_HEALTH_BARS, Math.max(0, count(correct) - CLOCK_ASSEMBLY_COUNT));
}

export function sigmaHitsRemaining(correct: number) {
  return SIGMA_HEALTH_BARS - sigmaHitsTaken(correct);
}

/** The sixteenth answer powers the clock and starts the battle. */
export function clockPowered(correct: number) {
  return count(correct) > CLOCK_ASSEMBLY_COUNT && CLOCK_TARGET > CLOCK_ASSEMBLY_COUNT;
}

/** Canvas angles: XII at the top, III right, VI bottom, IX left. */
export function clockPoint(index: number, divisions: number, radius: number) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / divisions;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** A genuine 10:10:00 clock, advancing at real clock ratios once it runs. */
export function restoredClockHandAngles(elapsedSeconds: number) {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const turn = Math.PI * 2;
  return {
    hour: -Math.PI / 2 + turn * (10 / 12 + 10 / 720 + elapsed / 43200),
    minute: -Math.PI / 2 + turn * (10 / 60 + elapsed / 3600),
    second: -Math.PI / 2 + turn * elapsed / 60,
  };
}

/** Equal tooth pitch and exact pitch-circle tangency, inside a lower dial window. */
export const CLOCK_GEARS = [
  { x: -40, y: 50, pitchRadius: 22, teeth: 22, direction: 1 },
  { x: 0, y: 50, pitchRadius: 18, teeth: 18, direction: -1 },
  { x: 36, y: 50, pitchRadius: 18, teeth: 18, direction: 1 },
] as const;

export function clockGearAngle(index: number, elapsed: number) {
  const gear = CLOCK_GEARS[index];
  return (index % 2 ? Math.PI / gear.teeth : 0) +
    Math.max(0, elapsed) * 0.6 * CLOCK_GEARS[0].teeth / gear.teeth * gear.direction;
}
