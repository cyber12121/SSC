import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const SYSTEM_INSTRUCTION = `You are "Tommy", an elite, analytical, highly encouraging study assistant and exam coach built directly into the candidate's CGL Preparation Portal.

YOUR CORE EXPERTISE:
1. SSC CGL Exam Pattern & Syllabus:
   - Tier 1: 4 sections (Reasoning, General Awareness, Quantitative Aptitude, English Comprehension). 25 questions each, 50 marks each (Total 200 marks, 60 minutes). Marking: +2 for correct, -0.5 for wrong. Cutoff targets: 145-160+ for UR category safety.
   - Tier 2: Mathematical Abilities (30 Qs), Reasoning (30 Qs), English (45 Qs), General Awareness (25 Qs), Computer Knowledge (20 Qs qualifying), plus Data Entry Speed Test. Marking: +3 for correct, -1 for wrong.
   - Subject mastery: Arithmetic & Advanced Maths formulas/shortcuts, English grammar rules (voice, narration, tense, subject-verb agreement) & vocab roots, Reasoning logical patterns & matrices, and high-yielding GK/GS areas (Polity, History, Science, Geography, Economics, Static GK).

3. REAL MOCK TEST CONTEXT & QUESTION SOLUTIONS:
   You have direct access to:
   - The candidate's real mock performance profile, sectional scores, accuracy percentages, and weak topics.
   - Exact questions, options, user choices, correct answers, and step-by-step solutions from their mocks and error bank.
   - Root-Cause Analysis (RCA) classification data: Conceptual gaps [C], silly mistakes [A], time/ego traps [T], and failed guesswork [G], including candidate-recorded silly mistake confessions.
   - Grounded "CANDIDATE ERROR & CONCEPT WEAKNESS MATRIX": Aggregates all user errors by Subject -> Topic -> Subtopic with specific Missed Concepts/Rules.
   When the candidate asks about any question, concept, or test:
   - Quote or reference the exact question and solution steps.
   - Break down the mathematical formula or English grammar rule.
   - Point out why the student's chosen option was wrong and how to eliminate incorrect options in under 30 seconds.
   - If the mistake is tagged as a Silly Mistake [A] or Time/Ego Trap [T], acknowledge their specific habit (e.g. calculation speed panic, misreading keywords) and give them an actionable habit fix to avoid repeating it.

4. TOPIC, SUBTOPIC & CONCEPT WEAKNESS SYNTHESIS:
   When the candidate asks what concepts they are weak in, where they are losing marks, or for a diagnosis of their mistakes:
   - Ground your analysis STRICTLY in the "CANDIDATE ERROR & CONCEPT WEAKNESS MATRIX" provided in context. Never invent counts or topics not present in the matrix.
   - Name the exact Subject, Topic, Subtopic, and the specific Missed Concepts/Rules.

   ALWAYS organize the diagnosis using these 3 Status-Based Tiers (every question has a status, so this ALWAYS works):
   * ❌ Tier 1 — INCORRECT (Wrong answers): Topics where you attempted but chose the wrong option. For each, name the exact missed concept/formula/rule and give a 1-line fix.
   * ⏱ Tier 2 — CORRECT (Slow): Topics where you got it right but took too long (>2x platform average). Give the shortcut/pattern-match trick to solve it in under 45 seconds next time.
   * ⬜ Tier 3 — UNATTEMPTED (Skipped): Topics you left blank. Classify as either (a) "Smart Skip" — genuinely tough, right call; or (b) "Avoidable Skip" — should be attempted with minimal revision, and give the specific revision target.

   BONUS LAYER — If RCA tags [C], [A], [T], [G] are present for some questions, mention them inside the relevant tier as extra context (e.g., "2 of these were tagged as Silly Mistakes [A] by you — the concept is clear, just slow down your first read").
   If no RCA tags exist, skip the bonus layer entirely. Do NOT say "no RCA data available" — just silently omit it.
   - Conclude with a targeted drill recommendation using [DRILL: Topic Name] on its own line.

HOW TO ANSWER:
- Be direct, strategic, highly motivating, and analytical.
- When explaining mathematical or reasoning questions, clearly demonstrate the conceptual approach followed by shortcut tricks or elimination methods.
- For English questions, explain the underlying grammatical rule or contextual vocabulary clue.
- When asked for a study plan or improvement advice, give clear day-wise or priority-based steps with concrete targets (e.g., target accuracy > 85%, cutoff benchmarks).
- Language Flexibility: You are fluent in English, Hindi, and Hinglish. If the candidate asks in Hindi or Hinglish (e.g., "English me score kaise improve kare?", "maths ke weak topics batao"), respond naturally in warm, motivating Hinglish with English terminology for SSC concepts.
- Targeted Drill Recommendation: When the candidate asks for a quiz, test, or practice drill, or when you advise them to practice a specific weak topic, conclude by adding [DRILL: Topic Name] on its own line (e.g. [DRILL: Active & Passive Voice] or [DRILL: Missing Number / Matrix]). The app will automatically render an interactive 1-click test launcher!
- CRITICAL MATHEMATICAL & TEXT FORMATTING RULES:
  * NEVER use LaTeX code or syntax! NEVER write \\frac, \\left, \\right, \\quad, \\text{}, \\times, or $ dollar signs!
  * Write all math, formulas, fractions, and equations in clean, readable plain unicode text:
    - Fractions: Write as a/b or (A / B) (e.g. 1/9, or (Error / (True Value - Error)) × 100).
    - Mixed numbers: Write as 16 2/3% or 11 1/9%.
    - Powers: Use superscripts like x² or (x/10)².
    - Multipliers/Arrows: Use clean symbols like ×, ÷, ±, → (e.g. CP → MP → SP).
    - Percentages: Write as %, never \\%.
    - Parentheses: Use standard ( ), never \\left( or \\right).
- Format responses beautifully using Markdown: bold key terms, use bullet points, tables when presenting comparisons or schedules, and clean math notation.`;

