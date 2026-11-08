import { trapdoor, groundHeight, courseSegments } from './simulation';
import { lambdaPose, paintSigma, sigmaRenderBounds } from './sigma';
import { gaitFromRun, lambdaLegs } from './lambdaGait';
import type { CharacterAnimationState } from './sigma';
import { P } from './palette';
import { drawMechanism, gateState } from './gate';
import { drawCoordinateRamp } from './coordinate-renderer';
import type { Run } from './contracts';
import { drawGreatClock } from './greatClockArt';
import { battleScene, REST_PLACEMENT, type BattleScene } from './greatClockBattle';
import { clockPowered, clockProgress } from './greatClockGeometry';
import { SIGMA_HEALTH_BARS } from './rules';
import { jumpBlockHeight, spikeTriangles } from './obstacles';
import { X_UNIT } from './coordinates';
import { terrainComponents } from './trigonometricTerrain';
import type { PlacedSegment } from './level';
import {
  clamp, LOW_TIME, LOW_TIME_MAX_TINT_OPACITY, LOW_TIME_MAX_ZOOM, PROX2D_FULL_PX,
  PROX2D_MAX_SHAKE_PX, PROX2D_MAX_TILT_DEG, PROX2D_MAX_TINT_OPACITY, PROX2D_MAX_ZOOM,
  PROX2D_START_PX, LOW_TIME_PULSE_RAD_S,
  MAP_CONVEYOR_SPEED, MAP_HAZARD_TRIGGER, MAP_RAISED_PLATFORM_HEIGHT, MAP_SHUTTER_MAX_HEIGHT,
  MAP_SHUTTER_RAD_S, MAP_SHUTTER_WIDTH, MAP_SPIKE_HEIGHT, MAP_STEAM_PERIOD_S,
} from './rules';

export const VW = 1100;
const VH = 580;
const FLOOR = 440;
const Y_AXIS_TOP = 96;

const motionQuery = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
function reducedMotion() { return motionQuery?.matches ?? false; }

/** Presentation-only danger values. Overlaps use maxima, never additive effects. */
export function dangerEffect(run: Run, reduceMotion = reducedMotion()) {
  const gap = run.monsterX - (run.player.x + 32);
  const proximity = clamp((PROX2D_START_PX - gap) / (PROX2D_START_PX - PROX2D_FULL_PX), 0, 1);
  const lowTime = clamp((LOW_TIME - run.timer) / LOW_TIME, 0, 1);
  const strength = Math.max(proximity, lowTime);
  const beat = reduceMotion ? 1 : 1 + Math.sin(run.time * 6.5) * 0.12 * proximity;
  return {
    gap, proximity, lowTime, strength,
    tint: Math.max(proximity * PROX2D_MAX_TINT_OPACITY * beat, lowTime * LOW_TIME_MAX_TINT_OPACITY),
    shake: reduceMotion ? 0 : PROX2D_MAX_SHAKE_PX * proximity * proximity,
    tilt: reduceMotion ? 0 : PROX2D_MAX_TILT_DEG * proximity * proximity,
    zoom: reduceMotion ? 0 : Math.max(PROX2D_MAX_ZOOM * proximity,
      LOW_TIME_MAX_ZOOM * lowTime * (0.5 + 0.5 * Math.sin(run.time * LOW_TIME_PULSE_RAD_S))),
  };
}

