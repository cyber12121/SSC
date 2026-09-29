import { Question, QuestionProgress, QuizResult } from '../types';
import { safeStorage } from './safeStorage';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { resolveQuestionSolution } from './solutionResolver';

export interface RecordedMistake {
  id: string;
  userId: number | string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  topic: string;
  topicSlug: string;
  source: 'chapter_bank' | 'mock_errors' | 'website_quiz' | 'website_mock' | 'telegram_quiz' | 'telegram_drill';
  timestamp: number;
  wrongCount: number;
  mastered: boolean;
  errorType?: 'wrong' | 'unattempted';
  selectedAnswer?: string;
  userAnswer?: string;
}

export const MISTAKE_NOTEBOOK_KEY = 'cgl_user_mistake_notebook';
export const SYNCED_STORAGE_KEY = 'cgl_synced_telegram_mistakes';

/**
 * Checks whether a quiz result is strictly Chapter Bank or Mock Errors analytics.
 */
export function isAllowedCategory(result: {
  category?: string;
  chapter_title?: string;
  id?: string;
  mode?: string;
}): boolean {
  if (!result) return false;
  const cat = (result.category || '').toLowerCase();
  const title = (result.chapter_title || '').toLowerCase();
  const id = (result.id || '').toLowerCase();
  if (cat === 'chapterbank' || cat === 'mockerrors') return true;
  if (title.includes('mock') || title.includes('testbook') || title.includes('oliveboard') || title.includes('sectional') || title.includes('live test') || title.includes('tier')) {
    return true;
  }
  if (id.includes('mock') || id.startsWith('tb_') || id.startsWith('ob_')) {
    return true;
  }
  return false;
}

// Canonical subject normalization
export function normalizeSubject(sub?: string): 'english' | 'mathematics' | 'reasoning' | 'general_awareness' {
  if (!sub) return 'general_awareness';
  const s = String(sub).toLowerCase().trim();
  if (s.includes('eng') || s.includes('vocab') || s.includes('synonym') || s.includes('grammar') || s.includes('idiom') || s.includes('antonym') || s.includes('cloze')) return 'english';
  if (s.includes('math') || s.includes('quant') || s.includes('arithmetic') || s.includes('algebra') || s.includes('geometry') || s.includes('trig') || s.includes('calc')) return 'mathematics';
  if (s.includes('reason') || s.includes('logic') || s.includes('analogy') || s.includes('series') || s.includes('syllogism') || s.includes('intel')) return 'reasoning';
  return 'general_awareness';
}

/**
 * Robust deduplication key.
 * Combines normalized question text with sorted options signature.
 * Prevents distinct questions sharing generic instructions (e.g. "Select the correctly spelt word")
 * from colliding, while accurately merging true duplicates of the same question.
 */
