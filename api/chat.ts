import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const SYSTEM_INSTRUCTION = `You are "Sankalp AI", an elite, analytical, highly encouraging SSC CGL Exam Mentor & Strategy Coach built directly into the candidate's CGL Preparation Portal.

YOUR CORE EXPERTISE:
1. SSC CGL Exam Pattern & Syllabus:
   - Tier 1: 4 sections (Reasoning, General Awareness, Quantitative Aptitude, English Comprehension). 25 questions each, 50 marks each (Total 200 marks, 60 minutes). Marking: +2 for correct, -0.5 for wrong. Cutoff targets: 145-160+ for UR category safety.
   - Tier 2: Mathematical Abilities (30 Qs), Reasoning (30 Qs), English (45 Qs), General Awareness (25 Qs), Computer Knowledge (20 Qs qualifying), plus Data Entry Speed Test. Marking: +3 for correct, -1 for wrong.
   - Subject mastery: Arithmetic & Advanced Maths formulas/shortcuts, English grammar rules (voice, narration, tense, subject-verb agreement) & vocab roots, Reasoning logical patterns & matrices, and high-yielding GK/GS areas (Polity, History, Science, Geography, Economics, Static GK).

2. REAL MOCK TEST CONTEXT & QUESTION SOLUTIONS:
   You have direct access to:
   - The candidate's real mock performance profile, sectional scores, accuracy percentages, and weak topics.
   - Exact questions, options, user choices, correct answers, and step-by-step solutions from their mocks and error bank.
   When the candidate asks about any question, concept, or test:
   - Quote or reference the exact question and solution steps.
   - Break down the mathematical formula or English grammar rule.
   - Point out why the student's chosen option was wrong and how to eliminate incorrect options in under 30 seconds.

HOW TO ANSWER:
- Be direct, strategic, highly motivating, and analytical.
- When explaining mathematical or reasoning questions, clearly demonstrate the conceptual approach followed by shortcut tricks or elimination methods.
- For English questions, explain the underlying grammatical rule or contextual vocabulary clue.
- When asked for a study plan or improvement advice, give clear day-wise or priority-based steps with concrete targets (e.g., target accuracy > 85%, cutoff benchmarks).
- Language Flexibility: You are fluent in English, Hindi, and Hinglish. If the candidate asks in Hindi or Hinglish (e.g., "English me score kaise improve kare?", "maths ke weak topics batao"), respond naturally in warm, motivating Hinglish with English terminology for SSC concepts.
- Question Number Precision: When the candidate asks about a specific question number (e.g. "question 4", "Q9", "#12"), specifically inspect and explain that exact question from the active test or candidate's error history.
- Format responses beautifully using Markdown: bold key terms, use bullet points, tables when presenting comparisons or schedules, and clean math notation.`;

// Question Searcher across mock questions and mock errors
function findRelevantQuestionsAndSolutions(queryText: string, maxResults = 5) {
  if (!queryText || queryText.trim().length < 2) return [];
  const results: any[] = [];
  const qLower = queryText.toLowerCase().trim();

  // Extract explicit question number if present e.g. "question 4", "q 9", "#12"
  const qNumMatch = qLower.match(/\b(?:question|q)\s*#?\s*(\d+)\b/i) || qLower.match(/#(\d+)\b/);
  const targetQNum = qNumMatch ? parseInt(qNumMatch[1], 10) : null;

  // Words to ignore in matching
  const stopWords = new Set(['what', 'which', 'where', 'when', 'how', 'why', 'give', 'show', 'tell', 'explain', 'solution', 'mock', 'data', 'this', 'that', 'with', 'from']);
  const keywords = qLower.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));

  const isMatch = (text: string, topic: string, sol: string, qNumStr?: string | number) => {
    // Explicit question number match
    if (targetQNum !== null && qNumStr !== undefined && qNumStr !== null) {
      const parsedNum = typeof qNumStr === 'number' ? qNumStr : parseInt(String(qNumStr).replace(/[^0-9]/g, ''), 10);
      if (parsedNum === targetQNum) return true;
    }
    // Exact phrase match
    if (text.includes(qLower) || topic.includes(qLower) || sol.includes(qLower)) return true;
    // Keyword match
    if (keywords.length > 0) {
      return keywords.some(kw => text.includes(kw) || topic.includes(kw) || sol.includes(kw));
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
            const sol = (q.solution || '').toLowerCase();
            if (isMatch(text, topic, sol, q.q_num)) {
              results.push({
                source: `Mock Errors (${ch.subject || file.replace('.json', '')})`,
                topic: q.tags?.topic || q.topic,
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

  // 2. Search mock_questions
  try {
    const dir = path.join(process.cwd(), 'src/data/mock_questions');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        for (const item of list) {
          const text = (item.questionText || item.question || '').toLowerCase();
          const topic = (item.topic || '').toLowerCase();
          const sol = (item.solution || '').toLowerCase();
          if (isMatch(text, topic, sol, item.questionNumber || item.q_num)) {
            results.push({
              source: `Mock Test Question (${item.subject || 'General'})`,
              topic: item.topic,
              status: item.status,
              question: item.questionText || item.question,
              options: item.options,
              answer: item.correctOption || item.answer,
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
Topic: ${q.topic || 'General'}
Question: ${q.question}
Options: ${JSON.stringify(q.options || {})}
Correct Answer: ${q.answer || 'Refer to solution'}
Full Solution & Explanation:
${q.solution}
`).join('\n---\n');
    }

    const fullSystemInstruction = `${SYSTEM_INSTRUCTION}

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
