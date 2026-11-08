import assert from 'node:assert/strict';
import { createStageRun, EMPTY_INPUT, stepRun, resolveAnswer, groundHeight } from './simulation';
import type { MathQuestion } from './contracts';
import type { AnswerResult } from '@lambda-rush/api-client';

const base = process.env.LAMBDA_API ?? 'http://localhost:8080';
const runKey = `level6-integration-${Date.now()}`;
async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${base}/api/math/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<T>;
}
const answers = ['128(2+8x)^{3}', '11', '34', '72(1+6x)^{3}', '3', 'y=\\sin(x)', '\\cos^2(\\theta)'];
let run = createStageRun(6);
for (let checkpoint = 0; checkpoint < 7; checkpoint++) {
  for (let frame = 0; frame < 1500 && run.mode === 'playing'; frame++) {
    run = stepRun(run, { ...EMPTY_INPUT, left: true }, 1 / 60);
    assert.equal(run.player.grounded, true, 'the mathematical route requires no invisible jumps');
    assert(Math.abs(run.player.y + 44 - groundHeight(run, run.player.x + 16)) < 1e-6);
  }
  assert.equal(run.mode, 'focus', `checkpoint ${checkpoint} is reachable with live pursuit`);
  const gate = run.mechanisms.find(m => m.index === run.activeIndex)!;
  const question = await post<MathQuestion>('question', { stage: 6, ordinal: gate.ordinal, runKey });
  assert(question.choices.includes(answers[gate.ordinal]));
  run = { ...run, mechanisms: run.mechanisms.map(m => m.index === gate.index ? { ...m, kind: question.mechanism, mechanic: question.mechanic } : m) };
  if (checkpoint === 0) {
    const wrong = await post<AnswerResult>('answer', { questionId: question.id, attemptId: 'wrong', answer: question.choices.find(a => a !== answers[gate.ordinal]) });
    run = resolveAnswer(run, wrong.correct);
    assert.equal(run.health, 4);
  }
  // Spend real simulation time on every question, with the chase still active.
  for (let frame = 0; frame < 120; frame++) run = stepRun(run, EMPTY_INPUT, 1 / 60);
  assert.equal(run.mode, 'focus');
  const request = { questionId: question.id, attemptId: 'correct', answer: answers[gate.ordinal] };
  const result = await post<AnswerResult>('answer', request);
  assert(result.correct);
  assert.deepEqual(await post<AnswerResult>('answer', request), result, 'retry returns the original verdict');
  run = resolveAnswer(run, result.correct, result.effect ?? undefined, result.points, result.timeBonus);
  assert.equal(run.correct - run.credited, Math.max(0, checkpoint - 1));
  assert.equal(run.score, Math.max(0, checkpoint - 1) * 500);
}
assert.equal(run.mode, 'won');
assert.equal(run.levelSixCorrect, 5);
assert.equal(run.health, 4);
console.log('Live Haskell Level 6 passed: all seven checkpoints traversed, exact effects, wrong answer, idempotent retry, no supplementary rewards, five-question victory.');
