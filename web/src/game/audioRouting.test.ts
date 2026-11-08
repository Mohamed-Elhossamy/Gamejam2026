import { strict as assert } from 'node:assert';
import { playClockSound, playGameEventSound, setClockMuted, unlockClockAudio } from './clockAudio';

const started: string[] = [];
const audible: string[] = [];
const oscillators: { stopped: boolean }[] = [];
class FakeAudio {
  paused = true;
  volume = 1;
  muted = false;
  currentTime = 0;
  preload = '';
  onended: (() => void) | null = null;
  constructor(public src: string) {}
  addEventListener() {}
  play() {
    this.paused = false;
    started.push(this.src);
    if (!this.muted) audible.push(this.src);
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
class FakeContext {
  currentTime = 0;
  destination = {};
  resume() { return Promise.resolve(); }
  createOscillator() {
    const oscillator = {
      stopped: false, type: 'sine', frequency: param(), onended: null,
      connect() { return this; }, disconnect() {}, start() {},
      stop(time?: number) { if (time === undefined) this.stopped = true; },
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  createGain() { return { gain: param(), connect() { return this; }, disconnect() {} }; }
}
Object.assign(globalThis, {
  Audio: FakeAudio, AudioContext: FakeContext, window: { AudioContext: FakeContext },
  localStorage: { getItem: () => null, setItem() {} },
});
unlockClockAudio();
assert.equal(audible.length, 0, 'Audio initialization must not audibly play the scream or any other cue');
playClockSound('intro');
assert.deepEqual(audible, ['https://www.myinstants.com/media/sounds/shinese-gong.mp3'],
  'Play/level entry has only the gong, even before audio priming completes');
await Promise.resolve();
assert.equal(audible.length, 1, 'Delayed priming completion must not expose other sounds');
started.length = 0;
playGameEventSound('wrong');
assert.equal(oscillators.length, 24, 'Wrong answer uses a quiet synthesized circus melody');
assert.equal(started.length, 1, 'Reload begins immediately alongside the quiet circus cue');
assert(started[0].endsWith('/12g-pumpfull.mp3'));
playGameEventSound('death');
assert(oscillators.every(node => node.stopped), 'Death cancels all remaining circus notes');
assert(started.at(-1)?.endsWith('/gta-v-wasted-death-sound.mp3'));
playClockSound('hit');
assert(started.at(-1)?.endsWith('/ricochet.mp3'));
playClockSound('intro');
assert(started.at(-1)?.endsWith('/shinese-gong.mp3'));
playClockSound('victory');
assert(started.at(-1)?.endsWith('/heavenly-music-gaming-sound-effect-hd-mp3cut.mp3'));
const count = started.length;
setClockMuted(true);
playGameEventSound('jump');
playGameEventSound('wrong');
playClockSound('intro');
assert.equal(started.length, count, 'Mute suppresses all new effects');
console.log('Audio routing: circus, death cancellation, boss/start/win clips and mute passed.');
