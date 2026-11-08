import { P } from './palette';
import {
  CLOCK_LAYOUT as L, CLOCK_GEARS, clockAssembledParts, clockPoint, restoredClockHandAngles, clockGearAngle,
} from './greatClockGeometry';
import type { ClockPlacement } from './greatClockBattle';

export interface GreatClockArtState {
  time: number;
  /** Accepted correct answers; the first fifteen each install one part. */
  correct: number;
  lastRepairTime: number | null;
  /** Screen x of the mechanism that was just solved (assembly pulse origin). */
  pulseX: number;
  placement: ClockPlacement;
  /** Answer 16 onwards: the dial is awake, gold and running. */
  powered: boolean;
  gold: number;
  flash: number;
  /** Seconds the hands and gears have been running. */
  running: number;
  /** 0–1 red impact flash when Σ bites the clock after a wrong battle answer. */
  hurt?: number;
  /** 0–1 extra-large victory glow around the centred clock. */
  glow?: number;
  reducedMotion: boolean;
}

const HIGHLIGHT_S = 1.5;
const FADE_S = 0.45;
const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const TAU = Math.PI * 2;
const GOLD = (a: number) => `rgba(240,214,157,${a})`;
const SHINE = (a: number) => `rgba(255,236,170,${a})`;
const GUIDE = 'rgba(42,38,34,0.28)';
const PART = { numeral0: 0, pin: 12, hour: 13, minute: 14 } as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function mix(a: string, b: string, k: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(a), [r2, g2, b2] = parse(b);
  const t = clamp(k, 0, 1);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function gearShape(ctx: CanvasRenderingContext2D, r: number, teeth: number) {
  const outer = r, inner = r - 4;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU, s = TAU / teeth;
    ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a + s * 0.18) * outer, Math.sin(a + s * 0.18) * outer);
    ctx.lineTo(Math.cos(a + s * 0.48) * outer, Math.sin(a + s * 0.48) * outer);
    ctx.lineTo(Math.cos(a + s * 0.66) * inner, Math.sin(a + s * 0.66) * inner);
  }
  ctx.closePath();
}

function hand(ctx: CanvasRenderingContext2D, angle: number, length: number, width: number, tail: number) {
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-tail, -width * 0.6);
  ctx.lineTo(length * 0.72, -width / 2);
  ctx.lineTo(length, 0);
  ctx.lineTo(length * 0.72, width / 2);
  ctx.lineTo(-tail, width * 0.6);
  ctx.closePath();
  ctx.restore();
}