// Pre-aggregates all errors from mock_errors and mock_tests by Subject -> Topic -> Subtopic
function generateTopicAndSubtopicWeaknessSummary(queryText: string): string {
  try {
    const errorDir = path.join(process.cwd(), 'src', 'data', 'mock_errors');
    const testsDir = path.join(process.cwd(), 'src', 'data', 'mock_tests');
    const errorFiles = ['english.json', 'mathematics.json', 'reasoning.json', 'general_awareness.json'];

    interface SubtopicStats {
      name: string;
      wrongCount: number;
      slowCount: number;
      unattemptedCount: number;
      totalCount: number;
      concepts: Set<string>;
      rcaCounts: Record<string, number>;
      sampleQuestions: string[];
    }

    interface TopicStats {
      name: string;
      subject: string;
      subtopics: Map<string, SubtopicStats>;
      totalErrors: number;
    }

    const topicMap = new Map<string, TopicStats>();

    // Track seen question fingerprints to prevent double-counting across mock_errors & mock_tests
    const seenIds = new Set<string>();

    const getQuestionFingerprint = (q: any): string => {
      // Prefer explicit ID, fall back to normalized question text (first 80 chars)
      if (q.id && String(q.id).trim().length > 2) return String(q.id).trim();
      const text = (q.question || q.questionText || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
      return text || `${q.q_num || ''}_${q.testName || ''}`.trim();
    };

    const recordQuestion = (q: any, defaultSubject = 'General') => {
      // Deduplicate: skip if this exact question was already counted from another source
      const fingerprint = getQuestionFingerprint(q);
      if (!fingerprint || seenIds.has(fingerprint)) return;
      seenIds.add(fingerprint);
      const subject = q.subject || defaultSubject;
      const topic = q.topic || q.tags?.topic || 'General';
      const subtopic = q.subtopic || q.tags?.subtopic || topic;
      const concept = q.conceptTested || q.tags?.conceptTested || '';
      const status = (q.status || '').toLowerCase();
      const isSlow = status.includes('slow');
      const isUnattempted = status.includes('unattempted') || status.includes('skipped');
      const isWrong = status.includes('wrong') || status.includes('incorrect') || (!isSlow && !isUnattempted && !status.includes('correct'));

      if (!isWrong && !isSlow && !isUnattempted) return; // Only aggregate mistakes/errors

      const topicKey = `${subject}:::${topic}`;
      if (!topicMap.has(topicKey)) {
        topicMap.set(topicKey, {
          name: topic,
          subject,
          subtopics: new Map(),
          totalErrors: 0
        });
      }

      const tStats = topicMap.get(topicKey)!;
      tStats.totalErrors++;

      if (!tStats.subtopics.has(subtopic)) {
        tStats.subtopics.set(subtopic, {
          name: subtopic,
          wrongCount: 0,
          slowCount: 0,
          unattemptedCount: 0,
          totalCount: 0,
          concepts: new Set(),
          rcaCounts: {},
          sampleQuestions: []
        });
      }

      const sStats = tStats.subtopics.get(subtopic)!;
      sStats.totalCount++;
      if (isWrong) sStats.wrongCount++;
      if (isSlow) sStats.slowCount++;
      if (isUnattempted) sStats.unattemptedCount++;
      if (concept && concept.trim().length > 2) sStats.concepts.add(concept.trim());

      const rcaTag = q.rca?.tag || (q.tags as any)?.rcaTag;
      if (rcaTag) {
        sStats.rcaCounts[rcaTag] = (sStats.rcaCounts[rcaTag] || 0) + 1;
      }

      const qText = (q.question || q.questionText || '').trim();
      if (qText && sStats.sampleQuestions.length < 2) {
        sStats.sampleQuestions.push(qText.slice(0, 100));
      }
    };

    // 1. Ingest from mock_errors (primary source — already filtered to errors only)
    if (fs.existsSync(errorDir)) {
      for (const file of errorFiles) {
        const p = path.join(errorDir, file);
        if (fs.existsSync(p)) {
          try {
            const chapters = JSON.parse(fs.readFileSync(p, 'utf8'));
            for (const ch of chapters) {
              for (const q of ch.questions || []) {
                recordQuestion(q, ch.subject || file.replace('.json', ''));
              }
            }
          } catch {}
        }
      }
    }

    // 2. Ingest errors from mock_tests (seenIds deduplication ensures no double-counting)
    if (fs.existsSync(testsDir)) {
      const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const list = JSON.parse(fs.readFileSync(path.join(testsDir, file), 'utf8'));
          for (const item of list) {
            recordQuestion(item, item.subject || 'General');
          }
        } catch {}
      }
    }

    if (topicMap.size === 0) return '';

    // Sort topics by error volume
    const sortedTopics = Array.from(topicMap.values()).sort((a, b) => b.totalErrors - a.totalErrors);
    const qLower = (queryText || '').toLowerCase();

    let lines: string[] = [];
    lines.push('--- CANDIDATE ERROR & CONCEPT WEAKNESS MATRIX (Grounded from Mock Tests & Error Bank) ---');
    lines.push('This is the factual, aggregate breakdown of candidate mistakes grouped by Subject, Topic, and Subtopic:');

    sortedTopics.forEach(t => {
      const isSubjectMatched = qLower.includes(t.subject.toLowerCase()) || qLower.includes(t.name.toLowerCase());
      const isGeneralQuery = /weak|mistake|concept|score|improve|analyze|insights|strategy|help|where/i.test(qLower);

      if (!isGeneralQuery && !isSubjectMatched && sortedTopics.length > 6) {
        return;
      }

      lines.push(`\n[${t.subject.toUpperCase()} → ${t.name}] (Total Errors: ${t.totalErrors})`);
      t.subtopics.forEach(sub => {
        const rcaParts: string[] = [];
        if (sub.rcaCounts['C']) rcaParts.push(`${sub.rcaCounts['C']} Conceptual Gaps [C]`);
        if (sub.rcaCounts['A']) rcaParts.push(`${sub.rcaCounts['A']} Silly Mistakes [A]`);
        if (sub.rcaCounts['T']) rcaParts.push(`${sub.rcaCounts['T']} Time/Ego Traps [T]`);
        if (sub.rcaCounts['G']) rcaParts.push(`${sub.rcaCounts['G']} Guesswork [G]`);
        const rcaStr = rcaParts.length > 0 ? ` | RCA: ${rcaParts.join(', ')}` : '';

        lines.push(`  • Subtopic: ${sub.name} (Wrong: ${sub.wrongCount}, Slow: ${sub.slowCount}, Skipped: ${sub.unattemptedCount}${rcaStr})`);
        if (sub.concepts.size > 0) {
          lines.push(`    - Specific Missed Concepts/Rules: ${Array.from(sub.concepts).join('; ')}`);
        }
      });
    });

    return lines.join('\n');
  } catch (e) {
    return '';
  }
}

