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

// Pre-indexed map for synchronous bundled mock questions to avoid O(N*M) linear scans
let bundledIndex: Map<string, string> | null = null;
let lastBundledRef: any[] | null = null;

function getBundledMap(): Map<string, string> {
  const bundled = getCachedBundledQuestionsSync();
  if (bundledIndex && lastBundledRef === bundled) {
    return bundledIndex;
  }
  bundledIndex = new Map<string, string>();
  lastBundledRef = bundled;
  for (let i = 0; i < bundled.length; i++) {
    const b = bundled[i];
    const sol = b.solution || b.explanation || b.sol;
    if (sol && typeof sol === 'string' && sol.trim().length > 3) {
      const cleanSol = sol.trim();
      if (b.id) bundledIndex.set(b.id, cleanSol);
      const qText = b.question || b.questionText;
      if (qText) {
        bundledIndex.set(qText.trim().toLowerCase(), cleanSol);
        const stripped = normalizeQuestionKey(qText);
        if (stripped) bundledIndex.set(stripped, cleanSol);
      }
    }
  }
  return bundledIndex;
}

const mockStorageCache = new Map<string, any[]>();

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

  // Tier 2: Check solution index (O(1))
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

  // Tier 3: Sync check bundled mock questions via O(1) indexed map
  const bMap = getBundledMap();
  if (bMap.size > 0) {
    if (q.id && bMap.has(q.id)) {
      const sol = bMap.get(q.id)!;
      solutionIndex.set(q.id, sol);
      return sol;
    }
    if (qText) {
      const rawLower = qText.trim().toLowerCase();
      if (bMap.has(rawLower)) {
        const sol = bMap.get(rawLower)!;
        solutionIndex.set(rawLower, sol);
        return sol;
      }
      const stripped = normalizeQuestionKey(qText);
      if (stripped && bMap.has(stripped)) {
        const sol = bMap.get(stripped)!;
        solutionIndex.set(stripped, sol);
        return sol;
      }
    }
  }

  // Tier 4: Check local storage mock questions with memoized JSON parsing
  const mId = q.mockId || q.testId;
  if (mId) {
    try {
      let list = mockStorageCache.get(mId);
      if (!list) {
        const raw = safeStorage.getItem(`cgl_mock_questions_${mId}`);
        if (raw) {
          list = JSON.parse(raw);
          if (Array.isArray(list)) {
            mockStorageCache.set(mId, list);
          }
        }
      }
      if (Array.isArray(list)) {
        const stripped = qText ? normalizeQuestionKey(qText) : '';
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          if ((q.id && it.id === q.id) || (stripped && normalizeQuestionKey(it.question || it.questionText) === stripped)) {
            const foundSol = it.solution || it.explanation || it.sol;
            if (foundSol && typeof foundSol === 'string' && foundSol.trim().length > 3) {
              registerQuestion(it);
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
