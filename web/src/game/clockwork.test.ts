import assert from 'node:assert/strict';
import { clockFace, clockHandAngles } from './clockwork';

const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-9);
for (const [time, expectedX, expectedY] of [
  [0, 0, -1], [15, 1, 0], [30, 0, 1], [45, -1, 0], [60, 0, -1],
]) {
  const { minute } = clockHandAngles(time);
  near(Math.cos(minute), expectedX);
  near(Math.sin(minute), expectedY);
}
const before = clockHandAngles(59.999);
const after = clockHandAngles(60.001);
assert(after.minute > before.minute, 'clock rotation does not jump at a full turn');
near((after.minute - before.minute) / (after.hour - before.hour), 12);

// Test the actual drawing commands as well as the angle helper.
for (const time of [0, 15, 30, 45]) {
  let start: [number, number] = [0, 0];
  const hands: [number, number][] = [];
  const centres: [number, number][] = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    translate(x: number, y: number) { centres.push([x, y]); },
    moveTo(x: number, y: number) { start = [x, y]; },
    lineTo(x: number, y: number) { if (start[0] === 0 && start[1] === 0) hands.push([x, y]); },
  } as unknown as CanvasRenderingContext2D;
  clockFace(ctx, 200, 180, 100, time, 1, 0);
  assert.deepEqual(centres, [[200, 180]], 'all hands share a stable clock centre');
  assert.equal(hands.length, 2);
  const angle = clockHandAngles(time).minute;
  near(hands[1][0], Math.cos(angle) * 76);
  near(hands[1][1], Math.sin(angle) * 76);
}
console.log('Clocks passed: actual hand endpoints follow 12→3→6→9, fixed centres, 12:1 hand speeds, continuous full-turn angles.');