// ── #7: Synonym expansion map for fuzzy question matching ──────────────────
// Keys are user-typed words; values are additional search terms to include
const SEARCH_SYNONYMS: Record<string, string[]> = {
  'boat':        ['stream', 'downstream', 'upstream', 'still water', 'river', 'motorboat'],
  'river':       ['stream', 'downstream', 'upstream', 'boat'],
  'pipe':        ['cistern', 'tap', 'filling', 'emptying', 'tank', 'leak'],
  'tank':        ['cistern', 'pipe', 'tap', 'filling', 'emptying'],
  'profit':      ['cp', 'sp', 'selling price', 'cost price', 'gain', 'loss', 'discount', 'marked price'],
  'loss':        ['cp', 'sp', 'selling price', 'cost price', 'gain', 'discount', 'markup'],
  'discount':    ['marked price', 'selling price', 'cost price', 'mp', 'sp'],
  'interest':    ['principal', 'rate', 'amount', 'compound', 'simple', 'si', 'ci', 'per annum'],
  'train':       ['platform', 'pole', 'bridge', 'crosses', 'length of the train', 'speed'],
  'speed':       ['distance', 'time', 'km/h', 'race', 'circular', 'relative speed'],
  'work':        ['efficiency', 'days', 'worker', 'men', 'women', 'complete'],
  'mixture':     ['alligation', 'alloy', 'milk', 'water', 'ratio', 'vessel'],
  'triangle':    ['geometry', 'circle', 'angle', 'area', 'perimeter', 'tangent', 'chord'],
  'circle':      ['tangent', 'chord', 'secant', 'radius', 'diameter', 'arc', 'geometry'],
  'trigonometry':['sin', 'cos', 'tan', 'cot', 'sec', 'cosec', 'angle', 'height', 'distance'],
  'height':      ['distance', 'elevation', 'depression', 'angle', 'trigonometry'],
  'percentage':  ['percent', 'increase', 'decrease', 'marks', 'population'],
  'ratio':       ['proportion', 'fourth proportional', 'mean proportional'],
  'average':     ['mean', 'age', 'weight', 'salary', 'score'],
  'probability': ['dice', 'cards', 'coin', 'tossed', 'drawn', 'sample space'],
  'voice':       ['active', 'passive', 'subject', 'object', 'verb'],
  'narration':   ['direct', 'indirect', 'speech', 'reported'],
  'analogy':     ['related', 'pair', 'same way', 'as is to'],
  'series':      ['pattern', 'sequence', 'next', 'missing number', 'replace'],
  'direction':   ['north', 'south', 'east', 'west', 'distance', 'walking', 'facing'],
  'blood':       ['relation', 'mother', 'father', 'brother', 'sister', 'son', 'daughter'],
  'coding':      ['decoding', 'code', 'language', 'coded', 'written'],
};

