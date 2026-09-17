const katex = require('katex');

function tryKatex(str) {
  try {
    const html = katex.renderToString(str, { throwOnError: false });
    const isError = html.includes('katex-error');
    console.log(`[${isError ? 'ERROR' : 'OK'}] "${str}" ->`, isError ? 'Has katex-error' : 'Success');
  } catch (e) {
    console.log(`[EXCEPTION] "${str}":`, e.message);
  }
}

console.log('--- Testing KaTeX native support ---');
tryKatex('21\\over 22');
tryKatex('{21\\over 22}');
tryKatex('21\\\\over 22');
tryKatex('\\frac{21}{22}');
tryKatex('30\\frac{10}{13}\\%');
tryKatex('30 \\frac{10}{13} %');
tryKatex('30 \\frac{10}{13}\\%');
