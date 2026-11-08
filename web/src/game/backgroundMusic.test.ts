import { strict as assert } from 'node:assert';
import { MUSIC_PASSAGES, musicSelection, syncBackgroundMusic, muteBackgroundMusic } from './backgroundMusic';
import { createStageRun } from './simulation';

class FakeAudio {
  static all: FakeAudio[] = [];
  paused = true;
  volume = 1;
  currentTime = 0;
  preload = '';
  events = new Map<string, () => void>();
  constructor(public src: string) { FakeAudio.all.push(this); }
  addEventListener(name: string, callback: () => void) { this.events.set(name, callback); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
Object.assign(globalThis, { Audio: FakeAudio });
const run = createStageRun(1);
run.mode = 'playing';
syncBackgroundMusic(run);
const player = FakeAudio.all[0];
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
assert(!player.paused);
assert.equal(player.currentTime, MUSIC_PASSAGES.stages[0][0]);
const second = createStageRun(2);
second.mode = 'playing';
syncBackgroundMusic(second);
assert.equal(player.currentTime, MUSIC_PASSAGES.stages[1][0]);
const progress = player.currentTime + 4;
player.currentTime = progress;
syncBackgroundMusic({ ...second, paused: true });
assert(player.paused);
syncBackgroundMusic(second);
assert.equal(player.currentTime, progress, 'Pause/resume preserves the music position');
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
muteBackgroundMusic(true);
assert(player.paused);
muteBackgroundMusic(false);
assert(!player.paused);
syncBackgroundMusic({ ...second, mode: 'focus' });
assert.equal(player.currentTime, MUSIC_PASSAGES.focus[0]);
player.currentTime = MUSIC_PASSAGES.focus[1] + 1;
player.events.get('timeupdate')?.();
assert.equal(player.currentTime, MUSIC_PASSAGES.focus[0], 'Loops only the chosen passage');
syncBackgroundMusic({ ...second, mode: 'over' });
assert(player.paused);
for (const range of [...MUSIC_PASSAGES.stages, MUSIC_PASSAGES.intro, MUSIC_PASSAGES.focus, MUSIC_PASSAGES.boss]) {
  assert(range[0] >= 0 && range[1] < 385.35835 && range[1] > range[0]);
}
assert(musicSelection({ ...run, mode: 'focus' }).volume < musicSelection(run).volume);
console.log('Background music: per-level sections, quiet focus, looping, pause, mute and death passed.');
