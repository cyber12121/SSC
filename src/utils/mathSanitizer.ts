/**
 * mathSanitizer.ts
 *
 * Centralized Math & Text Sanitizer:
 * 1. Unicode Math Italic & Alphanumeric Symbol Mapping (𝑃 -> P, 𝐴 -> A, etc.)
 * 2. Scraped Vertical MathML / Testbook Reconstruction
 * 3. KaTeX Pre-Sanitizer (preventing red error spans and swallowing of tokens)
 * 4. Case-Insensitive Question Option Normalizer
 */

/**
 * Maps Unicode Mathematical Alphanumeric Symbols (U+1D400-U+1D7FF)
 * and special math symbols to clean ASCII / standard Unicode characters.
 */
export function normalizeUnicodeMath(text: string = ''): string {
  if (!text) return '';

  // 1. NFKD normalization decomposes mathematical alphanumeric bold/italic letters
  // e.g. 𝑃 (U+1D443) -> P, 𝐴 (U+1D434) -> A, 𝑅 (U+1D445) -> R, 𝑛 (U+1D45B) -> n, etc.
  let s = text.normalize('NFKD');

  // 2. Normalize Greek math italics and special symbols that may not decompose cleanly
  const specialMap: Record<string, string> = {
    '𝜽': 'θ',
    '𝛉': 'θ',
    '𝜃': 'θ',
    '𝝧': 'θ',
    '𝞡': 'θ',
    '𝝅': 'π',
    '𝜋': 'π',
    '𝝿': 'π',
    '𝞹': 'π',
    '−': '-', // U+2212 minus sign to ASCII hyphen-minus
    '–': '-', // en-dash to hyphen
    '—': '-', // em-dash to hyphen
  };

  s = s.replace(/[\u{1D400}-\u{1D7FF}−–—]/gu, (ch) => specialMap[ch] || ch);

  return s;
}

/**
 * Reconstructs vertical scraped math sequences caused by tag-by-tag MathML scrapers.
 * e.g.:
 *   "20\n5\n=\n4" -> "20 / 5 = 4"
 *   "39200\n1.2544\n=\n31250" -> "39200 / 1.2544 = 31250"
 *   "𝑅\n𝑠\n.\n1\n,\n36\n,\n704" -> "Rs. 1,36,704"
 *   "𝑐\n𝑜\n𝑠\nθ" -> "cos θ"
 *   "(\n1.12\n)\n2" -> "(1.12)²"
 */
