import { strict as assert } from 'node:assert';
import { playEventAudio, stopEventAudio, unlockEventAudio } from './eventAudio';

class FakeAudio {
  static all: FakeAudio[] = [];
  static started: string[] = [];
  static audible: string[] = [];
  muted = false;
  volume = 1;
  preload = '';
  currentTime = 0;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  paused = true;
  loop = false;
  constructor(public src: string) { FakeAudio.all.push(this); }
  addEventListener() {}
  play() {
    this.paused = false;
    FakeAudio.started.push(this.src);
    // Model mobile browsers where volume=0 is not sufficient for silence.
    if (!this.muted) FakeAudio.audible.push(this.src);
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
Object.assign(globalThis, { Audio: FakeAudio });
unlockEventAudio();
assert.equal(FakeAudio.audible.length, 0, 'Unlocking must never audibly preview any sound effect');
await Promise.resolve();
assert.equal(FakeAudio.all.length, 7);
assert(FakeAudio.all.every(audio => audio.paused && audio.volume === 0.5));
assert(FakeAudio.all.every(audio => audio.muted), 'Unused primed clips stay muted until their event occurs');
FakeAudio.started = [];
for (const cue of ['ricochet', 'jump', 'gong', 'victory', 'death'] as const) playEventAudio(cue);
assert.equal(FakeAudio.started.length, 5);
assert(FakeAudio.started[0].endsWith('/ricochet.mp3'));
assert(FakeAudio.started[1].endsWith('/maro-jump-sound-effect_1.mp3'));
assert(FakeAudio.started[2].endsWith('/shinese-gong.mp3'));
assert(FakeAudio.started[3].endsWith('/heavenly-music-gaming-sound-effect-hd-mp3cut.mp3'));
assert(FakeAudio.started[4].endsWith('/gta-v-wasted-death-sound.mp3'));
assert(FakeAudio.all[3].loop, 'Heavenly music loops for the entire victory screen');
assert(FakeAudio.all.filter((_, index) => index !== 3).every(audio => !audio.loop), 'Other effects remain one-shot');
playEventAudio('wrong');
assert.equal(FakeAudio.started.length, 6);
assert(FakeAudio.started[5].endsWith('/12g-pumpfull.mp3'), 'Reload plays first');
FakeAudio.all[5].currentTime = 0.44;
FakeAudio.all[5].ontimeupdate?.();
assert.equal(FakeAudio.started.length, 6, 'Reload is audible before the handoff');
FakeAudio.all[5].currentTime = 0.45;
FakeAudio.all[5].ontimeupdate?.();
assert(FakeAudio.started[6].endsWith('/faaaaaaaaaaahhhhhhh-bass-boosted.mp3'), 'Scream starts after 0.45 seconds without waiting for the full reload');
assert(FakeAudio.all[5].paused, 'Reload tail is cut off at handoff');
playEventAudio('wrong');
assert(FakeAudio.all[6].paused, 'Another wrong answer cancels the previous scream');
const staleEnd = FakeAudio.all[5].onended;
const staleTimeUpdate = FakeAudio.all[5].ontimeupdate;
stopEventAudio();
const count = FakeAudio.started.length;
staleEnd?.();
FakeAudio.all[5].currentTime = 0.5;
staleTimeUpdate?.();
assert.equal(FakeAudio.started.length, count, 'Stopping prevents the queued scream from leaking into death/menu');
FakeAudio.all[5].currentTime = 0;
assert(FakeAudio.all.every(audio => audio.paused && audio.currentTime === 0));
assert(FakeAudio.all.every(audio => !audio.loop), 'Leaving or restarting clears victory looping');
console.log('Event audio: requested clips, reload → scream sequence, repeated wrong answers and cancellation passed.');
