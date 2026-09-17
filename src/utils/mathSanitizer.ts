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

  // 0. Protect Unicode superscript digits & letters from NFKD decomposition.
  // NFKD maps ² → 2, ³ → 3, ¹ → 1, ⁶ → 6, etc. (compatibility decomposition),
  // which would destroy already-correct superscript formatting in solution text.
  // We swap them to private-use placeholders before NFKD and restore after.
  const supMap: Array<[string, string]> = [
    ['⁰', '\uE000'], ['¹', '\uE001'], ['²', '\uE002'], ['³', '\uE003'],
    ['⁴', '\uE004'], ['⁵', '\uE005'], ['⁶', '\uE006'], ['⁷', '\uE007'],
    ['⁸', '\uE008'], ['⁹', '\uE009'], ['ⁿ', '\uE00A'], ['ⁱ', '\uE00B'],
    ['₀', '\uE010'], ['₁', '\uE011'], ['₂', '\uE012'], ['₃', '\uE013'],
    ['₄', '\uE014'], ['₅', '\uE015'], ['₆', '\uE016'], ['₇', '\uE017'],
    ['₈', '\uE018'], ['₉', '\uE019'],
  ];
  let s = text;
  for (const [sup, ph] of supMap) s = s.split(sup).join(ph);

  // 1. NFKD normalization decomposes mathematical alphanumeric bold/italic letters
  // e.g. 𝑃 (U+1D443) -> P, 𝐴 (U+1D434) -> A, 𝑅 (U+1D445) -> R, 𝑛 (U+1D45B) -> n, etc.
  s = s.normalize('NFKD');

  // Restore protected superscript/subscript characters
  for (const [sup, ph] of supMap) s = s.split(ph).join(sup);

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

  // 3. Decode unescaped form feed \x0c (ASCII 12) from JSON \f escapes followed by 'rac' -> \frac
  s = s.replace(/[\x0c\u000c]rac/g, '\\frac');
  s = s.replace(/[\x0c\u000c]/g, '\\f');

  return s;
}


/**
 * Extracts balanced curly braces starting at a given '{' index.
 */
export function extractBalanced(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') {
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(startIndex + 1, i), endIndex: i };
      }
    }
  }
  return null;
}

/**
 * Parses \frac{num}{den} starting at startIndex using balanced brace parsing.
 */
export function parseFraction(str: string, startIndex: number): { fullMatch: string; num: string; den: string; endIndex: number } | null {
  const fracPrefix = str.slice(startIndex);
  const match = /^\\frac\s*/.exec(fracPrefix);
  if (!match) return null;

  const numStart = startIndex + match[0].length;
  const numBalanced = extractBalanced(str, numStart);
  if (!numBalanced) return null;

  let denStart = numBalanced.endIndex + 1;
  while (denStart < str.length && /\s/.test(str[denStart])) {
    denStart++;
  }
  const denBalanced = extractBalanced(str, denStart);
  if (!denBalanced) return null;

  const fullMatch = str.slice(startIndex, denBalanced.endIndex + 1);
  return {
    fullMatch,
    num: numBalanced.content,
    den: denBalanced.content,
    endIndex: denBalanced.endIndex,
  };
}

/**
 * Finds all unwrapped \frac{...}{...} outside existing LaTeX math blocks ($$, $, \[, \()
 * and safely wraps them into $...$ (supporting mixed fractions like 9 \frac{1}{2} and percentages \frac{2}{3}%).
 */
