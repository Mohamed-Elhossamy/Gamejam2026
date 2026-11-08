import katex from 'katex';

export type MathPart = { kind: 'text'; text: string } | { kind: 'math'; tex: string };
export type ListStyle = 'vector' | 'values';
type Token = { kind: 'text' | 'math'; value: string };

const operators: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', ln: '\\ln', log: '\\log',
  exp: '\\exp', det: '\\det', span: '\\operatorname{span}',
};
const symbols: Record<string, string> = {
  '×': '\\times ', '·': '\\cdot ', '−': '-', 'λ': '\\lambda ', 'Σ': '\\sum ',
  '∂': '\\partial ', '∫': '\\int ', '∞': '\\infty ', 'θ': '\\theta ',
  'π': '\\pi ', '→': '\\to ', '°': '{}^{\\circ}', '²': '^{2}', '³': '^{3}',
  '₁': '_{1}', '₂': '_{2}', '₃': '_{3}', '′': '^{\\prime}', "'": '^{\\prime}',
  '{': '\\{', '}': '\\}', '*': '\\cdot ',
};
const productWords = new Set(['AB', 'BA', 'ad', 'bc', 'uv', 'dx', 'dy', 'dz']);

function closing(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    if (text[i] === close && --depth === 0) return i;
  }
  throw new Error('Unclosed mathematical delimiter');
}

function splitCells(text: string): string[] {
  const cells: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if ('[({'.includes(text[i])) depth++;
    if ('])}'.includes(text[i])) depth--;
    if (text[i] === ',' && depth === 0) { cells.push(text.slice(start, i).trim()); start = i + 1; }
  }
  cells.push(text.slice(start).trim());
  return cells;
}

function expression(text: string): string {
  return lex(text, 'vector').map(token => {
    if (token.kind === 'math') return token.value;
    if (/^\s*$/.test(token.value)) return ' ';
    throw new Error('Unexpected prose inside a mathematical array');
  }).join('');
}

function arrayTex(raw: string, style: ListStyle): string {
  const cells = splitCells(raw.slice(1, -1));
  if (!cells.length || cells.some(cell => !cell)) throw new Error('Empty mathematical array');
  if (cells.every(cell => cell.startsWith('[') && cell.endsWith(']'))) {
    const rows = cells.map(cell => splitCells(cell.slice(1, -1)));
    if (rows.some(row => row.length !== rows[0].length)) throw new Error('Ragged matrix');
    return `\\begin{pmatrix}${rows.map(row => row.map(expression).join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
  }
  const values = cells.map(expression);
  return style === 'values'
    ? `\\left\\{${values.join(',\\;')}\\right\\}`
    : `\\begin{pmatrix}${values.join(' \\\\ ')}\\end{pmatrix}`;
}

function lex(text: string, listStyle: ListStyle): Token[] {
  const result: Token[] = [];
  const add = (kind: Token['kind'], value: string) => result.push({ kind, value });
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i);
    const ch = text[i];
    if (ch === '[') {
      const end = closing(text, i, '[', ']');
      add('math', arrayTex(text.slice(i, end + 1), listStyle)); i = end + 1; continue;
    }
    if (ch === '(') {
      const end = closing(text, i, '(', ')');
      const inner = text.slice(i + 1, end);
      if (inner.includes(',') && /^[\dxyzab, +\-−/.]+$/.test(inner)) {
        add('math', arrayTex(`[${inner}]`, listStyle)); i = end + 1; continue;
      }
    }
    const derivative = rest.match(/^([d∂])\/([d∂])([xyz])/);
    if (derivative) {
      const d = derivative[1] === '∂' ? '\\partial' : '\\mathrm{d}';
      const denominator = derivative[2] === '∂' ? '\\partial' : '\\mathrm{d}';
      add('math', `\\frac{${d}}{${denominator}${derivative[3]}}`);
      i += derivative[0].length; continue;
    }
    const fraction = rest.match(/^(-?\d+)\/(-?\d+)/);
    if (fraction) {
      add('math', `\\frac{${fraction[1]}}{${fraction[2]}}`); i += fraction[0].length; continue;
    }
    if (ch === '^' || ch === '_') {
      let end = i + 1, value: string;
      if (text[end] === '{' || text[end] === '(') {
        const open = text[end], close = open === '{' ? '}' : ')';
        const last = closing(text, end, open, close);
        value = expression(text.slice(end + 1, last)); end = last + 1;
      } else {
        const power = text.slice(end).match(/^-?\d+|^[A-Za-z]/);
        if (!power) throw new Error('Invalid power or subscript');
        value = power[0]; end += value.length;
      }
      add('math', `${ch}{${value}}`); i = end; continue;
    }
    const axis = rest.match(/^[xyz]-axis\b/);
    if (axis) { add('text', axis[0]); i += axis[0].length; continue; }
    const word = rest.match(/^[A-Za-z]+/);
    if (word) {
      const value = word[0];
      if (operators[value]) add('math', operators[value] + ' ');
      else if (/^[aA]$/.test(value) && /^\s+(?:[A-Za-z]{2,}|\d)/.test(rest.slice(value.length))) add('text', value);
      else if (value.length === 1 || productWords.has(value)) add('math', value);
      else add('text', value);
      i += value.length; continue;
    }
    const number = rest.match(/^\d+(?:\.\d+)?/);
    if (number) { add('math', number[0]); i += number[0].length; continue; }
    if (symbols[ch]) add('math', symbols[ch]);
    else if ('()+-=<>|/'.includes(ch)) add('math', ch);
    else if (ch === '\\') throw new Error('Use MathFormula for authored TeX');
    else add('text', ch);
    i++;
  }
  return result;
}

/** Haskell payloads remain untouched; only their player-facing representation changes. */
export function mathParts(text: string, listStyle: ListStyle = 'vector'): MathPart[] {
  const tokens = lex(text, listStyle);
  const parts: MathPart[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const previous = parts[parts.length - 1];
    if (token.kind === 'text' && /^\s+$/.test(token.value) && previous?.kind === 'math') {
      let next = i + 1;
      while (tokens[next]?.kind === 'text' && /^\s+$/.test(tokens[next].value)) next++;
      if (tokens[next]?.kind === 'math') { previous.tex += ' '; continue; }
    }
    if (token.kind === 'math') {
      if (previous?.kind === 'math') previous.tex += token.value;
      else parts.push({ kind: 'math', tex: token.value });
    } else if (previous?.kind === 'text') previous.text += token.value;
    else parts.push({ kind: 'text', text: token.value });
  }
  return parts.map(part => part.kind === 'math'
    ? { ...part, tex: part.tex.replace(/\+\s*-/g, '-') }
    : part);
}

const rendered = new Map<string, string>();
export function typesetMath(tex: string): string {
  const existing = rendered.get(tex);
  if (existing) return existing;
  const html = katex.renderToString(tex, {
    throwOnError: true, trust: false, strict: 'error',
    output: 'htmlAndMathml', displayMode: false,
  });
  if (rendered.size >= 512) rendered.delete(rendered.keys().next().value!);
  rendered.set(tex, html);
  return html;
}
