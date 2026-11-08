import { createMathQuestion, submitMathAnswer, mathHealth } from '@lambda-rush/api-client';
import type { GameActions, GameView, Input, MathQuestion } from './contracts';
import { beginRun, createRun, createStageRun, EMPTY_INPUT, makeMechanism, resolveAnswer, setPaused, stepRun } from './simulation';
import { playClockSound, playGameEventSound, stopClockSound, unlockClockAudio } from './clockAudio';
import { CLOCK_ASSEMBLY_COUNT, CLOCK_CELEBRATION_SECONDS, rewardedTimeBonus } from './rules';
import { syncBackgroundMusic } from './backgroundMusic';

const RECORD_KEY = 'lambda.fractured-time.best.v2';
type Attempt = { questionId: string; answer: string; attemptId: string; index: number };

/** Owns the live simulation and all asynchronous boundaries. Presentation never
 * pauses simulation to wait for network requests or answer feedback. */
export class LambdaController {
  view: GameView = {
    runNumber: 0,
    run: createRun(), question: null, loading: false, submitting: false,
    error: null, feedback: null, highScore: 0, storageAvailable: true, engineReady: false,
    bonus: null,
  };
  private input = { ...EMPTY_INPUT };
  private runKey = crypto.randomUUID();
  private questions = new Map<number, MathQuestion>();
  private fetching = new Set<number>();
  private failedQuestions = new Set<number>();
  private pending: Attempt | null = null;
  private locked = false;
  private alive = true;
  private lastTime = 0;
  private lastPublish = 0;
  private frame = 0;
  private bonusId = 0;
  private startStage = 1;
  /** An answer reply that arrived while paused; applied on resume. */
  private deferred: (() => void) | null = null;

  constructor(private onChange: (view: GameView) => void) {
    try {
      const value = Number(localStorage.getItem(RECORD_KEY) ?? '0');
      this.view.highScore = Number.isFinite(value) && value >= 0 ? value : 0;
    } catch { this.view.storageAvailable = false; }
  }

  private publish = () => {
    if (this.alive) { syncBackgroundMusic(this.view.run); this.onChange({ ...this.view }); }
  };

  private record = () => {
    if (this.view.run.score <= this.view.highScore) return;
    this.view.highScore = this.view.run.score;
    try { localStorage.setItem(RECORD_KEY, String(this.view.highScore)); }
    catch { this.view.storageAvailable = false; }
  };

  connect = async () => {
    this.view.loading = true;
    this.view.error = null;
    this.publish();
    try {
      await mathHealth({ signal: AbortSignal.timeout(5000) });
      this.view.engineReady = true;
    } catch {
      this.view.engineReady = false;
      this.view.error = 'The Haskell mathematics engine could not be reached. Retry the connection.';
    } finally {
      this.view.loading = false;
      this.publish();
    }
  };

  private loadQuestion = async (index: number, force = false) => {
    if (this.fetching.has(index) || (!force && (this.questions.has(index) || this.failedQuestions.has(index)))) return;
    this.failedQuestions.delete(index);
    const key = this.runKey;
    this.fetching.add(index);
    if (this.view.run.activeIndex === index) {
      this.view.loading = true;
      this.view.error = null;
      this.publish();
    }
    const gate = makeMechanism(index);
    try {
      const question = await createMathQuestion({
        stage: gate.stage, ordinal: gate.ordinal, runKey: key,
      }, { signal: AbortSignal.timeout(5000) });
      if (key !== this.runKey || !this.alive) return;
      this.questions.set(index, question);
      this.view.run = {
        ...this.view.run,
        mechanisms: this.view.run.mechanisms.map((m) =>
          m.index === index ? { ...m, kind: question.mechanism, mechanic: question.mechanic } : m),
      };
      if (this.view.run.activeIndex === index && this.view.run.mode === 'focus') {
        this.view.question = question;
        this.view.run = { ...this.view.run, questionPoints: question.points };
        this.view.error = null;
      }
    } catch {
      if (key !== this.runKey || !this.alive) return;
      this.failedQuestions.add(index);
      if (this.view.run.activeIndex === index) {
        this.view.error = 'The mathematics engine did not return this puzzle. Retry the connection; the chase remains live.';
      }
    } finally {
      if (key === this.runKey && this.alive) {
        this.fetching.delete(index);
        if (this.view.run.activeIndex === index) this.view.loading = false;
        this.publish();
      }
    }
  };

