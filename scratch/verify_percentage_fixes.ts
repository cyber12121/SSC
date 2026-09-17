import fs from 'fs';
import katex from 'katex';
import { cleanQuestionText, tokenizeTextWithMath } from '../src/utils/formatQuestionText';
import { sanitizeLatexForKatex } from '../src/utils/mathSanitizer';
import { cleanSolutionText } from '../src/utils/cleanSolution';

function verifyQuestion(q: any, source: string) {
  console.log(`\n========================================`);
  console.log(`Verifying from: ${source}`);
  const qText = q.questionText || q.question;
  console.log(`Question: ${qText}`);

  // Test question tokens
  const qTokens = tokenizeTextWithMath(qText);
  for (const t of qTokens) {
    if (t.type === 'math') {
      const san = sanitizeLatexForKatex(t.value);
      const html = katex.renderToString(san, { throwOnError: false });
      if (html.includes('katex-error')) {
        throw new Error(`KaTeX error in question math: "${t.value}" -> "${san}"`);
      }
    }
  }
  console.log(`  Question text KaTeX check: PASSED`);

  // Test options
  for (const [key, val] of Object.entries(q.options || {})) {
    const optTokens = tokenizeTextWithMath(val as string);
    for (const t of optTokens) {
      if (t.type === 'math') {
        const san = sanitizeLatexForKatex(t.value);
        const html = katex.renderToString(san, { throwOnError: false });
        if (html.includes('katex-error')) {
          throw new Error(`KaTeX error in option ${key}: "${t.value}" -> "${san}"`);
        }
      }
    }
    console.log(`  Option ${key}: "${val}" -> PASSED`);
  }

  // Test solution
  const solText = q.solution?.text || q.solution || '';
  const cleanedSol = cleanSolutionText(solText);
  const solTokens = tokenizeTextWithMath(cleanedSol);
  let mathCount = 0;
  for (const t of solTokens) {
    if (t.type === 'math') {
      mathCount++;
      const san = sanitizeLatexForKatex(t.value);
      const html = katex.renderToString(san, { throwOnError: false });
      if (html.includes('katex-error')) {
        throw new Error(`KaTeX error in solution math: "${t.value}" -> "${san}"`);
      }
    }
  }
  console.log(`  Solution checked (${mathCount} math expressions): PASSED`);
}

// 1. Check mock questions file
const mockData = JSON.parse(fs.readFileSync('src/data/mock_questions/mock_1789628610492_0h079.json', 'utf8'));
verifyQuestion(mockData[10], 'mock_1789628610492_0h079.json (Q7)');
verifyQuestion(mockData[14], 'mock_1789628610492_0h079.json (Q8)');

// 2. Check mathematics.json file
const mathData = JSON.parse(fs.readFileSync('src/data/mock_errors/mathematics.json', 'utf8'));
for (const ch of mathData) {
  for (const q of ch.questions) {
    if (q.id === 'math_bf90242f35' || q.id === 'math_9f2da87d9a') {
      verifyQuestion(q, `mathematics.json (${q.id} in ${ch.chapter_title})`);
    }
  }
}

console.log('\n>>> ALL PERCENTAGE QUESTION VERIFICATIONS PASSED WITH 0 ERRORS! <<<');
