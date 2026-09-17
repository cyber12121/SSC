import katex from 'katex';

function normalizeTokens(rawText: string) {
  let text = rawText;

  // 0. Decode literal escaped quotes
  text = text.replace(/\\"/g, '"');

  // 1. Normalize multiple backslashes on delimiters
  text = text.replace(/\\+\(/g, '\\(').replace(/\\+\)/g, '\\)');
  text = text.replace(/\\+\[/g, '\\[').replace(/\\+\]/g, '\\]');

  // 2. Normalize mixed fractions with \over
  text = text.replace(/(\b\d+)\s*\\?\(\s*(\d+)\s*\\+over\s*(\d+)\s*\\?\)\s*(%?)/g, (_, w, n, d, pct) => {
    return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
  });
  text = text.replace(/\\?\(\s*([0-9a-zA-Z]+)\s*\\+over\s*([0-9a-zA-Z]+)\s*\\?\)/g, (_, n, d) => {
    return `$\\frac{${n}}{${d}}$`;
  });
  text = text.replace(/(\b\d+)\s*\\?\(?\s*(\d+)\s*\\+over\s*(\d+)\s*\\?\)?\s*(%?)/g, (_, w, n, d, pct) => {
    return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
  });
  text = text.replace(/\\?\(?\s*([0-9a-zA-Z]+)\s*\\+over\s*([0-9a-zA-Z]+)\s*\\?\)?/g, (_, n, d) => {
    return `$\\frac{${n}}{${d}}$`;
  });

  // Step 1: Normalize \(...\) to $...$ and \[...\] to $$...$$
  text = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `$$${eq}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq}$`);

  // Clean trailing or leading backslashes inside math delimiters
  text = text.replace(/\\+\$([^$]+?)\$/g, '$$$1$$');
  text = text.replace(/\$([^$]+?)\\+\$/g, '$$$1$$');

  return text;
}

const inputs = [
  'Number \\"A\\" is increased by 20%, then decreased by 30%, and is finally increased by 50%.',
  '\\\\(21\\\\over 22\\\\)',
  '\\\\(16\\\\over13\\\\)',
  '\\\\(13\\\\over16\\\\)',
  '\\\\(22\\\\over 21\\\\)',
  '30\\\\(10\\\\over13\\\\) %',
  '32\\\\(10\\\\over13\\\\) %',
  '20\\\\(10\\\\over13\\\\) %',
  '25\\\\(10\\\\over13\\\\) %',
  '\\(21\\over 22\\)',
  '30\\(10\\over13\\) %',
];

inputs.forEach(inp => {
  const norm = normalizeTokens(inp);
  console.log('INPUT:', inp);
  console.log('NORM :', norm);
  // test KaTeX on any math parts inside $...$
  const matches = norm.match(/\$([^$]+)\$/g);
  if (matches) {
    matches.forEach(m => {
      const inner = m.slice(1, -1);
      const html = katex.renderToString(inner, { throwOnError: false });
      console.log('  KATEX:', inner, 'error?', html.includes('katex-error'));
    });
  }
  console.log('---');
});
