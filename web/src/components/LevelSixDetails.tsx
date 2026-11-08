import type { GameView, Mechanism, Run } from '@/game/contracts';
import { MathFormula } from './math/MathText';
import './level-six.css';

/** Level 6 mechanism currently in focus, if any. */
export function levelSixMechanism(run: Run): Mechanism | null {
  if (run.activeIndex === null) return null;
  const m = run.mechanisms.find(x => x.index === run.activeIndex);
  return m && m.stage === 6 ? m : null;
}

/** Assessed Question N of 5 vs supplementary trigonometry checkpoint. */
export function LevelSixBadge({ view }: { view: GameView }) {
  const m = levelSixMechanism(view.run);
  if (!m) return null;
  const supplementary = m.ordinal >= 5;
  return (
    <p className={`l6-badge${supplementary ? ' is-supp' : ''}`} data-testid="text-level6-badge">
      {supplementary
        ? <>Trigonometry checkpoint {m.ordinal - 4} of 2 <span>supplementary, unscored</span></>
        : <>Level 6 <span>assessed question {m.ordinal + 1} of 5</span></>}
    </p>
  );
}

const DOT: Record<number, [[number, number], [number, number]]> = {
  1: [[3, 4], [5, -1]],
  4: [[2, 5], [4, -1]],
};

/** Compact, correctly scaled xy diagram of the two vectors in the dot product prompt. */
export function DotProductDiagram({ view }: { view: GameView }) {
  const m = levelSixMechanism(view.run);
  const pair = m && m.kind === 'vector' ? DOT[m.ordinal] : undefined;
  if (!pair) return null;
  const U = 13; // px per unit, identical on both axes
  const W = 6 * U, H = 6 * U; // x: -0.5..5.5, y: -1.5..5.5
  const ox = U * 0.6, oy = U * 5.4;
  const pt = ([x, y]: [number, number]) => [ox + x * U, oy - y * U] as const;
  const [a, b] = pair;
  const arrow = (v: [number, number], cls: string, id: string) => {
    const [ex, ey] = pt(v);
    return <line x1={ox} y1={oy} x2={ex} y2={ey} className={cls} markerEnd={`url(#${id})`} />;
  };
  return (
    <figure className="l6-vec" data-testid="figure-dot-product">
      <svg viewBox={`0 0 ${W} ${H + U}`} width={W * 1.3} height={(H + U) * 1.3} role="img"
        aria-label={`Vectors a = (${a.join(', ')}) and c = (${b.join(', ')}) on the xy plane`}>
        <defs>
          <marker id="l6a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" className="l6-head-a" /></marker>
          <marker id="l6b" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" className="l6-head-b" /></marker>
        </defs>
        {[0, 1, 2, 3, 4, 5].map(i => <line key={`x${i}`} x1={ox + i * U} x2={ox + i * U} y1={oy - 5 * U} y2={oy + U} className="l6-grid" />)}
        {[-1, 0, 1, 2, 3, 4, 5].map(j => <line key={`y${j}`} y1={oy - j * U} y2={oy - j * U} x1={ox} x2={ox + 5 * U} className="l6-grid" />)}
        <line x1={ox} x2={ox + 5.4 * U} y1={oy} y2={oy} className="l6-axis" />
        <line x1={ox} x2={ox} y1={oy + 1.4 * U} y2={oy - 5.4 * U} className="l6-axis" />
        <g fill="currentColor" fontSize="7">
          <text x={ox + 5.4 * U} y={oy - 4}>x</text>
          <text x={ox + 4} y={oy - 5.1 * U}>y</text>
          <text x={ox + 2} y={oy + 8}>0</text>
          {[1, 3, 5].map(i => <text key={i} x={ox + i * U - 2} y={oy + 8}>{i}</text>)}
        </g>
        {arrow(a, 'l6-a', 'l6a')}
        {arrow(b, 'l6-b', 'l6b')}
      </svg>
      <figcaption>
        <span className="l6-key-a"><MathFormula tex={`\\mathbf a=(${a[0]},${a[1]})`} /></span>
        <span className="l6-key-b"><MathFormula tex={`\\mathbf c=(${b[0]},${b[1]})`} /></span>
      </figcaption>
    </figure>
  );
}
