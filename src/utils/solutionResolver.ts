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

export function isGenericPrompt(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  if (clean.length > 140) return false;
  return /^(select|choose|identify|find)\s+(the\s+)?(most\s+appropriate\s+)?(synonym|antonym|meaning|correctly\s*spelt|incorrectly\s*spelt|option|part|sentence|alternative|word)/i.test(clean) ||
         /^(what\s+does\s+the\s+idiom|which\s+of\s+the\s+following\s+is\s+a\s+one-word)/i.test(clean);
}

export function getOptionsKey(options: any): string {
  if (!options || typeof options !== 'object') return '';
  const vals = Object.values(options)
    .map(v => typeof v === 'string' ? v.trim().toLowerCase() : '')
    .filter(Boolean);
  if (vals.length === 0) return '';
  return Array.from(new Set(vals)).sort().join('|');
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
    const stripped = normalizeQuestionKey(qText);
    const optKey = getOptionsKey(q.options);

    // If options are available, register composite key (collision-proof)
    if (optKey) {
      registerSolution(rawLower + '::' + optKey, cleanSol);
      if (stripped) {
        registerSolution(stripped + '::' + optKey, cleanSol);
      }
    }

    // Only register bare question text if it is NOT a generic template prompt
    if (!isGenericPrompt(rawLower)) {
      registerSolution(rawLower, cleanSol);
      if (stripped) {
        registerSolution(stripped, cleanSol);
      }
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

// Eager bundled mock modules: ensures all mock tests (including Oliveboard live tests) have 100% synchronous solution availability
const eagerMockModules = import.meta.glob('../data/mock_questions/*.json', { eager: true });
let eagerIndex: Map<string, string> | null = null;

function getEagerMap(): Map<string, string> {
  if (eagerIndex) return eagerIndex;
  eagerIndex = new Map<string, string>();
  for (const [, mod] of Object.entries(eagerMockModules)) {
    const raw = (mod as any)?.default || mod;
    const list = Array.isArray(raw) ? raw : (raw?.questions || raw?.data || []);
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const sol = b.solution || b.explanation || b.sol || b.detailedSolution || b.detailed_solution;
        if (sol && typeof sol === 'string' && sol.trim().length > 3) {
          const cleanSol = sol.trim();
          if (b.id) eagerIndex.set(b.id, cleanSol);
          const qText = b.question || b.questionText;
          if (qText) {
            const rawLower = qText.trim().toLowerCase();
            const stripped = normalizeQuestionKey(qText);
            const optKey = getOptionsKey(b.options);
            if (optKey) {
              eagerIndex.set(rawLower + '::' + optKey, cleanSol);
              if (stripped) eagerIndex.set(stripped + '::' + optKey, cleanSol);
            }
            if (!isGenericPrompt(rawLower)) {
              eagerIndex.set(rawLower, cleanSol);
              if (stripped) eagerIndex.set(stripped, cleanSol);
            }
          }
        }
      }
    }
  }
  return eagerIndex;
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
        const rawLower = qText.trim().toLowerCase();
        const stripped = normalizeQuestionKey(qText);
        const optKey = getOptionsKey(b.options);
        if (optKey) {
          bundledIndex.set(rawLower + '::' + optKey, cleanSol);
          if (stripped) bundledIndex.set(stripped + '::' + optKey, cleanSol);
        }
        if (!isGenericPrompt(rawLower)) {
          bundledIndex.set(rawLower, cleanSol);
          if (stripped) bundledIndex.set(stripped, cleanSol);
        }
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
  q: { id?: string; question?: string; questionText?: string; explanation?: string; solution?: string; sol?: string; detailedSolution?: string; mockId?: string; testId?: string; options?: any; [key: string]: any }
): string {
  if (!q) return '';

  // Tier 1: Direct property on question
  const direct = q.explanation || q.solution || q.sol || q.detailedSolution || (q as any).detailed_solution;
  if (direct && typeof direct === 'string' && direct.trim().length > 3) {
    return direct.trim();
  }

  // Tier 2: Check solution index by ID (O(1))
  if (q.id && solutionIndex.has(q.id)) {
    return solutionIndex.get(q.id)!;
  }

  const qText = q.question || q.questionText || '';
  const optKey = getOptionsKey(q.options);

  if (qText) {
    const rawLower = qText.trim().toLowerCase();
    const stripped = normalizeQuestionKey(qText);

    // Check composite key with options first (highest accuracy)
    if (optKey) {
      if (solutionIndex.has(rawLower + '::' + optKey)) {
        return solutionIndex.get(rawLower + '::' + optKey)!;
      }
      if (stripped && solutionIndex.has(stripped + '::' + optKey)) {
        return solutionIndex.get(stripped + '::' + optKey)!;
      }
    }

    // Only fallback to bare question text if NOT a generic template prompt
    if (!isGenericPrompt(rawLower)) {
      if (solutionIndex.has(rawLower)) {
        return solutionIndex.get(rawLower)!;
      }
      if (stripped && solutionIndex.has(stripped)) {
        return solutionIndex.get(stripped)!;
      }
    }
  }

  // Tier 2.5: Synchronous lookup across all bundled mock modules (O(1))
  const eMap = getEagerMap();
  if (eMap.size > 0) {
    if (q.id && eMap.has(q.id)) {
      const sol = eMap.get(q.id)!;
      solutionIndex.set(q.id, sol);
      return sol;
    }
    if (qText) {
      const rawLower = qText.trim().toLowerCase();
      const stripped = normalizeQuestionKey(qText);
      if (optKey) {
        if (eMap.has(rawLower + '::' + optKey)) {
          const sol = eMap.get(rawLower + '::' + optKey)!;
          solutionIndex.set(rawLower + '::' + optKey, sol);
          return sol;
        }
        if (stripped && eMap.has(stripped + '::' + optKey)) {
          const sol = eMap.get(stripped + '::' + optKey)!;
          solutionIndex.set(stripped + '::' + optKey, sol);
          return sol;
        }
      }
      if (!isGenericPrompt(rawLower)) {
        if (eMap.has(rawLower)) {
          const sol = eMap.get(rawLower)!;
          solutionIndex.set(rawLower, sol);
          return sol;
        }
        if (stripped && eMap.has(stripped)) {
          const sol = eMap.get(stripped)!;
          solutionIndex.set(stripped, sol);
          return sol;
        }
      }
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
      const stripped = normalizeQuestionKey(qText);
      if (optKey) {
        if (bMap.has(rawLower + '::' + optKey)) {
          const sol = bMap.get(rawLower + '::' + optKey)!;
          solutionIndex.set(rawLower + '::' + optKey, sol);
          return sol;
        }
        if (stripped && bMap.has(stripped + '::' + optKey)) {
          const sol = bMap.get(stripped + '::' + optKey)!;
          solutionIndex.set(stripped + '::' + optKey, sol);
          return sol;
        }
      }
      if (!isGenericPrompt(rawLower)) {
        if (bMap.has(rawLower)) {
          const sol = bMap.get(rawLower)!;
          solutionIndex.set(rawLower, sol);
          return sol;
        }
        if (stripped && bMap.has(stripped)) {
          const sol = bMap.get(stripped)!;
          solutionIndex.set(stripped, sol);
          return sol;
        }
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
          const itOptsKey = getOptionsKey(it.options);
          const sameOpts = optKey && itOptsKey ? optKey === itOptsKey : true;
          const sameId = q.id && it.id === q.id;
          const sameText = stripped && normalizeQuestionKey(it.question || it.questionText) === stripped && sameOpts;

          if (sameId || sameText) {
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

export const resolveSolutionSync = resolveQuestionSolution;

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