  private sendAttempt = async (attempt: Attempt) => {
    if (this.locked || this.view.run.mode !== 'focus') return;
    this.locked = true;
    this.view.submitting = true;
    this.view.error = null;
    this.publish();
    const key = this.runKey;
    try {
      const result = await submitMathAnswer({
        questionId: attempt.questionId, answer: attempt.answer, attemptId: attempt.attemptId,
      }, { signal: AbortSignal.timeout(5000) });
      if (!this.alive || key !== this.runKey || this.view.run.mode !== 'focus' ||
          this.view.run.activeIndex !== attempt.index ||
          this.view.question?.id !== result.questionId || result.attemptId !== attempt.attemptId) return;
      const apply = () => {
        if (this.view.run.mode !== 'focus' || this.view.run.activeIndex !== attempt.index) return;
        const correct = result.correct || result.solved;
        const previousCount = this.view.run.correct;
        const previousHits = this.view.run.levelSixCorrect;
        this.view.run = resolveAnswer(this.view.run, correct, result.effect ?? undefined, result.points, result.timeBonus);
        if (!correct && this.view.run.mode !== 'over') playGameEventSound('wrong');
        if (this.view.run.mode === 'over') playGameEventSound('death');
        // Strikes and the final fanfare are cued by the canvas when the blow lands, so they pause with the run.
        if (this.view.run.correct > previousCount && this.view.run.correct <= CLOCK_ASSEMBLY_COUNT) playClockSound('repair');
        else if (this.view.run.levelSixCorrect === 1 && previousHits === 0) playClockSound('power');
        this.view.feedback = result.correct ? null : 'WRONG';
        const bonus = rewardedTimeBonus(result.timeBonus);
        if (correct && bonus > 0) this.view.bonus = { seconds: bonus, id: ++this.bonusId };
        this.pending = null;
        if (result.solved || this.view.run.mode === 'over' || this.view.run.mode === 'won') {
          this.view.question = null;
          this.view.feedback = null;
          this.input = { ...EMPTY_INPUT };
        }
        if (this.view.run.mode === 'over' || this.view.run.mode === 'won') this.record();
      };
      // A reply that lands while paused is applied on resume (idempotency unchanged).
      if (this.view.run.paused) this.deferred = apply; else apply();
    } catch (error) {
      if (key !== this.runKey || !this.alive || this.view.run.mode !== 'focus') return;
      if (typeof error === 'object' && error && 'status' in error && error.status === 404) {
        this.pending = null;
        this.questions.delete(attempt.index);
        this.view.question = null;
        this.view.error = 'This puzzle expired after the engine restarted. Retry to reconnect to the mechanism.';
      } else {
        this.view.error = "Couldn't check that answer. Retry safely with the same attempt; no heart will be removed.";
      }
    } finally {
      if (key === this.runKey && this.alive) {
        this.locked = false;
        this.view.submitting = false;
        this.publish();
      }
    }
  };

  actions: GameActions = {
    start: () => {
      if (!this.view.engineReady) { void this.connect(); return; }
      stopClockSound();
      unlockClockAudio();
      playClockSound('intro');
      this.runKey = crypto.randomUUID();
      this.questions.clear();
      this.fetching.clear();
      this.failedQuestions.clear();
      this.pending = null;
      this.locked = false;
      this.input = { ...EMPTY_INPUT };
      this.view = {
        ...this.view, runNumber: this.view.runNumber + 1, run: beginRun(createStageRun(this.startStage)), question: null, loading: false,
        submitting: false, feedback: null, error: null, bonus: null,
      };
      this.deferred = null;
      for (const gate of this.view.run.mechanisms.slice(0, 3)) void this.loadQuestion(gate.index);
      this.publish();
    },
    startAtStage: (stage) => {
      this.startStage = Math.max(1, Math.min(6, Math.floor(stage) || 1));
      this.actions.start();
    },
    answer: (answer) => {
      const { question, run } = this.view;
      if (!question || run.mode !== 'focus' || run.paused || run.activeIndex === null || this.locked || this.pending) return;
      const attempt = {
        questionId: question.id, answer, attemptId: crypto.randomUUID(), index: run.activeIndex,
      };
      this.pending = attempt;
      void this.sendAttempt(attempt);
    },
    retry: () => {
      if (this.view.run.mode !== 'focus') { void this.connect(); return; }
      if (this.pending) { void this.sendAttempt(this.pending); return; }
      if (this.view.run.activeIndex !== null) void this.loadQuestion(this.view.run.activeIndex, true);
    },
    control: (action, pressed) => {
      if (this.view.run.mode === 'playing' && !this.view.run.paused) this.input[action] = pressed;
      else this.input = { ...EMPTY_INPUT };
    },
    pause: (paused) => {
      const run = this.view.run;
      const next = setPaused(run, paused ?? !run.paused);
      if (next === run) return;
      this.view.run = next;
      if (next.paused) stopClockSound();
      this.input = { ...EMPTY_INPUT };
      if (!next.paused && this.deferred) { const apply = this.deferred; this.deferred = null; apply(); }
      this.publish();
    },
    menu: () => {
      stopClockSound();
      this.record();
      this.startStage = 1;
      this.runKey = crypto.randomUUID();
      this.view = {
        ...this.view, run: createRun('menu'), question: null, error: null, feedback: null,
        submitting: false, loading: false, bonus: null,
      };
      this.deferred = null;
      this.input = { ...EMPTY_INPUT };
      this.questions.clear();
      this.fetching.clear();
      this.failedQuestions.clear();
      this.locked = false;
      this.pending = null;
      this.publish();
    },
  };

