import type { Mechanism, Run } from './contracts';

// Local mathematical x advances left with λ; y points up. Axis scales are
// explicit: steep derivatives use a compressed vertical scale, never a fake slope.
export const X_UNIT = 200;
export const GROUND_Y = 440;
export function motionScale(m: Mechanism) {
  return m.motion ? 80 / Math.max(1, Math.abs(m.motion.velocity * m.motion.duration)) : 1;
}
export function motionHeight(m: Mechanism, worldX: number) {
  if (!m.solved || !m.motion) return 0;
  const lift = m.motion.velocity * Math.min(m.elapsed, m.motion.duration) * motionScale(m);
  const x = worldX - m.x;
  if (x >= 25 && x <= 205) return lift;
  if (x > -175 && x < 25) return lift * (x + 175) / 200;
  if (x > 205 && x < 305) return lift * (305 - x) / 100;
  return 0;
}
export function surfaceHeight(m: Mechanism, worldX: number, progress = 1) {
  return motionHeight(m, worldX) || rampHeight(m, worldX, progress);
}
export function yUnit(m: Mechanism) {
  return m.slope ? Math.min(10, 80 / Math.max(1, Math.abs(m.slope.gradient))) : 10;
}
export function rampHeight(m: Mechanism, worldX: number, progress = 1) {
  if (!m.solved || !m.slope) return 0;
  const x = (m.x + 25 - worldX) / X_UNIT;
  const rise = x >= 0 && x <= 1 ? x : x > 1 && x < 2 ? 2 - x : 0;
  return rise * m.slope.gradient * yUnit(m) * progress;
}
export function coordinateFrame(run: Run) {
  const m = run.mechanisms.reduce((a, b) =>
    Math.abs(b.x + 25 - run.player.x) < Math.abs(a.x + 25 - run.player.x) ? b : a);
  return {
    gate: m, x: (m.x + 25 - (run.player.x + 16)) / X_UNIT,
    y: (GROUND_Y - run.player.y - 44) / yUnit(m),
  };
}
