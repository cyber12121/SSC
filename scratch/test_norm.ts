import katex from 'katex';
import { sanitizeLatexForKatex } from '../src/utils/mathSanitizer';

function normalizeMathString(rawText: string): string {
  let text = rawText;

  // 1. Normalize over-escaped delimiters: \\( -> \(, \\) -> \), \\[ -> \[, \\] -> \]
  text = text.replace(/\\+\(/g, '\\(').replace(/\\+\)/g, '\\)');
  text = text.replace(/\\+\[/g, '\\[').replace(/\\+\]/g, '\\]');

  // 2. Normalize mixed fractions with \over: e.g. 30\(10\over13\) % -> $30\frac{10}{13}\%$
  text = text.replace(/(\b\d+)\s*\\?\(\s*(\d+)\s*\\+over\s*(\d+)\s*\\?\)\s*(%?)/g, (_, whole, num, den, pct) => {
    return `$${whole}\\frac{${num}}{${den}}${pct ? '\\%' : ''}$`;
  });

  // 3. Normalize pure fractions with \over: e.g. \(21\over 22\) -> $\frac{21}{22}$
  text = text.replace(/\\?\(\s*([0-9a-zA-Z]+)\s*\\+over\s*([0-9a-zA-Z]+)\s*\\?\)/g, (_, num, den) => {
    return `$\\frac{${num}}{${den}}$`;
  });

  // 4. Any remaining \over patterns inside or outside math
  text = text.replace(/([0-9a-zA-Z]+)\s*\\+over\s*([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');

  return text;
}

const opt10 = '\\\\(21\\\\over 22\\\\)';
const opt14 = '30\\\\(10\\\\over13\\\\) %';

console.log('Norm 10:', normalizeMathString(opt10));
console.log('Norm 14:', normalizeMathString(opt14));

const h10 = katex.renderToString('\\frac{21}{22}', { throwOnError: false });
console.log('h10 error?', h10.includes('katex-error'));

const h14 = katex.renderToString('30\\frac{10}{13}\\%', { throwOnError: false });
console.log('h14 error?', h14.includes('katex-error'));
