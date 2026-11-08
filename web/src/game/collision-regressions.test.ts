import assert from 'node:assert/strict';
import { createRun, EMPTY_INPUT, FLOOR, PLAYER_H, PLAYER_W, groundHeight, stepRun } from './simulation';
import { placedSegments } from './level';
import { jumpBlockHeight } from './obstacles';
import { advanceCharacterAnimations, createCharacterAnimationState, lambdaPose } from './sigma';

function clearRun(x: number) {
  const run = createRun('playing');
  run.player.x = x;
  run.monsterX = 1e7;
  run.mechanisms.forEach(m => { m.solved = true; m.animation = 1; });
  return run;
}
const blocks = placedSegments(-7000, 0).filter(s => jumpBlockHeight(s));
for (const fps of [30, 60, 144]) {
  // A descending foot already a few pixels inside a ramp must not fall through it.
  let ramp = clearRun(-800);
  ramp.mechanisms[0].slope = { kind: 'slope', atX: 1, gradient: 12 };
  ramp.player.y = groundHeight(ramp, ramp.player.x + PLAYER_W / 2) - PLAYER_H + 8;
  ramp.player.grounded = false;
  ramp.player.vy = 120;
  ramp = stepRun(ramp, EMPTY_INPUT, 1 / fps);
  assert(ramp.player.grounded, 'a penetrated trapezium/ramp resolves to its solid surface');
  assert.equal(ramp.player.y + PLAYER_H, groundHeight(ramp, ramp.player.x + PLAYER_W / 2));
  for (const boost of [0, 3]) {
    let run = clearRun(-620);
    run.boost = boost;
    run.mechanisms[0].slope = { kind: 'slope', atX: 1, gradient: 12 };
    let airborne = false, landed = false;
    for (let frame = 0; frame < fps * 1.2; frame++) {
      run = stepRun(run, { ...EMPTY_INPUT, left: true, jump: frame === 0 }, 1 / fps);
      airborne ||= !run.player.grounded;
      landed ||= airborne && run.player.grounded;
      assert(run.player.y + PLAYER_H <= groundHeight(run, run.player.x + PLAYER_W / 2) + 1e-6,
        'normal/boosted jumps cannot penetrate the ascending or descending ramp');
    }
    assert(airborne && landed, 'a real jump lands back on the shaped ground');
  }
  for (const block of blocks.slice(0, 6)) {
    let stopped = clearRun(block.worldEnd + 20);
    const approachSurface = Math.max(0, ...blocks.filter(b =>
      stopped.player.x + PLAYER_W / 2 > b.worldStart &&
      stopped.player.x + PLAYER_W / 2 < b.worldEnd).map(jumpBlockHeight));
    stopped.player.y = FLOOR - approachSurface - PLAYER_H;
    for (let frame = 0; frame < fps / 2; frame++)
      stopped = stepRun(stopped, { ...EMPTY_INPUT, left: true }, 1 / fps);
    assert.equal(stopped.player.x, block.worldEnd, 'running cannot climb or pass through a block');
    const top = FLOOR - jumpBlockHeight(block);
    let standing = clearRun((block.worldStart + block.worldEnd) / 2 - PLAYER_W / 2);
    standing.player.y = top - PLAYER_H;
    const animation = createCharacterAnimationState();
    for (let frame = 0; frame < fps * 2; frame++) {
      standing = stepRun(standing, EMPTY_INPUT, 1 / fps);
      advanceCharacterAnimations(animation, standing);
      assert.equal(standing.player.y + PLAYER_H, top);
      assert.equal(lambdaPose(standing, animation).hop, 0, 'rendered feet stay on the actual block top');
    }
    // Walk away from an isolated block, releasing all support once both feet leave.
    if (block === blocks[0]) {
      let leftTop = false;
      for (let frame = 0; frame < fps / 2; frame++) {
        standing = stepRun(standing, { ...EMPTY_INPUT, right: true }, 1 / fps);
        if (standing.player.x + 6 >= block.worldEnd) {
          leftTop = true;
          assert(standing.player.y + PLAYER_H > top, 'walking off a block starts falling instead of hovering');
        }
      }
      assert(leftTop);
    }
    let embedded = clearRun((block.worldStart + block.worldEnd) / 2);
    embedded = stepRun(embedded, EMPTY_INPUT, 1 / fps);
    assert(embedded.player.x >= block.worldEnd || embedded.player.x + PLAYER_W <= block.worldStart,
      'an embedded body is expelled rather than allowed to move through a block');
    assert(blocks.every(b => embedded.player.x + PLAYER_W <= b.worldStart ||
      embedded.player.x >= b.worldEnd || embedded.player.y + PLAYER_H <= FLOOR - jumpBlockHeight(b)),
    'recovering from one block cannot embed λ in an adjacent step');
  }
  for (const y of [FLOOR - PLAYER_H, 0, FLOOR + 20]) {
    let run = clearRun(-1000);
    run.monsterX = -900;
    run.player.y = y;
    run.player.grounded = y === FLOOR - PLAYER_H;
    for (let frame = 0; frame < fps && run.mode !== 'over'; frame++) {
      run = stepRun(run, { ...EMPTY_INPUT, right: true }, 1 / fps);
      assert(run.player.x + PLAYER_W <= run.monsterX + 1e-8, 'λ never crosses behind Σ, even above/below its body');
    }
    assert.equal(run.mode, 'over');
  }
  let recovery = clearRun(-1000);
  recovery.player.y = 601;
  recovery.player.grounded = false;
  recovery.monsterX = -900;
  recovery = stepRun(recovery, EMPTY_INPUT, 1 / fps);
  assert.equal(recovery.mode, 'over', 'a recovery across Σ is a catch, not an escape behind it');
  assert(recovery.player.x + PLAYER_W <= recovery.monsterX);
  assert.equal(recovery.health, 5, 'environment/catch handling does not deduct maths hearts');
}
console.log('Collision regressions passed: solid ramps, jump-only blocks, no visual hovering, walk-off gravity, overlap recovery and no crossing behind Sigma at 30/60/144fps.');