  private tick = (now: number) => {
    const dt = this.lastTime === 0 ? 0 : Math.min(0.15, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const oldMode = this.view.run.mode;
    const jumping = oldMode === 'playing' && !this.view.run.paused &&
      this.view.run.player.grounded && this.input.jump && !this.view.run.jumpHeld;
    this.view.run = stepRun(this.view.run, this.input, dt);
    const { run } = this.view;
    if (jumping && run.player.vy < 0 && !run.player.grounded) playGameEventSound('jump');
    if (run.mode === 'focus' && oldMode !== 'focus') {
      this.input = { ...EMPTY_INPUT };
      this.view.feedback = null;
      const index = run.activeIndex!;
      this.view.question = this.questions.get(index) ?? null;
      if (this.view.question) this.view.run = { ...this.view.run, questionPoints: this.view.question.points };
      this.view.loading = !this.view.question;
      this.view.error = null;
      if (!this.view.question) void this.loadQuestion(index, true);
    }
    if (run.mode === 'playing') {
      // Keep only the imminent route prefetched; mathematical generation always
      // remains a real Haskell request even far into mixed survival.
      const gate = run.mechanisms.find((m) => !m.solved);
      if (gate) {
        for (let i = gate.index; i <= gate.index + 2; i++) {
          if (!this.questions.has(i) && !this.fetching.has(i) && !this.failedQuestions.has(i)) void this.loadQuestion(i);
        }
        for (const i of this.questions.keys()) if (i < gate.index - 2) this.questions.delete(i);
      }
    }
    if (run.mode === 'over' && oldMode !== 'over') {
      playGameEventSound('death');
      this.input = { ...EMPTY_INPUT };
      this.view.question = null;
      this.view.feedback = null;
      this.pending = null;
      this.view.submitting = false;
      this.record();
    }
    if (now - this.lastPublish > 30 || oldMode !== run.mode) {
      this.lastPublish = now;
      this.publish();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private keys: Record<string, keyof Input> = {
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
  };
  private keydown = (event: KeyboardEvent) => {
    if ((this.view.run.mode === 'menu' || this.view.run.mode === 'over' ||
        (this.view.run.mode === 'won' && this.view.run.celebration >= CLOCK_CELEBRATION_SECONDS)) &&
        event.code === 'Enter' && !event.repeat) {
      // Let native buttons handle Enter themselves if they own keyboard focus.
      if ((event.target as HTMLElement)?.tagName === 'BUTTON') return;
      event.preventDefault(); this.actions.start(); return;
    }
    if (event.code === 'KeyP' && !event.repeat &&
        ['intro', 'playing', 'focus', 'won'].includes(this.view.run.mode)) {
      event.preventDefault(); this.actions.pause(); return;
    }
    if (event.code === 'Escape' && !event.repeat &&
        ['intro', 'playing', 'focus', 'won'].includes(this.view.run.mode)) {
      event.preventDefault(); this.actions.pause(true); return;
    }
    if (this.view.run.paused) return;
    const action = this.keys[event.code];
    if (action && this.view.run.mode === 'playing') {
      event.preventDefault();
      this.input[action] = true;
    }
  };
  private keyup = (event: KeyboardEvent) => {
    const action = this.keys[event.code];
    if (action) this.input[action] = false;
    if (['KeyW', 'ArrowUp'].includes(event.code)) this.input.jump = false;
  };
  private blur = () => { this.input = { ...EMPTY_INPUT }; };
  /** Hiding the tab pauses the run automatically. */
  private visibility = () => { if (document.hidden) this.actions.pause(true); };

  mount() {
    this.alive = true;
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
    this.frame = requestAnimationFrame(this.tick);
    void this.connect();
  }
  destroy() {
    stopClockSound();
    this.alive = false;
    this.runKey = crypto.randomUUID();
    cancelAnimationFrame(this.frame);
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
  }
}
