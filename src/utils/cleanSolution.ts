import { reconstructScrapedMath, reconstructScrapedSolutionMath, wrapUnwrappedFractions } from './mathSanitizer';

/**
 * Utility to clean solutions:
 * - Replaces escaped literal '\\n' with actual newlines
 * - Removes Windows carriage returns
 * - Reconstructs scraped vertical MathML and broken math columns
 * - Eliminates excessive and multiple blank lines
 * - Groups continuous calculation steps, given data, and equations cleanly
 * - Preserves both English and Hindi sections dynamically
 */
export function cleanSolutionText(sol: string = ''): string {
  if (!sol) return '';

  // 1. Strip residual HTML tags and partial tag artifacts from scraper output
  // e.g. "<p>Given:" → "Given:", "p>Given:" → "Given:", "<br/>" → "\n"
  let s = String(sol)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[a-zA-Z][^>]*>/g, '')   // Remove opening tags like <p>, <span class="...">
    .replace(/<\/[a-zA-Z]+>/g, '')     // Remove closing tags like </p>, </span>
    .replace(/\bp>/gi, '')             // Remove partial "p>" artifacts (unbalanced scraper tag)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

  // 1b. Wrap unwrapped \frac formulas before extracting math placeholders
  s = wrapUnwrappedFractions(s);

  // 2. Temporarily extract and preserve math blocks ($$...$$, $...$, \[...\], \(...\))
  const mathPlaceholders: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\$(?!\s)[^\$]+?(?<!\s)\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
    const placeholder = `___MATH_BLOCK_${mathPlaceholders.length}___`;
    mathPlaceholders.push(m);
    return placeholder;
  });

  // 2. Decode literal unicode escapes like \u00f7 (÷) and \u00d7 (×)
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  });

  // 3. Replace escaped literal '\n' and carriage returns
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');

  // 4. Reconstruct vertical scraped MathML before line collapsing
  s = reconstructScrapedSolutionMath(s);

  // 4b. Normalize plain-text unit exponents (e.g. cm^2 -> cm², cm\n3 -> cm³, cm3 -> cm³, m^3 -> m³)
  // Mirrors the same fix in formatQuestionText.ts — only targets known measurement units
  s = s
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\s*\n+\s*([23])\b/gi, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(m)\s*\n+\s*([23])\b/g, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\^2\b/g, '$1²')
    .replace(/\b(cm|mm|km|sq\.?|cu\.?)\^3\b/g, '$1³')
    .replace(/\b(cm|mm|km)\s*([23])\b(?!\d)/gi, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`)
    .replace(/\b(m)\^2\b(?!\w)/g, 'm²')
    .replace(/\b(m)\^3\b(?!\w)/g, 'm³')
    .replace(/\b(m)\s*([23])\b(?!\d)/g, (_, u, p) => `${u}${p === '2' ? '²' : '³'}`);

  // 5. Purge diagram artifacts scraped from visual Testbook infographics
  s = purgeScrapedDiagramArtifacts(s);

  // 6. Trim whitespace on each line
  const lines = s.split('\n').map(l => l.trim());

  // 4. Collapse consecutive empty lines (no more than 1 blank line anywhere)
  const collapsed: string[] = [];
  let prevEmpty = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (!prevEmpty && collapsed.length > 0) {
        collapsed.push('');
        prevEmpty = true;
      }
    } else {
      collapsed.push(line);
      prevEmpty = false;
    }
  }

  // 5. Remove unnecessary empty lines between related sequential lines
  const resultLines: string[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const line = collapsed[i];
    if (line === '') {
      const prev = resultLines[resultLines.length - 1] || '';
      const next = collapsed[i + 1] || '';

      const isCalcOrStep = (str: string) => {
        if (!str) return false;
        // Symbol / bullet / step markers
        if (/^([⇒=>∴\*\-•–—]|\d+[\.\)]|[a-zA-Z][\.\)]|step\s*\d+|case\s*\d+|statement\s*[ivx\d]+)/i.test(str)) return true;
        // Short equation or definition
        if (/^[^.!?\n]{1,60}\s*[=:≈]\s*.+/i.test(str)) return true;
        // Data assignments
        if (/^(total|initial|new|remaining|cost|selling|profit|loss|let|where|now|hence|therefore|since|side|height|radius|speed|distance|work|principal|rate|time|passing|difference|marks)\b/i.test(str) && str.length < 80) return true;
        return false;
      };

      const isHeaderOrLabel = (str: string) => {
        return /^(given|formula used|calculations?|numerator|denominator|value|final value|where|let|note|method|steps?|shortcut trick|alternate method|key points?|additional information|in news|why the other options are incorrect|further insights?):?$/i.test(str);
      };

      // Don't leave an empty line immediately following a section label
      if (isHeaderOrLabel(prev)) {
        continue;
      }

      // Don't leave an empty line between consecutive equation or calculation steps
      if (isCalcOrStep(prev) && isCalcOrStep(next)) {
        continue;
      }

      // Keep final conclusion line tight if preceded by calculation
      if (/^[∴\s]*(the\s+)?(correct\s+)?answer\s+(is|will be)/i.test(next) && isCalcOrStep(prev)) {
        continue;
      }
    }
    resultLines.push(line);
  }

  let finalResult = resultLines.join('\n').trim();
  mathPlaceholders.forEach((math, idx) => {
    finalResult = finalResult.replace(`___MATH_BLOCK_${idx}___`, () => math);
  });

  return finalResult;
}

/**
 * Extracts language-specific solution from solution text.
 * Respects '📖 हिंदी स्पष्टीकरण :' and '📖 English Explanation :' boundaries.
 */
export function extractSolutionLanguage(
  sol: string = '',
  language: 'English' | 'Hindi' | 'Bilingual' | string = 'English'
): string {
  if (!sol) return '';
  const cleaned = cleanSolutionText(sol);
  if (language === 'Bilingual') return cleaned;

  const hindiSplitRegex = /📖\s*हिंदी\s*स्पष्टीकरण\s*:/i;
  const hasHindiSplit = hindiSplitRegex.test(cleaned);

  if (hasHindiSplit) {
    const parts = cleaned.split(hindiSplitRegex);
    if (language === 'Hindi') {
      return (parts[1] || parts[0]).trim();
    }
    // English
    return parts[0].replace(/📖\s*English\s*Explanation\s*:/gi, '').trim();
  }

  return cleaned;
}

/**
 * Strips isolated diagram column fragments left over from scraped visual infographics
 */
export function purgeScrapedDiagramArtifacts(text: string = ''): string {
  if (!text) return '';

  // 1. Matches: Formula Used: ... followed by diagram fragments before Calculations / Steps
  const pattern1 = /(Formula\s+Used:?\s*\n(?:[^\n]+\n)+?)([\s\S]*?)(\n\s*(?:Calculations?|Calculation|Step|Steps):?)/gi;
  let res = text.replace(pattern1, (match, formulaPart, middlePart, calcPart) => {
    const lines = middlePart.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.every((l: string) => l.length < 40 && !l.startsWith('⇒') && !l.startsWith('Let ') && !l.startsWith('∴'))) {
      return formulaPart.trimEnd() + '\n\n' + calcPart.trimStart();
    }
    return match;
  });

  // 2. Matches standalone clusters of diagram numbers or axis labels (e.g. -2, 11, Smallest, Middle)
  const diagramLinesPattern = /(?:^|\n)(?:[-+]\d+\n)+(?:Smallest|Largest|Middle|Average|\(Middle\)|Initial|Final|\d+\s*\/\s*\d+)/gi;
  res = res.replace(diagramLinesPattern, '');

  return res;
}

export interface SolutionSection {
  type: 'shortcut' | 'given' | 'formula' | 'calculation' | 'additional' | 'method' | 'general';
  title?: string;
  content: string;
}

/**
 * Splits a solution into structured sections:
 * - Shortcut Trick
 * - Given Data
 * - Formula Used
 * - Step-by-Step Calculations
 * - Additional Information / Key Concepts
 */
export function parseSolutionSections(solText: string = ''): SolutionSection[] {
  if (!solText) return [];
  let text = solText.replace(/^Solution\s*\n+/i, '').trim();

  const headerRegex = /(?<=^|\n)\s*(Shortcut Trick|Alternate Method|Method\s+\d+|Traditional Method|Given|Formula Used|Calculations?|Steps?|Additional Information|Key Points?|Note)\s*:?(?:\s*\n+|$)/gi;

  const splits: { header: string; index: number; headerLength: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    splits.push({
      header: match[1].trim().replace(/:$/, ''),
      index: match.index,
      headerLength: match[0].length,
    });
  }

  if (splits.length === 0) {
    return [{ type: 'general', content: text }];
  }

  const sections: SolutionSection[] = [];

  // Content before first header
  if (splits[0].index > 0) {
    const preContent = text.substring(0, splits[0].index).trim();
    if (preContent) {
      sections.push({ type: 'general', content: preContent });
    }
  }

  for (let i = 0; i < splits.length; i++) {
    const s = splits[i];
    const startIndex = s.index + s.headerLength;
    const endIndex = i + 1 < splits.length ? splits[i + 1].index : text.length;
    const content = text.substring(startIndex, endIndex).trim();

    const hLower = s.header.toLowerCase();
    let type: SolutionSection['type'] = 'general';
    if (hLower.includes('shortcut')) type = 'shortcut';
    else if (hLower.includes('formula')) type = 'formula';
    else if (hLower.includes('given')) type = 'given';
    else if (hLower.includes('calc') || hLower.includes('step')) type = 'calculation';
    else if (hLower.includes('additional') || hLower.includes('key point')) type = 'additional';
    else if (hLower.includes('alternate') || hLower.includes('method') || hLower.includes('traditional')) type = 'method';

    if (content) {
      sections.push({
        type,
        title: s.header,
        content,
      });
    }
  }

  return sections;
}


