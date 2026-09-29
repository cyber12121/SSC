import { Question, QuestionProgress, QuizResult } from '../types';
import { safeStorage } from './safeStorage';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

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
  source: 'telegram_quiz' | 'website_quiz' | 'telegram_drill' | 'website_mock';
  timestamp: number;
  wrongCount: number;
  mastered: boolean;
}

export const MISTAKE_NOTEBOOK_KEY = 'cgl_user_mistake_notebook';
export const SYNCED_STORAGE_KEY = 'cgl_synced_telegram_mistakes';

// Canonical subject normalization
export function normalizeSubject(sub?: string): 'english' | 'mathematics' | 'reasoning' | 'general_awareness' {
  if (!sub) return 'general_awareness';
  const s = String(sub).toLowerCase().trim();
  if (s.includes('eng') || s.includes('vocab') || s.includes('synonym') || s.includes('grammar') || s.includes('idiom') || s.includes('antonym') || s.includes('cloze')) return 'english';
  if (s.includes('math') || s.includes('quant') || s.includes('arithmetic') || s.includes('algebra') || s.includes('geometry') || s.includes('trig') || s.includes('calc')) return 'mathematics';
  if (s.includes('reason') || s.includes('logic') || s.includes('analogy') || s.includes('series') || s.includes('syllogism') || s.includes('intel')) return 'reasoning';
  return 'general_awareness';
}

// Canonical deduplication key based on normalized question text
export function getDedupeKey(qText?: string, id?: string): string {
  const text = (qText || '')
    .toLowerCase()
    .replace(/^(?:question\s*\d+[:.]?|\bq\s*\d+[:.]?|\d+[.)]\s*)/i, '')
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
    .replace(/[?.!,:;'"()\[\]{}]+$/g, '')
    .trim();
  return text || (id || '').trim().toLowerCase();
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
  }
): RecordedMistake | null {
  const q = item.question;
  if (!q || !q.question) return null;

  const qText = String(q.question).trim();
  if (!qText) return null;

  if (isSpeedLabQuestion({ id: q.id, topic: q.topic || q.tags?.topic, question: qText })) {
    return null;
  }

  const opts = extractOptionsArray(q.options);
  const correctIdx = extractCorrectOptionIndex(q.answer, opts.length || 4);
  const normSub = normalizeSubject(q.subject || fullResult.subject);
  const topic = q.tags?.topic || q.topic || fullResult.chapter_title || 'General Practice';
  const qId = q.id || `mistake_${fullResult.id || Date.now()}_${item.q_num}`;
  const isMock = fullResult.mode === 'mock' || fullResult.category === 'mockErrors' || (fullResult.chapter_title || '').toLowerCase().includes('mock');

  return {
    id: qId,
    userId: fullResult.userId || (auth.currentUser ? auth.currentUser.uid : 'guest'),
    question: qText,
    options: opts,
    correctOptionIndex: correctIdx,
    explanation: q.solution || (q as any).explanation || '',
    subject: normSub,
    topic,
    topicSlug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    source: isMock ? 'website_mock' : 'website_quiz',
    timestamp: Date.now(),
    wrongCount: 1,
    mastered: false
  };
}

/**
 * Records mistakes from a submitted quiz into:
 * 1. cgl_user_mistake_notebook (localStorage via safeStorage)
 * 2. cgl_synced_telegram_mistakes (permanent sync cache)
 * 3. cgl_rca_global_store (RCA / Silly mistakes cockpit)
 * 4. Firebase Firestore user_mistakes_{uid} (if authenticated)
 * 5. cgl_mock_questions_{mockId} (if mock test)
 */