export function getDedupeKey(qText?: string, id?: string, options?: string[]): string {
  const cleanText = (qText || '')
    .toLowerCase()
    .replace(/^(?:question\s*\d+[:.]?|\bq\s*\d+[:.]?|\d+[.)]\s*)/i, '')
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
    .replace(/[?.!,:;'"()\[\]{}]+$/g, '')
    .trim();

  let optStr = '';
  if (Array.isArray(options) && options.length > 0) {
    optStr = options
      .map(o => String(o || '').toLowerCase().trim().replace(/[\s\u200B-\u200D\uFEFF]+/g, ' '))
      .filter(Boolean)
      .sort()
      .join('|');
  }

  // If text is short or generic, include options or id so different questions don't collide
  const isGeneric = cleanText.length < 50 || /^(select the|choose the|in the following|identify the|find the|fill in the|what is|which of the)/i.test(cleanText);

  if (cleanText) {
    if (optStr) {
      return `${cleanText}::${optStr}`;
    }
    if (isGeneric && id) {
      return `${cleanText}::${id.trim().toLowerCase()}`;
    }
    return cleanText;
  }

  return (id || '').trim().toLowerCase();
}

/**
 * Checks if a quiz result is from a Full Mock or Sectional Mock test.
 * Mistakes from full mock tests or sectional mock tests must NOT be recorded
 * into the Mistake Notebook (only Chapter Practice and Mock Error remediation drills).
 */
export function isFullOrSectionalMock(result: {
  id?: string;
  chapter_title?: string;
  subject?: string;
  mode?: string;
  category?: string;
  totalQuestions?: number;
  section?: string;
}): boolean {
  if (!result) return false;

  const title = (result.chapter_title || '').trim().toLowerCase();
  const id = (result.id || '').trim().toLowerCase();
  const mode = (result.mode || '').trim().toLowerCase();
  const category = (result.category || '').trim().toLowerCase();
  const section = (result.section || '').trim().toLowerCase();
  const totalQ = typeof result.totalQuestions === 'number' ? result.totalQuestions : 0;

  // 1. If explicitly a Mistakes Drill or Chapter Error Remediation drill, it is NOT a full/sectional mock
  if (
    category === 'mockErrors' &&
    (title.includes('mistakes drill') ||
     title.includes('errors •') ||
     title.includes('remediation') ||
     section === 'mistakes_drill')
  ) {
    return false;
  }

  // 2. Full mock test indicators:
  // - 50 or more questions (Tier 1 is 100 questions, Tier 2 is 130+)
  if (totalQ >= 50) return true;

  // - Title contains full mock / live test / shift / PYP patterns
  if (
    title.includes('full mock') ||
    title.includes('live test') ||
    title.includes('tier-i full') ||
    title.includes('tier 1 full') ||
    title.includes('tier-1 full') ||
    title.includes('tier i full') ||
    title.includes('cgl tier 1 -') ||
    title.includes('cgl tier-1 -') ||
    title.includes('cgl tier i -') ||
    title.includes('cgl tier-i -') ||
    title.includes('previous year paper') ||
    title.includes('pyp') ||
    title.includes('shift 1') ||
    title.includes('shift 2') ||
    title.includes('shift 3') ||
    /mock\s*\d+/i.test(title) ||
    /tier\s*i\s*[-–]?\s*\d+/i.test(title)
  ) {
    return true;
  }

  // 3. Sectional Mock indicators:
  if (
    title.includes('sectional timing') ||
    title.includes('sectional test') ||
    title.includes('sectional mock') ||
    title.includes('oliveboard') ||
    title.includes('testbook') ||
    id.startsWith('ob_') ||
    id.startsWith('tb_') ||
    id.includes('sectional')
  ) {
    return true;
  }

  // 4. If mode is mock and not chapterBank or mockErrors
  if (mode === 'mock' && category !== 'chapterBank' && category !== 'mockErrors') {
    return true;
  }

  return false;
}

/**
 * Checks if an individual recorded mistake came from a full mock or sectional mock test,
 * so it can be filtered out from the Mistake Notebook.
 */
export function isFullOrSectionalMockItem(item: {
  topic?: string;
  source?: string;
  id?: string;
  question?: string;
}): boolean {
  if (item.source === 'website_mock') {
    const t = (item.topic || '').toLowerCase();
    if (t.includes('mistake') || t.includes('drill') || t.includes('error') || t.includes('remediation')) {
      return false;
    }
    return true;
  }

  const t = (item.topic || '').toLowerCase();
  const id = (item.id || '').toLowerCase();

  if (
    t.includes('mock test') ||
    t.includes('full mock') ||
    t.includes('sectional timing') ||
    t.includes('sectional') ||
    t.includes('oliveboard') ||
    t.includes('testbook') ||
    t.includes('live test') ||
    t.includes('tier i -') ||
    t.includes('tier-i -') ||
    t.includes('tier 1 -') ||
    t.includes('tier-1 -') ||
    /mock\s*\d+/i.test(t) ||
    id.startsWith('tb_') ||
    id.startsWith('ob_') ||
    id.startsWith('rca_')
  ) {
    if (t.includes('mistake') || t.includes('drill') || t.includes('error')) {
      return false;
    }
    return true;
  }

  return false;
}

// Checks if a question belongs to Speed Drills
export function isSpeedLabQuestion(item: { id?: string; topic?: string; question?: string; source?: string }): boolean {
  const s = ((item.id || '') + ' ' + (item.topic || '') + ' ' + (item.source || '')).toLowerCase();
  return (
    s.includes('speed') ||
    s.includes('mental_math') ||
    s.includes('calc_studio') ||
    s.includes('simplification') ||
    s.includes('step_triplets') ||
    s.includes('step_tables') ||
    s.includes('step_squares') ||
    s.includes('step_cubes') ||
    s.includes('step_fractions') ||
    s.includes('step_compl') ||
    s.includes('step_mult') ||
    s.includes('mm_add') ||
    s.includes('mm_sub') ||
    s.includes('mm_mul') ||
    s.includes('mm_div') ||
    s.includes('mm_sq') ||
    s.includes('mm_cu') ||
    s.includes('mm_pct') ||
    s.includes('simp_cat')
  );
}

/**
 * Normalizes question options into a standard string array [optA, optB, optC, optD]
 */
export function extractOptionsArray(rawOptions: any): string[] {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map(opt => (typeof opt === 'string' ? opt : (opt?.text || String(opt || '')))).filter(Boolean);
  }
  if (rawOptions && typeof rawOptions === 'object') {
    const fromKeys = ['a', 'b', 'c', 'd']
      .map(k => rawOptions[k] || rawOptions[k.toUpperCase()] || '')
      .filter(Boolean);
    if (fromKeys.length > 0) return fromKeys.map(String);
    return Object.values(rawOptions).map(v => (typeof v === 'string' ? v : (v && (v as any).text ? (v as any).text : String(v || '')))).filter(Boolean);
  }
  return [];
}

