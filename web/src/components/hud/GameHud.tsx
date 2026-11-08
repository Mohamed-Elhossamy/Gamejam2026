import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameActions, GameView, Run } from '@/game/contracts';
import {
  CORRECT_FADE_S,
  HEARTS_2D,
  WRONG_FLASH_S,
} from '@/game/rules';
import ClockSoundToggle from '../clock/ClockSoundToggle';
import FpsCounter from './FpsCounter';
import LevelAnnouncement from './LevelAnnouncement';
import { clockPiecesRemaining, clockPowered, sigmaHitsRemaining, clockProgress } from '@/game/greatClockGeometry';

type HudProps = { view: GameView; actions: GameActions; stageName: (stage: number) => string };
type CssVars = CSSProperties & Record<`--${string}`, string>;

function Heart({ filled }: { filled: boolean }) {
  return <svg className={`lx-heart${filled ? '' : ' is-empty'}`} viewBox="0 0 32 29" aria-hidden="true">
    <path d="M16 27.4 3.2 15.2A8.1 8.1 0 0 1 14.7 3.8L16 5.2l1.3-1.4a8.1 8.1 0 0 1 11.5 11.4Z" />
  </svg>;
}

function PauseGlyph({ paused }: { paused: boolean }) {
  return paused
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>;
}

function PauseControl({ run, actions }: { run: Run; actions: GameActions }) {
  return <button
      className="lx-pause-button"
      type="button"
      onClick={() => actions.pause()}
      aria-label={run.paused ? 'Resume game' : 'Pause game'}
      data-testid="button-pause"
    >
      <PauseGlyph paused={run.paused} />
    </button>;
}

function PauseOverlay({ run, actions }: { run: Run; actions: GameActions }) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (run.paused) resumeRef.current?.focus();
  }, [run.paused]);
  if (!run.paused) return null;
  return <section className="lx-pause-overlay" aria-label="Game paused" data-testid="overlay-paused">
    <div className="lx-pause-copy">
      <p>Paused</p>
      <button ref={resumeRef} type="button" onClick={() => actions.pause(false)} data-testid="button-resume">Resume</button>
      <button type="button" className="lx-exit-button" onClick={actions.menu} data-testid="button-exit-menu">Exit to main menu</button>
    </div>
  </section>;
}

function AnswerFeedback({ run, bonus }: Pick<GameView, 'bonus'> & { run: Run }) {
  const [seenBonus, setSeenBonus] = useState<{ id: number; start: number } | null>(null);
  const bonusId = bonus?.id;
  useEffect(() => {
    if (bonus && bonus.id !== seenBonus?.id) setSeenBonus({ id: bonus.id, start: run.time });
  }, [bonus, bonusId, run.time, seenBonus?.id]);

  if (!seenBonus) return null;
  const elapsed = Math.max(0, run.time - seenBonus.start);
  if (elapsed > CORRECT_FADE_S) return null;
  const motionState = run.paused ? 'paused' : 'running';
  const style = {
    '--correct-fade': `${CORRECT_FADE_S}s`,
    animationPlayState: motionState,
  } as CssVars;
  return <div className="lx-answer-feedback" style={style} aria-live="polite" aria-atomic="true">
    <strong className="lx-correct" data-testid="popup-correct">CORRECT!</strong>
  </div>;
}

export function WrongAnswerFlash({ run }: { run: Run }) {
  if (run.damage <= 0) return null;
  return <div
    className="lx-damage"
    style={{ '--wrong-flash': `${WRONG_FLASH_S}s`, animationPlayState: run.paused ? 'paused' : 'running' } as CssVars}
    data-testid="fx-damage"
    aria-hidden="true"
  />;
}

export default function GameHud({ view, actions, stageName }: HudProps) {
  const { run } = view;
  return <>
    <LevelAnnouncement run={run} stageName={stageName} />
    <div className={`lx-hud${run.mode === 'won' ? ' is-finale' : ''}${run.mode !== 'won' ? ' has-fps' : ''}`} data-testid="hud" data-paused={run.paused || undefined}>
      {run.mode !== 'won' && <FpsCounter />}
      <div className="lx-hud-left">
          <div data-testid="hud-health">
            <div className="lx-hearts" data-testid="hud-hearts" aria-label={`${run.health} of ${HEARTS_2D} hearts`}>
              {Array.from({ length: HEARTS_2D }, (_, index) => <Heart key={index} filled={index < run.health} />)}
            </div>
          </div>
      </div>
      <div className="lx-hud-centre"><PauseControl run={run} actions={actions} /></div>
      <div className="lx-hud-right">
        {clockPowered(clockProgress(run))
          ? <span className="gc-remaining is-battle" aria-live="polite" data-testid="clock-progress">
            Sigma health: <b data-testid="sigma-health-remaining">{sigmaHitsRemaining(clockProgress(run))}</b>
          </span>
          : <span className="gc-remaining" aria-live="polite" data-testid="clock-progress">
            Pieces remaining: <b data-testid="clock-pieces-remaining">{clockPiecesRemaining(clockProgress(run))}</b>
          </span>}
        <ClockSoundToggle />
      </div>
      <div className="lx-hud-meta" aria-label="Run details">
        <span title={stageName(run.stage)}><small>Stage</small><b data-testid="hud-stage">{run.stage}</b></span>
        <span className="lx-sr"><small>Score</small><b data-testid="hud-score">{run.score}</b></span>
        <span className="lx-sr"><small>Solved</small><b data-testid="hud-correct">{run.correct - run.credited}</b></span>
        <span className="lx-sr" data-testid="hud-time">{run.time.toFixed(1)} s</span>
        <span className="lx-sr" data-testid="hud-highscore">{view.highScore}</span>
        <span className="lx-sr" data-testid="text-highscore">{view.highScore}</span>
        {run.boost > 0 && <span className="lx-boost" data-testid="hud-boost">BOOST {run.boost.toFixed(1)}s</span>}
      </div>
    </div>
    <AnswerFeedback run={run} bonus={view.bonus} />
    <PauseOverlay run={run} actions={actions} />
  </>;
}
