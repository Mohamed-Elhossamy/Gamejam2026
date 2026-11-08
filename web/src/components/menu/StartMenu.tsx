import type { GameActions, GameView } from '@/game/contracts';
import { useId, type CSSProperties } from 'react';
import './StartMenu.css';
import ClockSoundToggle from '../clock/ClockSoundToggle';

function SigmaPlayMark() {
  const goldId = useId();
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="sm-sigma-play"
      style={{ '--sm-play-fill': `url("#${goldId}")` } as CSSProperties}>
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffbe1" />
          <stop offset="35%" stopColor="#ffedab" />
          <stop offset="68%" stopColor="#efbd50" />
          <stop offset="100%" stopColor="#fff1b6" />
        </linearGradient>
      </defs>
      <path className="sm-play-bloom" d="M34 25V95L84 60Z" />
      <path className="sm-sigma-lines" d="M84 25H34L84 60L34 95H84" />
      <path className="sm-play-spine" d="M34 25V95" />
      <path className="sm-play-mark" d="M34 25V95L84 60Z" />
    </svg>
  );
}

/**
 * The title λ wears the in-game character's eyes: the same ivory whites, ink
 * pupils, highlights, blink and gentle float, mirrored because the title glyph
 * leans right where the running λ faces left.
 */
function TitleLambda() {
  const eyes: [number, number, number, number, string][] = [
    [18, -16, 6.5, 7.5, 'a'],
    [2, -20, 6, 7, 'b'],
  ];
  return (
    <span className="sm-title-lambda">λ
      <svg className="sm-lambda-eyes" viewBox="-8 -30 36 26" aria-hidden="true">
        {eyes.map(([x, y, rx, ry, key]) => (
          <g key={key} className={`sm-eye sm-eye-${key}`}>
            <g className="sm-eye-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
              <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#efe6cf" />
              <g className="sm-eye-pupil">
                <circle cx={x + 1.8} cy={y + 0.7} r={rx * 0.42} fill="#111213" />
                <circle cx={x + 2.8} cy={y - 1} r={1.3} fill="#fff8e8" />
              </g>
            </g>
          </g>
        ))}
      </svg>
    </span>
  );
}

export default function StartMenu({ view, actions }: { view: GameView; actions: GameActions }) {
  return (
    <main className="sm" data-testid="screen-menu" data-state="menu">
      <ClockSoundToggle />
      <div className="sm-center">
        <h1 className="sm-title" data-testid="text-title"><TitleLambda />Rush</h1>
        <p className="sm-motto" data-testid="text-motto">Solve sums. Survive Sigma.</p>
        <p className="sm-clock-story"><b>The Great Clock has broken. Time is disappearing from the world.</b><br />
          Fix the clock and save time.</p>
        <div className="sm-actions">
          {view.engineReady ? (
            <>
              <button type="button" className="sm-play" onClick={actions.start} aria-label="Play game" data-testid="button-begin">
                <SigmaPlayMark />
              </button>
              {view.loading && <p className="sm-sub" role="status">Preparing the mathematics engine…</p>}
            </>
          ) : (
            <div className="sm-alert" role="alert" data-testid="status-engine-unavailable">
              <button type="button" className="sm-play" disabled aria-label="Play game" data-testid="button-begin">
                <SigmaPlayMark />
              </button>
              <p>The mathematics engine is not answering, so no fair run can start. {view.error ?? ''}</p>
              <button type="button" className="sm-ghost" onClick={actions.retry} data-testid="button-retry">RETRY</button>
            </div>
          )}
          <div className="sm-level-select" aria-label="Choose a level">
            <section aria-label="Levels">
              <div className="sm-level-buttons">
                {['Basic differentiation', 'Advanced differentiation', 'Vectors', 'Matrices', 'Further mathematics', 'Trigonometric terrain'].map((label, i) => (
                  <button type="button" className="sm-level" key={label} disabled={!view.engineReady}
                    onClick={() => actions.startAtStage(i + 1)} data-testid={`button-level-${i + 1}`}>
                    <span>Level {i + 1}</span>{label}
                  </button>
                ))}
              </div>
            </section>
          </div>
          {!view.storageAvailable && <p className="sm-warn" data-testid="text-storage-warning">Local storage is unavailable. Your record will not persist after this session.</p>}
        </div>
      </div>
    </main>
  );
}
