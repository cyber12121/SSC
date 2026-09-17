const katex = require('katex');

function sanitizeLatexForKatex(latex) {
  let s = latex.trim();
  s = s.replace(/\\+over(?![a-zA-Z])/g, '\\over ');
  s = s.replace(/\{([^{}]+?)\s*\\over\s*([^{}]+?)\}/g, '\\frac{$1}{$2}');
  s = s.replace(/([0-9a-zA-Z]+)\s*\\over\s*([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  s = s.replace(/(?<!\\)\\+$/, '');
  return s;
}

const tests = [
  '21\\\\over 22\\',
  '10\\\\over13\\',
  '{21\\over 22}',
  '10\\over 13',
  '10\\over13'
];

tests.forEach(t => {
  const san = sanitizeLatexForKatex(t);
  const html = katex.renderToString(san, { throwOnError: false });
  console.log(t, '->', san, 'error?', html.includes('katex-error'));
});
