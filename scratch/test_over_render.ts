import katex from 'katex';
import { sanitizeLatexForKatex } from '../src/utils/mathSanitizer';
import { tokenizeTextWithMath } from '../src/utils/formatQuestionText';

const opt10 = '\\\\(21\\\\over 22\\\\)';
const opt14 = '30\\\\(10\\\\over13\\\\) %';

console.log('--- Tokens for opt10 ---');
const t10 = tokenizeTextWithMath(opt10);
console.log(t10);
for (const t of t10) {
  if (t.type === 'math') {
    const san = sanitizeLatexForKatex(t.value);
    const html = katex.renderToString(san, { throwOnError: false });
    console.log('san:', san, 'error?', html.includes('katex-error'));
  }
}

console.log('--- Tokens for opt14 ---');
const t14 = tokenizeTextWithMath(opt14);
console.log(t14);
for (const t of t14) {
  if (t.type === 'math') {
    const san = sanitizeLatexForKatex(t.value);
    const html = katex.renderToString(san, { throwOnError: false });
    console.log('san:', san, 'error?', html.includes('katex-error'));
  }
}
