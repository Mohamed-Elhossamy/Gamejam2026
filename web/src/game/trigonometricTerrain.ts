import type { Run } from './contracts';

const FLOOR = 440;
export const TERRAIN_UNIT = 36;
export const IDENTITY_DURATION = 3;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** One shared mathematical surface for drawing and both characters' support.
 * x is in radians (120 world pixels per radian), y in 36-pixel units.
 * A smooth entry joins the mathematical section to the preceding flat course.
 */
export function terrainComponents(run: Run, x: number) {
  if (!run.terrain) return null;
  const { origin, started, phase } = run.terrain;
  const theta = (origin - x) / 120;
  const sine = Math.sin(theta);
  const elapsed = Math.max(0, run.time - started);
  return {
    sine, squared: sine * sine, complement: Math.cos(theta) ** 2,
    blend: phase === 'identity' ? smooth((elapsed - 1.2) / 1.8) : 0,
    envelope: smooth((origin + 400 - x) / 240),
  };
}

export function terrainHeight(run: Run, x: number) {
  const parts = terrainComponents(run, x);
  if (!parts || !run.terrain) return FLOOR;
  const elapsed = Math.max(0, run.time - run.terrain.started);
  const value = run.terrain.phase === 'sine'
    ? parts.sine * smooth(elapsed / 1.2)
    : parts.sine + (parts.squared - parts.sine) * smooth(elapsed / 1.2) + parts.complement * parts.blend;
  return FLOOR - TERRAIN_UNIT * value * parts.envelope;
}
