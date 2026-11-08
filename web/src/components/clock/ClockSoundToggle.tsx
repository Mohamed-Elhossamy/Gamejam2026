import { useState } from 'react';
import { clockMuted, setClockMuted, unlockClockAudio } from '@/game/clockAudio';
import './clock.css';

export default function ClockSoundToggle() {
  const [muted, setMuted] = useState(clockMuted);
  return <button type="button" className="gc-sound" aria-pressed={muted}
    aria-label={muted ? 'Enable clockwork sound' : 'Mute clockwork sound'} data-testid="button-sound"
    onClick={() => {
      const next = !muted;
      setClockMuted(next);
      setMuted(next);
      if (!next) unlockClockAudio();
    }}>
    SOUND {muted ? 'OFF' : 'ON'}
  </button>;
}
