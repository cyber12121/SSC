function testOverRegex(s: string) {
  let text = s;
  // 1. Mixed fraction with brackets: 30\(10\over13\) % or 30\\(10\\over13\\) %
  text = text.replace(/(\b\d+)\s*\\+\(\s*(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*\\+\)\s*(%?)/g, (_, w, n, d, pct) => {
    return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
  });

  // 2. Pure fraction with brackets: \(21\over 22\) or \\(21\\over 22\\)
  text = text.replace(/\\+\(\s*([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)\s*\\+\)/g, (_, n, d) => {
    return `$\\frac{${n}}{${d}}$`;
  });

  // 3. Mixed fraction with space: 30 10\over 13 %
  text = text.replace(/(\b\d+)\s+(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*(%?)/g, (_, w, n, d, pct) => {
    return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
  });

  // 4. Pure fraction unbracketed or braced
  text = text.replace(/\{([^{}]+?)\s*\\+over(?![a-zA-Z])\s*([^{}]+?)\}/g, '\\frac{$1}{$2}');
  text = text.replace(/(?<![0-9a-zA-Z])([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');

  return text;
}

const cases = [
  '\\\\(21\\\\over 22\\\\)',
  '30\\\\(10\\\\over13\\\\) %',
  '32\\\\(10\\\\over13\\\\) %',
  '\\\\(16\\\\over13\\\\)',
  '\\(21\\over 22\\)',
  '30\\(10\\over13\\) %',
  '30 10\\over 13 %',
  '21\\over 22'
];

cases.forEach(c => {
  console.log(c, '->', testOverRegex(c));
});