export function recordQuizMistakes(
  fullResult: QuizResult,
  userUid?: string
): RecordedMistake[] {
  if (!fullResult.questionDetails || fullResult.questionDetails.length === 0) {
    return [];
  }

  const errorItems = fullResult.questionDetails.filter(d => !d.isCorrect && d.question);
  if (errorItems.length === 0) return [];

  const effectiveUid = userUid || (auth.currentUser ? auth.currentUser.uid : (fullResult.userId !== 'guest' ? fullResult.userId : undefined));
  const isMock = fullResult.mode === 'mock' || fullResult.category === 'mockErrors' || (fullResult.chapter_title || '').toLowerCase().includes('mock');

  // 1. Convert to RecordedMistake
  const newMistakes: RecordedMistake[] = [];
  for (const item of errorItems) {
    const mistake = convertToRecordedMistake(item, fullResult);
    if (mistake) {
      newMistakes.push(mistake);
    }
  }

  if (newMistakes.length === 0) return [];

  // 2. Load existing mistake notebook & merge
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
      const k = getDedupeKey(m.question, m.id);
      if (k) mergedMap.set(k, m);
    }

    for (const m of newMistakes) {
      const k = getDedupeKey(m.question, m.id);
      if (!k) continue;
      if (mergedMap.has(k)) {
        const ex = mergedMap.get(k)!;
        ex.wrongCount = (ex.wrongCount || 1) + 1;
        ex.timestamp = Date.now();
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

    // Also update synced cache
    try {
      const syncedRaw = safeStorage.getItem(SYNCED_STORAGE_KEY);
      let syncedList: RecordedMistake[] = [];
      if (syncedRaw) {
        try {
          const parsed = JSON.parse(syncedRaw);
          if (Array.isArray(parsed)) syncedList = parsed;
        } catch {}
      }
      const syncedMap = new Map<string, RecordedMistake>();
      for (const m of syncedList) {
        const k = getDedupeKey(m.question, m.id);
        if (k) syncedMap.set(k, m);
      }
      for (const m of newMistakes) {
        const k = getDedupeKey(m.question, m.id);
        if (k && !syncedMap.has(k)) syncedMap.set(k, m);
      }
      safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(Array.from(syncedMap.values())));
    } catch {}

  } catch (err) {
    console.warn('[mistakeRecorder] Error updating local notebook:', err);
  }

  // 3. Update RCA global store so RCA analysis and heatmaps stay in sync
  try {
    const rcaRaw = safeStorage.getItem('cgl_rca_global_store');
    const rcaStore = rcaRaw ? JSON.parse(rcaRaw) : {};
    for (const item of errorItems) {
      if (!item.question) continue;
      const q = item.question;
      const qId = q.id || `quiz_${fullResult.id || Date.now()}_${item.q_num}`;
      const hasAnswer = Boolean(item.selectedAnswer && String(item.selectedAnswer).trim() !== '');
      rcaStore[qId] = {
        id: qId,
        q_num: item.q_num,
        mockId: isMock ? fullResult.id : undefined,
        mockTitle: fullResult.chapter_title,
        subject: q.subject || fullResult.subject || 'General Awareness',
        topic: q.tags?.topic || q.topic || fullResult.chapter_title || 'General Practice',
        questionText: q.question,
        options: q.options,
        answer: q.answer,
        solution: q.solution || (q as any).explanation || '',
        userAnswer: item.selectedAnswer || '',
        selectedAnswer: item.selectedAnswer || '',
        chosenOption: item.selectedAnswer || '',
        isCorrect: false,
        status: hasAnswer ? 'Incorrect' : 'Unattempted',
        errorType: hasAnswer ? 'wrong' : 'unattempted',
        isFromMock: isMock,
        classifiedAt: new Date().toISOString()
      };
      const qNorm = getDedupeKey(q.question);
      if (qNorm) {
        rcaStore[qNorm] = rcaStore[qId];
      }
    }
    safeStorage.setItem('cgl_rca_global_store', JSON.stringify(rcaStore));
  } catch (err) {
    console.warn('[mistakeRecorder] Error updating rca global store:', err);
  }

  // 4. Background sync to Firestore if user is authenticated
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

  // 5. Notify the rest of the application
  try {
    window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', {
      detail: { count: newMistakes.length, mistakes: newMistakes }
    }));
  } catch {}

  return newMistakes;
}

/**
 * Scans all available local and remote sources to auto-recover mistakes
 * from previously submitted quizzes (ensuring past phone/desktop quizzes aren't lost)
 */
export async function autoRecoverMistakesFromStorage(
  userUid?: string
): Promise<RecordedMistake[]> {
  const mergedMap = new Map<string, RecordedMistake>();
  const addMistake = (m: RecordedMistake | null) => {
    if (!m || isSpeedLabQuestion(m)) return;
    const k = getDedupeKey(m.question, m.id);
    if (!k) return;
    if (mergedMap.has(k)) {
      const ex = mergedMap.get(k)!;
      ex.wrongCount = Math.max(ex.wrongCount || 1, m.wrongCount || 1);
      ex.timestamp = Math.max(ex.timestamp || 0, m.timestamp || 0);
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

  // 2. Synced telegram mistakes
  try {
    const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(addMistake);
    }
  } catch {}

  // 3. Scan cgl_rca_global_store
  try {
    const raw = safeStorage.getItem('cgl_rca_global_store');
    if (raw) {
      const rcaStore = JSON.parse(raw);
      if (rcaStore && typeof rcaStore === 'object') {
        for (const item of Object.values(rcaStore) as any[]) {
          if (!item || !item.questionText) continue;
          if (item.isCorrect === true || item.status === 'Correct') continue;
          const opts = extractOptionsArray(item.options);
          const correctIdx = extractCorrectOptionIndex(item.answer, opts.length || 4);
          const m: RecordedMistake = {
            id: item.id || `rca_${Date.now()}`,
            userId: userUid || 'guest',
            question: item.questionText,
            options: opts,
            correctOptionIndex: correctIdx,
            explanation: item.solution || item.explanation || '',
            subject: normalizeSubject(item.subject),
            topic: item.topic || item.mockTitle || 'Practice',
            topicSlug: (item.topic || 'practice').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            source: item.isFromMock ? 'website_mock' : 'website_quiz',
            timestamp: item.classifiedAt ? new Date(item.classifiedAt).getTime() : Date.now(),
            wrongCount: 1,
            mastered: false
          };
          addMistake(m);
        }
      }
    }
  } catch {}

  // 4. Scan local quiz results caches
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

  // 5. Firestore user_mistakes collection
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

  // 6. Filter out deleted questions
  let deletedIds = new Set<string>();
  try {
    const delRaw = safeStorage.getItem('cgl_deleted_question_ids');
    if (delRaw) {
      const arr = JSON.parse(delRaw);
      if (Array.isArray(arr)) arr.forEach(id => deletedIds.add(String(id).toLowerCase()));
    }
  } catch {}

  const finalList = Array.from(mergedMap.values()).filter(item => {
    if (isSpeedLabQuestion(item)) return false;
    if (item.id && deletedIds.has(item.id.toLowerCase())) return false;
    if (item.question && deletedIds.has(item.question.trim().toLowerCase())) return false;
    return true;
  });

  finalList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Persist back to storage so it stays cached
  if (finalList.length > 0) {
    try {
      safeStorage.setItem(MISTAKE_NOTEBOOK_KEY, JSON.stringify(finalList));
      safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(finalList));
    } catch {}

    if (effectiveUid) {
      try {
        for (const m of finalList) {
          const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : `m_${Date.now()}`;
          setDoc(doc(db, `user_mistakes_${effectiveUid}`, docId), m, { merge: true }).catch(() => {});
        }
      } catch {}
    }
  }

  return finalList;
}