export function wrapUnwrappedFractions(rawText: string = ''): string {
  if (!rawText) return '';
  let s = rawText;

  // Normalize TeX \over into \frac or mixed fractions
  if (/\\*over/i.test(s)) {
    // 1. Mixed fraction with brackets: 30\(10\over13\) % or 30\\(10\\over13\\) %
    s = s.replace(/(\b\d+)\s*\\+\(\s*(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*\\+\)\s*(%?)/g, (_, w, n, d, pct) => {
      return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
    });
    // 2. Pure fraction with brackets: \(21\over 22\) or \\(21\\over 22\\)
    s = s.replace(/\\+\(\s*([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)\s*\\+\)/g, (_, n, d) => {
      return `$\\frac{${n}}{${d}}$`;
    });
    // 3. Mixed fraction with space: 30 10\over 13 %
    s = s.replace(/(\b\d+)\s+(\d+)\s*\\+over(?![a-zA-Z])\s*(\d+)\s*(%?)/g, (_, w, n, d, pct) => {
      return `$${w}\\frac{${n}}{${d}}${pct ? '\\%' : ''}$`;
    });
    // 4. Pure fraction unbracketed or braced
    s = s.replace(/\{([^{}]+?)\s*\\+over(?![a-zA-Z])\s*([^{}]+?)\}/g, '\\frac{$1}{$2}');
    s = s.replace(/(?<![0-9a-zA-Z])([0-9a-zA-Z]+)\s*\\+over(?![a-zA-Z])\s*([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  }

  if (!s.includes('\\frac')) return s;

  // 1. Temporarily protect existing math blocks ($$...$$, $...$, \[...\], \(...\))
  const mathPlaceholders: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });

  // 2. Scan and wrap unwrapped \frac
  let result = '';
  let i = 0;
  while (i < s.length) {
    const fracIdx = s.indexOf('\\frac', i);
    if (fracIdx === -1) {
      result += s.slice(i);
      break;
    }

    result += s.slice(i, fracIdx);

    // Check if preceded by a superscript caret '^' or '^{'
    const isSuperscript = /\^\{?$/.test(result);
    const mixedMatch = !isSuperscript ? /(\b\d+)\s*$/.exec(result) : null;
    const parsed = parseFraction(s, fracIdx);

    if (parsed) {
      let endIndex = parsed.endIndex;
      let suffix = '';
      // Check if immediately followed by %
      if (s[endIndex + 1] === '%') {
        suffix = '\\%';
        endIndex++;
      }

      if (isSuperscript) {
        result += `${parsed.fullMatch}${suffix}`;
      } else if (mixedMatch) {
        result = result.slice(0, result.length - mixedMatch[0].length);
        result += `$${mixedMatch[1]} ${parsed.fullMatch}${suffix}$`;
      } else {
        result += `$${parsed.fullMatch}${suffix}$`;
      }
      i = endIndex + 1;
    } else {
      result += '\\frac';
      i = fracIdx + 5;
    }
  }

  // 3. Restore preserved math blocks safely
  mathPlaceholders.forEach((math, idx) => {
    result = result.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  return result;
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

  // Preserve existing math blocks so regex cleanups do not corrupt math expressions
  const mathPlaceholders: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });

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

  // Reassemble unit exponents split across newlines (e.g. cm\n3 -> cm³, m\n2 -> m²)
  s = s.replace(/\b(cm|mm|km|sq\.?|cu\.?)\s*\n+\s*([23])\b/gi, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(m)\s*\n+\s*([23])\b/g, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(cm|mm|km)\s*([23])\b(?!\d)/gi, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);
  s = s.replace(/\b(m)\s*([23])\b(?!\d)/g, (_, u, p) => `${u}${powerMap[p] || `^${p}`}`);

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

  // 10. Normalize raw LaTeX geometric & mathematical symbols outside math blocks
  // Triangles: \DeltaABC -> ΔABC, \Delta ABC -> ΔABC, \Delta -> Δ
  s = s.replace(/\\Delta\s*([A-Za-z]+)/g, (_, p) => `Δ${p}`);
  s = s.replace(/\\Delta\b/g, 'Δ');

  // Angles: \angleA -> ∠A, \angle ABC -> ∠ABC, \angle -> ∠
  s = s.replace(/\\angle\s*([A-Za-z]+)/g, (_, p) => `∠${p}`);
  s = s.replace(/\\angle\b/g, '∠');

  // Angle degrees: 90^\circ, 90^ \circ, 90^{\circ}, 90\degree -> 90°
  s = s.replace(/(\d+(?:\.\d+)?)\s*\^\s*(?:\\circ|\{\s*\\circ\s*\}|\\degree|°)/g, '$1°');
  s = s.replace(/\^\s*(?:\\circ|\{\s*\\circ\s*\}|\\degree)/g, '°');
  s = s.replace(/\\degree\b/g, '°');
  s = s.replace(/\\circ\b/g, '°');

  // Congruence, similarity, equality & relations
  s = s.replace(/\\cong\b/g, '≅');
  s = s.replace(/\\ncong\b/g, '≇');
  s = s.replace(/\\sim\b/g, '∼');
  s = s.replace(/\\approx\b|\\approxeq\b/g, '≈');
  s = s.replace(/\\neq\b|\\ne\b/g, '≠');
  s = s.replace(/\\perp\b|\\bot\b/g, '⊥');
  s = s.replace(/\\parallel\b/g, '∥');
  s = s.replace(/\\le\b(?!ft)/g, '≤');
  s = s.replace(/\\ge\b/g, '≥');
  s = s.replace(/\\pm\b/g, '±');
  s = s.replace(/\\mp\b/g, '∓');
  s = s.replace(/\\times\b/g, '×');
  s = s.replace(/\\div\b/g, '÷');
  s = s.replace(/\\cdot\b/g, '·');
  s = s.replace(/\\theta\b/g, 'θ');
  s = s.replace(/\\pi\b/g, 'π');
  s = s.replace(/\\alpha\b/g, 'α');
  s = s.replace(/\\beta\b/g, 'β');
  s = s.replace(/\\gamma\b/g, 'γ');

  // Restore preserved math blocks safely
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  return s;
}

/**
 * Advanced multi-line mathematical solution cleaner:
 * - Solves scraped Testbook MathML vertical column explosion where fractions, mixed fractions,
 *   recurring decimals, operators, and equations are shredded into single-line fragments.
 * - Reassembles recurring decimals (e.g. 0.\n̄\n29 -> 0.29̄)
 * - Reassembles mixed fractions (e.g. 5 / 1\n\n4 -> 5 1/4)
 * - Reassembles fraction-over-fraction (e.g. 8/3\n\n1/3 -> (8/3) / (1/3))
 * - Pairs vertical numerators & denominators across newlines (e.g. 21\n\n4 -> 21 / 4)
 * - Stitches fragmented calculation steps across operators (+, -, ×, ÷, =, of, brackets)
 * - Respects '⇒', '=>', '∴', and section headers to keep each step clean and separate
 */
export function reconstructScrapedSolutionMath(rawText: string = ''): string {
  if (!rawText) return '';

  // First run the base math sanitizer
  let s = reconstructScrapedMath(rawText);

  // Preserve existing math blocks so line cleanups do not corrupt math expressions
  const mathPlaceholders: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });

  // 0. Deduplicate vertical+text fraction artifacts:
  // Testbook scraper emits both MathML vertical form AND a text fallback for the same fraction.
  // e.g. "1\n2\n1 / 2" → "1 / 2" (vertical 1\n2 is the MathML form, "1 / 2" is text form)
  // e.g. "6\n7\n6 / 7" → "6 / 7"
  // e.g. "x\ny\nx\ny" → "x / y" (algebraic fraction duplicate)
  // Pattern: numA\ndenA\nnumA / denA → numA / denA (keep text form)
  s = s.replace(/\b(\d+)\s*\n\s*(\d+)\s*\n\s*\1\s*\/\s*\2\b/g, '$1 / $2');
  // Same for algebraic: e.g. "x+2\n2y\nx+2 / 2y" → "x+2 / 2y"
  s = s.replace(/([a-zA-Z0-9+\-]+)\s*\n\s*([a-zA-Z0-9+\-]+)\s*\n\s*\1\s*\/\s*\2\b/g, '$1 / $2');
  // Duplicate single variable pair: "x\ny\nx\ny" → "x / y"
  s = s.replace(/\b([a-zA-Z])\s*\n\s*([a-zA-Z])\s*\n\s*\1\s*\n\s*\2\s*(?=\n|$)/g, '$1 / $2');

  // Remove duplicate equation lines where the same expression appears twice back-to-back
  // e.g. "x+2\n2y = 1\n2\nx\n+\n2\n2\ny = 1 / 2" → "x+2 / 2y = 1 / 2"
  // These are compound lines that appear as text fragments followed by split MathML
  // Handle vertical fraction headers followed by their repeated text split form:
  // "(\n6.25\n)\n1\n/\n2\n×\n(\n0.0144\n)\n1\n/\n2\n+\n1" style (fully vertical MathML)
  // We collapse: ( \n val \n ) \n num \n / \n den → (val)^(num/den)
  s = s.replace(/\(\s*\n\s*([0-9.]+)\s*\n\s*\)\s*\n\s*(\d+)\s*\n\s*\/\s*\n\s*(\d+)/g, '($1)^($2/$3)');

  // 1. Broken recurring decimals with combining overline (macron):
  // e.g. "0.\n̄\n29" -> "0.29̄", "÷0.3\n̄\n2" -> "÷0.32̄", "0.\n̄\nab" -> "0.ab̄"
  s = s.replace(/([0-9a-zA-Z]*\.[0-9a-zA-Z]*)\s*\n+\s*[\u0304\u0305\u00AF̄¯]\s*\n+\s*([a-zA-Z0-9]+)/g, (_, prefix, barPart) => `${prefix}${barPart}̄`);
  s = s.replace(/([a-zA-Z0-9\.]+)\s*\n+\s*[\u0304\u0305\u00AF̄¯]\s*\n*/g, (_, b) => `${b}̄`);

  // 2. Fraction over fraction:
  // e.g. "8/3\n\n1/3" -> "(8/3) / (1/3)"
  s = s.replace(/(\d+\s*\/\s*\d+)\s*\n+\s*(\d+\s*\/\s*\d+)/g, '($1) / ($2)');

  // 3. Scraped mixed fractions:
  // e.g. "5 / 1\n\n4" -> "5 1/4" (non-zero integer denominator not followed by '/' or '.')
  s = s.replace(/(\b\d+)\s*\/\s*(\d+)\s*\n+\s*([1-9]\d*\b)(?!\s*[\/\.])/g, '$1 $2/$3');
  s = s.replace(/(\b\d+)\s*\n+\s*(\d+)\s*\/\s*([1-9]\d*\b)(?!\s*[\/\.])/g, '$1 $2/$3');

  // 4. Equations ending with numerator followed by standalone denominator:
  // e.g. "0.ab̄ = ab\n\n99" -> "0.ab̄ = ab / 99"
  // e.g. ", 0.ab̄ = ab-a\n\n90" -> ", 0.ab̄ = (ab - a) / 90"
  s = s.replace(/(=|is)\s*([a-zA-Z0-9_\-]+)\s*\n+\s*([1-9]\d*)\s*(?=\n|$)/g, (_, eq, num, den) => {
    if (num.includes('-') || num.includes('+')) {
      return `${eq} (${num}) / ${den}`;
    }
    return `${eq} ${num} / ${den}`;
  });

  // 5. Line-Level Structure Reconstruction
  const rawLines = s.split('\n').map(l => l.trim()).filter(Boolean);

  // Pass A: Merge pure fraction pairs on consecutive lines
  // e.g. line A is "21", line B is "4" -> "21 / 4"
  // e.g. line A is "29", line B is "99" -> "29 / 99"
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const next = rawLines[i + 1];

    const isNum = (str: string) => /^(\d{1,4}|[a-zA-Z]{1,4}|[a-zA-Z0-9]+-[a-zA-Z0-9]+|\(\d+\s*\/\s*\d+\))$/.test(str);
    const isDenom = (str: string) => /^([1-9]\d{0,3}|[a-zA-Z]{1,4}|\(\d+\s*\/\s*\d+\))$/.test(str);

    if (next && isNum(cur) && isDenom(next)) {
      let merged = '';
      if (cur.includes('/') || next.includes('/')) {
        merged = `${cur} / ${next}`;
      } else if (cur.includes('-') || cur.includes('+')) {
        merged = `(${cur}) / ${next}`;
      } else {
        merged = `${cur} / ${next}`;
      }
      lines.push(merged);
      i++;
      continue;
    }
    lines.push(cur);
  }

  // Pass B: Stitch broken lines connected by math operators or parentheses
  const isSectionHeader = (str: string) => /^(solution|given|formula used|calculations?|numerator|denominator|value|final value|shortcut trick|alternate method|note|case\s*\d+|step\s*\d+):?$/i.test(str);
  const endsWithOperator = (str: string) => /([+\-×*÷/=~:,]|\bof\b|\(|\-\(|\+\(|\÷\(|×\(|\/)$/i.test(str.trim());
  const startsWithOperator = (str: string) => /^([+\-×*÷/=:~,]|\bof\b|\)|\)\+|\)-\(|\)-|\)×|\)÷|\)=)/i.test(str.trim());
  const isOperatorOnly = (str: string) => /^([+\-×*÷/=:~,]|\bof\b|\(|\)|\)-\(|\)\+|\)-|\)×|\)÷|\)=|\(\-|\(\+|\(×|\(÷)$/i.test(str.trim());

  const stitched: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];

    if (isSectionHeader(cur)) {
      stitched.push(cur);
      continue;
    }

    // If cur is just '⇒', join it with the expression on next line
    if (cur === '⇒' || cur === '=>') {
      if (i + 1 < lines.length && !isSectionHeader(lines[i + 1])) {
        cur = '⇒ ' + lines[i + 1];
        i++;
      }
    }

    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (isSectionHeader(next)) break;
      // Do not merge if next starts with '⇒', '=>' or '∴'
      if (/^(⇒|=>|∴)/.test(next)) break;

      if (endsWithOperator(cur) || startsWithOperator(next) || isOperatorOnly(cur) || isOperatorOnly(next)) {
        let sep = ' ';
        if (cur.endsWith('(') || next.startsWith(')')) {
          sep = '';
        } else if (next.startsWith(',')) {
          sep = '';
        }
        cur = cur + sep + next;
        i++;
      } else {
        break;
      }
    }

    // Clean spacing around operators
    cur = cur.replace(/\s+/g, ' ')
             .replace(/\(\s+/g, '(')
             .replace(/\s+\)/g, ')')
             .replace(/\)\s*-\s*\(/g, ') - (')
             .replace(/\)\s*\+\s*\(/g, ') + (')
             .replace(/\)\s*([+\-×*÷])\s*/g, ') $1 ')
             .replace(/([0-9a-zA-Z])\s*-\s*([0-9a-zA-Z])/g, '$1 - $2')
             .replace(/([0-9a-zA-Z])\s*\+\s*([0-9a-zA-Z])/g, '$1 + $2')
             .replace(/⇒\s*/g, '⇒ ')
             .replace(/\s*=\s*/g, ' = ')
             .replace(/\s*÷\s*/g, ' ÷ ')
             .replace(/\s*×\s*/g, ' × ')
             .replace(/,\s*/g, ', ')
             .trim();

    stitched.push(cur);
  }

  s = stitched.join('\n\n');

  // Clean up algebraic powers and units (e.g. x2 -> x², y2 -> y², cm3 -> cm³) in solutions
  s = cleanAlgebraPowers(s);

  // Restore preserved math blocks safely
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  return s;
}

