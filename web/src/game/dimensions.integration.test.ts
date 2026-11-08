import assert from 'node:assert/strict';
import { LambdaController } from './controller';
import { hasGround } from './simulation';
import { placedSegments } from './level';

Object.assign(globalThis, {
  window: new EventTarget(), localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
});
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => originalFetch(
  typeof url === 'string' && url.startsWith('/') ? `${process.env.LAMBDA_API ?? 'http://localhost:8080'}${url}` : url, options);
const game = new LambdaController(() => {});
let now = 1000;
const step = () => { now += 1000 / 60; (game as unknown as { tick: (now: number) => void }).tick(now); };
async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 500; i++) { if (condition()) return; await new Promise(r => setTimeout(r, 5)); }
  throw new Error('Timed out waiting for the actual Haskell controller');
}
/** Run left until a checkpoint opens its shared question panel. */
async function approach() {
  for (let frame = 0; frame < 600 && game.view.run.mode === 'intro'; frame++) step();
  game.actions.control('left', true);
  for (let frame = 0; frame < 1500 && game.view.run.mode === 'playing'; frame++) {
    const x = game.view.run.player.x;
    const obstacle = placedSegments(x - 180, x + 20).some(seg => seg.type === 'obstacle' && seg.obstacle !== 'conveyor');
    game.actions.control('jump', obstacle ? frame % 24 < 12 : frame % 48 > 12); step();
  }
  game.actions.control('left', false);
  game.actions.control('jump', false);
}
async function focus() {
  await approach();
  assert.equal(game.view.run.mode, 'focus');
  await waitFor(() => game.view.question !== null);
}
function correctAnswer() {
  const q = game.view.question!;
  let expected: string;
  if (q.topic === 'Power rule') {
    const [, a, n] = q.prompt.match(/(\d*)x\^(\d+)/)!;
    expected = `${+(a || 1) * +n}x${+n - 1 === 1 ? '' : `^${+n - 1}`}`;
  } else if (q.topic === 'Quadratic differentiation') {
    const [, b] = q.prompt.match(/x\^2 \+ (\d*)x/)!;
    expected = `2x + ${+(b || 1)}`;
  } else if (q.topic === 'Velocity over time') {
    const [, a, b] = q.prompt.match(/s\(t\)=(\d*)t\^2\+(\d*)t/)!;
    expected = String(2 * +(a || 1) + +(b || 1));
  } else if (q.topic === 'Simple gradients') {
    const [, a] = q.prompt.match(/f\(x\)=(\d*)x\^2/)!;
    expected = String(2 * +(a || 1));
  } else if (q.topic === 'Chain rule') {
    const [, a, b, n] = q.prompt.match(/\((\d+)x\+(\d+)\)\^(\d+)/)!;
    expected = `${+a * +n}(${a}x+${b})${+n - 1 === 1 ? '' : `^${+n - 1}`}`;
  } else if (q.topic === 'Product rule') {
    const [, b] = q.prompt.match(/x\(x\+(\d+)\)/)!;
    expected = `2x + ${+b}`;
  } else if (q.topic === 'Vector addition') {
    const arrays = [...q.prompt.matchAll(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g)]
      .map(match => match[1].split('\\\\').map(Number));
    expected = `\\begin{bmatrix}${arrays[0].map((v, i) => v + arrays[1][i]).join(' \\\\ ')}\\end{bmatrix}`;
  } else throw new Error(`Unexpected test topic ${q.topic}`);
  assert(q.choices.includes(expected), `${q.topic}: expected ${expected}`);
  game.actions.answer(expected);
}

await game.connect(); game.actions.start();
for (let i = 0; i < 6; i++) {
  await focus();
  correctAnswer();
  await waitFor(() => game.view.run.mode === 'playing');
  assert.equal(game.view.run.correct, i + 1);
  if (i === 5) {
    const m = game.view.run.mechanisms.find(m => m.index === i)!;
    assert(m.motion && m.motion.duration === 2 && m.motion.velocity > 0);
  }
}
assert.equal(game.view.run.stage, 3);
assert.equal(game.view.run.perspective, '2d', 'later maths stays in the same 2D run');
// The first vector checkpoint opens immediately, without a perspective switch.
await approach();
assert.equal(game.view.run.perspective, '2d');
assert.equal(game.view.run.mode, 'focus');
assert.equal(game.view.run.activeIndex, 6);
for (let i = 0; i < 60 && !game.view.question; i++) { step(); await new Promise(r => setTimeout(r, 5)); }
assert.equal(game.view.question!.dimensions, 3);
// Submit through exactly the same controller action as 2D.
const hearts = game.view.run.health;
game.actions.answer('deliberately wrong');
await waitFor(() => !game.view.submitting);
assert.equal(game.view.run.health, hearts - 1);
assert.equal(game.view.run.mode, 'focus');
correctAnswer();
await waitFor(() => game.view.run.mode === 'playing');
game.actions.control('left', false);
assert.equal(game.view.run.health, hearts - 1, 'correct answer preserves the same hearts as 2D');
assert(game.view.bonus && game.view.bonus.seconds > 0, 'Haskell time bonus for a vector answer in 2D');
const zBefore = game.view.run.player.z;
game.actions.control('jump', true);
for (let i = 0; i < 60; i++) step();
game.actions.control('jump', false);
assert.equal(game.view.run.player.z, zBefore, '2D controls never introduce depth movement');
for (let i = 0; i < 90; i++) step();
const bridge = game.view.run.mechanisms.find(m => m.index === 6)!;
assert(bridge.vector?.displacement.length === 3);
assert(hasGround(game.view.run, bridge.x - 100), 'the Haskell-controlled bridge supports the 2D route');
game.destroy();
console.log('Live progression passed: six Haskell-backed spatial/time challenges, physical lift effects, continuous 2D progression and vector-controlled bridge support.');
