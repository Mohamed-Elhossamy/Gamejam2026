import assert from 'node:assert/strict';
import { placedSegments, type PlacedSegment } from './level';
import { jumpBlockHeight, spikeTriangles, touchesSpikes } from './obstacles';
import { createRun, EMPTY_INPUT, FLOOR, PLAYER_H, PLAYER_W, stepRun } from './simulation';

const course = placedSegments(-30000, 0);
const allowed = new Set(['spike-strip', 'jump-block', 'bridge-gap']);
for (const segment of course)
  if (segment.type === 'obstacle') assert(allowed.has(segment.obstacle), `${segment.obstacle} is not a readable course obstacle`);
const spikes = course.filter(s => s.type === 'obstacle' && s.obstacle === 'spike-strip');
const blocks = course.filter(s => s.type === 'obstacle' && s.obstacle === 'jump-block');
assert(spikes.length > 10 && blocks.length > 10);
assert(new Set(blocks.map(jumpBlockHeight)).size >= 3, 'course includes distinct stepped heights');

const triangle = { type: 'obstacle', obstacle: 'spike-strip', worldStart: 0, worldEnd: 26 } as PlacedSegment;
assert(!touchesSpikes(triangle, { x: 15, y: FLOOR - PLAYER_H - 30 }, PLAYER_W, PLAYER_H, FLOOR),
  'passing above the sloping edge does not hit an invisible rectangle');
assert(touchesSpikes(triangle, { x: 0, y: FLOOR - PLAYER_H }, PLAYER_W, PLAYER_H, FLOOR));
assert.deepEqual(spikeTriangles(triangle), spikeTriangles(triangle), 'spikes have no timed retraction or random geometry');

function at(x: number) {
  const run = createRun('playing');
  run.player.x = x;
  const support = Math.max(0, ...blocks.filter(b => x + PLAYER_W / 2 > b.worldStart &&
    x + PLAYER_W / 2 < b.worldEnd).map(jumpBlockHeight));
  run.player.y = FLOOR - support - PLAYER_H;
  run.monsterX = 1e7;
  run.mechanisms = run.mechanisms.map(m => ({ ...m, solved: true, animation: 1 }));
  return run;
}
for (const fps of [30, 60, 144]) {
  for (const boost of [0, 3]) {
    for (const spike of spikes.slice(0, 4)) {
      let run = at(spike.worldEnd + 50);
      run.boost = boost;
      for (let frame = 0; frame < Math.round(fps * 0.65); frame++) {
        run = stepRun(run, { ...EMPTY_INPUT, left: true, jump: frame === 0 }, 1 / fps);
        assert.equal(run.stumble, 0, 'a clear jump never triggers spike knockback');
        assert.equal(run.health, 5);
      }
      assert(run.player.x + PLAYER_W < spike.worldStart, 'normal and boosted jumps clear each visible spike group');
    }
  }
  for (const block of blocks.slice(0, 5)) {
    let standing = at((block.worldStart + block.worldEnd) / 2 - PLAYER_W / 2);
    standing.player.y = FLOOR - jumpBlockHeight(block) - PLAYER_H;
    const expectedY = standing.player.y;
    for (let frame = 0; frame < fps; frame++) {
      standing = stepRun(standing, EMPTY_INPUT, 1 / fps);
      assert(Math.abs(standing.player.y - expectedY) < 1e-7, 'standing on a block never jitters or drops through');
      assert(standing.player.grounded);
    }
    let stopped = at(block.worldEnd + 20);
    for (let frame = 0; frame < fps / 2; frame++)
      stopped = stepRun(stopped, { ...EMPTY_INPUT, left: true }, 1 / fps);
    assert(Math.abs(stopped.player.x - block.worldEnd) < 1e-7, 'a solid side stops λ without teleporting or clipping');
    assert.equal(stopped.stumble, 0);
    const precedingStep = blocks.some(b => Math.abs(b.worldStart - block.worldEnd) < 1e-6);
    // Start on the real runway, not inside the preceding spike cluster.
    let jumping = at(block.worldEnd + (precedingStep ? 95 : 65));
    for (let frame = 0; frame < fps * 1.2; frame++)
      jumping = stepRun(jumping, { ...EMPTY_INPUT, left: true, jump: frame === 0 }, 1 / fps);
    assert(jumping.player.x + PLAYER_W < block.worldStart,
      `timed step jump: fps=${fps}, height=${jumpBlockHeight(block)}, x=${jumping.player.x}, left=${block.worldStart}, end=${block.worldEnd}, y=${jumping.player.y}, mode=${jumping.mode}, stumble=${jumping.stumble}`);
  }
}
console.log('Readable course passed: permanent triangle spikes, no abstract/timed hazards, varied solid steps, clean base/boost jumps, stable landings and solid sides at 30/60/144 fps.');
