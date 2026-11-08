/** Myinstants links; streamed, not bundled third-party recordings.
 * Page slugs: ricochet-35950, mario-jump, shinese-gong-11537,
 * heavenly-musiic-80491, gta-v-wasted-death-sound-8038. */
const URLS = {
  ricochet: 'https://www.myinstants.com/media/sounds/ricochet.mp3',
  jump: 'https://www.myinstants.com/media/sounds/maro-jump-sound-effect_1.mp3',
  gong: 'https://www.myinstants.com/media/sounds/shinese-gong.mp3',
  victory: 'https://www.myinstants.com/media/sounds/heavenly-music-gaming-sound-effect-hd-mp3cut.mp3',
  death: 'https://www.myinstants.com/media/sounds/gta-v-wasted-death-sound.mp3',
  pump: 'https://www.myinstants.com/media/sounds/12g-pumpfull.mp3',
  scream: 'https://www.myinstants.com/media/sounds/faaaaaaaaaaahhhhhhh-bass-boosted.mp3',
};
type Clip = keyof typeof URLS;
export type EventCue = Clip | 'wrong';
const clips = new Map<Clip, HTMLAudioElement>();
const active = new Set<HTMLAudioElement>();
let primed = false;
let wrongVersion = 0;
const RELOAD_HANDOFF_SECONDS = 0.45;

function getClip(name: Clip) {
  if (typeof Audio === 'undefined') return undefined;
  let audio = clips.get(name);
  if (!audio) {
    audio = new Audio(URLS[name]);
    audio.preload = 'auto';
    audio.volume = 0.5;
    audio.addEventListener('error', () => {
      active.delete(audio!);
      console.warn(`Could not load game sound: ${name}`);
    });
    clips.set(name, audio);
  }
  return audio;
}

export function unlockEventAudio() {
  if (primed || typeof Audio === 'undefined') return;
  primed = true;
  for (const name of Object.keys(URLS) as Clip[]) {
    const audio = getClip(name)!;
    // Some mobile browsers ignore volume=0. Keep priming explicitly muted;
    // only an actual gameplay cue is allowed to unmute its recording.
    audio.muted = true;
    audio.volume = 0;
    void audio.play().then(() => {
      if (!active.has(audio)) {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = true;
        audio.volume = 0.5;
      }
    }).catch(() => { primed = false; });
  }
}

export function playEventAudio(cue: EventCue, ended?: () => void) {
  if (cue === 'wrong') {
    const version = ++wrongVersion;
    for (const name of ['pump', 'scream'] as const) {
      const previous = clips.get(name);
      if (previous) {
        previous.onended = null;
        previous.ontimeupdate = null;
        previous.pause();
        previous.currentTime = 0;
        active.delete(previous);
      }
    }
    let handedOff = false;
    const handOff = () => {
      if (version !== wrongVersion || handedOff) return;
      handedOff = true;
      const pump = clips.get('pump');
      if (pump) {
        pump.onended = null;
        pump.ontimeupdate = null;
        pump.pause();
        active.delete(pump);
      }
      playEventAudio('scream');
    };
    playEventAudio('pump', handOff);
    const pump = clips.get('pump');
    if (pump) pump.ontimeupdate = () => {
      // Use actual playback time, so loading delays don't start the scream first.
      if (pump.currentTime >= RELOAD_HANDOFF_SECONDS) handOff();
    };
    return;
  }
  const audio = getClip(cue);
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.loop = cue === 'victory';
  active.add(audio);
  audio.muted = false;
  audio.volume = cue === 'jump' ? 0.35 : 0.5;
  audio.onended = () => { active.delete(audio); ended?.(); };
  void audio.play().catch(() => {
    active.delete(audio);
    console.warn(`Could not play game sound: ${cue}`);
  });
}

export function stopEventAudio() {
  wrongVersion++;
  for (const audio of clips.values()) {
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.muted = true;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    active.delete(audio);
  }
}