function dangerTint(ctx: CanvasRenderingContext2D, effect: ReturnType<typeof dangerEffect>) {
  if (effect.tint <= 0) return;
  const gradient = ctx.createRadialGradient(VW / 2, VH / 2, VW * 0.12, VW / 2, VH / 2, VW * 0.76);
  gradient.addColorStop(0, `rgba(200,67,47,${effect.tint * 0.13})`);
  gradient.addColorStop(0.62, `rgba(200,67,47,${effect.tint * 0.38})`);
  gradient.addColorStop(1, `rgba(110,42,34,${effect.tint})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VW, VH);
}

function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = P.night;
  ctx.fillRect(0, 0, VW, VH);
}

function drawObstacle(ctx: CanvasRenderingContext2D, segment: PlacedSegment, cam: number, time: number) {
  if (segment.type !== 'obstacle') return;
  const x = segment.worldStart - cam;
  const width = segment.worldEnd - segment.worldStart;
  if (x + width < -100 || x > VW + 100) return;
  const phase = time + (segment.mechanismIndex ?? 0) * 0.47;
  const owner = segment.mechanismIndex ?? 0;
  ctx.save();
  ctx.shadowColor = 'rgba(210,182,122,0.45)'; ctx.shadowBlur = 5;
  ctx.strokeStyle = P.brassHi; ctx.fillStyle = P.ironHi; ctx.lineWidth = 2;
  if (segment.obstacle === 'jump-block') {
    const height = jumpBlockHeight(segment);
    ctx.shadowBlur = 0;
    ctx.fillStyle = P.plate;
    ctx.fillRect(x, FLOOR - height, width, height);
    ctx.strokeStyle = P.brass;
    ctx.strokeRect(x + 1, FLOOR - height + 1, width - 2, height - 2);
    ctx.fillStyle = P.brassHi;
    ctx.fillRect(x, FLOOR - height, width, 4);
    ctx.strokeStyle = P.brassDeep;
    ctx.strokeRect(x + 7, FLOOR - height + 9, width - 14, Math.max(8, height - 17));
    for (const boltX of [x + 5, x + width - 5]) {
      ctx.fillStyle = P.brass; ctx.fillRect(boltX - 1, FLOOR - 7, 2, 2);
    }
  } else if (segment.obstacle === 'steam-vent') {
    const active = Math.sin(time * Math.PI * 2 / MAP_STEAM_PERIOD_S + owner) > MAP_HAZARD_TRIGGER;
    ctx.fillStyle = P.plate; ctx.fillRect(x, FLOOR - 14, width, 14);
    ctx.fillStyle = P.ironHi; ctx.fillRect(x + 2, FLOOR - 12, width - 4, 10);
    ctx.strokeStyle = P.brass; ctx.strokeRect(x + 1, FLOOR - 14, width - 2, 14);
    const ventCount = 4;
    for (let vent = 0; vent < ventCount; vent++) {
      const vx = x + 8 + (vent + 0.5) * (width - 16) / ventCount;
      ctx.fillStyle = active ? P.red : P.redDim;
      ctx.fillRect(vx - 4, FLOOR - 10, 8, 8);
      if (active) {
        const jetHeight = 28 + Math.max(0, Math.sin(phase * Math.PI * 2 / MAP_STEAM_PERIOD_S + vent)) * 16;
        ctx.shadowColor = P.red; ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(vx - 6, FLOOR - 12);
        ctx.lineTo(vx, FLOOR - jetHeight);
        ctx.lineTo(vx + 6, FLOOR - 12);
        ctx.closePath();
        ctx.fillStyle = P.red; ctx.fill();
        ctx.strokeStyle = P.ivoryDim; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  } else if (segment.obstacle === 'timed-shutter-platform') {
    const height = MAP_SHUTTER_MAX_HEIGHT * Math.max(0, Math.sin(time * MAP_SHUTTER_RAD_S + owner));
    const blockX = x + width - MAP_SHUTTER_WIDTH;
    ctx.fillStyle = P.plate; ctx.fillRect(x, FLOOR - MAP_RAISED_PLATFORM_HEIGHT, width - MAP_SHUTTER_WIDTH, 14);
    ctx.fillStyle = P.ironHi; ctx.fillRect(x, FLOOR - MAP_RAISED_PLATFORM_HEIGHT, width - MAP_SHUTTER_WIDTH, 8);
    ctx.fillStyle = P.brassHi; ctx.fillRect(x, FLOOR - MAP_RAISED_PLATFORM_HEIGHT, width - MAP_SHUTTER_WIDTH, 3);
    ctx.fillStyle = P.slate; ctx.fillRect(x + 12, FLOOR - 58, 6, 58); ctx.fillRect(x + width - 62, FLOOR - 58, 6, 58);
    ctx.fillStyle = P.plate; ctx.fillRect(blockX - 4, FLOOR - 8, MAP_SHUTTER_WIDTH + 8, 8);
    const blockHeight = Math.max(6, height);
    ctx.fillStyle = height > 1 ? P.red : P.redDim;
    ctx.fillRect(blockX, FLOOR - blockHeight, MAP_SHUTTER_WIDTH, blockHeight);
    ctx.strokeStyle = height > 1 ? P.ivoryDim : P.brassHi; ctx.lineWidth = 1.5;
    ctx.strokeRect(blockX, FLOOR - blockHeight, MAP_SHUTTER_WIDTH, blockHeight);
    if (height > 10) {
      ctx.save();
      ctx.beginPath(); ctx.rect(blockX, FLOOR - height, MAP_SHUTTER_WIDTH, height); ctx.clip();
      ctx.strokeStyle = P.redDim; ctx.lineWidth = 5;
      for (let stripe = -height; stripe < MAP_SHUTTER_WIDTH; stripe += 14) {
        ctx.beginPath(); ctx.moveTo(blockX + stripe, FLOOR); ctx.lineTo(blockX + stripe + height, FLOOR - height); ctx.stroke();
      }
      ctx.restore();
    }
  } else if (segment.obstacle === 'collapsing-grate') {
    ctx.fillStyle = P.plate; ctx.fillRect(x, FLOOR - 10, width, 10);
    ctx.fillStyle = P.ironHi; ctx.fillRect(x, FLOOR - 8, width, 8);
    ctx.strokeStyle = P.brassHi; ctx.strokeRect(x, FLOOR - 10, width, 10);
    for (let bar = 8; bar < width; bar += 16) {
      ctx.fillStyle = bar % 32 === 8 ? P.redDim : P.brassDeep;
      ctx.fillRect(x + bar, FLOOR - 8, 4, 8);
    }
  } else if (segment.obstacle === 'spike-strip') {
    ctx.fillStyle = P.plate; ctx.fillRect(x, FLOOR - 6, width, 6);
    ctx.fillStyle = P.redDim; ctx.fillRect(x, FLOOR - 3, width, 3);
    ctx.shadowColor = P.red; ctx.shadowBlur = 3;
    ctx.strokeStyle = P.ivoryDim; ctx.lineWidth = 1;
    for (const triangle of spikeTriangles(segment)) {
      ctx.beginPath();
      ctx.moveTo(triangle.left - cam, FLOOR - 4);
      ctx.lineTo(triangle.tip - cam, FLOOR - MAP_SPIKE_HEIGHT);
      ctx.lineTo(triangle.right - cam, FLOOR - 4);
      ctx.closePath();
      ctx.fillStyle = P.red; ctx.fill(); ctx.stroke();
    }
  } else if (segment.obstacle === 'conveyor') {
    ctx.fillStyle = P.plate; ctx.fillRect(x, FLOOR - 15, width, 15);
    ctx.fillStyle = P.ironHi; ctx.fillRect(x, FLOOR - 12, width, 12);
    ctx.strokeStyle = P.brassHi;
    const offset = (time * MAP_CONVEYOR_SPEED) % 18;
    for (let tooth = -offset; tooth < width; tooth += 18) {
      ctx.beginPath(); ctx.moveTo(x + tooth, FLOOR - 12); ctx.lineTo(x + tooth + 9, FLOOR - 3); ctx.stroke();
    }
  } else if (segment.obstacle === 'gear-platform') {
    ctx.translate(x + width / 2, FLOOR - 34); ctx.rotate(phase * 1.3); ctx.fillStyle = P.ironHi; ctx.beginPath(); ctx.arc(0, 0, width * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

type Gap = { a: number; b: number };

const TRIG_UNIT = 36;
/**
 * Level 6 identity guides. The brass surface itself is groundHeight(); these
 * only trace sin^2 and its complement cos^2 so the sum to y = 1 is legible.
 */
function trigGuides(ctx: CanvasRenderingContext2D, run: Run, cam: number, left: number, right: number, inGap: (wx: number) => boolean) {
  const trace = (pick: (c: NonNullable<ReturnType<typeof terrainComponents>>) => number | null, colour: string, dash: number[]) => {
    ctx.strokeStyle = colour; ctx.setLineDash(dash); ctx.lineWidth = 2;
    ctx.beginPath();
    let pen = false;
    for (let wx = Math.floor(left / 6) * 6; wx <= right; wx += 6) {
      const c = inGap(wx) ? null : terrainComponents(run, wx);
      const v = c ? pick(c) : null;
      if (v === null || !c || c.envelope <= 0.01) { pen = false; continue; }
      const y = FLOOR - v * TRIG_UNIT * c.envelope;
      if (pen) ctx.lineTo(wx - cam, y); else ctx.moveTo(wx - cam, y);
      pen = true;
    }
    ctx.stroke(); ctx.setLineDash([]);
  };
  ctx.save();
  ctx.lineJoin = 'round';
  // cos^2 grows in as the complement is added; sin^2 stays as a ghost reference.
  trace(c => (c.blend > 0.02 ? c.complement * Math.min(1, c.blend) : null), 'rgba(143,190,196,0.85)', [7, 5]);
  trace(c => (c.blend > 0.02 ? c.squared : null), 'rgba(210,182,122,0.42)', [2, 4]);
  // faint reference at y = 1 so the flattening has a visible target
  let any = false;
  for (let wx = Math.floor(left / 40) * 40; wx <= right && !any; wx += 40) any = !!terrainComponents(run, wx);
  if (any) {
    ctx.strokeStyle = 'rgba(239,230,207,0.16)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, FLOOR - TRIG_UNIT); ctx.lineTo(VW, FLOOR - TRIG_UNIT); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Small post-solve annotations for the Level 6 vector and determinant gates. */
function levelSixAnnotations(ctx: CanvasRenderingContext2D, run: Run, cam: number) {
  for (const m of run.mechanisms) {
    if (m.stage !== 6 || !m.solved) continue;
    const x = m.x - cam;
    if (x < -200 || x > VW + 200) continue;
    const base = groundHeight(run, m.x) - 150;
    const k = Math.min(1, m.animation);
    ctx.save();
    ctx.globalAlpha = 0.9 * k;
    ctx.lineWidth = 2;
    if (m.kind === 'vector' && (m.ordinal === 1 || m.ordinal === 4)) {
      // a, b drawn at 8 px per unit (x mirrored: course x grows leftwards)
      const [a, b] = m.ordinal === 1 ? [[3, 4], [5, -1]] : [[2, 5], [4, -1]];
      const u = 8, ox = x + 40, oy = base;
      const arrow = (v: number[], colour: string) => {
        const ex = ox - v[0] * u * k, ey = oy - v[1] * u * k;
        ctx.strokeStyle = colour; ctx.fillStyle = colour;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        const ang = Math.atan2(ey - oy, ex - ox);
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4));
        ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4)); ctx.fill();
      };
      ctx.fillStyle = P.brassDeep; ctx.fillRect(ox - 2, oy - 2, 4, 4);
      arrow(a, P.brassHi); arrow(b, '#8fbec4');
      ctx.font = '500 10px "Spline Sans Mono", monospace'; ctx.fillStyle = P.ivoryDim; ctx.textAlign = 'center';
      ctx.fillText(`a\u00b7b = ${m.ordinal === 1 ? 11 : 3}`, ox - 20, oy + 18);
    } else if (m.kind === 'matrix' && m.ordinal === 2) {
      // unit square -> parallelogram spanned by (7,-2), (3,4); area scales by 34
      const u = 6, ox = x + 30, oy = base + 10;
      const P1 = [-7 * u * k, 2 * u * k], P2 = [-3 * u * k, -4 * u * k];
      ctx.strokeStyle = 'rgba(239,230,207,0.5)'; ctx.strokeRect(ox - u, oy - u, u, u);
      ctx.fillStyle = 'rgba(168,135,79,0.25)'; ctx.strokeStyle = P.brassHi;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + P1[0], oy + P1[1]);
      ctx.lineTo(ox + P1[0] + P2[0], oy + P1[1] + P2[1]); ctx.lineTo(ox + P2[0], oy + P2[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.font = '500 10px "Spline Sans Mono", monospace'; ctx.fillStyle = P.ivoryDim; ctx.textAlign = 'center';
      ctx.fillText('area \u00d7 34', ox - 30, oy + 28);
    }
    ctx.restore();
  }
}

/**
 * The running surface IS the graph: a continuous global Cartesian plane whose
 * x-axis (y = 0) is the floor. Global x = -(worldX)/200 never resets per gate.
 * The plotted line follows groundHeight(), so ramps and lifts are part of it.
 */
function graphFloor(ctx: CanvasRenderingContext2D, run: Run, cam: number, gaps: Gap[]) {
  const left = cam - 40;
  const right = cam + VW + 40;
  const xScale = run.terrain ? 120 : X_UNIT;
  const yScale = run.terrain ? TRIG_UNIT : 100;
  const origin = run.terrain?.origin ?? -16;
  const inGap = (wx: number) => gaps.some(g => wx > g.a && wx < g.b);
  // faint plane above the axis: horizontal unit lines (1 unit = 100 px)
  ctx.strokeStyle = 'rgba(143,152,155,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = FLOOR - yScale; y > 40; y -= yScale) { ctx.moveTo(0, y); ctx.lineTo(VW, y); }
  const s0 = Math.ceil(left / X_UNIT) * X_UNIT;
  for (let wx = s0; wx < right; wx += X_UNIT) { ctx.moveTo(wx - cam, 60); ctx.lineTo(wx - cam, FLOOR); }
  ctx.stroke();
  ctx.font = '500 10px "Spline Sans Mono", monospace';
  ctx.fillStyle = 'rgba(185,175,152,0.55)';
  ctx.textAlign = 'left';
  for (let k = 1; k * yScale < FLOOR - 40; k++) ctx.fillText(`y=${k}`, 6, FLOOR - k * yScale - 4);

  // below-axis paper: the plane continues, minor grid every 50 px
  ctx.fillStyle = '#1a1b1b';
  ctx.fillRect(0, FLOOR, VW, VH - FLOOR);
  ctx.strokeStyle = 'rgba(168,135,79,0.16)';
  ctx.beginPath();
  for (let wx = Math.ceil(left / 50) * 50; wx < right; wx += 50) { ctx.moveTo(wx - cam, FLOOR); ctx.lineTo(wx - cam, VH); }
  for (let y = FLOOR + 50; y < VH; y += 50) { ctx.moveTo(0, y); ctx.lineTo(VW, y); }
  ctx.stroke();

  // voids: the plane is genuinely missing here
  for (const g of gaps) {
    if (g.b < left || g.a > right) continue;
    const x = g.a - cam, w = g.b - g.a;
    ctx.fillStyle = P.ink;
    ctx.fillRect(x, FLOOR - 1, w, VH - FLOOR + 1);
    ctx.fillStyle = P.redDim;
    for (let k = 0; k < w; k += 18) {
      ctx.beginPath(); ctx.moveTo(x + k, VH); ctx.lineTo(x + k + 9, VH - 24); ctx.lineTo(x + k + 18, VH); ctx.fill();
    }
    ctx.strokeStyle = P.red; ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x + w, FLOOR); ctx.stroke(); ctx.setLineDash([]);
  }

  // the plotted surface y = ground(x): fill under raised parts, then the axis/curve line
  const pts: Array<[number, number] | null> = [];
  for (let wx = Math.floor(left / 8) * 8; wx <= right; wx += 8) pts.push(inGap(wx) ? null : [wx - cam, groundHeight(run, wx)]);
  // Troughs that dip below the axis: carve the paper away so no phantom floor
  // remains at y = 0, then fill the solid ground down from the true surface.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (!a || !b || (a[1] <= FLOOR && b[1] <= FLOOR)) continue;
    ctx.fillStyle = P.night;
    ctx.beginPath(); ctx.moveTo(a[0], FLOOR - 0.5); ctx.lineTo(a[0], Math.max(a[1], FLOOR)); ctx.lineTo(b[0], Math.max(b[1], FLOOR)); ctx.lineTo(b[0], FLOOR - 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(74,69,62,0.85)';
    ctx.beginPath(); ctx.moveTo(a[0], VH); ctx.lineTo(a[0], Math.max(a[1], FLOOR)); ctx.lineTo(b[0], Math.max(b[1], FLOOR)); ctx.lineTo(b[0], VH); ctx.fill();
  }
  ctx.fillStyle = 'rgba(74,69,62,0.85)';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (!a || !b || (a[1] >= FLOOR && b[1] >= FLOOR)) continue;
    ctx.beginPath(); ctx.moveTo(a[0], FLOOR); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], FLOOR); ctx.fill();
  }
  trigGuides(ctx, run, cam, left, right, inGap);
  ctx.strokeStyle = P.brassHi; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath();
  let pen = false;
  for (const q of pts) {
    if (!q) { pen = false; continue; }
    if (pen) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
    pen = true;
  }
  ctx.stroke();

  // global x ticks on the axis, labelled in units (x grows leftwards)
  ctx.fillStyle = P.ivoryDim; ctx.strokeStyle = P.brassHi; ctx.lineWidth = 1.5;
  ctx.textAlign = 'center';
  for (let wx = Math.ceil((left - origin) / xScale) * xScale + origin; wx < right; wx += xScale) {
    if (inGap(wx)) continue;
    const sx = wx - cam;
    ctx.beginPath(); ctx.moveTo(sx, FLOOR - 5); ctx.lineTo(sx, FLOOR + 7); ctx.stroke();
    const units = Math.round((origin - wx) / xScale);
    ctx.fillText(`${units}`, sx, FLOOR + 20);
  }
  for (let wx = Math.ceil(left / 50) * 50; wx < right; wx += 50) {
    if (inGap(wx)) continue;
    ctx.fillRect(wx - cam, FLOOR, 1, 4);
  }
  // global y-axis (x = 0) if in view
  const ox = origin - cam;
  if (ox > -10 && ox < VW + 10) {
    ctx.strokeStyle = P.ivory; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, VH); ctx.lineTo(ox, Y_AXIS_TOP); ctx.lineTo(ox - 5, Y_AXIS_TOP + 10); ctx.moveTo(ox, Y_AXIS_TOP); ctx.lineTo(ox + 5, Y_AXIS_TOP + 10); ctx.stroke();
    ctx.fillStyle = P.ivory; ctx.font = 'italic 15px Fraunces, Georgia, serif';
    ctx.fillText('y', ox + 12, Y_AXIS_TOP + 6);
  }
  ctx.font = 'italic 15px Fraunces, Georgia, serif';
  ctx.fillStyle = P.ivory; ctx.textAlign = 'left';
  ctx.fillText(run.terrain ? 'x (radians)  \u2190' : 'x  \u2190', 14, FLOOR + 38);
}

function lambda(ctx: CanvasRenderingContext2D, run: Run, cam: number, animation?: CharacterAnimationState) {
  const p = run.player;
  const t = run.time;
  const x = p.x - cam;
  const pose = lambdaPose(run, animation);
  const base = p.y + 44;
  const y = p.y - pose.hop;
  const ground = p.grounded ? base : groundHeight(run, p.x + 16);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.globalAlpha = pose.shadowOpacity;
  ctx.ellipse(x + 16, ground + 2, 18 * pose.shadowScale, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (run.boost > 0) {
    ctx.fillStyle = P.brassHi;
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.22 - i * 0.045;
      ctx.fillRect(x + 12 + i * 12, y + 10, 12, 28);
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(x + 16, base - pose.hop);
  ctx.rotate(run.stumble > 0 ? Math.sin(t * 30) * 0.16 : Math.abs(p.vx) > 5 ? -0.06 : 0);
  ctx.scale(pose.scaleX * 0.5, pose.scaleY * 0.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Running legs: knees bend with a distance-driven stride, tuck in the air, and
  // straighten back into the plain λ glyph when standing.
  const legs = lambdaLegs(animation?.lambda.stride ?? gaitFromRun(run));
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(8, -86);
    ctx.quadraticCurveTo(2, -82, legs.front.hip.x, legs.front.hip.y);
    ctx.lineTo(legs.front.knee.x, legs.front.knee.y);
    ctx.lineTo(legs.front.foot.x, legs.front.foot.y);
    ctx.moveTo(legs.back.hip.x, legs.back.hip.y);
    ctx.lineTo(legs.back.knee.x, legs.back.knee.y);
    ctx.lineTo(legs.back.foot.x, legs.back.foot.y);
  };
  path();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 13;
  ctx.stroke();
  path();
  ctx.strokeStyle = run.damage > 0 ? P.red : run.boost > 0 ? P.brassHi : P.brass;
  ctx.lineWidth = 9;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#f0d69d';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const blink = pose.blink ? 0.15 : 1;
  const eyes: [number, number, number, number, number][] = [
    [-10, -102, 6.5, 7.5, pose.eyeLeftOffsetY],
    [6, -106, 6, 7, pose.eyeRightOffsetY],
  ];
  for (const [ex, ey, radius, height, eyeOffset] of eyes) {
    const eyeY = ey + eyeOffset;
    ctx.fillStyle = '#efe6cf';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, radius, height * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!pose.blink) {
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(ex + pose.eyeLook, eyeY + 0.7, radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath();
      ctx.arc(ex + pose.eyeLook - 1, eyeY - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Purely decorative: a glowing blue orb around λ while Σ's laser eyes are active. */
function lambdaOrb(ctx: CanvasRenderingContext2D, run: Run, cam: number, strength: number, rm: boolean) {
  if (strength <= 0) return;
  const p = run.player;
  const cx = p.x - cam + 16;
  const cy = p.y + 12;
  const beat = rm ? 1 : 1 + 0.05 * Math.sin(run.time * 4.2);
  const r = 40 * beat;
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength);
  const halo = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r * 1.55);
  halo.addColorStop(0, 'rgba(90,180,255,0.32)');
  halo.addColorStop(1, 'rgba(90,180,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  body.addColorStop(0, 'rgba(200,236,255,0.22)');
  body.addColorStop(0.7, 'rgba(70,160,255,0.12)');
  body.addColorStop(1, 'rgba(80,170,255,0.3)');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'rgba(110,195,255,0.9)';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(150,215,255,0.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(235,248,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  ctx.restore();
}

/** Σ's five health bars, centred over its hovering body. */
function healthBars(ctx: CanvasRenderingContext2D, scene: BattleScene) {
  const w = 22, gap = 5, h = 9;
  const total = SIGMA_HEALTH_BARS * w + (SIGMA_HEALTH_BARS - 1) * gap;
  const x0 = Math.round(scene.bars.x - total / 2), y = Math.round(scene.bars.y);
  ctx.save();
  ctx.fillStyle = 'rgba(17,18,19,0.85)';
  ctx.fillRect(x0 - 5, y - 5, total + 10, h + 10);
  ctx.strokeStyle = 'rgba(200,67,47,0.7)'; ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4.5, y - 4.5, total + 9, h + 9);
  for (let i = 0; i < SIGMA_HEALTH_BARS; i++) {
    const x = x0 + i * (w + gap);
    const full = i < scene.barsLeft;
    ctx.fillStyle = full ? '#d2281e' : 'rgba(110,42,34,0.35)';
    ctx.fillRect(x, y, w, h);
    if (full) { ctx.fillStyle = 'rgba(255,150,120,0.55)'; ctx.fillRect(x, y, w, 2); }
  }
  ctx.restore();
}

/** Deterministic embers drifting up from Σ while it dissolves. */
function dissolveEmbers(ctx: CanvasRenderingContext2D, scene: BattleScene) {
  const d = scene.sigma.dissolve;
  if (d <= 0 || d >= 1) return;
  const cx = scene.sigma.x + 65, cy = scene.sigma.floor - 62;
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = 20 + ((i * 37) % 70);
    const x = cx + Math.cos(a) * r * (0.6 + d * 0.8);
    const y = cy + Math.sin(a) * r * 0.7 - d * (40 + (i % 7) * 18);
    ctx.globalAlpha = (1 - d) * (0.45 + (i % 3) * 0.2);
    ctx.fillStyle = i % 4 === 0 ? '#ffd9c8' : '#c8281e';
    ctx.fillRect(x, y, 3 + (i % 3), 3 + (i % 3));
  }
  ctx.restore();
}

function monster(ctx: CanvasRenderingContext2D, run: Run, cam: number, animation?: CharacterAnimationState) {
  const x = run.monsterX - cam;
  const bounds = sigmaRenderBounds(run, animation);
  const bodyOutsideRight = x + bounds.left > VW;
  const bodyOutsideLeft = x + bounds.right < 0;
  if (bodyOutsideRight || bodyOutsideLeft) {
    return;
  }
  const ground = groundHeight(run, run.monsterX + 65);
  paintSigma(ctx, run, x, ground, { animation });
}

export function paintWorld(
  ctx: CanvasRenderingContext2D,
  run: Run,
  width: number,
  height: number,
  animation?: CharacterAnimationState,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = P.ink;
  ctx.fillRect(0, 0, width, height);
  const s = Math.min(width / VW, height / VH);
  ctx.translate((width - VW * s) / 2, (height - VH * s) / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.clip();

  const danger = dangerEffect(run);
  // Camera treatment moves only pixels; world positions and collision stay in simulation.
  if (danger.zoom > 0 || danger.shake > 0) {
    const shakeX = danger.shake * (Math.sin(run.time * 23) * 0.6 + Math.sin(run.time * 37 + 1.3) * 0.4);
    const shakeY = danger.shake * 0.7 * (Math.sin(run.time * 29 + 0.7) * 0.6 + Math.sin(run.time * 41) * 0.4);
    ctx.translate(VW / 2 + shakeX, VH / 2 + shakeY);
    ctx.rotate((danger.tilt * Math.sin(run.time * 11) * Math.PI) / 180);
    ctx.scale(1 + danger.zoom, 1 + danger.zoom);
    ctx.translate(-VW / 2, -VH / 2);
  }

  const cam = run.cameraX;
  const t = run.time;
  ctx.globalAlpha = 0.6;
  background(ctx);
  ctx.globalAlpha = 1;
  const map = courseSegments(run, cam - 400, cam + VW + 400);
  const gaps: Gap[] = [];
  for (const segment of map) {
    const owner = run.mechanisms.find((mechanism) => mechanism.index === segment.mechanismIndex);
    if (segment.type === 'obstacle' && segment.obstacle === 'bridge-gap' && owner?.kind !== 'gear') gaps.push({ a: segment.worldStart, b: segment.worldEnd });
  }
  for (const m of run.mechanisms) {
    const hatch = trapdoor(m, t);
    if (hatch) gaps.push({ a: hatch.x, b: hatch.x + hatch.width });
  }
  graphFloor(ctx, run, cam, gaps);
  const rm = reducedMotion();
  const liftoffFloor = run.battle ? groundHeight(run, run.battle.liftoffX + 65) : FLOOR;
  const scene = battleScene(run, cam, liftoffFloor, rm);
  const clockState = {
    time: run.time, correct: clockProgress(run),
    lastRepairTime: run.lastRepair?.time ?? null,
    pulseX: (run.lastRepair?.x ?? run.player.x) - cam,
    placement: scene.active ? scene.clock : REST_PLACEMENT,
    powered: clockPowered(clockProgress(run)),
    gold: scene.clock.gold, flash: scene.clock.flash, running: scene.clock.running,
    hurt: scene.clock.hurt, glow: scene.clock.glow,
    reducedMotion: rm,
  };
  for (const segment of map) drawObstacle(ctx, segment, cam, t);
  for (const m of run.mechanisms) {
    const hatch = trapdoor(m, t);
    if (!hatch) continue;
    const x = hatch.x - cam;
    if (x < -160 || x > VW + 160) continue;
    const lift = terrainComponents(run, hatch.x) ? groundHeight(run, hatch.x) - FLOOR : 0;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side === -1 ? x : x + hatch.width, FLOOR + lift);
      ctx.rotate(side === -1 ? hatch.angle : -hatch.angle);
      const start = side === -1 ? 0 : -hatch.width / 2;
      const halfWidth = hatch.width / 2;
      ctx.fillStyle = P.plate; ctx.fillRect(start, 0, halfWidth, 14);
      ctx.fillStyle = P.ironHi; ctx.fillRect(start, 0, halfWidth, 11);
      ctx.fillStyle = hatch.open ? P.red : P.brass; ctx.fillRect(start, 0, halfWidth, 3);
      ctx.strokeStyle = hatch.open ? P.red : P.brassHi; ctx.lineWidth = 2;
      ctx.strokeRect(start, 0, halfWidth, 14);
      ctx.strokeStyle = hatch.open ? P.red : P.slate; ctx.lineWidth = 1.5;
      for (let stripe = 12; stripe < halfWidth; stripe += 18) {
        ctx.beginPath(); ctx.moveTo(start + stripe, 4); ctx.lineTo(start + stripe + 7, 12); ctx.stroke();
      }
      ctx.restore();
    }
  }
  const live = run.mode === 'playing' || run.mode === 'focus';
  for (const m of run.mechanisms) {
    const st = gateState(m, run.player.x, live ? run.activeIndex : null, run.damage);
    // Mechanisms are authored on FLOOR; seat them on the live surface.
    const lift = terrainComponents(run, m.x) ? groundHeight(run, m.x) - FLOOR : 0;
    ctx.save();
    if (lift) ctx.translate(0, lift);
    drawMechanism(ctx, m, cam, t, live || st === 'open' ? st : 'locked');
    drawCoordinateRamp(ctx, m, cam);
    ctx.restore();
  }
  levelSixAnnotations(ctx, run, cam);
  // While it is assembled the clock rests top-right above every obstacle and door,
  // with only the actors in front; once powered it flies in screen space below.
  if (!scene.active) drawGreatClock(ctx, clockState);
  if (!scene.active) monster(ctx, run, cam, animation);
  lambda(ctx, run, cam, animation);
  if (scene.active) lambdaOrb(ctx, run, cam, scene.sigma.lasers, rm);

  // Tint is painted after undoing the camera transform, so it never shakes.
  ctx.restore();
  ctx.save();
  ctx.translate((width - VW * s) / 2, (height - VH * s) / 2);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.clip();
  dangerTint(ctx, danger);
  if (scene.active) {
    // The finale fades the whole course away, leaving only the clock.
    if (scene.worldFade > 0) {
      ctx.fillStyle = `rgba(17,18,19,${scene.worldFade})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (scene.sigma.visible) {
      paintSigma(ctx, run, scene.sigma.x, scene.sigma.floor, {
        animation, shadow: !scene.sigma.floating, hopOffset: 0,
        battle: { red: scene.sigma.red, flash: scene.sigma.flash, lasers: scene.sigma.lasers, dissolve: scene.sigma.dissolve, time: run.time },
      });
      if (scene.sigma.lift > 0.6) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (scene.sigma.lift - 0.6) / 0.4) * (1 - scene.sigma.dissolve);
        healthBars(ctx, scene); ctx.restore();
      }
    }
    dissolveEmbers(ctx, scene);
    if (scene.shockwave) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,228,151,${scene.shockwave.alpha})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(REST_PLACEMENT.x, REST_PLACEMENT.y, scene.shockwave.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  if (scene.active) {
    // Unclipped, so the finale's large glow fades out over the letterbox bands
    // instead of stopping at a hard edge of the play area.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate((width - VW * s) / 2, (height - VH * s) / 2);
    ctx.scale(s, s);
    drawGreatClock(ctx, clockState);
    ctx.restore();
  }
}
