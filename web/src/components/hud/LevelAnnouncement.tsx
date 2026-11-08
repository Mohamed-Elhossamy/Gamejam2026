import type { Run } from '@/game/contracts';

export const LEVEL_ANNOUNCEMENT_SECONDS = 4;

export default function LevelAnnouncement({ run, stageName }: {
  run: Run;
  stageName: (stage: number) => string;
}) {
  const event = run.levelTransition;
  if (!event || !['playing', 'focus'].includes(run.mode)) return null;
  const elapsed = run.time - event.time;
  if (elapsed < 0 || elapsed >= LEVEL_ANNOUNCEMENT_SECONDS) return null;
  const opacity = Math.min(1, elapsed / 0.16, (LEVEL_ANNOUNCEMENT_SECONDS - elapsed) / 0.3);
  return <section className="lx-level-announcement" role="status" aria-live="polite"
    aria-atomic="true" data-testid="level-announcement" style={{ opacity }}>
    <strong className="lx-level-announcement-title">LEVEL {event.to}</strong>
    <span className="lx-level-announcement-name">{stageName(event.to)}</span>
    <span className="lx-level-announcement-complete">Level {event.from} completed</span>
  </section>;
}
