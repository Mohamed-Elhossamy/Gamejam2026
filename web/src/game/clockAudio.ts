import { playEventAudio, stopEventAudio, unlockEventAudio, type EventCue } from './eventAudio';
import { duckBackgroundMusic, muteBackgroundMusic, stopBackgroundMusic, unlockBackgroundMusic } from './backgroundMusic';

/** Synthesized clockwork cues plus selected remote event recordings. */
type Cue = 'intro' | 'repair' | 'victory' | 'power' | 'hit';
let context: AudioContext | null = null;
let muted: boolean | null = null;
const nodes = new Set<OscillatorNode>();
const circusNodes = new Set<OscillatorNode>();
const KEY = 'lambda-clock-muted';

export function clockMuted() {
  if (muted === null) {
    try { muted = localStorage.getItem(KEY) === 'true'; } catch { muted = false; }
  }
  return muted;
}

export function stopClockSound() {
  stopEventAudio();
  stopBackgroundMusic();
  for (const node of nodes) { try { node.stop(); } catch { /* Already ended. */ } }
  nodes.clear();
  circusNodes.clear();
}

export function setClockMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(KEY, String(value)); } catch { /* Optional preference storage. */ }
  if (value) stopClockSound();
  muteBackgroundMusic(value);
}

/** Call directly from the user's Play/unmute gesture to unlock browser audio. */
export function unlockClockAudio() {
  muteBackgroundMusic(clockMuted());
  if (!clockMuted()) { unlockEventAudio(); unlockBackgroundMusic(); }
  if (typeof window === 'undefined' || !window.AudioContext || clockMuted()) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch { /* Sound is optional; unsupported audio must not block a run. */ }
}

export function playGameEventSound(cue: EventCue | 'wrong') {
  if (clockMuted()) return;
  if (cue === 'wrong') { playCircus(); playEventAudio('wrong'); return; }
  if (cue === 'death') stopClockSound();
  playEventAudio(cue);
}

/** Quiet original calliope-style circus jingle, not a copied recording. */
function playCircus() {
  if (!context) return;
  for (const node of circusNodes) { try { node.stop(); } catch { /* ended */ } }
  circusNodes.clear();
  duckBackgroundMusic();
  const melody = [76, 75, 76, 72, 69, 72, 76, 79, 78, 79, 76, 72, 76, 79, 84, 83, 84, 79, 76, 72, 69, 71, 72, 74];
  const now = context.currentTime;
  for (const [index, note] of melody.entries()) {
    const start = now + index * 0.23;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(440 * 2 ** ((note - 69) / 12), start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.035, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.21);
    oscillator.connect(gain).connect(context.destination);
    nodes.add(oscillator); circusNodes.add(oscillator);
    oscillator.onended = () => {
      nodes.delete(oscillator); circusNodes.delete(oscillator);
      oscillator.disconnect(); gain.disconnect();
    };
    oscillator.start(start); oscillator.stop(start + 0.22);
  }
}

export function playClockSound(cue: Cue) {
  if (clockMuted()) return;
  if (cue === 'hit') { playEventAudio('ricochet'); return; }
  if (cue === 'intro') { playEventAudio('gong'); return; }
  if (cue === 'victory') { stopBackgroundMusic(); playEventAudio('victory'); return; }
  if (!context || clockMuted()) return;
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const notes = cue === 'power' ? [392, 523.25, 659.25, 783.99, 1046.5] : [523.25, 783.99];
  const now = context.currentTime;
  const duration = cue === 'power' ? 0.9 : 0.22;
  for (const [index, frequency] of notes.entries()) {
    const start = now + index * (cue === 'power' ? 0.07 : 0.055);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(reduced ? 0.016 : 0.035, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(context.destination);
    nodes.add(oscillator);
    oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