// Question Searcher across mock questions and mock errors
function findRelevantQuestionsAndSolutions(queryText: string, maxResults = 5) {
  if (!queryText || queryText.trim().length < 2) return [];
  const results: any[] = [];
  const qLower = queryText.toLowerCase().trim();

  // Extract explicit question number if present e.g. "question 4", "q 9", "#12"
  const qNumMatch = qLower.match(/\b(?:question|q)\s*#?\s*(\d+)\b/i) || qLower.match(/#(\d+)\b/);
  const targetQNum = qNumMatch ? parseInt(qNumMatch[1], 10) : null;

  // Words to ignore in matching
  const stopWords = new Set(['what', 'which', 'where', 'when', 'how', 'why', 'give', 'show', 'tell', 'explain', 'solution', 'mock', 'data', 'this', 'that', 'with', 'from', 'about', 'the', 'and', 'for']);
  const baseKeywords = qLower.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));

  // Expand keywords using synonym map
  const expandedKeywords = new Set<string>(baseKeywords);
  baseKeywords.forEach(kw => {
    const syns = SEARCH_SYNONYMS[kw];
    if (syns) syns.forEach(s => expandedKeywords.add(s));
    // Also check partial matches in synonym keys
    Object.entries(SEARCH_SYNONYMS).forEach(([key, vals]) => {
      if (kw.includes(key) || key.includes(kw)) {
        expandedKeywords.add(key);
        vals.forEach(v => expandedKeywords.add(v));
      }
    });
  });
  const keywords = Array.from(expandedKeywords);

  const isMatch = (text: string, topic: string, sol: string, qNumStr?: string | number) => {
    // Explicit question number match
    if (targetQNum !== null && qNumStr !== undefined && qNumStr !== null) {
      const parsedNum = typeof qNumStr === 'number' ? qNumStr : parseInt(String(qNumStr).replace(/[^0-9]/g, ''), 10);
      if (parsedNum === targetQNum) return true;
    }
    // Exact phrase match
    if (text.includes(qLower) || topic.includes(qLower) || sol.includes(qLower)) return true;
    // Expanded keyword match (any synonym hit counts)
    if (keywords.length > 0) {
      const matchCount = keywords.filter(kw => text.includes(kw) || topic.includes(kw) || sol.includes(kw)).length;
      // Require at least 2 keyword hits if keywords list is large (reduces false positives)
      return baseKeywords.length > 3 ? matchCount >= 2 : matchCount >= 1;
    }
    return false;
  };

  // 1. Search mock_errors
  try {
    const errorFiles = ['english.json', 'mathematics.json', 'reasoning.json', 'general_awareness.json'];
    for (const file of errorFiles) {
      const p = path.join(process.cwd(), 'src/data/mock_errors', file);
      if (fs.existsSync(p)) {
        const chapters = JSON.parse(fs.readFileSync(p, 'utf8'));
        for (const ch of chapters) {
          for (const q of ch.questions || []) {
            const text = (q.question || '').toLowerCase();
            const topic = (q.tags?.topic || q.topic || '').toLowerCase();
            const subtopic = (q.tags?.subtopic || q.subtopic || '').toLowerCase();
            const sol = (q.solution || '').toLowerCase();
            if (isMatch(text, topic + ' ' + subtopic, sol, q.q_num)) {
              results.push({
                source: `Mock Errors (${ch.subject || file.replace('.json', '')})`,
                topic: q.tags?.topic || q.topic,
                subtopic: q.tags?.subtopic || q.subtopic,
                conceptTested: q.tags?.conceptTested || q.conceptTested,
                question: q.question,
                options: q.options,
                answer: q.answer,
                solution: q.solution
              });
              if (results.length >= maxResults) return results;
            }
          }
        }
      }
    }
  } catch (e) {}

  // 2. Search mock_tests (master directory) or mock_questions
  try {
    const primaryDir = path.join(process.cwd(), 'src/data/mock_tests');
    const legacyDir = path.join(process.cwd(), 'src/data/mock_questions');
    const dir = fs.existsSync(primaryDir) ? primaryDir : (fs.existsSync(legacyDir) ? legacyDir : null);
    if (dir) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        for (const item of list) {
          const text = (item.questionText || item.question || '').toLowerCase();
          const topic = (item.topic || item.tags?.topic || '').toLowerCase();
          const subtopic = (item.subtopic || item.tags?.subtopic || '').toLowerCase();
          const sol = (item.solution || '').toLowerCase();
          if (isMatch(text, topic + ' ' + subtopic, sol, item.questionNumber || item.q_num)) {
            results.push({
              source: `${item.testName || 'Mock Test'} (${item.subject || 'General'})`,
              testName: item.testName || item.test_name,
              platform: item.platform,
              topic: item.topic || item.tags?.topic,
              subtopic: item.subtopic || item.tags?.subtopic,
              conceptTested: item.conceptTested || item.tags?.conceptTested,
              status: item.status,
              chosenOption: item.chosenOption || item.userAnswer || item.selectedAnswer,
              answer: item.correctOption || item.answer,
              userTime: item.userTime || item.user_time || item.timeSpent,
              avgTime: item.avgTime || item.avg_time,
              rca: item.rca,
              question: item.questionText || item.question,
              options: item.options,
              solution: item.solution
            });
            if (results.length >= maxResults) return results;
          }
        }
      }
    }
  } catch (e) {}

  return results;
}