export function reconstructScrapedMath(rawText: string = ''): string {
  if (!rawText) return '';
  let s = normalizeUnicodeMath(rawText);

  // 1. Reassemble broken vertical currency "R\ns\n.\n" or "Rs.\n" followed by numbers and commas
  s = s.replace(/R\s*\n+\s*s\s*\n+\s*\.\s*\n*/gi, 'Rs. ');
  s = s.replace(/R\s*\n+\s*s\s*\n*/gi, 'Rs. ');

  // Reassemble broken digit sequences in currency: e.g. Rs.\n1\n,\n36\n,\n704 -> Rs. 1,36,704
  s = s.replace(/(Rs\.?|₹)\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)/gi, '$1 $2,$3,$4');
  s = s.replace(/(Rs\.?|₹)\s*(\d+)\s*\n+\s*,\s*\n+\s*(\d+)/gi, '$1 $2,$3');
  s = s.replace(/(Rs\.?|₹)\s*\n+\s*(\d+)/gi, '$1 $2');

  // General broken comma numbers: e.g. "1\n,\n36\n,\n704" -> "1,36,704"
  s = s.replace(/(\b\d{1,3})\s*\n+\s*,\s*\n+\s*(\d{2,3})\s*\n+\s*,\s*\n+\s*(\d{3}\b)/g, '$1,$2,$3');
  s = s.replace(/(\b\d{1,3})\s*\n+\s*,\s*\n+\s*(\d{2,3}\b)/g, '$1,$2');

  // 2. Reassemble broken trig / math functions:
  // c\no\ns\nθ -> cos θ, s\ni\nn\nθ -> sin θ, t\na\nn\nθ -> tan θ, c\no\nt\nθ -> cot θ
  s = s.replace(/c\s*\n+\s*o\s*\n+\s*s\s*\n+\s*(θ|[a-zA-Z])/gi, 'cos $1');
  s = s.replace(/s\s*\n+\s*i\s*\n+\s*n\s*\n+\s*(θ|[a-zA-Z])/gi, 'sin $1');
  s = s.replace(/t\s*\n+\s*a\s*\n+\s*n\s*\n+\s*(θ|[a-zA-Z])/gi, 'tan $1');
  s = s.replace(/c\s*\n+\s*o\s*\n+\s*t\s*\n+\s*(θ|[a-zA-Z])/gi, 'cot $1');
  s = s.replace(/co\s*\n+\s*t\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, 'cot² $1');
  s = s.replace(/si\s*\n+\s*n\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, 'sin² $1');
  s = s.replace(/co\s*\n+\s*s\s*\n+\s*2\s*\n+\s*(θ|[a-zA-Z])/gi, 'cos² $1');

  // 3. Reassemble broken acronyms: C\nI -> CI, S\nI -> SI
  s = s.replace(/\bC\s*\n+\s*I\b/g, 'CI');
  s = s.replace(/\bS\s*\n+\s*I\b/g, 'SI');

  // 4. Reassemble broken vertical mixed fractions:
  // e.g. "16\n2\n3\n%" -> "16 2/3%"
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\n+\s*(\d+)\s*\n+\s*%/g, '$1 $2/$3%');
  // e.g. "50\n3\n%" -> "50/3%"
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\n+\s*%/g, '$1/$2%');

  // 5. Reassemble vertical fractions with '=':
  // e.g. "20\n5\n=\n4" -> "20 / 5 = 4"
  // e.g. "39200\n1.2544\n=\n31250" -> "39200 / 1.2544 = 31250"
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*=\s*\n+\s*(\d+(?:\.\d+)?)/g, '$1 / $2 = $3');

  // Vertical fraction with multiplication / addition / subtraction:
  // e.g. "140\n100\n×\n2500" -> "140 / 100 × 2500"
  // e.g. "12\n100\n×\n1\n3" -> "12 / 100 × 1 / 3"
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*([×÷\+\-\*=])\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)/g, '$1 / $2 $3 $4 / $5');
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n+\s*(\d+(?:\.\d+)?)\s*\n+\s*([×÷\+\-\*=])\s*\n+\s*(\d+(?:\.\d+)?)/g, '$1 / $2 $3 $4');

  // Vertical fractions before commas or text words:
  // e.g. "6\n5\n, so" -> "6 / 5, so"
  // e.g. "1\n6\n, so" -> "1 / 6, so"
  // e.g. "7\n6\n\n" -> "7 / 6\n\n"
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*(?=[,\.]\s*(?:so|gives|then|where|\b)|\n\n|$)/gi, '$1 / $2');

  // 6. Reassemble vertical parentheses & powers:
  // e.g. "(\n1.12\n)\n2" -> "(1.12)²"
  // e.g. "(\n7\n6\n)\n3" -> "(7 / 6)³"
  // e.g. "(\n1\n+\n𝑅\n100\n)\n𝑛" -> "(1 + R / 100)^n"
  const powerMap: Record<string, string> = {
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    'n': '^n',
    't': '^t',
  };

  s = s.replace(/\(\s*\n+\s*(\d+)\s*\n+\s*(\d+)\s*\n+\s*\)\s*\n+\s*([2345nt])/g, (_, n1, n2, p) => `(${n1} / ${n2})${powerMap[p] || `^${p}`}`);
  s = s.replace(/\(\s*\n+\s*([^\n\(\)]+?)\s*\n+\s*\)\s*\n+\s*([2345nt])/g, (_, inner, p) => `(${inner})${powerMap[p] || `^${p}`}`);
  s = s.replace(/\(\s*([^\(\)]+?)\s*\)\s*\n+\s*([2345nt])/g, (_, inner, p) => `(${inner})${powerMap[p] || `^${p}`}`);

  // Reassemble compound interest vertical formula:
  // (\n1\n+\n R\n100\n)\n n -> (1 + R/100)^n
  s = s.replace(/\(\s*\n+\s*1\s*\n+\s*([+\-])\s*\n+\s*([a-zA-Z])\s*\n+\s*(\d+)\s*\n+\s*\)\s*\n+\s*([a-zA-Z0-9])/g, '(1 $1 $2 / $3)^$4');

  // 7. Fix broken exponents on parentheses or variables:
  // "(1)2" -> "(1)²", "(6)2" -> "(6)²", "(1.02)2" -> "(1.02)²"
  s = s.replace(/(\([0-9\.]+\))\s*([23])(?!\d)/g, (_, base, p) => `${base}${powerMap[p] || `^${p}`}`);
  // "(R / 100)2" -> "(R / 100)²"
  s = s.replace(/(\([a-zA-Z0-9\s\/+\-]+\))\s*([23])(?!\d)/g, (_, base, p) => `${base}${powerMap[p] || `^${p}`}`);
  // "sin2θ" -> "sin²θ", "cos2θ" -> "cos²θ", "tan2θ" -> "tan²θ", "cot2θ" -> "cot²θ"
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec)\s*2\s*(θ|[a-zA-Z])/gi, '$1²$2');

  // 8. Reassemble broken vertical equations:
  // e.g. "P\n=\n39200 / 1.2544 = 31250" or "Final amount\n=\n12000"
  s = s.replace(/([a-zA-Z0-9\)]+)\s*\n+\s*=\s*\n+\s*/g, '$1 = ');
  s = s.replace(/\s*\n+\s*=\s*\n+\s*([a-zA-Z0-9\(\$])/g, ' = $1');

  // 9. Clean duplicate scraper artifacts:
  // e.g. "1625% $\frac{16}{25} \%$" -> "$\frac{16}{25}\%$"
  s = s.replace(/\b\d{3,4}%\s*(\$\s*\\frac\{[^}]+\}\{[^}]+\}\s*\%?\s*\$)/gi, '$1');
  // e.g. "912 $\frac{1}{2}$" -> "9 $\frac{1}{2}$"
  s = s.replace(/\b(\d+)\d\d\s*(\$\s*\\frac\{1\}\{2\}\s*\$)/gi, '$1 $2');

  return s;
}

