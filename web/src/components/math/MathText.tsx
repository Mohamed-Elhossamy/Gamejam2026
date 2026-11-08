import { useMemo } from 'react';
import { mathParts, typesetMath, type ListStyle } from './notation';
import 'katex/dist/katex.min.css';
import './MathText.css';

export function MathFormula({ tex, className = '' }: { tex: string; className?: string }) {
  const html = useMemo(() => {
    try { return typesetMath(tex); } catch { return null; }
  }, [tex]);
  if (html === null) return <span className="math-unavailable" role="alert" data-notation-error>Notation unavailable</span>;
  return <span className={`math-expression ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function MathText({ text, listStyle = 'vector', className = '' }: {
  text: string; listStyle?: ListStyle; className?: string;
}) {
  const parts = useMemo(() => {
    try { return mathParts(text, listStyle); } catch { return null; }
  }, [text, listStyle]);
  if (parts === null) return <span className="math-unavailable" role="alert" data-notation-error>Notation unavailable</span>;
  return <span className={`math-text ${className}`}>{parts.map((part, index) =>
    part.kind === 'text' ? part.text : <MathFormula key={index} tex={part.tex} />
  )}</span>;
}
