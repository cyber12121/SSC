const katex = require('katex');

// Let's import or mock what FormattedText does
const { sanitizeLatexForKatex } = require('../src/utils/mathSanitizer');

console.log('Sanitizing 10\\\\over13\\\\:');
const s1 = sanitizeLatexForKatex('10\\\\over13\\\\');
console.log('Sanitized:', s1);
const h1 = katex.renderToString(s1, { throwOnError: false });
console.log('Has error?', h1.includes('katex-error'));
if (h1.includes('katex-error')) console.log('HTML:', h1);

const s2 = sanitizeLatexForKatex('21\\\\over 22\\\\');
console.log('Sanitized s2:', s2);
const h2 = katex.renderToString(s2, { throwOnError: false });
console.log('Has error s2?', h2.includes('katex-error'));
if (h2.includes('katex-error')) console.log('HTML:', h2);