/**
 * Normalizes correct option answer key into index (0 to 3)
 */
export function extractCorrectOptionIndex(answerKey: any, optionsCount = 4): number {
  const ansStr = String(answerKey || '').trim().toLowerCase();
  if (ansStr === 'a' || ansStr === '1') return 0;
  if (ansStr === 'b' || ansStr === '2') return 1;
  if (ansStr === 'c' || ansStr === '3') return 2;
  if (ansStr === 'd' || ansStr === '4') return 3;
  const num = parseInt(ansStr, 10);
  if (!isNaN(num) && num >= 0 && num < optionsCount) return num;
  return 0;
}

/**
 * Converts a question from a QuizResult into a RecordedMistake
 */
export function convertToRecordedMistake(
  item: QuestionProgress,
  fullResult: {
    id?: string;
    chapter_title?: string;
    subject?: string;
    mode?: string;
    category?: string;
    userId?: string;
    totalQuestions?: number;
    section?: string;
  }
): RecordedMistake | null {
  // Only record Chapter Bank and Mock Errors analytics
  if (!isAllowedCategory(fullResult)) return null;

  const q = item.question;
  if (!q || !q.question) return null;

  const qText = String(q.question).trim();
  if (!qText) return null;

  if (isSpeedLabQuestion({ id: q.id, topic: q.topic || q.tags?.topic, question: qText })) {
    return null;
  }

  // Detect whether question was wrong vs skipped/unattempted
  const userAns = item.selectedAnswer || (item as any).userAnswer || '';
  const isSkipped = !userAns || userAns === '' || (item as any).status === 'unattempted' || (item as any).errorType === 'unattempted';
  const errorType: 'wrong' | 'unattempted' = isSkipped ? 'unattempted' : 'wrong';

  const opts = extractOptionsArray(q.options);
  const correctIdx = extractCorrectOptionIndex(q.answer, opts.length || 4);
  const normSub = normalizeSubject(q.subject || fullResult.subject);
  const topic = q.tags?.topic || q.topic || fullResult.chapter_title || 'General Practice';
  const qId = q.id || `mistake_${fullResult.id || 'q'}_${item.q_num}`;

  const isMock = (fullResult.category === 'mockErrors') ||
    Boolean(fullResult.chapter_title && fullResult.chapter_title.toLowerCase().includes('mock')) ||
    Boolean(fullResult.id && (fullResult.id.includes('mock') || fullResult.id.startsWith('tb_') || fullResult.id.startsWith('ob_')));

  return {
    id: qId,
    userId: fullResult.userId || (auth.currentUser ? auth.currentUser.uid : 'guest'),
    question: qText,
    options: opts,
    correctOptionIndex: correctIdx,
    explanation: (
      q.solution ||
      (q as any).explanation ||
      (q as any).sol ||
      (q as any).detailedSolution ||
      (item as any).solution ||
      (item as any).explanation ||
      ''
    ).trim() || resolveQuestionSolution({ ...q, id: qId, question: qText }),
    subject: normSub,
    topic,
    topicSlug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    source: isMock ? 'mock_errors' : 'chapter_bank',
    timestamp: Date.now(),
    wrongCount: 1,
    mastered: false,
    errorType,
    selectedAnswer: userAns,
    userAnswer: userAns
  };
}