/**
 * Pre-sanitizes LaTeX formulas specifically for KaTeX rendering:
 * - Replaces unescaped `%` inside math blocks with `\%` (preventing KaTeX from treating them as comments).
 * - Fixes degree symbols `°` inside math to `^\circ`.
 * - Replaces broken `≤ft` created by erroneous `\le` replacements back to `\left`.
 * - Translates raw Unicode geometry and mathematical symbols inside math blocks to LaTeX commands.
 * - Cleans invalid or unclosed commands.
 */
export function sanitizeLatexForKatex(latex: string = ''): string {
  if (!latex) return '';
  let s = latex.trim();

  // 1. Fix corrupted \left / \right and form-feed corrupted \frac
  s = s.replace(/[\x0c\u000c]rac/g, '\\frac');
  s = s.replace(/[\x0c\u000c]/g, '\\f');
  s = s.replace(/\{?\$+([^$]+)\$+\}?/g, '$1');
  s = s.replace(/≤ft\b/g, '\\left');
  s = s.replace(/\\le\s*ft\b/g, '\\left');

  // Fix scraper stripped \r from \right and Take pi notes: e.g. \left( {{m{Take}}\,\,{m{\pi }}\,{m{ = }}... ight)
  s = s.replace(/\\left\(\s*\{+m\{Take\}[\s\S]*?ight\)/gi, '\\left(\\text{Take }\\pi = \\frac{22}{7}\\right)');
  s = s.replace(/(?<![a-zA-Z\\])ight\s*([\)\}\]])/g, '\\right$1');
  s = s.replace(/\\r\s*\\right/g, '\\right');
  s = s.replace(/\{+m\{Take\}\}+/gi, '\\text{Take }');
  s = s.replace(/\{+m\{\\pi\s*\}\}+/gi, '\\pi ');
  s = s.replace(/\{+m\{\s*=\s*\}\}+/gi, '= ');
  s = s.replace(/\{+m\{([^}]+)\}\}+/g, '\\text{$1}');

  // 2. Degree symbol inside math mode
  s = s.replace(/°/g, '^\\circ');

  // 3. Fix unseparated commands without space like \DeltaABC -> \Delta ABC, \angleA -> \angle A
  s = s.replace(/\\Delta([A-Za-z]+)/g, '\\Delta $1');
  s = s.replace(/\\angle([A-Za-z]+)/g, '\\angle $1');
  s = s.replace(/\\sim([A-Za-z]+)/g, '\\sim $1');
  s = s.replace(/\\cong([A-Za-z]+)/g, '\\cong $1');

  // 4. Translate raw Unicode geometry & math operators inside LaTeX formulas to valid LaTeX commands
  // so KaTeX does not fail or render error spans
  s = s.replace(/Δ/g, '\\Delta ');
  s = s.replace(/∠/g, '\\angle ');
  s = s.replace(/∼/g, '\\sim ');
  s = s.replace(/≅/g, '\\cong ');
  s = s.replace(/×/g, '\\times ');
  s = s.replace(/÷/g, '\\div ');
  s = s.replace(/≠/g, '\\neq ');
  s = s.replace(/≤/g, '\\le ');
  s = s.replace(/≥/g, '\\ge ');
  s = s.replace(/·/g, '\\cdot ');
  s = s.replace(/±/g, '\\pm ');
  s = s.replace(/∓/g, '\\mp ');
  s = s.replace(/⊥/g, '\\perp ');
  s = s.replace(/∥/g, '\\parallel ');
  s = s.replace(/≈/g, '\\approx ');

  // 5. KaTeX treats % as a comment delimiter that swallows everything after it.
  // Replace unescaped % with \%
  // Match % not preceded by \
  s = s.replace(/(?<!\\)%/g, '\\%');

  // If there was an accidental double escaping or spacing like 2\% \pi
  // or a swallowed command like 2\%\pi -> 2\pi (when % was an artifact)
  s = s.replace(/(\d+)\s*\\%\s*\\(pi|theta|alpha|beta|gamma|sqrt|sin|cos|Delta|angle|sim|cong)/g, '$1\\$2');

  // 6. Common scraper math artifacts: \rm with nothing or empty text
  s = s.replace(/\\rm\s*([a-zA-Z0-9]+)/g, '\\mathrm{$1}');
  s = s.replace(/\\rm\b/g, '');

  // 7. Fix TeX \over primitives and corrupted double-backslash \over inside math mode
  s = s.replace(/\\+over(?![a-zA-Z])/g, '\\over ');
  s = s.replace(/\{([^{}]+?)\s*\\over\s*([^{}]+?)\}/g, '\\frac{$1}{$2}');
  s = s.replace(/([0-9a-zA-Z]+)\s*\\over\s*([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');

  // 8. Strip trailing dangling backslashes (incomplete commands) at the end of LaTeX formulas
  s = s.replace(/(?<!\\)\\+$/, '');
  // Strip leading lone backslash not followed by command letter
  s = s.replace(/^\\+(?![a-zA-Z])/, '');

  return s;
}

/**
 * Normalizes algebraic exponents and scientific units in solution text:
 * - x2 -> x², y2 -> y², x3 -> x³, y3 -> y³, a2 -> a², b2 -> b², 250x3 -> 250x³
 * - cm3 -> cm³, cm2 -> cm², m3 -> m³, m2 -> m²
 * - x1/3 -> x^(1/3)
 */
export function cleanAlgebraPowers(text: string = ''): string {
  if (!text) return '';
  let s = text;

  // 1. Scientific and measurement units: cm3 -> cm³, cm2 -> cm², etc.
  s = s.replace(/\b(cm|m|mm|km|ft|in)3\b/g, '$1³');
  s = s.replace(/\b(cm|m|mm|km|ft|in)2\b/g, '$1²');

  // 2. Fractional exponents: x1/3 -> x^(1/3), (xyz)1/3 -> (xyz)^(1/3)
  s = s.replace(/([a-zA-Z]|\))\s*1\/3\b/g, '$1^(1/3)');

  // 3. Variables followed by 2 or 3 in algebraic expressions:
  // e.g. a2 -> a², 3b2 -> 3b², 25x2 -> 25x², 27y2 -> 27y², 250x3 -> 250x³, 270xy2 -> 270xy²
  // e.g. Cx3 -> Cx³, Dxy2 -> Dxy², 2A3 -> 2A³, 6AB2 -> 6AB², 125x3 -> 125x³, 9y2 -> 9y²
  // e.g. r3 -> r³, l2 -> l²
  s = s.replace(/([a-zA-Z])([23])(?=[a-zA-Z+\-×*÷/=\s,)\.]|$)/g, (_, v, p) => {
    return v + (p === '2' ? '²' : '³');
  });

  // 4. Arithmetic squares inside brackets or square root differences: e.g. 172 - 82 -> 17² - 8²
  s = s.replace(/(\b\d{1,2})2\s*([+\-])\s*(\b\d{1,2})2/g, '$1² $2 $3²');
  s = s.replace(/\[\s*(\d{1,2})2\s*([+\-])/g, '[$1² $2');

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
