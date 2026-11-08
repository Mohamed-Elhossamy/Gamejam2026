import assert from 'node:assert/strict';
import { mathParts, typesetMath } from './notation';
import { DECORATIVE_EQUATIONS } from './formulae';

const tex = (text: string, style: 'vector' | 'values' = 'vector') =>
  mathParts(text, style).filter(part => part.kind === 'math').map(part => part.tex).join(' ');
assert.equal(tex('3x^2 + 5x^3'), '3x^{2} + 5x^{3}');
assert.equal(tex('2x^2 + -8x'), '2x^{2} -8x');
assert(tex("Find f'(x) when f(x) = 2x^3.").includes('f^{\\prime}(x)'));
assert.equal(tex('[2, -3]'), '\\begin{pmatrix}2 \\\\ -3\\end{pmatrix}');
assert.equal(tex('[[1, 2], [3, 4]]'), '\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}');
assert.equal(tex('[2, 4]', 'values'), '\\left\\{2,\\;4\\right\\}');
assert(tex('1/3').includes('\\frac{1}{3}'));
assert(tex('d/dx').includes('\\frac{\\mathrm{d}}{\\mathrm{d}x}'));
assert(tex('(−y,x)').includes('\\begin{pmatrix}-y \\\\ x\\end{pmatrix}'));

const examples = [
  'Differentiate f(x) = 3x^4.', "Find f'(x) when f(x) = 2x^3 + 4x^2 + 3x + 5.",
  'Find the gradient of f(x) = 2x^2 + 3x + 1 at x = 2.',
  'Differentiate f(x) = (3x + 2)^4.', 'Differentiate f(x) = x^2(x + 3).',
  'At which x is f(x) = 2x^2 + -8x + 2 stationary?',
  'Calculate [2, 3] + [3, 2].', 'Calculate 2 × [3, -2].',
  'Find the magnitude of [3, 4].', 'Find [2, 3] · [2, -1].',
  'Calculate [[1, 2], [0, 1]] × [[1, 0], [3, 1]].',
  'Apply [[1, 2], [3, 0]] to [2, 1].', 'Find det [[2, 1], [3, 2]].',
  'Rotate [2, 3] by 90° anticlockwise about the origin.',
  'Reflect [2, 3] in the x-axis.',
  'For A = [[1, 2], [0, 1]], B = [[1, 0], [3, 1]], find AB − BA.',
  'Find the inverse of [[1, 3], [2, 7]].',
  'Find the eigenvalues of [[2, 3], [0, 4]].',
  'Which vector is an eigenvector of [[2, 3], [0, 4]] for eigenvalue 2?',
  'What is the dimension of span{[1,0,1], [0,1,1], [1,1,2]} over the real numbers?',
  "Use u'v + uv', or expand the product before differentiating.",
  'For a 2×2 matrix, determinant = ad − bc.',
  'A 90° anticlockwise rotation sends (x,y) to (−y,x).',
  'Solve (A − λI)v = 0. An eigenvector must be nonzero.',
  '[[1/2, -1/3], [2/5, 7/9]]', '12(3x + 2)^3',
  'Correct. Mechanism activated — run!',
];
for (const example of examples) {
  for (const part of mathParts(example)) {
    if (part.kind === 'text') assert(!part.text.includes('^') && !part.text.includes('\\'));
    else {
      const html = typesetMath(part.tex);
      assert(html.includes('katex-html'));
      assert(!html.includes('katex-error'));
    }
  }
}
assert(typesetMath(tex('3x^2')).includes('<msup>'));
assert(typesetMath(tex('1/3')).includes('<mfrac>'));
assert(typesetMath(tex('[[1,2],[3,4]]')).includes('<mtable'));
for (const formula of DECORATIVE_EQUATIONS) assert(typesetMath(formula).includes('katex-html'));
console.log(`Notation passed: ${examples.length} engine-format examples; proper powers, primes, fractions, column vectors, matrices, eigenvalue sets and accessible MathML.`);
