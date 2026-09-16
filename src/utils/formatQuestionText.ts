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

export interface MathToken {
  type: 'text' | 'math';
  value: string;
  display?: boolean;
}

/**
 * Normalizes and cleans question/option text while strictly preserving LaTeX math blocks.
 */
export function cleanQuestionText(text: string = ''): string {
  if (!text) return '';
  let s = String(text);

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

  // 5. Format Para Jumbles & Sentence sequences
  s = s.replace(/([^\n])\s*(S[1-6]\s*:)/g, '$1\n$2');
  s = s.replace(/([^\n])\s*([PQRS]\s*:|\([PQRS]\)\s*|\[[PQRS]\]\s*)/g, '$1\n$2');

  // Statements & Conclusions in Reasoning questions
  s = s.replace(/([^\n])\s*(Statement\s+[I|V|X|\d]+:?|Conclusion\s+[I|V|X|\d]+:?)/gi, '$1\n$2');

  // 6. If question ends with ? followed by an equation or number without newline
  s = s.replace(/\?([ \t]*)(?=[0-9A-Za-z\+\-\*\/÷×=]+\s*[\+\-\*\/÷×=]\s*[0-9A-Za-z])/g, '?\n');

  // 7. Clean up trailing spaces on lines & collapse multiple empty lines
  s = s
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 8. Restore preserved math blocks
  mathPlaceholders.forEach((math, idx) => {
    s = s.replace(`___MATH_BLOCK_${idx}___`, math);
  });

  return s;
}

/**
 * Extracts language-specific text from bilingual strings ("English / Hindi")
 */
export function getLanguageText(
  rawText: string = '',
  language: 'English' | 'Hindi' | 'Bilingual' = 'English'
): string {
  if (!rawText) return '';
  const cleaned = cleanQuestionText(rawText);
  if (language === 'Bilingual') return cleaned;

  // Split lines to check for line-by-line or whole-text bilingual delimiter
  const lines = cleaned.split('\n');
  const hasLineDelimiters = lines.some(l => /\s+\/\s+/.test(l));

  if (hasLineDelimiters) {
    return lines
      .map(line => {
        const parts = line.split(/\s+\/\s+/);
        if (language === 'English') return parts[0]?.trim() || line;
        if (language === 'Hindi') return parts[1]?.trim() || parts[0]?.trim() || line;
        return line;
      })
      .join('\n')
      .trim();
  }

  // Check whole-string delimiter
  const parts = cleaned.split(/\s+\/\s+/);
  if (parts.length > 1) {
    if (language === 'English') return parts[0].trim();
    if (language === 'Hindi') return parts[1].trim() || parts[0].trim();
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

  // Step 2: Combined pattern for:
  // - $$ display math $$
  // - $ inline math $ (opening $ NOT followed by space, closing $ NOT preceded by space)
  // - Unwrapped LaTeX formulas starting with \command (e.g. \sin, \cos, \frac, \sqrt, \theta, \pi, etc.)
  const combinedRegex = /(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\(?:frac|sqrt|sin|cos|tan|cot|sec|csc|cosec|theta|pi|alpha|beta|gamma|delta|times|div|pm|mp|cdot|degree|circ|approx|neq|leq|geq|le|ge|infty|sum|prod|lim|log|ln|text|left|right|rm|mathrm)[a-zA-Z0-9\+\-\*\/\=\(\)\{\}\[\]\^\_\s\.,\\|<>]+?(?=\s+(?:is|are|was|were|if|then|where|find|when|and|with|for|to|of|as|by|in|such|given)\b|[\?\:\.](?:\s|$)|$))/g;

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
