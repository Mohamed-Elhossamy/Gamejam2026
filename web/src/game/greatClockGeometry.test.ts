import assert from 'node:assert/strict';
import {
  BATTLE_LAYOUT, CLOCK_ASSEMBLY_PARTS, CLOCK_GEARS, CLOCK_LAYOUT, clockAssembledParts, clockGearAngle,
  clockPiecesRemaining, clockPoint, clockPowered, restoredClockHandAngles, sigmaHitsRemaining, sigmaHitsTaken,
} from './greatClockGeometry';
import { CLOCK_ASSEMBLY_COUNT, CLOCK_TARGET, SIGMA_HEALTH_BARS } from './rules';

const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
assert.equal(CLOCK_ASSEMBLY_COUNT, 15);
assert.equal(SIGMA_HEALTH_BARS, 5);
assert.equal(CLOCK_ASSEMBLY_COUNT + SIGMA_HEALTH_BARS, CLOCK_TARGET);
assert.equal(CLOCK_ASSEMBLY_PARTS.length, CLOCK_ASSEMBLY_COUNT, 'one assembly component per assembly answer');
assert.equal(new Set(CLOCK_ASSEMBLY_PARTS).size, CLOCK_ASSEMBLY_COUNT);
assert.deepEqual(CLOCK_ASSEMBLY_PARTS.slice(0, 12), [
  'numeral-XII', 'numeral-I', 'numeral-II', 'numeral-III', 'numeral-IV', 'numeral-V',
  'numeral-VI', 'numeral-VII', 'numeral-VIII', 'numeral-IX', 'numeral-X', 'numeral-XI',
]);
assert.deepEqual(CLOCK_ASSEMBLY_PARTS.slice(12), ['centre-pin', 'hour-hand', 'minute-hand']);
for (let correct = 0; correct <= CLOCK_TARGET; correct++) {
  assert.equal(clockAssembledParts(correct), Math.min(15, correct));
  assert.equal(clockPiecesRemaining(correct), Math.max(0, 15 - correct));
  assert.equal(sigmaHitsTaken(correct), Math.max(0, correct - 15));
  assert.equal(sigmaHitsRemaining(correct), 5 - Math.max(0, correct - 15));
  assert.equal(clockPowered(correct), correct >= 16, 'the sixteenth answer powers the clock');
}
assert.equal(clockPiecesRemaining(-1), 15);
assert.equal(clockPiecesRemaining(99), 0);
assert.equal(clockPiecesRemaining(NaN), 15);
assert.equal(sigmaHitsTaken(99), 5);
assert(BATTLE_LAYOUT.perch.x < 550 && BATTLE_LAYOUT.sigma.x > 550, 'clock top-left, Sigma top-right');

const radius = CLOCK_LAYOUT.numeralRadius;
for (let hour = 0; hour < 12; hour++) {
  const point = clockPoint(hour, 12, radius);
  near(Math.hypot(point.x, point.y), radius);
  const tick = clockPoint(hour * 5, 60, radius);
  near(point.x, tick.x);
  near(point.y, tick.y);
}
for (const [index, x, y] of [[0, 0, -radius], [3, radius, 0], [6, 0, radius], [9, -radius, 0]]) {
  const point = clockPoint(index, 12, radius);
  near(point.x, x); near(point.y, y);
}
const minuteAngles = Array.from({ length: 60 }, (_, index) => -Math.PI / 2 + index * Math.PI * 2 / 60);
for (let i = 1; i < minuteAngles.length; i++) near(minuteAngles[i] - minuteAngles[i - 1], Math.PI / 30);

const initial = restoredClockHandAngles(0);
const after = restoredClockHandAngles(10);
near((after.second - initial.second) / (after.minute - initial.minute), 60);
near((after.minute - initial.minute) / (after.hour - initial.hour), 12);
near(restoredClockHandAngles(60).second - initial.second, Math.PI * 2);
near(restoredClockHandAngles(3600).minute - initial.minute, Math.PI * 2);
near(restoredClockHandAngles(43200).hour - initial.hour, Math.PI * 2);
assert(CLOCK_LAYOUT.hourLength < CLOCK_LAYOUT.minuteLength);
assert(CLOCK_LAYOUT.minuteLength < CLOCK_LAYOUT.tickMajor);
assert(CLOCK_LAYOUT.numeralRadius + 24 < CLOCK_LAYOUT.tickMajor, 'even the widest numerals leave space before the hour ticks');
const displayRadius = CLOCK_LAYOUT.radius * CLOCK_LAYOUT.displayScale;
assert(CLOCK_LAYOUT.cx > 800, 'the assembling clock rests on the right, out of the obstacles\' path');
assert(Math.hypot(CLOCK_LAYOUT.cx - BATTLE_LAYOUT.sigma.x, CLOCK_LAYOUT.cy - BATTLE_LAYOUT.sigma.y) < 40, 'it rests where Σ hovers in the battle');
assert(displayRadius < 125, 'the displayed clock is smaller than the former 166px-radius dial');
assert(CLOCK_LAYOUT.cy - displayRadius > 105, 'the top rim clears the HUD counter and sound button');
assert(CLOCK_LAYOUT.cy + displayRadius < 300, 'the face stays above Σ\'s chasing body');
assert(CLOCK_LAYOUT.cx + displayRadius < 1100 - 40, 'the face stays clear of the right edge');
for (const [width, height] of [[1366, 900], [1024, 768], [390, 206], [844, 126]]) {
  const scale = Math.min(width / 1100, height / 580);
  const x = (width - 1100 * scale) / 2 + CLOCK_LAYOUT.cx * scale;
  const y = (height - 580 * scale) / 2 + CLOCK_LAYOUT.cy * scale;
  // Include the largest celebration ring, not only the dial.
  const extent = (CLOCK_LAYOUT.radius + 50) * CLOCK_LAYOUT.displayScale * scale;
  assert(x - extent > 0 && x + extent < width, `horizontal border clearance at ${width}×${height}`);
  assert(y - extent > 0 && y + extent < height, `vertical border clearance at ${width}×${height}`);
}
for (let i = 1; i < CLOCK_GEARS.length; i++) {
  const a = CLOCK_GEARS[i - 1], b = CLOCK_GEARS[i];
  near(Math.hypot(a.x - b.x, a.y - b.y), a.pitchRadius + b.pitchRadius);
  near(a.pitchRadius / a.teeth, b.pitchRadius / b.teeth);
  const av = clockGearAngle(i - 1, 1) - clockGearAngle(i - 1, 0);
  const bv = clockGearAngle(i, 1) - clockGearAngle(i, 0);
  assert(av * bv < 0, 'meshing wheels counter-rotate');
  near(Math.abs(av * a.teeth), Math.abs(bv * b.teeth));
}
console.log('Clock geometry passed: 12 numerals, centre pin and two hands over 15 answers, five Sigma strikes, cardinal numerals, sixty equal ticks, common-pivot hand ratios, tangent gear train and HUD/course clearance.');
