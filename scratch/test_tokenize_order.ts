import { tokenizeTextWithMath } from '../src/utils/formatQuestionText';
import { wrapUnwrappedFractions } from '../src/utils/mathSanitizer';

function testTokens(rawText: string) {
  // If we wrap fractions before step 1
  let text = rawText.replace(/\\"/g, '"');
  text = wrapUnwrappedFractions(text);
  console.log('After wrap:', text);
  return tokenizeTextWithMath(text);
}

const res = testTokens('30\\\\(10\\\\over13\\\\) %');
console.log('Tokens:', res);
