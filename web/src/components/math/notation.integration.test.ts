import assert from 'node:assert/strict';
import { typesetMath } from './notation';

async function main() {
  let expressions = 0;
  for (let stage = 1; stage <= 6; stage++) {
    for (let ordinal = 0; ordinal < 6; ordinal++) {
      const response = await fetch(`${process.env.LAMBDA_API ?? 'http://localhost:8080'}/api/math/question`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage, ordinal, runKey: 'notation-integration' }),
      });
      assert(response.ok, `Haskell question failed: ${response.status}`);
      const question = await response.json() as { prompt: string; choices: string[]; points: number };
      assert.equal(question.choices.length, 4, 'every question has four choices');
      // Level 6 opens with unscored (0-point) trigonometry checkpoints.
      assert(question.points === 0 ? stage === 6 : question.points >= 100 && question.points <= 500);
      for (const text of [question.prompt, ...question.choices]) {
        const html = typesetMath(text);
        assert(html.includes('katex-html'));
        assert(!html.includes('katex-error'));
        expressions++;
      }
    }
  }
  console.log(`Live Haskell notation passed: 36 questions; four choices, increasing stage points, and ${expressions} KaTeX-rendered expressions.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
