/**
 * The 2D route is deliberately just data.  Sections are read from right to left
 * (lambda's direction of travel) and always finish at a checkpoint.  Change the
 * arrays below to reorder the first-draft map without changing simulation or
 * rendering code.
 */
export type ObstacleKind =
  | 'bridge-gap' | 'gear-platform' | 'collapsing-grate'
  | 'conveyor' | 'steam-vent' | 'timed-shutter-platform' | 'spike-strip' | 'jump-block';

type SegmentBase = { width: number; label?: string };
export type GroundSegment = SegmentBase & { type: 'ground' };
export type GapSegment = SegmentBase & { type: 'gap'; pit?: boolean };
export type SlopeSegment = SegmentBase & { type: 'slope'; rise: number };
export type ObstacleSegment = SegmentBase & {
  type: 'obstacle'; obstacle: ObstacleKind;
  /** Optional world offset from the owning checkpoint; keeps mechanism features declarative. */
  anchorOffset?: number;
  height?: number;
};
export type CheckpointSegment = SegmentBase & { type: 'checkpoint' };
export type LevelSegment = GroundSegment | GapSegment | SlopeSegment | ObstacleSegment | CheckpointSegment;
export type LevelSection = { id: string; segments: readonly LevelSegment[] };
export type PlacedSegment = LevelSegment & {
  sectionId: string; sectionIndex: number; segmentIndex: number;
  /** Inclusive left and exclusive right world x bounds. */
  xStart: number; xEnd: number;
  /** Checkpoint ordinal, or the ordinal of the checkpoint which owns an obstacle. */
  mechanismIndex: number | null;
  /** Visual/collision range; normally identical to xStart/xEnd. */
  worldStart: number; worldEnd: number;
};

const g = (width: number, label?: string): GroundSegment => ({ type: 'ground', width, label });
const o = (width: number, obstacle: ObstacleKind, label?: string, anchorOffset?: number): ObstacleSegment =>
  ({ type: 'obstacle', width, obstacle, label, anchorOffset });
const checkpoint = (): CheckpointSegment => ({ type: 'checkpoint', width: 25 });
const block = (width: number, height: number): ObstacleSegment =>
  ({ type: 'obstacle', obstacle: 'jump-block', width, height, label: 'solid jump block' });

/** First checkpoint is intentionally close; later sections repeat endlessly. */
export const levelSections: readonly LevelSection[] = [
  { id: 'arrival', segments: [g(415, 'opening runway'), g(160), g(100), checkpoint()] },
  // The 25 px bridge lip means its visual range remains m.x - 240 .. m.x + 25.
  { id: 'bridge-run', segments: [
    o(265, 'bridge-gap', 'matrix/vector bridge opening', -240), g(100), g(130), g(130),
    o(70, 'spike-strip', 'permanent red spikes'), g(20), g(130),
    block(140, 48), g(270, 'safe checkpoint landing'), checkpoint(),
  ] },
  { id: 'second-bridge-run', segments: [
    o(265, 'bridge-gap', 'matrix/vector bridge opening', -240), g(100), g(130), g(160),
    o(80, 'spike-strip', 'triple spike jump'), g(110),
    block(70, 40), block(70, 72), g(270, 'safe checkpoint landing'), checkpoint(),
  ] },
  { id: 'spike-and-steps', segments: [
    o(265, 'bridge-gap', 'matrix/vector bridge opening', -240), g(100), g(130), g(150),
    o(80, 'spike-strip', 'permanent spike cluster'), g(120),
    block(70, 28), block(70, 56), g(270, 'safe checkpoint landing'), checkpoint(),
  ] },
  { id: 'late-rhythm', segments: [
    o(265, 'bridge-gap', 'matrix/vector bridge opening', -240), g(100), g(130), g(100),
    o(50, 'spike-strip', 'first rhythm jump'), g(240, 'recovery runway'),
    o(50, 'spike-strip', 'second rhythm jump'), g(130),
    block(140, 48), g(270, 'safe checkpoint landing'), checkpoint(),
  ] },
] as const;

export const FIRST_DRAFT_LAYOUT = levelSections.map(section => `${section.id}: ${section.segments.map(s => s.type === 'obstacle' ? s.obstacle : s.type).join(' → ')}`);

function sectionFor(index: number) {
  if (index === 0) return levelSections[0];
  return levelSections[1 + ((index - 1) % (levelSections.length - 1))];
}

/** The final left edge of a section is its checkpoint's mechanism x. */
export function mechanismX(index: number) {
  let cursor = 0;
  for (let i = 0; i <= index; i++) for (const segment of sectionFor(i).segments) cursor -= segment.width;
  return cursor;
}

/** Deterministic world query used by the 2D renderer and collision system. */
export function placedSegments(fromX: number, toX: number): PlacedSegment[] {
  const low = Math.min(fromX, toX);
  const high = Math.max(fromX, toX);
  const result: PlacedSegment[] = [];
  let cursor = 0;
  for (let sectionIndex = 0; cursor > low - 1400; sectionIndex++) {
    const section = sectionFor(sectionIndex);
    const sectionStart = cursor;
    const sectionEnd = cursor - section.segments.reduce((sum, segment) => sum + segment.width, 0);
    for (let segmentIndex = 0; segmentIndex < section.segments.length; segmentIndex++) {
      const segment = section.segments[segmentIndex];
      const xEnd = cursor;
      const xStart = cursor - segment.width;
      cursor = xStart;
      const ownerIndex = segment.type === 'checkpoint' ? sectionIndex : segment.type === 'obstacle'
        ? segment.obstacle === 'bridge-gap' ? sectionIndex - 1 : sectionIndex : null;
      const ownerX = segment.type === 'obstacle' && segment.obstacle === 'bridge-gap' ? sectionStart : sectionEnd;
      const worldStart = segment.type === 'obstacle' && segment.anchorOffset !== undefined
        ? ownerX + segment.anchorOffset : xStart;
      const worldEnd = segment.type === 'obstacle' && segment.anchorOffset !== undefined
        ? worldStart + segment.width : xEnd;
      if (worldEnd >= low && worldStart <= high) result.push({
        ...segment, sectionId: section.id, sectionIndex, segmentIndex, xStart, xEnd,
        mechanismIndex: ownerIndex,
        worldStart, worldEnd,
      });
    }
  }
  return result;
}

export function checkpointPlacements(count: number) {
  return placedSegments(mechanismX(count - 1) - 1, 1)
    .filter((segment): segment is PlacedSegment & CheckpointSegment => segment.type === 'checkpoint')
    .sort((a, b) => (a.mechanismIndex ?? 0) - (b.mechanismIndex ?? 0));
}
