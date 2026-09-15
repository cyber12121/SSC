/**
 * Utility to clean solutions:
 * - Replaces escaped literal '\\n' with actual newlines
 * - Removes Windows carriage returns
 * - Eliminates excessive and multiple blank lines
 * - Groups continuous calculation steps, given data, and equations cleanly
 */
export function cleanSolutionText(sol: string = ''): string {
  if (!sol) return '';

  // 1. Decode literal unicode escapes like \u00f7 (÷) and \u00d7 (×)
  let s = sol.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  });

  // 2. Replace escaped literal '\n' and carriage returns
  s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');

  // 3. Remove language header tags if present
  const parts = s.split(/📖\s*हिंदी\s*स्पष्टीकरण\s*:/i);
  s = parts[0].replace(/📖\s*English\s*Explanation\s*:/gi, '').trim();

  // 3. Trim whitespace on each line
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
        return /^(given|formula used|calculations?|where|let|note|method|steps?|shortcut trick|alternate method|key points?|additional information|in news|why the other options are incorrect|further insights?):?$/i.test(str);
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

  return resultLines.join('\n').trim();
}
