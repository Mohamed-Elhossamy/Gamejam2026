import type { PlacedSegment } from './level';
import { MAP_SPIKE_HEIGHT } from './rules';

/** Drawing and collision share the same permanent triangle geometry. */
export function spikeTriangles(segment: PlacedSegment) {
  const width = segment.worldEnd - segment.worldStart;
  const count = Math.max(1, Math.round(width / 26));
  const pitch = width / count;
  return Array.from({ length: count }, (_, index) => ({
    left: segment.worldStart + index * pitch + 1,
    tip: segment.worldStart + (index + 0.5) * pitch,
    right: segment.worldStart + (index + 1) * pitch - 1,
  }));
}

export function touchesSpikes(segment: PlacedSegment, body: { x: number; y: number }, width: number, height: number, floor: number) {
  // Match λ's narrow silhouette rather than treating its empty glyph margins as solid.
  const left = body.x + 6, right = body.x + width - 6;
  const bottom = body.y + height - 1;
  return spikeTriangles(segment).some(triangle => {
    if (right <= triangle.left || left >= triangle.right || body.y >= floor - 4) return false;
    const nearest = Math.max(left, Math.min(right, triangle.tip));
    const half = (triangle.right - triangle.left) / 2;
    const heightAtContact = 4 + (MAP_SPIKE_HEIGHT - 4) * Math.max(0, 1 - Math.abs(nearest - triangle.tip) / half);
    return bottom > floor - heightAtContact;
  });
}

export function jumpBlockHeight(segment: PlacedSegment) {
  return segment.type === 'obstacle' && segment.obstacle === 'jump-block' ? segment.height ?? 48 : 0;
}