/**
 * Pre-sanitizes LaTeX formulas specifically for KaTeX rendering:
 * - Replaces unescaped `%` inside math blocks with `\%` (preventing KaTeX from treating them as comments).
 * - Fixes degree symbols `°` inside math to `^\circ`.
 * - Replaces broken `≤ft` created by erroneous `\le` replacements back to `\left`.
 * - Cleans invalid or unclosed commands.
 */
export function sanitizeLatexForKatex(latex: string = ''): string {
  if (!latex) return '';
  let s = latex.trim();

  // 1. Fix corrupted \left / \right
  s = s.replace(/≤ft\b/g, '\\left');
  s = s.replace(/\\le\s*ft\b/g, '\\left');

  // 2. Degree symbol inside math mode
  s = s.replace(/°/g, '^\\circ');

  // 3. KaTeX treats % as a comment delimiter that swallows everything after it.
  // Replace unescaped % with \%
  // Match % not preceded by \
  s = s.replace(/(?<!\\)%/g, '\\%');

  // If there was an accidental double escaping or spacing like 2\% \pi
  // or a swallowed command like 2\%\pi -> 2\pi (when % was an artifact)
  s = s.replace(/(\d+)\s*\\%\s*\\(pi|theta|alpha|beta|gamma|sqrt|sin|cos)/g, '$1\\$2');

  // 4. Common scraper math artifacts: \rm with nothing or empty text
  s = s.replace(/\\rm\s*([a-zA-Z0-9]+)/g, '\\mathrm{$1}');
  s = s.replace(/\\rm\b/g, '');

  return s;
}

/**
 * Case-insensitively normalizes any option dictionary into standard { a, b, c, d }.
 * Handles:
 * - { "A": "...", "B": "...", "C": "...", "D": "..." }
 * - { "a": "...", "b": "...", "c": "...", "d": "..." }
 * - { "1": "...", "2": "...", "3": "...", "4": "..." }
 * - { "opt1": "...", "opt2": "..." }
 */
export function normalizeQuestionOptions(options: any): { a: string; b: string; c: string; d: string } {
  const result = { a: '', b: '', c: '', d: '' };
  if (!options || typeof options !== 'object') return result;

  const getVal = (...keys: string[]): string => {
    for (const k of keys) {
      if (options[k] !== undefined && options[k] !== null) {
        return String(options[k]);
      }
    }
    return '';
  };

  result.a = getVal('a', 'A', '1', 'opt1', 'option1', 'optionA', 'option 1', 'option a');
  result.b = getVal('b', 'B', '2', 'opt2', 'option2', 'optionB', 'option 2', 'option b');
  result.c = getVal('c', 'C', '3', 'opt3', 'option3', 'optionC', 'option 3', 'option c');
  result.d = getVal('d', 'D', '4', 'opt4', 'option4', 'optionD', 'option 4', 'option d');

  return result;
}

/**
 * Normalizes question answer to standard 'a' | 'b' | 'c' | 'd'.
 */
export function normalizeAnswerKey(ans: any): 'a' | 'b' | 'c' | 'd' {
  if (!ans) return 'a';
  const raw = String(ans).toLowerCase().trim();
  if (raw === 'a' || raw === 'opt1' || raw === 'option 1' || raw === 'option a' || raw === '1') return 'a';
  if (raw === 'b' || raw === 'opt2' || raw === 'option 2' || raw === 'option b' || raw === '2') return 'b';
  if (raw === 'c' || raw === 'opt3' || raw === 'option 3' || raw === 'option c' || raw === '3') return 'c';
  if (raw === 'd' || raw === 'opt4' || raw === 'option 4' || raw === 'option d' || raw === '4') return 'd';
  return (raw[0] as any) || 'a';
}
