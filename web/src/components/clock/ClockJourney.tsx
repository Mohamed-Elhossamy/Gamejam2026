import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { GameActions, GameView } from '@/game/contracts';
import { CLOCK_CELEBRATION_SECONDS, CLOCK_INTRO_SECONDS } from '@/game/rules';
import { BATTLE_TIMING } from '@/game/greatClockBattle';
import './clock.css';

export default function ClockJourney({ view, actions }: { view: GameView; actions: GameActions }) {
  const { run } = view;
  const ready = run.mode === 'won' && run.celebration >= CLOCK_CELEBRATION_SECONDS;
  const replay = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (ready && !run.paused) replay.current?.focus(); }, [ready, run.paused]);
  if (run.mode === 'intro') {
    const elapsed = CLOCK_INTRO_SECONDS - run.introRemaining;
    const opacity = Math.max(0, Math.min(1, elapsed / 0.16, run.introRemaining / 0.24));
    return <section className="gc-intro" role="status" aria-live="polite" data-testid="clock-introduction"
      style={{ opacity, '--gc-enter': `${Math.max(0, 1 - elapsed / 0.3) * 14}px` } as CSSProperties}>
      <p>THE GREAT CLOCK HAS BROKEN</p>
      <h1>REPAIR THE CLOCK</h1>
      <strong>SAVE TIME</strong>
    </section>;
  }
  if (run.mode !== 'won') return null;
  const opacity = Math.min(1, Math.max(0, (run.celebration - BATTLE_TIMING.message) / 0.45));
  return <section className="gc-victory" role="status" aria-label="You fixed the clock. You saved time!"
    data-testid="panel-victory" data-state={ready ? 'results' : 'celebration'}>
    <div className="gc-victory-copy" style={{ opacity }}>
      <h1 data-testid="text-victory-title">YOU FIXED THE CLOCK</h1>
      <strong data-testid="text-victory-subtitle">YOU SAVED TIME!</strong>
      {ready && <div className="gc-results" data-testid="clock-results">
        <p>Sigma defeated <span>·</span> {run.score.toLocaleString()} points</p>
        <div className="lx-row">
          <button ref={replay} type="button" className="lx-btn" onClick={actions.start}
            disabled={!view.engineReady || run.paused} data-testid="button-play-again">PLAY AGAIN</button>
          <button type="button" className="lx-btn ghost" onClick={actions.menu} data-testid="button-victory-menu">MAIN MENU</button>
        </div>
      </div>}
    </div>
  </section>;
}