export function drawGreatClock(ctx: CanvasRenderingContext2D, state: GreatClockArtState): void {
  const t = state.time;
  const rm = state.reducedMotion;
  const count = clockAssembledParts(state.correct);
  const latest = count - 1;
  const since = state.lastRepairTime == null || state.powered ? Infinity : t - state.lastRepairTime;
  const fresh = since >= 0 && since < HIGHLIGHT_S;
  const hl = fresh ? 1 - since / HIGHLIGHT_S : 0;
  const gold = state.powered ? clamp(state.gold, 0, 1) : 0;
  const flash = clamp(state.flash, 0, 1);
  const has = (i: number) => i < count;
  /** Opacity multiplier for a part: fades in place, never moves. */
  const fade = (i: number) => (i === latest && fresh && !rm ? clamp(since / FADE_S, 0, 1) : 1);
  const glow = (i: number) => (i === latest ? hl : 0);

  const { radius: R } = L;
  const { x: cx, y: cy, scale, tilt } = state.placement;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Gold repair pulse from the solved mechanism (screen) to the clock base.
  if (fresh && !rm && since < 1.1) {
    const sx = clamp(state.pulseX, -20, 1120), sy = 420;
    const ex = cx, ey = cy + R * scale;
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 50;
    const k = 1 - Math.pow(1 - clamp(since / 0.9, 0, 1), 3);
    ctx.strokeStyle = GOLD(0.22 * hl);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    const u = 1 - k;
    const px = u * u * sx + 2 * u * k * mx + k * k * ex;
    const py = u * u * sy + 2 * u * k * my + k * k * ey;
    const g = ctx.createRadialGradient(px, py, 0, px, py, 12);
    g.addColorStop(0, GOLD(0.85 * hl)); g.addColorStop(1, GOLD(0));
    ctx.fillStyle = g; circle(ctx, px, py, 12); ctx.fill();
  }

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (tilt) ctx.rotate(tilt);

  // Victory orb: a much larger, softer light around the centred clock.
  const victoryGlow = clamp(state.glow ?? 0, 0, 1);
  if (victoryGlow > 0) {
    const outer = R * (2.2 + 1.9 * victoryGlow);
    const g = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, outer);
    g.addColorStop(0, SHINE(0.6 * victoryGlow));
    g.addColorStop(0.3, `rgba(250,210,104,${0.36 * victoryGlow})`);
    g.addColorStop(0.65, `rgba(240,186,64,${0.14 * victoryGlow})`);
    g.addColorStop(1, 'rgba(240,186,64,0)');
    ctx.fillStyle = g; circle(ctx, 0, 0, outer); ctx.fill();
  }

  // Powered halo: the same light gold as the menu's play mark, bleeding outwards.
  const halo = Math.max(gold * (rm ? 0.55 : 0.45 + 0.2 * Math.sin(t * 3)), flash);
  if (halo > 0) {
    const g = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * (1.8 + flash * 0.6));
    g.addColorStop(0, SHINE(0.55 * halo));
    g.addColorStop(0.45, `rgba(246,201,86,${0.28 * halo})`);
    g.addColorStop(1, 'rgba(246,193,65,0)');
    ctx.fillStyle = g; circle(ctx, 0, 0, R * (1.8 + flash * 0.6)); ctx.fill();
  }

  ctx.globalAlpha = 0.92; // Smaller dial needs crisp contrast, not a translucent face.
  const base = ctx.globalAlpha;
  const part = (i: number, draw: () => void) => {
    if (!has(i)) return;
    ctx.save(); ctx.globalAlpha = base * fade(i); draw(); ctx.restore();
  };

  // Casing: dark iron disc with a quiet brass rim, present from the start.
  circle(ctx, 0, 0, R - 2);
  ctx.fillStyle = mix(P.plate, '#5a4316', gold * 0.7); ctx.fill();
  ctx.strokeStyle = P.brassDeep; ctx.lineWidth = 1.5;
  circle(ctx, 0, 0, R - 8); ctx.stroke();

  // Outer bezel: continuous concentric brass rings, gold once powered.
  ctx.strokeStyle = mix(P.brassDeep, '#c9962f', gold); ctx.lineWidth = 10; circle(ctx, 0, 0, R - 4); ctx.stroke();
  ctx.strokeStyle = mix(P.brass, '#ffe39a', gold); ctx.lineWidth = 2; circle(ctx, 0, 0, R); ctx.stroke();
  ctx.strokeStyle = mix(P.brassHi, '#fff6d6', gold); ctx.lineWidth = 1; circle(ctx, 0, 0, R - 9); ctx.stroke();

  // Dial face: muted aged ivory, filled from the first frame.
  {
    const g = ctx.createRadialGradient(0, -30, 10, 0, 0, L.tickOuter + 6);
    g.addColorStop(0, mix('#d9cfb6', '#fbedc4', gold * 0.7)); g.addColorStop(1, mix('#b4a888', '#e2c98f', gold * 0.7));
    circle(ctx, 0, 0, L.tickOuter + 6); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = P.brassDeep; ctx.lineWidth = 1.2; ctx.stroke();
    circle(ctx, 0, 0, L.tickMajor - 3); ctx.strokeStyle = 'rgba(42,38,34,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  // Minute track: exactly 60 ticks at 6 degrees.
  ctx.strokeStyle = P.plate;
  for (let m = 0; m < 60; m++) {
    const major = m % 5 === 0;
    const a = clockPoint(m, 60, L.tickOuter);
    const b = clockPoint(m, 60, major ? L.tickMajor : L.tickMinor);
    ctx.lineWidth = major ? 2.8 : 1.2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  circle(ctx, 0, 0, L.tickOuter); ctx.lineWidth = 0.8; ctx.stroke();

  // Gear train inside a lower dial window; it turns once the clock is powered.
  const gx0 = CLOCK_GEARS[0].x - CLOCK_GEARS[0].pitchRadius - 6;
  const gx1 = CLOCK_GEARS[2].x + CLOCK_GEARS[2].pitchRadius + 6;
  const gy = CLOCK_GEARS[0].y;
  const wh = CLOCK_GEARS[0].pitchRadius + 7;
  const windowPath = () => { ctx.beginPath(); ctx.roundRect(gx0, gy - wh, gx1 - gx0, wh * 2, wh); };
  windowPath(); ctx.fillStyle = P.plate; ctx.fill();
  ctx.save(); windowPath(); ctx.clip();
  const elapsed = rm ? 0 : Math.max(0, state.running) / 60;
  CLOCK_GEARS.forEach((g, k) => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(clockGearAngle(k, elapsed));
    gearShape(ctx, g.pitchRadius + 2, g.teeth);
    ctx.fillStyle = k === 1 ? mix(P.brassDeep, '#c9962f', gold) : mix(P.brass, '#f1cd6d', gold); ctx.fill();
    ctx.strokeStyle = P.brassHi; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = P.plate; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * TAU;
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * (g.pitchRadius - 6), Math.sin(a) * (g.pitchRadius - 6));
    }
    ctx.stroke();
    circle(ctx, 0, 0, 3); ctx.fillStyle = P.plate; ctx.fill();
    ctx.restore();
  });
  ctx.restore();
  windowPath(); ctx.strokeStyle = mix(P.brassDeep, '#c9962f', gold); ctx.lineWidth = 2; ctx.stroke();

  // Faint aligned seats for every numeral still missing (never scattered).
  ctx.strokeStyle = GUIDE; ctx.lineWidth = 1;
  for (let n = 0; n < 12; n++) {
    if (has(PART.numeral0 + n)) continue;
    const p = clockPoint(n, 12, L.numeralRadius);
    circle(ctx, p.x, p.y, 2); ctx.stroke();
  }

  // 1..12 Upright Roman numerals at exact positions.
  ctx.font = '600 20px Cinzel, Fraunces, Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let n = 0; n < 12; n++) {
    const i = PART.numeral0 + n;
    part(i, () => {
      const p = clockPoint(n, 12, L.numeralRadius);
      ctx.fillStyle = '#2a2622';
      ctx.fillText(NUMERALS[n], p.x, p.y + 1);
      if (glow(i)) { ctx.strokeStyle = GOLD(glow(i)); ctx.lineWidth = 1.5; circle(ctx, p.x, p.y, 17); ctx.stroke(); }
    });
  }

  // 14..15 Hands on the common pivot: 10:10, running at clock ratios once powered.
  const angles = restoredClockHandAngles(rm ? 0 : state.running);
  const handPart = (i: number, angle: number, len: number, w: number, tail: number) => {
    // No hand, and no hand-shaped guide, until its answer installs it.
    part(i, () => {
      hand(ctx, angle, len, w, tail);
      ctx.fillStyle = P.ink; ctx.fill();
      ctx.strokeStyle = mix(P.brassDeep, '#f1cd6d', gold); ctx.lineWidth = 0.8; ctx.stroke();
      if (glow(i)) { hand(ctx, angle, len, w, tail); ctx.strokeStyle = GOLD(glow(i)); ctx.lineWidth = 2; ctx.stroke(); }
    });
  };
  handPart(PART.hour, angles.hour, L.hourLength, 8, 14);
  handPart(PART.minute, angles.minute, L.minuteLength, 5.5, 18);

  // 13 Centre pin: the dot the hands turn on.
  if (!has(PART.pin)) { ctx.strokeStyle = GUIDE; ctx.lineWidth = 1; circle(ctx, 0, 0, 7); ctx.stroke(); }
  part(PART.pin, () => {
    circle(ctx, 0, 0, 7); ctx.fillStyle = mix(P.brass, '#f1cd6d', gold); ctx.fill();
    ctx.strokeStyle = P.brassHi; ctx.lineWidth = 1; ctx.stroke();
    circle(ctx, 0, 0, 2.5); ctx.fillStyle = P.ink; ctx.fill();
    if (glow(PART.pin)) { ctx.strokeStyle = GOLD(glow(PART.pin)); ctx.lineWidth = 2; circle(ctx, 0, 0, 12); ctx.stroke(); }
  });

  // Flare: a light-gold wash over the whole dial while the clock flashes.
  if (flash > 0) {
    ctx.globalAlpha = 1;
    circle(ctx, 0, 0, R + 2);
    ctx.fillStyle = SHINE(0.72 * flash); ctx.fill();
    ctx.strokeStyle = `rgba(255,251,225,${flash})`; ctx.lineWidth = 3; circle(ctx, 0, 0, R + 4); ctx.stroke();
  }

  // Bitten: a red wash and rim while Σ's jaws are on the clock.
  const hurt = clamp(state.hurt ?? 0, 0, 1);
  if (hurt > 0) {
    ctx.globalAlpha = 1;
    circle(ctx, 0, 0, R + 2);
    ctx.fillStyle = `rgba(200,30,22,${0.45 * hurt})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,70,50,${hurt})`; ctx.lineWidth = 6; circle(ctx, 0, 0, R + 5); ctx.stroke();
  }

  ctx.restore();
}
