/**
 * Utility for formatting questions, options, and solutions.
 * Handles:
 * 1. Decoding unicode escapes (\\u00f7 -> ÷, \\u00d7 -> ×, etc.)
 * 2. Unescaping literal \\n and carriage returns
 * 3. Proper line breaks for Para Jumbles (S1:, P:, Q:, R:, S:, S6:) and Statements
 * 4. Equation line break after question marks
 * 5. Bilingual text extraction
 * 6. Tokenizing LaTeX math for KaTeX rendering
 */

import { reconstructScrapedMath, wrapUnwrappedFractions } from './mathSanitizer';

export interface MathToken {
  type: 'text' | 'math';
  value: string;
  display?: boolean;
}

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/**
 * Normalizes and cleans question/option text while strictly preserving LaTeX math blocks.
 */
export function cleanQuestionText(text: string = ''): string {
  if (!text) return '';
  let s = wrapUnwrappedFractions(String(text));

  // 1. Temporarily extract and preserve math blocks ($$...$$, $...$, \[...\], \(...\))
  // so string replacements don't corrupt LaTeX commands (like \rm, \right, \neq, \nu, \root, etc.)
  const mathPlaceholders: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });

  // 2. Decode literal unicode escapes like \u00f7 (÷) and \u00d7 (×) in non-math text
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  });

  // 3. Unescape literal newlines and carriage returns (only literal \r\n or standalone \n in plain text)
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 4. Normalize non-breaking spaces
  s = s.replace(/\u00a0/g, ' ');

  // 5. Reconstruct vertical scraped MathML / Testbook equations
  s = reconstructScrapedMath(s);

  // 5b. Normalize plain-text unit exponents outside math blocks (e.g. cm^2 -> cm², cm\n3 -> cm³, cm3 -> cm³, m^3 -> m³)
  // Only targets known measurement unit abbreviations to avoid corrupting algebraic variables
  s = s
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\s*\n+\s*([23])\b/gi, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(m)\s*\n+\s*([23])\b/g, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\^2\b/g, '$1²')
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\^3\b/g, '$1³')
    .replace(/\b(cm|mm|km)\s*([23])\b(?!\d)/gi, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(m)\^2\b(?!\w)/g, 'm²')
    .replace(/\b(m)\^3\b(?!\w)/g, 'm³')
    .replace(/\b(m)\s*([23])\b(?!\d)/g, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`);


  s = s.replace(/([^\n])\s*(S[1-6]\s*:)/g, '$1\n$2');
  s = s.replace(/([^\n])\s*([PQRS]\s*:|\([PQRS]\)\s*|\[[PQRS]\]\s*)/g, '$1\n$2');

  // Statements & Conclusions in Reasoning questions
  s = s.replace(/([^\n])\s*(Statement\s+[I|V|X|\d]+:?|Conclusion\s+[I|V|X|\d]+:?)/gi, '$1\n$2');

  // 7. If question ends with ? followed by an equation or number without newline
  s = s.replace(/\?([ \t]*)(?=[0-9A-Za-z\+\-\*\/÷×=]+\s*[\+\-\*\/÷×=]\s*[0-9A-Za-z])/g, '?\n');

  // 8. Clean up trailing spaces on lines & collapse multiple empty lines
  s = s
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 9. Restore preserved math blocks safely
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  return s;
}

/**
 * Extracts language-specific text from bilingual strings ("English / Hindi")
 * STRICT RULE: A slash '/' is ONLY treated as a bilingual delimiter if at least
 * one side contains Devanagari script characters ([\u0900-\u097F]).
 * Mathematical fractions or divisions (e.g. 16 / 25, km / h) are never split!
 */
export function getLanguageText(
  rawText: string = '',
  language: 'English' | 'Hindi' | 'Bilingual' = 'English'
): string {
  if (!rawText) return '';
  const cleaned = cleanQuestionText(rawText);
  if (language === 'Bilingual') return cleaned;

  // Helper to safely split on bilingual delimiter only if Devanagari is present
  const splitBilingual = (str: string): { english: string; hindi: string } | null => {
    if (!/\s+\/\s+/.test(str)) return null;
    const parts = str.split(/\s+\/\s+/);
    if (parts.length < 2) return null;

    // Strict Rule: At least one part MUST contain Devanagari Hindi characters
    const hasDevanagari = parts.some(p => DEVANAGARI_REGEX.test(p));
    if (!hasDevanagari) {
      return null; // Pure math division / unit / fraction, do not split!
    }

    // Determine English vs Hindi part
    if (DEVANAGARI_REGEX.test(parts[1]) && !DEVANAGARI_REGEX.test(parts[0])) {
      return { english: parts[0].trim(), hindi: parts[1].trim() };
    }
    if (DEVANAGARI_REGEX.test(parts[0]) && !DEVANAGARI_REGEX.test(parts[1])) {
      return { english: parts[1].trim(), hindi: parts[0].trim() };
    }

    return { english: parts[0].trim(), hindi: parts[1].trim() };
  };

  // Check line-by-line bilingual delimiters
  const lines = cleaned.split('\n');
  const hasLineDelimiters = lines.some(l => splitBilingual(l) !== null);

  if (hasLineDelimiters) {
    return lines
      .map(line => {
        const bi = splitBilingual(line);
        if (!bi) return line;
        if (language === 'English') return bi.english || line;
        if (language === 'Hindi') return bi.hindi || bi.english || line;
        return line;
      })
      .join('\n')
      .trim();
  }

  // Check whole-string delimiter
  const wholeBi = splitBilingual(cleaned);
  if (wholeBi) {
    if (language === 'English') return wholeBi.english;
    if (language === 'Hindi') return wholeBi.hindi || wholeBi.english;
  }

  return cleaned;
}

/**
 * Tokenizes text into plain text chunks and LaTeX math chunks for rendering.
 */
export function tokenizeTextWithMath(rawText: string = ''): MathToken[] {
  if (!rawText) return [];

  // Step 1: Normalize \(...\) to $...$ and \[...\] to $$...$$
  let text = rawText
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `$$${eq}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq}$`);

  // Step 2: Wrap any remaining unwrapped fractions (\frac)
  text = wrapUnwrappedFractions(text);

  // Step 3: Combined pattern for:
  // - $$ display math $$
  // - $ inline math $ (opening $ NOT followed by space, closing $ NOT preceded by space)
  // - Unwrapped LaTeX formulas starting with \command (e.g. \sin, \cos, \frac, \sqrt, \theta, \pi, \Delta, \angle, \sim, \cong, etc.)
  const combinedRegex = /(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\(?:frac|sqrt|sin|cos|tan|cot|sec|csc|cosec|theta|pi|alpha|beta|gamma|delta|Delta|angle|sim|cong|times|div|pm|mp|cdot|approx|neq|leq|geq|le|ge|infty|sum|prod|lim|log|ln|text|left|right|rm|mathrm)[a-zA-Z0-9\+\-\*\/\=\(\)\{\}\[\]\^\_\s\.,\\|<>]+?(?=\s+(?:is|are|was|were|if|then|where|find|when|and|with|for|to|of|as|by|in|such|given)\b|[\?\:\.](?:\s|$)|$))/g;

  const tokens: MathToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    let mathStr = match[0].trim();
    let display = false;

    // Guard against arbitrary dollar signs used in substitution reasoning (e.g. "23 $ 45 = 26 and 34 $ 96")
    if (mathStr.startsWith('$') && !mathStr.startsWith('$$')) {
      const inner = mathStr.slice(1, -1);
      // If it contains natural language words like " and " or " then " without \text, it's not a single LaTeX math token
      if (/\s+(?:and|then|where|with|from|between)\s+/i.test(inner) && !/\\text\{/.test(inner)) {
        continue;
      }
    }

    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }

    if (mathStr.startsWith('$$') && mathStr.endsWith('$$')) {
      mathStr = mathStr.slice(2, -2).trim();
      display = true;
    } else if (mathStr.startsWith('$') && mathStr.endsWith('$')) {
      mathStr = mathStr.slice(1, -1).trim();
    }

    tokens.push({ type: 'math', value: mathStr, display });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.substring(lastIndex) });
  }

  return tokens;
}

export function isMathSubject(subject?: string): boolean {
  if (!subject) return false;
  return /quant|math|arithmetic|numerical|algebra|geometry/i.test(subject);
}

const DIRECTIVE_PREFIX = /^(?:Select|Identify|In\s+the|Given\s+below|Choose|Find|Four|Which|Arrange|Read|Direction|Directions|Study|Recognize|Determine|Point|Refer|Fill|Look|Complete|Replace|Spot|State|उस|निम्नलिखित|दिए|दी\s+गई)/i;

/**
 * Splits instructional directive from the main question text.
 * Strictly ignores Quantitative Aptitude / Mathematics questions.
 */
export function splitInstructionAndQuestion(
  text: string = '',
  subject?: string
): { instruction: string | null; content: string } {
  if (!text) return { instruction: null, content: '' };
  if (isMathSubject(subject)) return { instruction: null, content: text };

  const trimmed = text.trim();

  // Case 1: Directive ending with colon ':'
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 10 && colonIdx < 300) {
    const candidateInst = trimmed.substring(0, colonIdx + 1).trim();
    const candidateContent = trimmed.substring(colonIdx + 1).trim();
    const isDirective = DIRECTIVE_PREFIX.test(candidateInst);
    const hasAnalogyOps = /::|[<>=]/.test(candidateInst.slice(0, -1));
    const wordCount = candidateInst.split(/\s+/).length;

    if (candidateContent && !hasAnalogyOps && (isDirective || (wordCount >= 4 && /[a-zA-Z\u0900-\u097F]{3,}/.test(candidateInst)))) {
      return { instruction: candidateInst, content: candidateContent };
    }
  }

  // Case 2: Directive ending with period or newline
  const lines = trimmed.split('\n');
  if (lines.length > 1 && DIRECTIVE_PREFIX.test(lines[0].trim())) {
    const inst = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    if (content) {
      return { instruction: inst, content };
    }
  }

  return { instruction: null, content: trimmed };
}

