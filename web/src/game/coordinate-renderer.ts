import type { Mechanism } from './contracts';
import { GROUND_Y, X_UNIT, rampHeight } from './coordinates';
import { mechanismProgress } from './simulation';
import { P } from './palette';

export function drawCoordinateRamp(ctx: CanvasRenderingContext2D, m: Mechanism, cameraX: number) {
  if (m.kind !== 'gear' || m.mechanic === 'motion' || m.motion) return;
  const origin = m.x + 25 - cameraX;
  if (origin < -60 || origin > 1560) return;
  const progress = mechanismProgress(m.animation);
  const peak = rampHeight(m, m.x + 25 - X_UNIT, progress);
  ctx.save();
  ctx.strokeStyle = P.slateHi; ctx.fillStyle = P.ivory;
  ctx.lineWidth = 1.5;
  // Local Cartesian frame: positive x leftwards, positive y upwards.
  ctx.beginPath(); ctx.moveTo(origin + 10, GROUND_Y); ctx.lineTo(origin - 225, GROUND_Y);
  ctx.moveTo(origin - 219, GROUND_Y - 4); ctx.lineTo(origin - 225, GROUND_Y); ctx.lineTo(origin - 219, GROUND_Y + 4);
  ctx.moveTo(origin, GROUND_Y + 4); ctx.lineTo(origin, GROUND_Y - 115);
  ctx.moveTo(origin - 4, GROUND_Y - 109); ctx.lineTo(origin, GROUND_Y - 115); ctx.lineTo(origin + 4, GROUND_Y - 109);
  ctx.stroke();
  ctx.font = '16px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('x', origin - 235, GROUND_Y + 5);
  ctx.fillText('y', origin, GROUND_Y - 123);
  ctx.font = '12px sans-serif';
  ctx.fillText('0', origin + 8, GROUND_Y + 18);
  ctx.fillText('1', origin - X_UNIT, GROUND_Y + 18);
  if (m.slope && m.solved) {
    ctx.setLineDash([4, 4]); ctx.strokeStyle = P.brass;
    ctx.beginPath(); ctx.moveTo(origin, GROUND_Y - peak); ctx.lineTo(origin - X_UNIT, GROUND_Y - peak);
    ctx.lineTo(origin - X_UNIT, GROUND_Y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'right';
    ctx.fillText(String(m.slope.gradient), origin - 8, GROUND_Y - peak - 8);
    ctx.beginPath(); ctx.arc(origin - X_UNIT, GROUND_Y - peak, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = P.ivoryDim; ctx.font = '12px sans-serif';
  }
  ctx.restore();
}