/**
 * Records mistakes from a submitted quiz into:
 * 1. cgl_user_mistake_notebook (localStorage via safeStorage)
 * 2. Firebase Firestore user_mistakes_{uid} (if authenticated)
 *
 * NOTE: Strictly records BOTH wrong and skipped/unattempted questions from:
 * - Chapter Bank ('chapterBank')
 * - Mock Errors ('mockErrors' / mock analytics)
 */
export function recordQuizMistakes(
  fullResult: QuizResult,
  userUid?: string
): RecordedMistake[] {
  // 1. Only record for chapterBank and mockErrors analytics
  if (!isAllowedCategory(fullResult)) {
    return [];
  }

  if (!fullResult.questionDetails || fullResult.questionDetails.length === 0) {
    return [];
  }

  // 2. Filter for all non-correct questions (captures BOTH wrong and skipped/unattempted)
  const errorItems = fullResult.questionDetails.filter(d => !d.isCorrect && d.question);
  if (errorItems.length === 0) return [];

  const effectiveUid = userUid || (auth.currentUser ? auth.currentUser.uid : (fullResult.userId !== 'guest' ? fullResult.userId : undefined));

  // 3. Convert to RecordedMistake
  const newMistakes: RecordedMistake[] = [];
  for (const item of errorItems) {
    const mistake = convertToRecordedMistake(item, fullResult);
    if (mistake) {
      newMistakes.push(mistake);
    }
  }

  if (newMistakes.length === 0) return [];

  // 4. Load existing mistake notebook & merge with accurate deduplication
  try {
    const existingRaw = safeStorage.getItem(MISTAKE_NOTEBOOK_KEY);
    let existingList: RecordedMistake[] = [];
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) existingList = parsed;
      } catch {}
    }

    const mergedMap = new Map<string, RecordedMistake>();
    for (const m of existingList) {
      if (isSpeedLabQuestion(m)) continue;
      const k = getDedupeKey(m.question, m.id, m.options);
      if (k) mergedMap.set(k, m);
    }

    for (const m of newMistakes) {
      const k = getDedupeKey(m.question, m.id, m.options);
      if (!k) continue;
      if (mergedMap.has(k)) {
        const ex = mergedMap.get(k)!;
        ex.wrongCount = (ex.wrongCount || 1) + 1;
        ex.timestamp = Date.now();
        if (m.errorType) ex.errorType = m.errorType;
        if ((!ex.explanation || ex.explanation.length < 10) && m.explanation) {
          ex.explanation = m.explanation;
        }
        if ((!ex.options || ex.options.length === 0) && m.options.length > 0) {
          ex.options = m.options;
          ex.correctOptionIndex = m.correctOptionIndex;
        }
      } else {
        mergedMap.set(k, m);
      }
    }

    const updatedNotebook = Array.from(mergedMap.values());
    updatedNotebook.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    safeStorage.setItem(MISTAKE_NOTEBOOK_KEY, JSON.stringify(updatedNotebook));
  } catch (err) {
    console.warn('[mistakeRecorder] Error updating local notebook:', err);
  }

  // 5. Background sync to Firestore if user is authenticated
  if (effectiveUid) {
    try {
      for (const m of newMistakes) {
        const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setDoc(doc(db, `user_mistakes_${effectiveUid}`, docId), m, { merge: true }).catch(e => {
          console.warn('[mistakeRecorder] Firestore setDoc error:', e);
        });
      }
    } catch (e) {
      console.warn('[mistakeRecorder] Firestore sync error:', e);
    }
  }

  // 6. Notify the rest of the application
  try {
    window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', {
      detail: { count: newMistakes.length, mistakes: newMistakes }
    }));
  } catch {}

  return newMistakes;
}