export default async function handler(req: any, res: any) {
  // CORS headers for local and cloud access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your .env or Vercel Environment Variables.'
    });
  }

  try {
    const { messages, mockSummary, activeMockContext, activeReviewQuestions } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
    }

    // Format conversational contents for Gemini
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || m.content || '') }]
    }));

    // Active review questions context (if candidate is currently reviewing a quiz/mock)
    let reviewQuestionsContext = '';
    if (Array.isArray(activeReviewQuestions) && activeReviewQuestions.length > 0) {
      reviewQuestionsContext = `\n--- CURRENT QUIZ/MOCK TEST QUESTIONS & COMPLETE SOLUTIONS (${activeReviewQuestions.length} Questions) ---\n` +
        activeReviewQuestions.map((q: any) => `
[Question #${q.qNum}]
Topic: ${q.topic || 'General'}
Question: ${q.question}
Options: ${JSON.stringify(q.options || {})}
Candidate Chosen Answer: ${q.userAnswer ? q.userAnswer.toUpperCase() : 'Unattempted / Left'}
True Correct Answer: ${q.correctAnswer ? q.correctAnswer.toUpperCase() : 'Refer to solution'}
Result: ${q.isCorrect ? '✅ CORRECT' : '❌ WRONG / SKIPPED'}
Time Spent: ${q.timeSpent ? q.timeSpent + 's' : (q.userTime || 'N/A')} (Platform Avg Time: ${q.avgTime ? q.avgTime + 's' : 'N/A'})
Step-by-step Official Solution:
${q.solution || 'Solution not provided'}
`).join('\n---\n');
    }

    // Dynamic question retrieval based on candidate's query
    const latestUserMsg = messages[messages.length - 1]?.text || '';
    const relevantQs = findRelevantQuestionsAndSolutions(latestUserMsg, 5);
    let matchedQuestionsContext = '';
    if (relevantQs.length > 0) {
      matchedQuestionsContext = `\n--- MATCHED QUESTIONS & SOLUTIONS FROM CANDIDATE'S MOCK DATABASE ---\n` +
        relevantQs.map((q, idx) => `
[Matched Question #${idx + 1} from ${q.source}]
Topic: ${q.topic || 'General'}${q.subtopic ? ` → ${q.subtopic}` : ''}
${q.conceptTested ? `Concept Tested: ${q.conceptTested}\n` : ''}Time: You: ${q.userTime || 'N/A'} | Platform Avg: ${q.avgTime || 'N/A'}
Question: ${q.question}
Options: ${JSON.stringify(q.options || {})}
Correct Answer: ${q.answer || 'Refer to solution'}
Full Solution & Explanation:
${q.solution}
`).join('\n---\n');
    }

    // Generate grounded Topic, Subtopic & Concept Weakness Matrix
    const topicWeaknessMatrix = generateTopicAndSubtopicWeaknessSummary(latestUserMsg);

    const fullSystemInstruction = `${SYSTEM_INSTRUCTION}

${topicWeaknessMatrix ? `\n${topicWeaknessMatrix}\n` : ''}
${mockSummary ? `\n--- CANDIDATE'S CURRENT MOCK PERFORMANCE SUMMARY ---\n${mockSummary}` : ''}
${activeMockContext ? `\n--- ACTIVE MOCK TEST DETAILS ---\n${activeMockContext}` : ''}
${reviewQuestionsContext}
${matchedQuestionsContext}
`;

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: fullSystemInstruction,
        temperature: 0.7
      }
    });

    const reply = response.text || 'I apologize, but I could not generate a response at this moment.';
    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error('[Gemini Chat Error]:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat with Gemini.'
    });
  }
}
