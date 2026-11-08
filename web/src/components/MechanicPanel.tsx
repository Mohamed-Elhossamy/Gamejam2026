import type { MathQuestion, Mechanism } from '@/game/contracts';
import { MathFormula } from './math/MathText';
import { motionScale, yUnit } from '@/game/coordinates';

export type Mechanic = 'slope' | 'motion' | 'vector' | 'matrix';

export function mechanicOf(q: MathQuestion | null, m?: Mechanism): Mechanic {
  const declared = (q as (MathQuestion & { mechanic?: Mechanic }) | null)?.mechanic;
  if (declared) return declared;
  if (m?.kind === 'vector') return 'vector';
  if (m?.kind === 'matrix') return 'matrix';
  if (m?.motion) return 'motion';
  return 'slope';
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Spatial derivative: local axes + tangent. Schematic unless real gradient data exists. */
function SlopeDiagram({ m }: { m?: Mechanism }) {
  const g = m?.slope?.gradient;
  const ang = g === undefined ? 0.5 : Math.atan(g * (m ? yUnit(m) : 10) / 200);
  const dx = Math.cos(ang) * 70, dy = Math.sin(ang) * 70;
  return (
    <svg viewBox="0 0 220 110" className="lx-diagram" aria-hidden>
      <path d="M200 90 H14 M20 84 L14 90 L20 96 M190 96 V10 M186 16 L190 10 L194 16" className="ax" />
      <text x="8" y="104" className="lab">x</text><text x="196" y="12" className="lab">y</text>
      <path d="M190 90 C150 88, 120 70, 60 30" className={g === undefined ? 'curve dash' : 'curve'} />
      <line x1={120 - dx} y1={60 - dy} x2={120 + dx} y2={60 + dy} className="tan" />
      <circle cx="120" cy="60" r="3.5" className="pt" />
      <text x="128" y="78" className="small">{g === undefined ? 'tangent: your answer' : `m = ${fmt(g)}`}</text>
      <text x="14" y="12" className="small">local axes · y scaled</text>
    </svg>
  );
}

/** Temporal derivative: s(t) curve with v = ds/dt at t = 2 marked. Schematic shape, real numbers in text. */
function MotionDiagram({ m }: { m?: Mechanism }) {
  return (
    <svg viewBox="0 0 220 110" className="lx-diagram" aria-hidden>
      <path d="M20 96 H206 M200 90 L206 96 L200 102 M20 100 V8 M16 14 L20 8 L24 14" className="ax" />
      <text x="208" y="108" className="lab">t</text><text x="26" y="12" className="lab">s</text>
      <path d="M20 96 Q 90 92, 190 18" className="curve dash" />
      <line x1="70" y1="104" x2="160" y2="40" className="tan" />
      <line x1="115" y1="96" x2="115" y2="72" className="guide" />
      <circle cx="115" cy="72" r="3.5" className="pt" />
      <text x="106" y="108" className="small">t=2</text>
      <text x="132" y="86" className="small">{m?.motion ? `v = ${fmt(m.motion.velocity)}` : 'velocity'}</text>
    </svg>
  );
}

function VectorDiagram({ m, dims }: { m?: Mechanism; dims: number }) {
  const d = m?.vector?.displacement;
  return (
    <svg viewBox="0 0 220 110" className="lx-diagram" aria-hidden>
      <path d="M110 70 H200 M110 70 V8" className="ax" />
      {dims === 3 && <path d="M110 70 L60 104" className="ax" />}
      <text x="202" y="74" className="lab">x</text><text x="114" y="12" className="lab">y</text>
      {dims === 3 && <text x="48" y="106" className="lab">z</text>}
      <line x1="110" y1="70" x2={dims === 3 ? 170 : 175} y2={dims === 3 ? 34 : 30} className="tan" markerEnd="url(#arr)" />
      <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#d2b67a" /></marker></defs>
      <text x="14" y="16" className="small">displacement</text>
      <text x="14" y="30" className="small">60 px per unit</text>
    </svg>
  );
}

function MatrixDiagram() {
  return (
    <svg viewBox="0 0 220 110" className="lx-diagram" aria-hidden>
      <path d="M20 90 H120 M30 100 V10" className="ax" />
      <rect x="30" y="50" width="40" height="40" className="sq" />
      <path d="M140 60 H170 M164 54 L170 60 L164 66" className="guide" />
      <path d="M190 90 L190 50 L150 50 L150 90 Z" className="sq img" transform="rotate(-25 190 90)" />
      <text x="40" y="74" className="lab">I</text>
      <text x="176" y="104" className="small">M · square (schematic)</text>
    </svg>
  );
}

export default function MechanicPanel({ q, m, elapsed, graphOnly = false }: {
  q: MathQuestion | null; m?: Mechanism; elapsed: number; graphOnly?: boolean;
}) {
  const mech = mechanicOf(q, m);
  const dims = (q as (MathQuestion & { dimensions?: number }) | null)?.dimensions ?? (m?.vector?.displacement.length === 3 ? 3 : 2);
  if (graphOnly) {
    return mech === 'motion'
      ? <div className="lx-motion-graph" data-testid="panel-mechanic" data-mechanic="motion">
          <div role="img" aria-label="Distance plotted against time; the tangent shows rate of change." data-testid="panel-motion-graph"><MotionDiagram m={m} /></div>
        </div>
      : null;
  }
  return (
    <div className={`lx-mech lx-mech-${mech}`} data-testid="panel-mechanic" data-mechanic={mech}>
      <div className="lx-mech-head">
        <span>{mech === 'slope' ? 'Spatial slope' : mech === 'motion' ? 'Motion in time' : mech === 'vector' ? `Vector · ${dims}D` : 'Matrix transform'}</span>
        <MathFormula tex={mech === 'slope' ? '\\tfrac{dy}{dx}' : mech === 'motion' ? '\\tfrac{ds}{dt}' : mech === 'vector' ? '\\mathbf{d}' : 'M\\mathbf{x}'} />
      </div>
      {mech === 'slope' && <SlopeDiagram m={m} />}
      {mech === 'motion' && <MotionDiagram m={m} />}
      {mech === 'vector' && <VectorDiagram m={m} dims={dims} />}
      {mech === 'matrix' && <MatrixDiagram />}
      <p className="lx-mech-note" data-testid="text-mechanic-note">
        {mech === 'slope' && 'Gradient in space: rise per unit x. Your answer tilts the ground on the local, vertically scaled axes.'}
        {mech === 'motion' && (m?.motion
          ? <>Lift rises at v = {fmt(m.motion.velocity)} for {fmt(m.motion.duration)} s, drawn at {motionScale(m).toFixed(2)} px per unit. Elapsed {fmt(Math.min(m.elapsed, m.motion.duration))} s.</>
          : <>Rate in time, not a slope in space. The velocity you find drives the lift. Run elapsed: {elapsed.toFixed(1)} s.</>)}
        {mech === 'vector' && (q?.topic === 'Vector addition' || q?.topic === 'Scalar multiplication'
          ? 'This vector shifts the platform along the 2D course.'
          : 'Calculate this vector property to unlock the marked bridge on the 2D route.')}
        {mech === 'matrix' && 'The bridge turns about its marked pivot when the transformation is right.'}
      </p>
    </div>
  );
}
