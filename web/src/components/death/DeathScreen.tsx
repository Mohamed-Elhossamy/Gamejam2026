import { useEffect, useRef, useState } from 'react';
import type { GameActions, GameView } from '@/game/contracts';
import youDiedLettering from '@/assets/you-died-lettering.svg';
import './death-screen.css';

// Lettering is outlined artwork (see src/assets/LETTERING-PROVENANCE.md) — not a webfont.
const ACTIONS_DELAY_MS = 2300;

export default function DeathScreen({ view, actions }: { view: GameView; actions: GameActions }) {
  const r = view.run;
  const timedOut = r.timer <= 0;
  const [ready, setReady] = useState(false);
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setReady(true), reduce ? 0 : ACTIONS_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) restartRef.current?.focus({ preventScroll: true });
  }, [ready]);

  return (
    <div className="ds" role="dialog" aria-modal="true" aria-labelledby="ds-title" data-testid="panel-game-over" data-state="game-over">
      <div className="ds-dim" aria-hidden="true" />
      <div className="ds-band" aria-hidden="true" />
      <div className="ds-black" aria-hidden="true" />
      <h2 id="ds-title" className="ds-title" data-testid="text-game-over-title">
        <img src={youDiedLettering} alt="you died" draggable={false} />
      </h2>
      <div className={`ds-after${ready ? ' is-ready' : ''}`} inert={!ready} aria-hidden={!ready}>
        {timedOut && <p className="ds-cause">The clock ran out. The Great Clock is still broken.</p>}
        <dl className="ds-stats">
          <div><dt>Correct</dt><dd data-testid="text-final-correct">{Math.trunc(r.correct - r.credited)}</dd></div>
          <div><dt>Score</dt><dd data-testid="text-final-score">{Math.trunc(r.score)}</dd></div>
        </dl>
        <div className="ds-row">
          <button ref={restartRef} className="ds-btn" onClick={actions.start} disabled={!view.engineReady} data-testid="button-restart">Try again</button>
          <button className="ds-btn ghost" onClick={actions.menu} data-testid="button-menu">Main menu</button>
        </div>
      </div>
    </div>
  );
}
