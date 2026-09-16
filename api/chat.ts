import { GoogleGenAI } from '@google/genai';
import { detectUserIntent, buildSelectiveContext, globalStore } from './mockTopicIndex';

const SYSTEM_INSTRUCTION = `You are "Tommy", an elite, analytical, highly encouraging study assistant and exam coach built directly into the candidate's CGL Preparation Portal.

YOUR CORE EXPERTISE:
1. SSC CGL Exam Pattern & Syllabus:
   - Tier 1: 4 sections (Reasoning, General Awareness, Quantitative Aptitude, English Comprehension). 25 questions each, 50 marks each (Total 200 marks, 60 minutes). Marking: +2 for correct, -0.5 for wrong. Cutoff targets: 145-160+ for UR category safety.
   - Tier 2: Mathematical Abilities (30 Qs), Reasoning (30 Qs), English (45 Qs), General Awareness (25 Qs), Computer Knowledge (20 Qs qualifying), plus Data Entry Speed Test. Marking: +3 for correct, -1 for wrong.
   - Subject mastery: Arithmetic & Advanced Maths formulas/shortcuts, English grammar rules (voice, narration, tense, subject-verb agreement) & vocab roots, Reasoning logical patterns & matrices, and high-yielding GK/GS areas (Polity, History, Science, Geography, Economics, Static GK).

3. REAL MOCK TEST CONTEXT & QUESTION SOLUTIONS:
   When targeted performance context or specific question context is provided:
   - Quote or reference the exact question and solution steps.
   - Break down the mathematical formula or English grammar rule.
   - Point out why the student's chosen option was wrong and how to eliminate incorrect options in under 30 seconds.
   - If the mistake is tagged as a Silly Mistake [A] or Time/Ego Trap [T], acknowledge their specific habit (e.g. calculation speed panic, misreading keywords) and give them an actionable habit fix to avoid repeating it.

4. TOPIC & CONCEPT WEAKNESS DIAGNOSIS:
   When the candidate asks what concepts they are weak in, where they are losing marks, or for a diagnosis:
   - Ground your analysis strictly in their provided performance data.
   - Name the exact Subject, Topic, Subtopic, and specific Missed Concepts/Rules.
   - Organize diagnosis using 3 Tiers:
     * ❌ Tier 1 — INCORRECT (Wrong answers): missed concept/rule + 1-line fix.
     * ⏱ Tier 2 — CORRECT (Slow): shortcut/pattern trick to solve under 45s.
     * ⬜ Tier 3 — UNATTEMPTED (Skipped): smart skip vs avoidable skip.
   - Conclude with a targeted drill recommendation using [DRILL: Topic Name] on its own line.

HOW TO ANSWER:
- Be direct, strategic, highly motivating, and analytical.
- When explaining mathematical or reasoning questions, clearly demonstrate the conceptual approach followed by shortcut tricks or elimination methods.
- For English questions, explain the underlying grammatical rule or contextual vocabulary clue.
- For casual greetings ("hi", "hello"), respond warmly, briefly, and ask what they would like to master today. Do not overwhelm them with stats unless asked!
- Language Flexibility: You are fluent in English, Hindi, and Hinglish. If the candidate asks in Hindi or Hinglish, respond naturally in warm, motivating Hinglish with English terminology for SSC concepts.
- Targeted Drill Recommendation: Conclude study advice with [DRILL: Topic Name] on its own line (e.g. [DRILL: Active & Passive Voice]).
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
    const { messages, mockSummary, activeMockContext, activeReviewQuestions, activeQuestion, focusedScope, activeMockId, activeMockTitle } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
    }

    // Format conversational contents for Gemini
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || m.content || '') }]
    }));

    const latestUserMsg = messages[messages.length - 1]?.text || '';
    const { intent, matchedTopic, targetQNum, targetMock } = detectUserIntent(
      latestUserMsg,
      activeMockId,
      activeMockTitle
    );

    // ── Build Scoped Focus Context (if user opened Tommy via an AI Chip) ──
    let scopeContext = '';
    if (focusedScope && typeof focusedScope === 'object') {
      const { type, title, subject, stats, questions, summaryText } = focusedScope;
      scopeContext += `\n=========================================\n`;
      scopeContext += `🎯 ACTIVE FOCUSED SCOPE: ${String(type || '').toUpperCase()} - "${title}"\n`;
      if (subject) scopeContext += `Subject: ${subject}\n`;
      if (stats) {
        if (stats.score !== undefined) scopeContext += `Score: ${stats.score}/${stats.maxMarks || 200} | Accuracy: ${stats.accuracy}%\n`;
        if (stats.wrong !== undefined || stats.slow !== undefined || stats.unattempted !== undefined) {
          scopeContext += `Mistake Breakdown: ${stats.wrong ?? 0} Wrong, ${stats.slow ?? 0} Correct but Slow, ${stats.unattempted ?? 0} Unattempted\n`;
        }
      }
      if (summaryText) {
        scopeContext += `Summary:\n${summaryText}\n`;
      }
      if (Array.isArray(questions) && questions.length > 0) {
        scopeContext += `\n--- MISTAKE QUESTIONS IN THIS ${String(type || '').toUpperCase()} (${questions.length} Items) ---\n`;
        scopeContext += questions.map((q: any, i: number) => {
          const num = q.qNum || (i + 1);
          const optStr = q.options ? Object.entries(q.options).map(([k, v]) => `${k.toUpperCase()}) ${v}`).join(' | ') : '';
          const userAns = q.userAnswer ? q.userAnswer.toUpperCase() : (q.status === 'unattempted' ? 'Skipped' : 'N/A');
          const correctAns = q.answer ? q.answer.toUpperCase() : 'Refer to solution';
          const rcaTag = q.rca ? ` [RCA: ${q.rca.tagName || q.rca.tag}]` : '';
          const status = q.status ? ` [Status: ${q.status.toUpperCase()}]` : '';
          return `[Question #${num}]${status}${rcaTag}\nQuestion: ${q.question}\nOptions: ${optStr}\nCandidate Choice: ${userAns} | Correct: ${correctAns}\nSolution: ${q.solution || 'See concept'}`;
        }).join('\n-----------------------------------------\n');
      }
      scopeContext += `\n=========================================\n`;
      scopeContext += `FOCUSED SCOPE RULES:
- The candidate explicitly opened you to discuss this ${type}: "${title}".
- If they ask about questions, errors, shortcuts, or concepts from this ${type}, refer directly to the exact questions and details provided above.
- If they ask general questions or change the topic, answer helpfully and clearly without hallucinating or forcing the test questions into the response.\n`;
    }

    // ── Selective Context Assembly (Token Optimization) ──
    let selectiveContext = '';

    if (intent === 'GREETING') {
      // 0 extra tokens attached for greetings and casual chitchat
      selectiveContext = '';
    } else {
      // Find question context if user is asking about a specific question
      let targetQ = activeQuestion;
      if (!targetQ && targetQNum && Array.isArray(activeReviewQuestions)) {
        targetQ = activeReviewQuestions.find(
          (q: any) => q.qNum === targetQNum || q.questionNumber === targetQNum
        );
      }

      selectiveContext = buildSelectiveContext({
        userText: latestUserMsg,
        activeQuestion: targetQ,
        activeMockContext,
        activeMockId,
        activeMockTitle
      });

      // If user asks about the active quiz review and not a single question:
      if (!selectiveContext && Array.isArray(activeReviewQuestions) && activeReviewQuestions.length > 0) {
        const isQuizQuery = /quiz|review|test|wrong|mistake|question/i.test(latestUserMsg);
        if (isQuizQuery) {
          // Include only wrong questions (max 5) to stay token-efficient
          const wrongQs = activeReviewQuestions.filter((q: any) => !q.isCorrect).slice(0, 5);
          if (wrongQs.length > 0) {
            selectiveContext = `\n--- ACTIVE QUIZ/MOCK WRONG QUESTIONS (${wrongQs.length} items) ---\n` +
              wrongQs.map((q: any) => `
[Question #${q.qNum}] Topic: ${q.topic || 'General'}
Question: ${q.question}
Options: ${JSON.stringify(q.options || {})}
Candidate Choice: ${q.userAnswer ? q.userAnswer.toUpperCase() : 'Unattempted'} | Correct: ${q.correctAnswer ? q.correctAnswer.toUpperCase() : 'Refer to solution'}
Solution: ${q.solution || 'No solution provided'}
`).join('\n---\n');
          }
        }
      }

      // Only attach mockSummary if user specifically asked about their overall score / test performance
      if (mockSummary && (intent === 'OVERALL_WEAKNESS' || intent === 'FULL_MOCK')) {
        selectiveContext += `\n--- CANDIDATE'S CURRENT MOCK PERFORMANCE SUMMARY ---\n${mockSummary}\n`;
      }
    }

    const fullSystemInstruction = `${SYSTEM_INSTRUCTION}
${scopeContext ? `\n${scopeContext}\n` : ''}
${selectiveContext ? `\n${selectiveContext}\n` : ''}
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