/**
 * Scans local and remote sources to auto-recover mistakes.
 * Strictly records Chapter Bank and Mock Errors (wrong + skipped).
 * Removes duplicates and ensures distinct questions are never lost.
 */
export async function autoRecoverMistakesFromStorage(
  userUid?: string
): Promise<RecordedMistake[]> {
  let globalRcaMap: Record<string, any> = {};
  try {
    const rawRca = safeStorage.getItem('cgl_rca_global_store');
    if (rawRca) globalRcaMap = JSON.parse(rawRca);
  } catch {}

  const mergedMap = new Map<string, RecordedMistake>();
  const addMistake = (m: RecordedMistake | null) => {
    if (!m || isSpeedLabQuestion(m)) return;

    // Auto-rehydrate explanation from solutionResolver or global RCA store if missing
    if (!m.explanation || m.explanation.trim().length < 5) {
      const resolved = resolveQuestionSolution(m);
      if (resolved && resolved.length > 3) {
        m.explanation = resolved;
      } else {
        const qId = m.id;
        const qText = (m.question || '').trim().toLowerCase();
        const rcaMatch = (qId && globalRcaMap[qId]) || (qText && globalRcaMap[qText]);
        if (rcaMatch && (rcaMatch.solution || rcaMatch.explanation || rcaMatch.sol)) {
          m.explanation = rcaMatch.solution || rcaMatch.explanation || rcaMatch.sol;
        }
      }
    }

    const k = getDedupeKey(m.question, m.id, m.options);
    if (!k) return;
    if (mergedMap.has(k)) {
      const ex = mergedMap.get(k)!;
      ex.wrongCount = Math.max(ex.wrongCount || 1, m.wrongCount || 1);
      ex.timestamp = Math.max(ex.timestamp || 0, m.timestamp || 0);
      if (m.errorType) ex.errorType = m.errorType;
      if ((!ex.explanation || ex.explanation.length < 10) && m.explanation) {
        ex.explanation = m.explanation;
      }
      if ((!ex.options || ex.options.length === 0) && m.options.length > 0) {
        ex.options = m.options;
        ex.correctOptionIndex = m.correctOptionIndex;
      }
    } else {
      mergedMap.set(k, { ...m, subject: normalizeSubject(m.subject) });
    }
  };

  // 1. Existing notebook
  try {
    const raw = safeStorage.getItem(MISTAKE_NOTEBOOK_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(addMistake);
    }
  } catch {}

  // 2. Scan local quiz results caches (Chapter Bank and Mock Errors analytics)
  const cacheKeys = [
    'guest_results',
    'cgl_user_results_cache_guest',
    userUid ? `cgl_user_results_cache_${userUid}` : null,
    userUid ? `offline_results_${userUid}` : null
  ].filter(Boolean) as string[];

  for (const cKey of cacheKeys) {
    try {
      const raw = safeStorage.getItem(cKey);
      if (raw) {
        const results = JSON.parse(raw);
        if (Array.isArray(results)) {
          for (const res of results) {
            if (!isAllowedCategory(res)) continue;

            if (res && Array.isArray(res.questionDetails)) {
              for (const d of res.questionDetails) {
                if (d && !d.isCorrect && d.question) {
                  const m = convertToRecordedMistake(d, res);
                  addMistake(m);
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // 3. Firestore user_mistakes collection
  const effectiveUid = userUid || (auth.currentUser ? auth.currentUser.uid : undefined);
  if (effectiveUid) {
    try {
      const snap = await getDocs(collection(db, `user_mistakes_${effectiveUid}`));
      snap.forEach(d => {
        const data = d.data() as RecordedMistake;
        if (data && data.question) {
          addMistake({ ...data, id: data.id || d.id });
        }
      });
    } catch {}
  }

  // 4. Build final list, excluding speed lab questions
  const finalList = Array.from(mergedMap.values()).filter(item => {
    if (isSpeedLabQuestion(item)) return false;
    return true;
  });

  finalList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Persist cleaned list back to storage
  try {
    safeStorage.setItem(MISTAKE_NOTEBOOK_KEY, JSON.stringify(finalList));
    // Clean up old Telegram cache key so it doesn't linger
    safeStorage.removeItem('cgl_synced_telegram_mistakes');
  } catch {}

  return finalList;
}
