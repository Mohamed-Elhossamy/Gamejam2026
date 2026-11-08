import type { Run } from './contracts';

// The uploaded Grand Dark Waltz Allegro (Kevin MacLeod), 385.36 seconds.
// Passage boundaries follow 8-bar phrases at the recording's tagged 121 BPM.
const PHRASE = 24 * 60 / 121;
export const MUSIC_PASSAGES = {
  intro: [0, PHRASE * 2],
  focus: [PHRASE * 18, PHRASE * 20],
  boss: [PHRASE * 28, PHRASE * 32],
  stages: [2, 6, 10, 14, 22, 26].map(bar => [bar * PHRASE, (bar + 2) * PHRASE]),
};
let audio: HTMLAudioElement | null = null;
let passage = '';
let lastRun: Run | null = null;
let muted = false;
let duckUntil = 0;
let playPending = false;
let blocked = false;
let bounds = MUSIC_PASSAGES.intro;

export function musicSelection(run: Run) {
  const key = run.battle ? 'boss' : run.mode === 'intro' ? 'intro'
    : run.mode === 'focus' ? 'focus' : `stage-${run.stage}`;
  const range = run.battle ? MUSIC_PASSAGES.boss : run.mode === 'intro' ? MUSIC_PASSAGES.intro
    : run.mode === 'focus' ? MUSIC_PASSAGES.focus : MUSIC_PASSAGES.stages[Math.min(5, Math.max(0, run.stage - 1))];
  return { key, range, volume: run.mode === 'focus' ? 0.13 : run.battle ? 0.32 : 0.24 };
}

function ensureAudio() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio('/api/math/music');
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('error', () => console.warn('Background music could not be loaded'));
    audio.addEventListener('timeupdate', () => {
      if (audio && audio.currentTime >= bounds[1]) audio.currentTime = bounds[0];
    });
    audio.addEventListener('ended', () => {
      if (audio && lastRun && !lastRun.paused && !muted && ['intro', 'playing', 'focus'].includes(lastRun.mode)) {
        audio.currentTime = bounds[0];
        void audio.play().catch(() => console.warn('Background music could not resume'));
      }
    });
  }
  return audio;
}

export function unlockBackgroundMusic() { blocked = false; ensureAudio(); }
export function duckBackgroundMusic() { duckUntil = Date.now() + 6500; }
export function stopBackgroundMusic() { audio?.pause(); }
export function muteBackgroundMusic(value: boolean) {
  muted = value;
  if (lastRun) syncBackgroundMusic(lastRun);
}
export function syncBackgroundMusic(run: Run) {
  lastRun = run;
  if (muted || run.paused || !['intro', 'playing', 'focus'].includes(run.mode)) {
    audio?.pause();
    if (run.mode === 'menu' || run.mode === 'over' || run.mode === 'won') passage = '';
    return;
  }
  const player = ensureAudio();
  if (!player) return;
  const selected = musicSelection(run);
  if (passage !== selected.key) {
    passage = selected.key;
    bounds = selected.range;
    player.currentTime = bounds[0];
  }
  // Ease level changes and duck the waltz while the quiet clown cue plays.
  const target = selected.volume * (Date.now() < duckUntil ? 0.3 : 1);
  player.volume += (target - player.volume) * 0.12;
  if (player.paused && !playPending && !blocked) {
    playPending = true;
    void player.play().catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return; // pause/restart interrupted a pending play
      blocked = true;
      console.warn('Background music playback was blocked');
    }).finally(() => { playPending = false; });
  }
}
