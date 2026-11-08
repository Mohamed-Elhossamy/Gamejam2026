import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { CSSProperties } from 'react';
import type { GameActions, GameView, Input } from '@/game/contracts';
import { paintWorld } from '@/game/renderer';
import { advanceCharacterAnimations, createCharacterAnimationState, sigmaRenderBounds } from '@/game/sigma';
import { battleScene } from '@/game/greatClockBattle';
import { playClockSound } from '@/game/clockAudio';
import StartMenu from './menu/StartMenu';
import { MathFormula } from './math/MathText';
import GameHud, { WrongAnswerFlash } from './hud/GameHud';
import './hud/hud.css';
import DeathScreen from './death/DeathScreen';
import ClockJourney from './clock/ClockJourney';
import './question-layout.css';
import { DotProductDiagram, LevelSixBadge } from './LevelSixDetails';

const STAGES = ['Basic Differentiation', 'Advanced Differentiation', 'Vectors', 'Matrices', 'Further Mathematics', 'Mathematics and Trigonometric Terrain'];
const stageName = (s: number) => STAGES[Math.min(Math.max(s, 1), 6) - 1];
const KEYS = ['1', '2', '3', '4', '5', '6'];

function WorldCanvas({ view }: { view: GameView }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  const animationRef = useRef(createCharacterAnimationState());
  viewRef.current = view;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    // Battle cues fire when the blow visibly lands, so they freeze with pause.
    const initial = battleScene(viewRef.current.run, 0, 0, true);
    let landed = initial.landed;
    let clockHurt = initial.clock.hurt;
    let announced = initial.message;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const run = viewRef.current.run;
      advanceCharacterAnimations(animationRef.current, run);
      const scene = battleScene(run, 0, 0, true);
      if (scene.landed > landed) playClockSound('hit');
      if (scene.clock.hurt > 0 && clockHurt <= 0) playClockSound('hit');
      if (scene.message && !announced) playClockSound('victory');
      landed = scene.landed;
      clockHurt = scene.clock.hurt;
      announced = scene.message;
      paintWorld(ctx, run, w, h, animationRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const run = view.run;
  const bounds = sigmaRenderBounds(run, animationRef.current);
  const offRight = run.monsterX + bounds.left > run.cameraX + 1100;
  const offLeft = run.monsterX + bounds.right < run.cameraX;
  const showBubble = !run.battle && (run.mode === 'playing' || run.mode === 'focus') && (offRight || offLeft);
  return (
    <>
      <canvas ref={canvasRef} className="lx-canvas" aria-label="Maths chase scene with a continuous coordinate plane" role="img" data-testid="canvas-world" />
      {showBubble && (
        <span
          className="lx-sigma-edge"
          role="status"
          aria-label={`Sigma is off-screen, beyond the ${offRight ? 'right' : 'left'} edge`}
          data-testid="sigma-proximity-bubble"
          style={{
            top: '29%',
            ...(offRight ? { right: '3.1%' } : { left: '3.1%' }),
          } as CSSProperties}
        >Σ {offRight ? '→' : '←'}</span>
      )}
    </>
  );
}

function Focus({ view, actions }: { view: GameView; actions: GameActions }) {
  const q = view.question;
  const questionParts = q?.prompt.split(',\\quad') ?? [];
  return (
    <section className="lx-focus" inert={view.run.paused} aria-live="polite" aria-label="Math question" data-testid="panel-focus" data-state="question">
      {view.loading && !q && (
        <div data-testid="status-loading" style={{ display: 'grid', gap: 8 }}>
          <div className="lx-skel" style={{ width: '80%', height: 34 }} />
          <div className="lx-choices">{[0, 1, 2, 3].map(i => <div key={i} className="lx-skel" style={{ height: 44 }} />)}</div>
        </div>
      )}
      {view.error && (
        <div className="lx-error" role="alert" data-testid="status-error">
          <p style={{ margin: '0 0 10px' }}>{view.error}</p>
          <button className="lx-btn ghost" onClick={actions.retry} data-testid="button-retry">Retry</button>
        </div>
      )}
      {q && (
        <>
          <LevelSixBadge view={view} />
          <h2 className="lx-purpose" data-testid="text-purpose">{q.purpose}</h2>
          <div className="lx-prompt" data-testid="text-prompt">
            {questionParts.map((part, index) => <span className="lx-question-part" key={index}>
              <MathFormula tex={part} />
            </span>)}
          </div>
          <DotProductDiagram view={view} />
          <div className="lx-choices" role="group" aria-label="Answer choices">
            {q.choices.map((c, i) => (
              <button key={`${c}-${i}`} className="lx-choice" disabled={view.submitting || view.run.paused} onClick={() => actions.answer(c)} data-testid={`button-answer-${i}`} aria-label={`Answer ${i + 1}`}>
                <MathFormula tex={c} />
              </button>
            ))}
          </div>
        </>
      )}
      {view.feedback && <p className="lx-feedback" role="status" data-testid="text-feedback" data-state="wrong">WRONG<span>TRY AGAIN</span></p>}
    </section>
  );
}

function Touch({ actions }: { actions: GameActions }) {
  const bind = (k: keyof Input) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); actions.control(k, true); },
    onPointerUp: () => actions.control(k, false),
    onPointerCancel: () => actions.control(k, false),
    onLostPointerCapture: () => actions.control(k, false),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  return (
    <div className="lx-touch" aria-label="Touch controls">
      <div>
        <button aria-label="Run left" data-testid="touch-left" {...bind('left')}>LEFT</button>
        <button aria-label="Step right" data-testid="touch-right" {...bind('right')}>RIGHT</button>
      </div>
      <div>
        <button aria-label="Jump" data-testid="touch-jump" {...bind('jump')}>JUMP</button>
      </div>
    </div>
  );
}

export default function LambdaShell({ view, actions }: { view: GameView; actions: GameActions }) {
  const r = view.run;
  const mode = r.mode;

  // Optional letter shortcuts for answers during focus.
  const qRef = useRef(view);
  qRef.current = view;
  const answerRef = useRef(actions.answer);
  answerRef.current = actions.answer;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = qRef.current;
      if (v.run.mode !== 'focus' || v.run.paused || !v.question || v.submitting || e.repeat) return;
      const n = KEYS.indexOf(e.key);
      if (n >= 0 && n < v.question.choices.length) answerRef.current(v.question.choices[n]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (mode === 'menu') return <StartMenu view={view} actions={actions} />;

  return (
    <main className="lx" data-state={mode}>
      <div className={`lx-view${mode === 'focus' ? ' is-focus' : ''}${r.paused ? ' is-paused' : ''}`} data-testid="game-view">
        {(mode !== 'over') && <GameHud key={view.runNumber} view={view} actions={actions} stageName={stageName} />}
        <div className="lx-stage">
          <WorldCanvas key={view.runNumber} view={view} />
          <WrongAnswerFlash run={r} />
        </div>
        <ClockJourney view={view} actions={actions} />
        {mode === 'focus' && <Focus view={view} actions={actions} />}
        {mode === 'playing' && view.error && (
          <div className="lx-focus lx-focus-err" role="alert">
            <p className="lx-error" style={{ margin: 0 }}>{view.error}</p>
            <button className="lx-btn ghost" onClick={actions.retry} data-testid="button-retry">Retry</button>
          </div>
        )}
        {mode === 'over' && <DeathScreen key={view.runNumber} view={view} actions={actions} />}
      </div>
      {(mode === 'playing' || mode === 'focus') && <Touch actions={actions} />}
    </main>
  );
}
