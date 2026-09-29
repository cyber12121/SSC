import { safeStorage } from './safeStorage';
import { getCachedData } from './cache';
import { SubjectData, Chapter, Question } from '../types';
import { loadAllBundledMockQuestions, getCachedBundledQuestionsSync, getAllCachedMockQuestions } from './mockErrorAggregator';
import { RecordedMistake } from './mistakeRecorder';

// In-memory solution lookup cache: keyed by q.id, exact normalized text, and stripped text
const solutionIndex = new Map<string, string>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export function normalizeQuestionKey(text: string): string {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/[\$\\\{\}\_\^\s\.,\-\?!;:'"()\[\]]/g, '');
}

function registerSolution(key: string | undefined, solution: string | undefined) {
  if (!key || !solution || typeof solution !== 'string') return;
  const cleanSol = solution.trim();
  if (cleanSol.length < 3) return;

  if (!solutionIndex.has(key)) {
    solutionIndex.set(key, cleanSol);
  }
}

function registerQuestion(q: any) {
  if (!q) return;
  const sol = q.solution || q.explanation || q.sol || q.detailedSolution || q.detailed_solution;
  if (!sol || typeof sol !== 'string' || sol.trim().length < 3) return;

  const cleanSol = sol.trim();
  if (q.id) {
    registerSolution(q.id, cleanSol);
  }
  const qText = q.question || q.questionText || '';
  if (qText) {
    const rawLower = qText.trim().toLowerCase();
    registerSolution(rawLower, cleanSol);
    const stripped = normalizeQuestionKey(qText);
    if (stripped) {
      registerSolution(stripped, cleanSol);
    }
  }
}

/**
 * Initializes and populates the solution lookup index from all available sources:
 * 1. Cached user mock attempts in safeStorage
 * 2. Bundled mock tests (api / static)
 * 3. Chapter Bank & Mock Errors in IndexedDB / App cache
 */
export async function initSolutionResolver(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Index from cached user mock attempts
      const cachedMocks = getAllCachedMockQuestions();
      cachedMocks.forEach(registerQuestion);

      // 2. Index from bundled mock tests
      const bundledMocks = await loadAllBundledMockQuestions();
      bundledMocks.forEach(registerQuestion);

      // 3. Index from IndexedDB / subject cache (chapter_bank + mock_errors)
      try {
        const cachedSubjectData = await getCachedData<{ rawMockData: SubjectData; rawBankData: SubjectData }>();
        if (cachedSubjectData) {
          const indexSubjectData = (data: SubjectData) => {
            Object.values(data || {}).forEach((chapters: Chapter[]) => {
              if (!Array.isArray(chapters)) return;
              chapters.forEach(ch => {
                (ch.questions || []).forEach(registerQuestion);
              });
            });
          };
          if (cachedSubjectData.rawMockData) indexSubjectData(cachedSubjectData.rawMockData);
          if (cachedSubjectData.rawBankData) indexSubjectData(cachedSubjectData.rawBankData);
        }
      } catch {}

      // 4. Index from global RCA store (if solutions were stored)
      try {
        const rawRca = safeStorage.getItem('cgl_rca_global_store');
        if (rawRca) {
          const rcaMap = JSON.parse(rawRca);
          Object.entries(rcaMap).forEach(([k, v]: [string, any]) => {
            if (v && (v.solution || v.explanation || v.sol)) {
              registerSolution(k, v.solution || v.explanation || v.sol);
            }
          });
        }
      } catch {}

      isInitialized = true;
    } catch (e) {
      console.warn('[solutionResolver] Error initializing solution resolver:', e);
    }
  })();

  return initPromise;
}

/**
 * Synchronously or best-effort resolves a question's solution.
 */
export function resolveQuestionSolution(
  q: { id?: string; question?: string; questionText?: string; explanation?: string; solution?: string; sol?: string; detailedSolution?: string; mockId?: string; testId?: string; [key: string]: any }
): string {
  if (!q) return '';

  // Tier 1: Direct property on question
  const direct = q.explanation || q.solution || q.sol || q.detailedSolution || (q as any).detailed_solution;
  if (direct && typeof direct === 'string' && direct.trim().length > 3) {
    return direct.trim();
  }

  // Tier 2: Check solution index
  if (q.id && solutionIndex.has(q.id)) {
    return solutionIndex.get(q.id)!;
  }

  const qText = q.question || q.questionText || '';
  if (qText) {
    const rawLower = qText.trim().toLowerCase();
    if (solutionIndex.has(rawLower)) {
      return solutionIndex.get(rawLower)!;
    }
    const stripped = normalizeQuestionKey(qText);
    if (stripped && solutionIndex.has(stripped)) {
      return solutionIndex.get(stripped)!;
    }
  }

  // Tier 3: Sync check bundled mock questions if index was populated
  const bundled = getCachedBundledQuestionsSync();
  if (bundled.length > 0) {
    const stripped = normalizeQuestionKey(qText);
    const match = bundled.find(b => {
      if (q.id && b.id === q.id) return true;
      if (stripped && normalizeQuestionKey(b.question || b.questionText) === stripped) return true;
      return false;
    });
    if (match) {
      const matchSol = match.solution || match.explanation || match.sol;
      if (matchSol && typeof matchSol === 'string' && matchSol.trim().length > 3) {
        registerQuestion(match);
        return matchSol.trim();
      }
    }
  }

  // Tier 4: Safe check in local storage mock questions
  const mId = q.mockId || q.testId;
  if (mId) {
    try {
      const raw = safeStorage.getItem(`cgl_mock_questions_${mId}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const stripped = normalizeQuestionKey(qText);
          const found = list.find((it: any) => {
            if (q.id && it.id === q.id) return true;
            if (stripped && normalizeQuestionKey(it.question || it.questionText) === stripped) return true;
            return false;
          });
          if (found) {
            const foundSol = found.solution || found.explanation || found.sol;
            if (foundSol && typeof foundSol === 'string' && foundSol.trim().length > 3) {
              registerQuestion(found);
              return foundSol.trim();
            }
          }
        }
      }
    } catch {}
  }

  return '';
}

/**
 * Rehydrates missing explanations in a list of RecordedMistake items.
 * Returns a new list with enriched explanations where available.
 */
export function rehydrateMistakesSolutions(mistakes: RecordedMistake[]): RecordedMistake[] {
  let changed = false;
  const updated = mistakes.map(m => {
    if (m.explanation && m.explanation.trim().length > 5) {
      return m;
    }
    const resolved = resolveQuestionSolution(m);
    if (resolved && resolved.length > 5) {
      changed = true;
      return {
        ...m,
        explanation: resolved
      };
    }
    return m;
  });

  return changed ? updated : mistakes;
}
