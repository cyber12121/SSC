import katex from 'katex';
import { cleanQuestionText, tokenizeTextWithMath } from '../src/utils/formatQuestionText';
import { sanitizeLatexForKatex } from '../src/utils/mathSanitizer';

function testPipeline(input: string, label: string) {
  console.log(`=== Testing ${label} ===`);
  console.log('Original:', JSON.stringify(input));
  const cleaned = cleanQuestionText(input);
  console.log('Cleaned:', JSON.stringify(cleaned));
  const tokens = tokenizeTextWithMath(input);
  console.log('Tokens:', tokens);

  tokens.forEach((t, i) => {
    if (t.type === 'math') {
      const sanitized = sanitizeLatexForKatex(t.value);
      try {
        const html = katex.renderToString(sanitized, { throwOnError: false });
        const hasError = html.includes('katex-error');
        console.log(`  Token ${i} [MATH]: val="${t.value}" san="${sanitized}" error=${hasError}`);
      } catch (err: any) {
        console.log(`  Token ${i} [MATH EXCEPTION]:`, err.message);
      }
    } else {
      console.log(`  Token ${i} [TEXT]: "${t.value}"`);
    }
  });
}

// Test cases
testPipeline('Number \\"A\\" is increased by 20%, then decreased by 30%, and is finally increased by 50%.', 'Q7 text');
testPipeline('\\\\(21\\\\over 22\\\\)', 'Q7 Option A');
testPipeline('30\\\\(10\\\\over13\\\\) %', 'Q8 Option A');
