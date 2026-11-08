import type { MathQuestion, SlopeEffect, MotionEffect, VectorEffect } from '@lambda-rush/api-client';

export type { MathQuestion };
export type MechanismType = 'gear' | 'vector' | 'matrix';
export type Mode = 'menu' | 'intro' | 'playing' | 'focus' | 'over' | 'won';
export type Input = {
  left: boolean; right: boolean; jump: boolean;
};
export type Body = { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean };
export type Mechanism = {
  index: number; x: number; stage: number; ordinal: number;
  kind: MechanismType; solved: boolean; animation: number;
  mechanic?: MathQuestion['mechanic'];
  slope?: SlopeEffect;
  motion?: MotionEffect; vector?: VectorEffect; elapsed: number;
};
export type Run = {
  mode: Mode; player: Body; monsterX: number; monsterZ: number; cameraX: number;
  time: number; sigmaTime: number; distance: number; startX: number; stage: number;
  /** Clock progress: answers credited by a level shortcut plus answers actually earned this run. */
  correct: number;
  /** Only Level 6's five assessed answers strike Sigma; terrain checkpoints do not. */
  levelSixCorrect: number;
  /** Earlier-level answers assumed correct by a level shortcut; never counted as earned. */
  credited: number;
  health: number;
  introRemaining: number;
  celebration: number;
  lastRepair: { x: number; time: number } | null;
  /** Non-blocking announcement of a level completed within this run. */
  levelTransition?: { from: number; to: number; time: number };
  /**
   * Set by the sixteenth repair: Σ leaves the course at `liftoffX` and the powered clock fights it.
   * `lastMiss` is the run time of the latest wrong answer in the battle (Σ lunges at the clock).
   */
  battle: { start: number; liftoffX: number; lastMiss: number | null } | null;
  score: number; boost: number; damage: number; stumble: number;
  mechanisms: Mechanism[]; activeIndex: number | null;
  jumpHeld: boolean; cause: string; normalChaseSpeed: number;
  /** Seconds left on the run timer. */
  timer: number;
  /** Pause freezes the whole simulation, timer included. */
  paused: boolean;
  /** Every stage uses the same side-scrolling 2D world. */
  perspective: '2d';
  /** Points of the current or most recent Haskell question. */
  questionPoints: number;
  /** Supplementary Level 6 checkpoints never count as assessed answers. */
  terrain?: { phase: 'sine' | 'identity'; started: number; origin: number };
};
/** A correct answer's "+N seconds!" popup; `id` changes for every new award. */
export type BonusPopup = { seconds: number; id: number };
export type GameView = {
  /** Identifies a fresh run so graphics state cannot leak through restart. */
  runNumber: number;
  run: Run; question: MathQuestion | null; loading: boolean; submitting: boolean;
  error: string | null; feedback: string | null; highScore: number;
  storageAvailable: boolean; engineReady: boolean;
  bonus: BonusPopup | null;
};
export type GameActions = {
  start: () => void; answer: (answer: string) => void; retry: () => void;
  startAtStage: (stage: number) => void;
  control: (action: keyof Input, pressed: boolean) => void; menu: () => void;
  /** Toggle pause, or force it with an explicit value. */
  pause: (paused?: boolean) => void;
};
