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

import { reconstructScrapedMath, wrapUnwrappedFractions, cleanAlgebraPowers, normalizeListCommas } from './mathSanitizer';

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
  let s = String(text);

  // Decode literal escaped quotes from scrapers (e.g. \"A\" -> "A")
  s = s.replace(/\\"/g, '"');

  // Strip residual redundant options block appended at the end of question statements
  s = s.replace(/\n\s*Options:\s*\n\s*A:[\s\S]+$/i, '');

  // Protect single dollar signs used as operators in reasoning (e.g. "'$'", "num $ num", "$ stands for")
  s = s.replace(/(['"`])\$(['"`])/g, '$1___DOLLAR_SYM___$2');
  s = s.replace(/(\b\d+)\s*\$\s*(\d+\b)/g, '$1 ___DOLLAR_SYM___ $2');
  s = s.replace(/\$\s+(stands\s+for)/gi, '___DOLLAR_SYM___ $1');
  s = s.replace(/(stands\s+for\s+['"`]?)\$/gi, '$1___DOLLAR_SYM___');
  s = s.replace(/([@%#*^]\s*\d+\s*)\$(\s*\d+)/g, '$1___DOLLAR_SYM___$2');

  // Normalize multiple backslashes on math delimiters: e.g. \\( -> \(, \\) -> \)
  s = s.replace(/\\+\(/g, '\\(').replace(/\\+\)/g, '\\)');
  s = s.replace(/\\+\[/g, '\\[').replace(/\\+\]/g, '\\]');

  // Normalize spaces inside dollar delimiters: only if not containing natural language words
  s = s.replace(/\$([^\$\n]+?)\$/g, (m, inner) => {
    const trimmed = inner.trim();
    if (/\b(?:stands|then|find|which|option|select)\b/i.test(trimmed)) {
      return m;
    }
    return trimmed ? `$${trimmed}$` : '$$';
  });

  s = wrapUnwrappedFractions(s);

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

  // 5c. Repair broken words accidentally split across newlines before colons
  // (e.g. "AFTE\nR :" -> "AFTER :", "OQ\nS :" -> "OQS :", "BODMA\nS :" -> "BODMAS :", "C\nP :" -> "CP :")
  s = s.replace(/([A-Za-z]{2,})\s*\n+\s*([A-Za-z])\s*:/g, '$1$2 :');

  // Para Jumble line breaks (strictly require preceding punctuation, newline or start of string, NEVER breaking inside words or before analogies/equations)
  s = s.replace(/(?<=[.!?]|\n|^)\s*(S[1-6]\s*:)/g, '\n$1');
  s = s.replace(/(?<=[.!?]|\n|^)\s*([PQRS]\s*:|\([PQRS]\)\s*|\[[PQRS]\]\s*)(?!\s*[:=])/g, '\n$1');

  // Statements & Conclusions in Reasoning questions
  s = s.replace(/([^\n])\s*(Statement\s+[I|V|X|\d]+:?|Conclusion\s+[I|V|X|\d]+:?)/gi, '$1\n$2');

  // 6. Reasoning Analogy & Proportion normalizations:
  // - Convert spaced double colons (e.g. " : : " or ": :") into clean " :: "
  s = s.replace(/\s*:\s*:\s*/g, ' :: ');
  // - Clean redundant spacing around analogy/ratio single colons while avoiding URLs or time (e.g. "12:00", "http://")
  s = s.replace(/(?<=[A-Za-z0-9?])\s+:\s+(?=[A-Za-z0-9?])/g, ' : ');
  // - Ensure directive ending with a period/question mark followed immediately by an analogy is placed on a fresh line
  s = s.replace(/([.?!])\s+(?=(?:[A-Za-z0-9,\s\-']+\s*:\s*[A-Za-z0-9,\s\-']+\s*::|[A-Za-z0-9]+\s*:\s*[A-Za-z0-9]+\s*:\s*[A-Za-z0-9]+\s*:))/g, '$1\n\n');

  // 7. If question ends with ? followed by an equation or number without newline
  s = s.replace(/\?([ \t]*)(?=[0-9A-Za-z\+\-\*\/÷×=]+\s*[\+\-\*\/÷×=]\s*[0-9A-Za-z])/g, '?\n');

  // 8. Clean up trailing spaces on lines & collapse multiple empty lines
  s = s
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 8b. Normalize algebraic powers (e.g. 3x^2 -> 3x², x^3 -> x³) and list commas (e.g. 0,1 -> 0, 1)
  s = cleanAlgebraPowers(s);
  s = normalizeListCommas(s);

  // 9. Restore preserved math blocks safely
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  // Restore protected literal dollar signs
  s = s.replace(/___DOLLAR_SYM___/g, '$');

  return s;
}

/**
 * Extracts language-specific text from bilingual strings ("English / Hindi")
 * When language is English (default), ensures all Hindi text is completely purged.
 */
export function getLanguageText(
  rawText: string = '',
  language: 'English' | string = 'English'
): string {
  if (!rawText) return '';
  const cleaned = cleanQuestionText(rawText);

  // If language is English (or default), strip all Devanagari Hindi text
  if (language === 'English' || !language) {
    let eng = cleaned.replace(/📖\s*हिंदी\s*स्पष्टीकरण\s*:[\s\S]*/i, '').trim();
    if (!DEVANAGARI_REGEX.test(eng)) {
      return eng;
    }

    const lines = eng.split('\n');
    const cleanedLines: string[] = [];
    for (const line of lines) {
      const l = line.trim();
      const m = l.match(DEVANAGARI_REGEX);
      if (!m || m.index === undefined) {
        cleanedLines.push(line);
      } else {
        const engPart = l.substring(0, m.index).trim().replace(/\s*\/$/, '');
        if (/[A-Za-z]{2,}/.test(engPart)) {
          cleanedLines.push(engPart);
        }
      }
    }
    const res = cleanedLines.join('\n').trim();
    return res || eng;
  }

  // If language is Hindi:
  if (language === 'Hindi') {
    const hindiSectionMatch = cleaned.match(/📖\s*हिंदी\s*स्पष्टीकरण\s*:([\s\S]*)/i);
    if (hindiSectionMatch && hindiSectionMatch[1].trim()) {
      return hindiSectionMatch[1].trim();
    }
    const lines = cleaned.split('\n');
    const hindiLines: string[] = [];
    for (const line of lines) {
      if (line.includes(' / ')) {
        const parts = line.split(' / ');
        const hPart = parts.find(p => DEVANAGARI_REGEX.test(p));
        if (hPart) hindiLines.push(hPart.trim());
        else hindiLines.push(line);
      } else {
        const m = line.match(DEVANAGARI_REGEX);
        if (m && m.index !== undefined) {
          hindiLines.push(line.substring(m.index).trim());
        } else {
          hindiLines.push(line);
        }
      }
    }
    return hindiLines.join('\n').trim();
  }

  return cleaned;
}

/**
 * Tokenizes text into plain text chunks and LaTeX math chunks for rendering.
 */
export function tokenizeTextWithMath(rawText: string = ''): MathToken[] {
  if (!rawText) return [];

  // Step 0: Clean escaped quotes and normalize double-escaped delimiters
  let text = rawText.replace(/\\"/g, '"');
  text = text.replace(/\\+\(/g, '\\(').replace(/\\+\)/g, '\\)');
  text = text.replace(/\\+\[/g, '\\[').replace(/\\+\]/g, '\\]');

  // Step 1: Wrap unwrapped fractions (\frac and \over) including mixed fractions
  text = wrapUnwrappedFractions(text);

  // Step 2: Normalize \(...\) to $...$ and \[...\] to $$...$$
  text = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `$$${eq}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq}$`);

  // Clean trailing or leading backslashes inside math delimiters: e.g. \$...$ -> $...$, $...\$ -> $...$
  text = text.replace(/\\+\$([^$]+?)\$/g, '$$$1$$');
  text = text.replace(/\$([^$]+?)\\+\$/g, '$$$1$$');

  // Protect single dollar signs used as operators in reasoning (e.g. "'$'", "num $ num", "$ stands for")
  text = text.replace(/(['"`])\$(['"`])/g, '$1___DOLLAR_SYM___$2');
  text = text.replace(/(\b\d+)\s*\$\s*(\d+\b)/g, '$1 ___DOLLAR_SYM___ $2');
  text = text.replace(/\$\s+(stands\s+for)/gi, '___DOLLAR_SYM___ $1');
  text = text.replace(/(stands\s+for\s+['"`]?)\$/gi, '$1___DOLLAR_SYM___');
  text = text.replace(/([@%#*^]\s*\d+\s*)\$(\s*\d+)/g, '$1___DOLLAR_SYM___$2');

  // Normalize spaces inside dollar delimiters: only if valid math expression
  text = text.replace(/\$([^\$\n]+?)\$/g, (m, inner) => {
    const trimmed = inner.trim();
    if (/\b(?:stands|then|find|which|option|select|value)\b/i.test(trimmed)) {
      return m;
    }
    return trimmed ? `$${trimmed}$` : '$$';
  });

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
    if (mathStr.includes('___DOLLAR_SYM___')) {
      continue;
    }

    if (mathStr.startsWith('$') && !mathStr.startsWith('$$')) {
      const inner = mathStr.slice(1, -1);
      // If it contains natural language words like " and " or " then " without \text, it's not a single LaTeX math token
      if (/\s+(?:and|then|where|with|from|between)\s+/i.test(inner) && !/\\text\{/.test(inner)) {
        continue;
      }
    }

    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.substring(lastIndex, match.index).replace(/___DOLLAR_SYM___/g, '$') });
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
    tokens.push({ type: 'text', value: text.substring(lastIndex).replace(/___DOLLAR_SYM___/g, '$') });
  }

  return tokens;
}

export function isMathSubject(subject?: string): boolean {
  if (!subject) return false;
  return /quant|math|arithmetic|numerical|algebra|geometry/i.test(subject);
}

const DIRECTIVE_PREFIX = /^(?:Select|Identify|In\s+the|Given\s+below|Choose|Find|Four|Which|Arrange|Read|Direction|Directions|Study|Recognize|Determine|Point|Refer|Fill|Look|Complete|Replace|Spot|State|Letter\s+Analogy|Word\s+Analogy|Number\s+Analogy|उस|निम्नलिखित|दिए|दी\s+गई)/i;

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

  // Case 1: Multi-line text where the first line is a directive
  const lines = trimmed.split('\n');
  if (lines.length > 1 && DIRECTIVE_PREFIX.test(lines[0].trim())) {
    const inst = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    if (content) {
      return { instruction: inst, content };
    }
  }

  // Case 2: Directive ending with colon ':' on the first line (e.g. "Letter Analogy: GFEH : MLKN :: ONMP : ?" or "Directions:")
  // Strict rule: The colon MUST be on the first line, and candidateInst must NOT look like an analogy term (e.g. "AFTER :")
  const firstLine = lines[0].trim();
  const colonIdx = firstLine.indexOf(':');
  if (colonIdx > 8 && colonIdx < 120) {
    const candidateInst = firstLine.substring(0, colonIdx + 1).trim();
    const remainingFirstLine = firstLine.substring(colonIdx + 1).trim();
    const candidateContent = [remainingFirstLine, ...lines.slice(1)].filter(Boolean).join('\n').trim();
    const isDirective = DIRECTIVE_PREFIX.test(candidateInst);
    const hasAnalogyOps = /::|[<>=]/.test(candidateInst);
    const isAnalogyTerm = /^[A-Z0-9,\s\-']{1,10}\s*:?$/.test(candidateInst) || candidateInst.split(/\s+/).length < 2;

    if (candidateContent && isDirective && !hasAnalogyOps && !isAnalogyTerm) {
      return { instruction: candidateInst, content: candidateContent };
    }
  }

  // Case 3: Single line where directive ends with a period/question mark followed by an analogy or question content
  // e.g. "Select the option... related to 1st number. 25 : 37 :: 64 : ?"
  const periodMatch = trimmed.match(/^([A-Z\u0900-\u097F][^.!?\n]*[.?!])\s+((?:[A-Za-z0-9,\s\-']+\s*:\s*[A-Za-z0-9,\s\-']+\s*::|[\d\s,]+:\s*[\d\s,]+|.+:\s*.+))/);
  if (periodMatch && DIRECTIVE_PREFIX.test(periodMatch[1])) {
    return { instruction: periodMatch[1].trim(), content: periodMatch[2].trim() };
  }

  return { instruction: null, content: trimmed };
}

