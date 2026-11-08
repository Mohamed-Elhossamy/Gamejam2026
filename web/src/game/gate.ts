import { mechanismProgress } from './simulation';
import type { Mechanism } from './contracts';
import { P } from './palette';
import { CHECKPOINT_GLOW_MAX, CHECKPOINT_GLOW_MIN, CHECKPOINT_PULSE_MAX_S, CHECKPOINT_PULSE_MIN_S } from './rules';

export type GateState = 'locked' | 'active' | 'wrong' | 'open';
const FLOOR = 440;

/** Derive the presentation state from real run data; never changes rules. */
export function gateState(m: Mechanism, playerX: number, activeIndex: number | null, damage: number): GateState {
  if (m.solved) return 'open';
  if (activeIndex === m.index) return damage > 0 ? 'wrong' : 'active';
  void playerX;
  return 'locked';
}

/**
 * The gate slab stays on the existing route and preserves its animation.
 * Its checkpoint is presentation-only: the simulation owns the exact touch face.
 */
function checkpoint(ctx: CanvasRenderingContext2D, m: Mechanism, x: number, t: number) {
  const cycle = CHECKPOINT_PULSE_MIN_S + ((m.index * 0.61803398875) % 1) *
    (CHECKPOINT_PULSE_MAX_S - CHECKPOINT_PULSE_MIN_S);
  const phase = (t / cycle + m.index * 0.17) * Math.PI * 2;
  const pulse = (Math.sin(phase) + 1) / 2;
  const glow = CHECKPOINT_GLOW_MIN + pulse * (CHECKPOINT_GLOW_MAX - CHECKPOINT_GLOW_MIN);
  const cx = x + 65;
  const cy = FLOOR - 18;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 1;
  ctx.shadowColor = '#ffe39a';
  ctx.shadowBlur = 7 + pulse * 8;
  ctx.strokeStyle = '#d2b67a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 14 + pulse * 1.5, -Math.PI * 0.1, Math.PI * 1.6);
  ctx.stroke();
  // arrowhead closes the circular-arrow loop without becoming a tick marker.
  ctx.fillStyle = '#ffe39a';
  ctx.beginPath();
  ctx.moveTo(-3, -15); ctx.lineTo(4, -17); ctx.lineTo(1, -10); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a8874f';
  ctx.strokeStyle = '#ffe39a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.globalAlpha = glow;
  ctx.strokeStyle = '#ffe39a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 19 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function gate(ctx: CanvasRenderingContext2D, m: Mechanism, x: number, t: number, s: GateState) {
  const prog = mechanismProgress(m.animation);
  const top = 214;
  const doorH = FLOOR - top;
  const lift = prog * (doorH + 4);
  const face = x + 65;

  // Existing obstacle geometry: its visible slab still clears with the route.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 36, top, 32, doorH);
  ctx.clip();
  const dy = top - lift;
  ctx.fillStyle = P.ironHi;
  ctx.fillRect(x + 38, dy, face - (x + 38), doorH);
  ctx.fillStyle = P.iron;
  ctx.fillRect(x + 38, dy, 6, doorH);
  // Three framed insets and a continuous edge stile read as a door leaf.
  for (let panel = 0; panel < 3; panel++) {
    const py = dy + 12 + panel * 68;
    ctx.fillStyle = P.iron;
    ctx.fillRect(x + 44, py, face - x - 46, 49);
    ctx.strokeStyle = P.slate;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 45, py + 1, face - x - 48, 47);
  }
  const handleY = dy + doorH / 2;
  ctx.fillStyle = P.brassHi;
  ctx.fillRect(face - 8, handleY - 9, 4, 18);
  ctx.fillRect(face - 12, handleY - 9, 8, 3);
  ctx.fillRect(face - 12, handleY + 6, 8, 3);
  if (s !== 'open') {
    const lockY = handleY - 4;
    ctx.strokeStyle = P.ivory;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(face - 12, lockY);
    ctx.lineTo(face - 12, lockY - 3);
    ctx.quadraticCurveTo(face - 8, lockY - 10, face - 4, lockY - 3);
    ctx.lineTo(face - 4, lockY);
    ctx.stroke();
    ctx.fillStyle = P.brassHi;
    ctx.fillRect(face - 14, lockY, 12, 9);
    ctx.fillStyle = P.iron;
    ctx.fillRect(face - 9, lockY + 2, 2, 4);
  }
  ctx.fillStyle = s === 'wrong' ? P.red : P.brassDeep;
  ctx.fillRect(face - 3, dy, 3, doorH);
  ctx.restore();

  // Lintel and sill remain part of the traversable gate silhouette.
  ctx.fillStyle = P.iron;
  ctx.fillRect(x + 26, top - 6, 12, FLOOR - top + 6);
  ctx.fillStyle = P.ironHi;
  ctx.fillRect(x + 66, top - 2, 10, FLOOR - top + 2);
  ctx.fillStyle = P.ironHi;
  ctx.fillRect(x + 20, 200, 56, 14);
  ctx.fillStyle = P.brassDeep;
  ctx.fillRect(x + 20, top - 4, 56, 3);
  ctx.fillStyle = P.ink;
  ctx.fillRect(x + 22, FLOOR - 6, 52, 6);
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 22, top - 5, 54, FLOOR - top + 5);

  // No text plate above the door: its open/closed leaf already shows the state.

  if (!m.solved) checkpoint(ctx, m, x, t);
}

function crossing(ctx: CanvasRenderingContext2D, m: Mechanism, x: number) {
  const prog = mechanismProgress(m.animation);
  const gw = 265;
  // abutments at both ends of the real gap (m.x-240 .. m.x+25)
  ctx.fillStyle = P.iron;
  ctx.fillRect(x - 256, 300, 14, FLOOR - 300);
  ctx.fillRect(x + 25, 300, 14, FLOOR - 300);
  ctx.fillStyle = P.brassDeep;
  ctx.fillRect(x - 260, 296, 22, 5);
  ctx.fillRect(x + 21, 296, 22, 5);
  if (m.kind === 'vector') {
    const px = x - 240 - (1 - prog) * 300;
    ctx.fillStyle = P.slate;
    ctx.fillRect(x - 560, FLOOR - 2, 585, 2);
    ctx.fillStyle = P.ironHi;
    ctx.fillRect(px, FLOOR, gw, 20);
    ctx.fillStyle = P.brass;
    ctx.fillRect(px, FLOOR, gw, 3);
    ctx.fillStyle = P.slate;
    for (let k = 14; k < gw; k += 34) ctx.fillRect(px + k, FLOOR + 9, 16, 3);
  } else {
    // pivots about (x+25, FLOOR), vertical to horizontal
    ctx.save();
    ctx.translate(x + 25, FLOOR);
    ctx.rotate((1 - prog) * (Math.PI / 2));
    ctx.fillStyle = P.ironHi;
    ctx.fillRect(-gw, 0, gw, 18);
    ctx.fillStyle = P.brass;
    ctx.fillRect(-gw, 0, gw, 3);
    ctx.strokeStyle = P.slate;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < gw - 20; k += 26) {
      ctx.moveTo(-gw + k, 17); ctx.lineTo(-gw + k + 13, 4); ctx.lineTo(-gw + k + 26, 17);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawMechanism(ctx: CanvasRenderingContext2D, m: Mechanism, cam: number, t: number, s: GateState) {
  const x = m.x - cam;
  if (x < -700 || x > 1500) return;
  if (m.kind !== 'gear') crossing(ctx, m, x);
  gate(ctx, m, x, t, s);
}
